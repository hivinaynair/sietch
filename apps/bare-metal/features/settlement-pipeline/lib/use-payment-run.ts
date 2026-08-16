"use client";

import { useState, useTransition } from "react";
import { resultFailureStep } from "@/lib/settlement-status";
import type { DemoAgent, DemoScenario, TriggerResult } from "./payment-demo";
import { fallbackRouteForAgent } from "./payment-demo";
import { takeSseEvents } from "./sse-events";

export function usePaymentRun({
  selectedIndex,
  selectedScenario,
  selectedAgent,
}: {
  selectedIndex: number;
  selectedScenario: DemoScenario;
  selectedAgent: DemoAgent;
}) {
  const [isPending, startTransition] = useTransition();
  const [animStep, setAnimStep] = useState(0);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [agentReasoning, setAgentReasoning] = useState("");

  const approved = result?.httpStatus === 200;
  const activeStep = isPending ? animStep : result ? (approved ? 6 : resultFailureStep(result)) : 0;

  function resetRunState() {
    setAnimStep(0);
    setResult(null);
    setAgentReasoning("");
  }

  function runDemo() {
    startTransition(async () => {
      resetRunState();

      try {
        const response = await fetch("/api/trigger-payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioIndex: selectedIndex }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }
        if (!response.body) throw new Error("No response stream");

        const reader = response.body.getReader();
        const dec = new TextDecoder();
        let buffer = "";

        const apply = (chunk: string, flush = false) => {
          const next = takeSseEvents(buffer, chunk, flush);
          buffer = next.buffer;
          for (const event of next.events) {
            if (event.type === "token") {
              setAgentReasoning((prev) => prev + event.text);
            } else if (event.type === "gate") {
              setAnimStep(event.step);
            } else {
              setResult({ ...event.result, completedAt: new Date().toISOString() });
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            apply(dec.decode(), true);
            break;
          }
          apply(dec.decode(value, { stream: true }));
        }
      } catch (err) {
        setResult({
          slot: selectedScenario.slot,
          agent: selectedAgent,
          route: {
            ...fallbackRouteForAgent(selectedAgent),
            id: "unknown",
            path: "/api/trigger-payment",
          },
          httpStatus: 500,
          body: { error: String(err) },
        });
      }
    });
  }

  return {
    activeStep,
    agentReasoning,
    approved,
    loading: isPending,
    resetRunState,
    result,
    runDemo,
  };
}
