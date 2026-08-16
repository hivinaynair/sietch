import { ATTESTATION_REGISTRY_ABI } from "@repo/metal-shared/abis";
import { buildCommitment, committedRecordFrom, randomSalt } from "@repo/metal-shared/commitment";
import type { Decision, IdentityStatus } from "@repo/metal-shared/types";

export interface PublishedAttestation {
  attestationTx: string;
  commitment: `0x${string}`;
  salt: `0x${string}`;
}

export async function publishAttestation({
  amountUsdc,
  decision,
  identityStatus,
  payer,
  paymentHash,
  policyMaxAmountUsdc,
  rejectionReason,
}: {
  amountUsdc: bigint;
  decision: Decision;
  identityStatus: IdentityStatus;
  payer: string;
  paymentHash: `0x${string}`;
  policyMaxAmountUsdc: bigint;
  rejectionReason?: string;
}): Promise<PublishedAttestation | null> {
  const salt = randomSalt();
  const commitment = buildCommitment(
    committedRecordFrom({
      paymentHash,
      payer,
      amountUsdc,
      policyMaxAmountUsdc,
      identityStatus,
      decision,
      rejectionReason,
    }),
    salt,
  );
  try {
    const { account, walletClient } = await import("./clients.js");
    const { env } = await import("../env.js");
    const { reportPipelineGate, GATE_STEP } = await import("./pipeline-progress.js");
    const attestationTx = await walletClient.writeContract({
      address: env.ATTESTATION_REGISTRY_ADDRESS,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "attest",
      args: [commitment],
      chain: null,
      account,
    });
    reportPipelineGate(payer, GATE_STEP.ATTESTATION);
    return { attestationTx, commitment, salt };
  } catch (err) {
    console.error("[publishAttestation] failed:", err);
    return null;
  }
}
