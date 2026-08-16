import { buildDecisionRecord } from "@repo/metal-shared/decision-record";
import type { lookupIdentity } from "@repo/metal-shared/identity";
import type { MandateHeaderValue } from "@repo/metal-shared/mandate-header";
import { parseMandateHeader } from "@repo/metal-shared/mandate-header";
import { Decision, IdentityStatus } from "@repo/metal-shared/types";
import type { PublicClient } from "viem";
import { keccak256 } from "viem";
import { publishAttestation } from "./attest.js";
import { USDC_ATOMIC_FACTOR, type verifyMandateSignature } from "./mandate.js";
import { persistAttestationRow } from "./persist-attestation.js";
import { GATE_STEP, reportPipelineGate } from "./pipeline-progress.js";
import { getPolicyMaxAtomic } from "./policy-store.js";
import { requestCtx } from "./request-context.js";

export interface VerifyDeps {
  verifyMandateSignature: typeof verifyMandateSignature;
  lookupIdentity: typeof lookupIdentity;
  registryAddress: `0x${string}`;
  client: Pick<PublicClient, "readContract">;
}

export function buildVerifyRejectionPaymentHash({
  amountAtomic,
  authorizationNonce,
  payer,
  reason,
  resource,
}: {
  amountAtomic: bigint;
  authorizationNonce?: string;
  payer: string;
  reason: string;
  resource?: unknown;
}) {
  const hashSeed = authorizationNonce
    ? `${payer}-${amountAtomic}-${authorizationNonce}-${reason}`
    : `${payer}-${amountAtomic}-${reason}-${String(resource ?? "")}`;
  return keccak256(new TextEncoder().encode(hashSeed) as unknown as `0x${string}`);
}

export async function recordRejection({
  agentId,
  amountAtomic,
  authorizationNonce,
  identityStatus,
  mandateEntry,
  payer,
  reason,
  resource,
}: {
  agentId?: bigint;
  amountAtomic: bigint;
  authorizationNonce?: string;
  identityStatus: IdentityStatus;
  mandateEntry?: MandateHeaderValue;
  payer: string;
  reason: string;
  resource?: unknown;
}) {
  const paymentHash = buildVerifyRejectionPaymentHash({
    amountAtomic,
    authorizationNonce,
    payer,
    reason,
    resource,
  });
  const policyMaxAtomic = await getPolicyMaxAtomic();
  const published = await publishAttestation({
    amountUsdc: amountAtomic,
    decision: Decision.Rejected,
    identityStatus,
    payer,
    paymentHash,
    policyMaxAmountUsdc: policyMaxAtomic,
    rejectionReason: reason,
  });
  const decisionRecord = buildDecisionRecord({
    agentId,
    amountAtomic,
    decision: Decision.Rejected,
    identityStatus,
    mandate: mandateEntry?.mandate,
    payer,
    paymentHash,
    authorizationNonce,
    policyMaxAtomic,
    resource,
    rejectionReason: reason,
    attestationTxHash: published?.attestationTx ?? null,
  });
  await persistAttestationRow({
    paymentHash,
    published,
    payer,
    amountUsdc: amountAtomic,
    policyMaxAmountUsdc: policyMaxAtomic,
    decisionRecord,
    identityStatus,
    decision: Decision.Rejected,
    authorizationNonce,
  });
}

export type ValidateMandateResult =
  | { ok: true; mandateEntry: MandateHeaderValue }
  | { ok: false; abort: true; reason: string };

export async function validateMandateForPayment(
  {
    payer,
    amountAtomic,
    authorizationNonce,
    resource,
  }: {
    payer: string;
    amountAtomic: bigint;
    authorizationNonce?: string;
    resource?: unknown;
  },
  deps: VerifyDeps,
): Promise<ValidateMandateResult> {
  const { mandateJson } = requestCtx.get();
  const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined;

  const reject = async (
    reason: string,
    identityStatus: IdentityStatus,
    extra?: { agentId?: bigint; mandateEntry?: MandateHeaderValue },
  ): Promise<ValidateMandateResult> => {
    await recordRejection({
      amountAtomic,
      authorizationNonce,
      identityStatus,
      payer,
      reason,
      resource,
      ...extra,
    });
    return { ok: false, abort: true, reason };
  };

  if (!mandateEntry) {
    reportPipelineGate(payer, GATE_STEP.MANDATE_CHECK);
    return reject("mandate_missing", IdentityStatus.NotFound);
  }

  const { mandate, agentId } = mandateEntry;

  const isValidSig = await deps.verifyMandateSignature(mandate);
  if (!isValidSig || mandate.payload.agent.toLowerCase() !== payer.toLowerCase()) {
    reportPipelineGate(payer, GATE_STEP.MANDATE_CHECK);
    return reject("mandate_invalid", IdentityStatus.NotFound, { agentId, mandateEntry });
  }

  reportPipelineGate(payer, GATE_STEP.IDENTITY_CHECK);
  const profile = await deps.lookupIdentity(agentId, deps.registryAddress, deps.client);
  if (!profile || profile.wallet.toLowerCase() !== payer.toLowerCase()) {
    return reject("identity_not_found", IdentityStatus.NotFound, { agentId, mandateEntry });
  }

  reportPipelineGate(payer, GATE_STEP.MANDATE_CHECK);
  if (mandate.payload.expiry < BigInt(Math.floor(Date.now() / 1000))) {
    return reject("mandate_expired", IdentityStatus.Verified, { agentId, mandateEntry });
  }

  const mandateMaxAtomic = mandate.payload.maxAmountUsdc * USDC_ATOMIC_FACTOR;
  if (amountAtomic > mandateMaxAtomic) {
    return reject("mandate_amount_exceeded", IdentityStatus.Verified, { agentId, mandateEntry });
  }

  return { ok: true, mandateEntry };
}
