"use client";

import { Button } from "@repo/ui/components/button";
import { Play, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { PageFrame, PageHead } from "@/components/page-chrome";
import { GateDetailSheet } from "@/features/settlement-pipeline/components/gate-detail-sheet";
import {
  HomeRunPanels,
  RainAnswer,
} from "@/features/settlement-pipeline/components/home-run-panels";
import { ScenarioPicker } from "@/features/settlement-pipeline/components/scenario-picker";
import { SettlementScene } from "@/features/settlement-pipeline/components/settlement-scene";
import {
  fallbackRouteForAgent,
  SCENARIOS,
  scenarioIndexFromSearch,
} from "@/features/settlement-pipeline/lib/payment-demo";
import { buildProofBundle } from "@/features/settlement-pipeline/lib/payment-proof";
import { usePaymentRun } from "@/features/settlement-pipeline/lib/use-payment-run";
import { demoAgents } from "@/lib/demo-scenarios";
import type { TraceStep } from "@/lib/trace-steps";

export default function Page() {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    return scenarioIndexFromSearch(window.location.search);
  });
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [activeGateStep, setActiveGateStep] = useState<TraceStep | null>(null);

  const selectedScenario = SCENARIOS[selectedIndex]!;
  const selectedAgent = demoAgents.find((agent) => agent.id === selectedScenario.agentName)!;
  const { activeStep, agentReasoning, approved, loading, resetRunState, result, runDemo } =
    usePaymentRun({ selectedIndex, selectedScenario, selectedAgent });

  const proofBundle = useMemo(
    () => buildProofBundle(result, selectedAgent),
    [result, selectedAgent],
  );
  const amountLabel = result?.route.price ?? fallbackRouteForAgent(selectedAgent).price;

  async function copyProof() {
    await navigator.clipboard.writeText(proofBundle);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1500);
  }

  async function startRun() {
    setCopyState("idle");
    await runDemo();
  }

  return (
    <PageFrame>
      <PageHead
        eyebrow="The Bare-Metal rail"
        title="Compliance before settlement"
        question="Is it going to rain in Melbourne at 1 PM tomorrow?"
      />

      <ScenarioPicker
        selectedIndex={selectedIndex}
        loading={loading}
        onSelect={(index) => {
          if (loading) return;
          setSelectedIndex(index);
          resetRunState();
          setCopyState("idle");
        }}
      />

      <div className="sm:overflow-x-auto">
        <SettlementScene
          agentLabel={selectedScenario.displayAgent}
          agentStatus={selectedAgent.status === "approved" ? "Trusted" : selectedScenario.title}
          agentReasoning={agentReasoning}
          amountLabel={amountLabel}
          routeLabel={result?.route.path ?? fallbackRouteForAgent(selectedAgent).path}
          activeStep={activeStep}
          running={loading}
          approved={Boolean(approved)}
          rejectedReason={result?.body?.error}
          action={
            <Button
              size="sm"
              onClick={startRun}
              disabled={loading}
              className="h-8 rounded-md border border-foreground bg-foreground px-3 text-xs text-background hover:bg-foreground/85"
            >
              {loading ? (
                <>
                  <Zap className="h-3 w-3 animate-pulse" />
                  Running
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Run
                </>
              )}
            </Button>
          }
        />
      </div>

      <RainAnswer approved={Boolean(approved)} result={result} />

      <GateDetailSheet step={activeGateStep} onClose={() => setActiveGateStep(null)} />

      <HomeRunPanels
        result={result}
        loading={loading}
        activeStep={activeStep}
        selectedAgent={selectedAgent}
        selectedScenario={selectedScenario}
        amountLabel={amountLabel}
        proofBundle={proofBundle}
        copyState={copyState}
        onCopyProof={() => void copyProof()}
        onStepClick={setActiveGateStep}
      />
    </PageFrame>
  );
}
