import { schema } from "@repo/metal-db";
import { BASE_SEPOLIA_USDC_ADDRESS, ERC20_BALANCE_ABI } from "@repo/metal-shared/abis";
import { parseMandateHeader } from "@repo/metal-shared/mandate-header";
import { Decision, IdentityStatus } from "@repo/metal-shared/types";
import type {
  FacilitatorSettleContext,
  FacilitatorSettleFailureContext,
  FacilitatorSettleResultContext,
} from "@x402/core/facilitator";
import type { SettleResponse } from "@x402/core/types";
import { and, eq } from "drizzle-orm";
import { keccak256 } from "viem";
import { publishAttestation } from "../lib/attest.js";
import { publicClient } from "../lib/clients.js";
import { getDb } from "../lib/db.js";
import { verifyDeps } from "../lib/deps.js";
import { extractAuthNonce, getPayerAddress } from "../lib/mandate.js";
import { recordSettledPayment } from "../lib/persist-attestation.js";
import { GATE_STEP, reportPipelineGate } from "../lib/pipeline-progress.js";
import { getPolicyMaxAtomic } from "../lib/policy-store.js";
import { requestCtx } from "../lib/request-context.js";
import { recordRejection, validateMandateForPayment } from "../lib/validate-mandate.js";

const SETTLEMENT_TX_FAILED_REASON = "settlement_transaction_failed";
const SETTLEMENT_RECEIPT_UNCONFIRMED_REASON = "settlement_receipt_unconfirmed";

export async function onBeforeSettle({
  paymentPayload,
  requirements,
}: FacilitatorSettleContext): Promise<void | { abort: true; reason: string }> {
  const payer = getPayerAddress(paymentPayload.payload);
  if (!payer) return;

  const paymentAmountAtomic = BigInt(requirements.amount);
  const authorizationNonce = extractAuthNonce(paymentPayload.payload);

  const mandateResult = await validateMandateForPayment(
    {
      payer,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      resource: paymentPayload.resource,
    },
    verifyDeps,
  );
  if (mandateResult.ok === false) return { abort: true, reason: mandateResult.reason };

  const balance = await publicClient.readContract({
    address: BASE_SEPOLIA_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [payer],
    authorizationList: undefined,
  });
  console.log(`[onBeforeSettle] payer=${payer} balance=${balance} required=${paymentAmountAtomic}`);
  if (balance < paymentAmountAtomic) {
    await recordRejection({
      agentId: mandateResult.mandateEntry.agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry: mandateResult.mandateEntry,
      payer,
      reason: "insufficient_funds",
      resource: paymentPayload.resource,
    });
    return { abort: true, reason: "insufficient_funds" };
  }

  reportPipelineGate(payer, GATE_STEP.POLICY_CHECK);
  const policyMaxAtomic = await getPolicyMaxAtomic();
  if (paymentAmountAtomic > policyMaxAtomic) {
    await recordRejection({
      agentId: mandateResult.mandateEntry.agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry: mandateResult.mandateEntry,
      payer,
      reason: "policy_amount_exceeded",
      resource: paymentPayload.resource,
    });
    return { abort: true, reason: "policy_amount_exceeded" };
  }

  reportPipelineGate(payer, GATE_STEP.SETTLEMENT);
}

function settlementContext(paymentPayload: FacilitatorSettleResultContext["paymentPayload"]) {
  const payer = getPayerAddress(paymentPayload.payload);
  const { mandateJson } = requestCtx.get();
  const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined;
  return {
    payer,
    authorizationNonce: extractAuthNonce(paymentPayload.payload) ?? null,
    amountUsdc: BigInt(paymentPayload.accepted.amount),
    mandateEntry,
    identityStatus: mandateEntry ? IdentityStatus.Verified : IdentityStatus.NotFound,
    resource: paymentPayload.resource,
  };
}

