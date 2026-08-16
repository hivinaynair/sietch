import { describe, expect, it } from "bun:test";
import { GATE_STEP, pipelineGateFor, reportPipelineGate } from "./pipeline-progress";

const PAYER = "0xBf43C2E070BeCF6F5eAC23787813c9ad8747Be46";

describe("pipeline progress", () => {
  it("records the live gate for a payer, monotonically", () => {
    reportPipelineGate(PAYER, GATE_STEP.IDENTITY_CHECK);
    expect(pipelineGateFor(PAYER)).toBe(GATE_STEP.IDENTITY_CHECK);

    reportPipelineGate(PAYER, GATE_STEP.MANDATE_CHECK);
    expect(pipelineGateFor(PAYER)).toBe(GATE_STEP.MANDATE_CHECK);

    reportPipelineGate(PAYER, GATE_STEP.IDENTITY_CHECK);
    expect(pipelineGateFor(PAYER)).toBe(GATE_STEP.MANDATE_CHECK);
  });

  it("ignores stale rows from a previous run", () => {
    reportPipelineGate(PAYER, GATE_STEP.ATTESTATION);
    const since = Date.now() + 5;
    expect(pipelineGateFor(PAYER, since)).toBe(0);
  });
});
