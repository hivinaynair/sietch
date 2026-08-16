import { IdentityStatus } from "@repo/metal-shared/types";
import { GATE_STEP, reportPipelineGate } from "./pipeline-progress.js";
import { getPolicyMaxAtomic } from "./policy-store.js";
import { recordRejection, type VerifyDeps, validateMandateForPayment } from "./validate-mandate.js";

export type PreclearInput = {
  amountAtomic: bigint;
  payer: string;
  resource?: string;
};

export type PreclearResult = { ok: true } | { ok: false; reason: string };

export async function evaluatePreclear(
  input: PreclearInput,
  deps: VerifyDeps,
): Promise<PreclearResult> {
  reportPipelineGate(input.payer, GATE_STEP.PAYMENT_SUBMITTED);
  const mandateResult = await validateMandateForPayment(
    {
      payer: input.payer,
      amountAtomic: input.amountAtomic,
      resource: input.resource,
    },
    deps,
  );
  if (mandateResult.ok === false) {
    return { ok: false, reason: mandateResult.reason };
  }

  reportPipelineGate(input.payer, GATE_STEP.POLICY_CHECK);
  const policyMaxAtomic = await getPolicyMaxAtomic();
  if (input.amountAtomic > policyMaxAtomic) {
    await recordRejection({
      agentId: mandateResult.mandateEntry.agentId,
      amountAtomic: input.amountAtomic,
      identityStatus: IdentityStatus.Verified,
      mandateEntry: mandateResult.mandateEntry,
      payer: input.payer,
      reason: "policy_amount_exceeded",
      resource: input.resource,
    });
    return { ok: false, reason: "policy_amount_exceeded" };
  }

  return { ok: true };
}
