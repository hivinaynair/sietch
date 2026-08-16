import type { DecisionProof, RawMandate, X402Challenge } from "@repo/metal-shared/types";
import type { demoAgents } from "@/lib/demo-scenarios";

export const SCENARIOS = [
  {
    agentName: "metal-agent-1",
    slot: "A",
    title: "Happy path",
    displayAgent: "metal-agent-1",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
  {
    agentName: "metal-agent-2",
    slot: "B",
    title: "Mandate exceeded",
    displayAgent: "metal-agent-2",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
  {
    agentName: "metal-agent-3",
    slot: "C",
    title: "Policy exceeded",
    displayAgent: "metal-agent-3",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
  {
    agentName: "metal-agent-ghost",
    slot: "D",
    title: "Unregistered agent",
    displayAgent: "metal-agent-ghost",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
] as const;

export interface TriggerResult {
  slot: string;
  agent: DemoAgent | null;
  route: { id: string; path: string; price: string };
  httpStatus: number;
  agentKey?: string;
  payer?: string;
  agentUri?: string;
  mandateDelegator?: string;
  mandateValid?: boolean;
  authorizationNonce?: string;
  policyThreshold?: string;
  proofLookupError?: string;
  settlementTxHash?: string;
  settlementTxUrl?: string;
  attestationTxHash?: string;
  attestationTxUrl?: string;
  decisionProof?: DecisionProof;
  rawMandate?: RawMandate;
  x402Challenge?: X402Challenge;
  completedAt?: string;
  body?: {
    error?: string;
    willRainAt1Pm?: boolean;
    rainProbabilityPercent?: number;
    temperatureC?: number;
    recommendation?: string;
    objective?: string;
    city?: string;
  };
}

export type DemoScenario = (typeof SCENARIOS)[number];
export type DemoAgent = (typeof demoAgents)[number];

export function scenarioIndexFromSearch(search: string) {
  const requestedScenario = Number(new URLSearchParams(search).get("scenario") ?? 0);
  return Number.isInteger(requestedScenario)
    ? Math.min(Math.max(requestedScenario, 0), SCENARIOS.length - 1)
    : 0;
}

const FALLBACK_ROUTES = {
  premium: { id: "premium", path: "/api/weather/rooftop-brief", price: "$5.00" },
  basic: { id: "basic", path: "/api/weather/public", price: "$0.20" },
} as const;

export function fallbackRouteForAgent(agent: DemoAgent) {
  return FALLBACK_ROUTES[agent.route.startsWith("Rooftop") ? "premium" : "basic"];
}
