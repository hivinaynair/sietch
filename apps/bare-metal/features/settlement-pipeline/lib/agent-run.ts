import { BASE_SEPOLIA_EXPLORER } from "@repo/metal-shared/chains";
import { getDecisionRecord } from "@repo/metal-shared/facilitator";
import type { DemoAgentName, RawMandate, X402Challenge } from "@repo/metal-shared/types";
import type { HandleMessageStreamEvent } from "eve/client";
import { gateStepsForResult } from "./gate-steps";

/** Exact tool output for the demo's paid fetch, read off `action.result`. */
export type PaidRunOutcome = {
  authorizationNonce?: string;
  body?: unknown;
  error?: string;
  httpStatus?: number;
  payer: string;
  rawMandate?: RawMandate;
  settlementTxHash?: string;
  x402Challenge?: X402Challenge;
};

export function demoPrompt(agentName: DemoAgentName, targetUrl: string) {
  return [
    `You are ${agentName}, a Metal settlement agent on Base Sepolia.`,
    "Someone asked: is it going to rain in Melbourne at 1 PM tomorrow?",
    `Call fetch_paid_resource with agentName exactly "${agentName}" and url exactly "${targetUrl}".`,
    "You propose payments. The facilitator decides whether money moves. Never invent a transaction hash.",
    "If the tool is denied, report the denial reason and stop. Do not buy any other URL.",
    "If the paid JSON returns, answer the rain question only from willRainAt1Pm. Never invent weather.",
  ].join(" ");
}

function sameResource(a: string, b: string) {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

function unwrapToolOutput(output: unknown): Record<string, unknown> | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) return undefined;
  const record = output as Record<string, unknown>;
  if (
    record.type === "json" &&
    record.value &&
    typeof record.value === "object" &&
    !Array.isArray(record.value)
  ) {
    return record.value as Record<string, unknown>;
  }
  return record;
}

function toolNameOf(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const record = result as Record<string, unknown>;
  if (typeof record.toolName === "string") return record.toolName;
  if (typeof record.name === "string") return record.name;
  return undefined;
}

/**
 * Pulls the demo's primary payment outcome out of a typed `action.result`
 * event. Financial fields are copied verbatim from the tool result rather than
 * from model text, so a hallucinated hash can never reach the UI.
 */
export function outcomeFromEvent(
  event: Extract<HandleMessageStreamEvent, { type: "action.result" }>,
  targetUrl: string,
  payerFallback: string,
): PaidRunOutcome | undefined {
  const name = toolNameOf(event.data.result);
  if (typeof name !== "string" || !name.includes("fetch_paid_resource")) return undefined;

  const result = event.data.result as { output?: unknown };
  const out = unwrapToolOutput(result.output) ?? {};

  const url = typeof out.url === "string" ? out.url : undefined;
  if (url && !sameResource(url, targetUrl)) return undefined;

  const denialReason =
    out.type === "denied" && typeof out.reason === "string" ? out.reason : undefined;
  const streamError =
    event.data.status === "rejected" || event.data.status === "failed"
      ? event.data.error?.message
      : undefined;
  const error =
    typeof out.error === "string"
      ? out.error
      : (denialReason ?? (typeof streamError === "string" ? streamError : undefined));

  return {
    authorizationNonce:
      typeof out.authorizationNonce === "string" ? out.authorizationNonce : undefined,
    body: out.body,
    error,
    httpStatus: typeof out.status === "number" ? out.status : error ? 402 : 200,
    payer: typeof out.payer === "string" ? out.payer : payerFallback,
    rawMandate: out.rawMandate as PaidRunOutcome["rawMandate"],
    settlementTxHash: typeof out.txHash === "string" ? out.txHash : undefined,
    x402Challenge: out.x402Challenge as PaidRunOutcome["x402Challenge"],
  };
}

function explorerTxUrl(hash: string) {
  return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`;
}

export async function buildDoneResult(
  outcome: PaidRunOutcome,
  agentUrl: string,
  facilitatorUrl: string,
) {
  const decisionRecord = await getDecisionRecord({
    authorizationNonce: outcome.authorizationNonce,
    facilitatorUrl,
    payer: outcome.payer,
    settlementTxHash: outcome.settlementTxHash,
  });

  let error = outcome.error;
  let httpStatus = outcome.httpStatus;
  if (!error && decisionRecord?.policy.decision === "rejected") {
    error = decisionRecord.rejectionReason ?? "settlement_rejected";
    if (!httpStatus || httpStatus < 400) httpStatus = 402;
  }

  return {
    error,
    gates: gateStepsForResult(error, outcome.settlementTxHash),
    attestationStep: Boolean(!error && decisionRecord?.attestationTxHash),
    result: {
      payer: outcome.payer,
      agentUri: `${agentUrl.replace(/\/+$/, "")}/api/agent/${outcome.payer}`,
      settlementTxHash: outcome.settlementTxHash,
      settlementTxUrl: outcome.settlementTxHash
        ? explorerTxUrl(outcome.settlementTxHash)
        : undefined,
      attestationTxHash: decisionRecord?.attestationTxHash,
      attestationTxUrl: decisionRecord?.attestationTxHash
        ? explorerTxUrl(decisionRecord.attestationTxHash)
        : undefined,
      httpStatus,
      error,
      authorizationNonce: outcome.authorizationNonce,
      rawMandate: outcome.rawMandate,
      x402Challenge: outcome.x402Challenge,
      policyThreshold: decisionRecord?.policy.maxAmountUsdc
        ? `$${decisionRecord.policy.maxAmountUsdc}`
        : undefined,
      proofLookupError: decisionRecord ? undefined : "decision_record_not_found",
      decisionProof: decisionRecord,
      body: error ? { error } : outcome.body,
    },
  };
}