async function publishAndRecord(args: {
  payer: string;
  amountUsdc: bigint;
  paymentHash: `0x${string}`;
  policyMaxAtomic: bigint;
  identityStatus: IdentityStatus;
  decision: Decision;
  authorizationNonce: string | null;
  mandateEntry?: ReturnType<typeof parseMandateHeader>;
  resource?: unknown;
  rejectionReason?: string;
  settlementTx?: `0x${string}` | null;
}) {
  const published = await publishAttestation({
    amountUsdc: args.amountUsdc,
    decision: args.decision,
    identityStatus: args.identityStatus,
    payer: args.payer,
    paymentHash: args.paymentHash,
    policyMaxAmountUsdc: args.policyMaxAtomic,
    rejectionReason: args.rejectionReason,
  });
  await recordSettledPayment({
    paymentHash: args.paymentHash,
    settlementTx: args.settlementTx ?? null,
    published,
    payer: args.payer,
    amountUsdc: args.amountUsdc,
    policyMaxAtomic: args.policyMaxAtomic,
    identityStatus: args.identityStatus,
    decision: args.decision,
    authorizationNonce: args.authorizationNonce,
    mandateEntry: args.mandateEntry,
    resource: args.resource,
    rejectionReason: args.rejectionReason,
  });
  return published;
}

export async function onAfterSettle({
  paymentPayload,
  result,
}: FacilitatorSettleResultContext): Promise<void> {
  if (!result.success) {
    const ctx = settlementContext(paymentPayload);
    if (!ctx.payer) return;
    const policyMaxAtomic = await getPolicyMaxAtomic();
    const paymentHash = keccak256(
      `0x${Buffer.from(`failed:${ctx.authorizationNonce ?? ctx.payer}`).toString("hex")}` as `0x${string}`,
    );
    await publishAndRecord({
      ...ctx,
      payer: ctx.payer,
      paymentHash,
      policyMaxAtomic,
      decision: Decision.Rejected,
      rejectionReason: result.errorReason ?? "settlement_rejected",
    });
    return;
  }
  if (!result.transaction) return;

  const ctx = settlementContext(paymentPayload);
  if (!ctx.payer) return;
  reportPipelineGate(ctx.payer, GATE_STEP.SETTLEMENT);

  const settlementTx = result.transaction as `0x${string}`;
  const paymentHash = keccak256(settlementTx);
  const receiptPromise = publicClient.waitForTransactionReceipt({ hash: settlementTx });
  const policyMaxAtomic = await getPolicyMaxAtomic();

  const record = (decision: Decision, rejectionReason?: string) =>
    publishAndRecord({
      ...ctx,
      payer: ctx.payer!,
      paymentHash,
      policyMaxAtomic,
      decision,
      rejectionReason,
      settlementTx,
    });

  let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>;
  try {
    receipt = await receiptPromise;
  } catch (err) {
    console.error("[onAfterSettle] settlement receipt lookup failed:", err);
    await record(Decision.Rejected, SETTLEMENT_RECEIPT_UNCONFIRMED_REASON);
    return;
  }

  if (receipt.status !== "success") {
    await record(Decision.Rejected, SETTLEMENT_TX_FAILED_REASON);
    return;
  }

  const published = await record(Decision.Approved);
  if (published?.attestationTx) {
    console.log("[onAfterSettle] attestation tx:", published.attestationTx);
  }
}

export async function onSettleFailure({
  paymentPayload,
  requirements,
}: FacilitatorSettleFailureContext): Promise<void | { recovered: true; result: SettleResponse }> {
  const authorizationNonce = extractAuthNonce(paymentPayload.payload);
  if (!authorizationNonce) return;

  try {
    const existing = await getDb()
      .select()
      .from(schema.settlementAttestations)
      .where(
        and(
          eq(schema.settlementAttestations.authorizationNonce, authorizationNonce),
          eq(schema.settlementAttestations.decision, Decision.Approved),
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0]!.settlementTx) {
      console.log("[onSettleFailure] duplicate detected, recovering:", authorizationNonce);
      return {
        recovered: true,
        result: {
          success: true,
          transaction: existing[0]!.settlementTx,
          network: requirements.network,
        },
      };
    }
  } catch (err) {
    console.error("[onSettleFailure] db lookup failed:", err);
  }
}
