import { GATE_STEP } from "@repo/metal-shared/settlement-errors";

type Progress = { gate: number; at: number };

const progress = new Map<string, Progress>();

export function reportPipelineGate(payer: string, gate: number) {
  if (!payer.startsWith("0x")) return;
  const key = payer.toLowerCase();
  const current = progress.get(key);
  if (current && gate < current.gate) return;
  progress.set(key, { gate, at: Date.now() });
}

export function pipelineGateFor(payer: string, sinceMs = 0) {
  const row = progress.get(payer.toLowerCase());
  if (!row) return 0;
  if (row.at < sinceMs) return 0;
  return row.gate;
}

export { GATE_STEP };
