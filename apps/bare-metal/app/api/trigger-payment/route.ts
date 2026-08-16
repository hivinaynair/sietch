import { schema } from "@repo/metal-db";
import {
  DEMO_AGENT_ROUTE,
  DEMO_SCENARIO_AGENTS,
  getDemoReportRoute,
} from "@repo/metal-shared/demo";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { env } from "@/env";
import {
  buildDoneResult,
  demoPrompt,
  outcomeFromEvent,
  type PaidRunOutcome,
} from "@/features/settlement-pipeline/lib/agent-run";
import { readLivePipelineGate } from "@/features/settlement-pipeline/lib/live-pipeline-gate";
import { getDb } from "@/lib/db";
import { demoAgents } from "@/lib/demo-scenarios";
import { isMandateFailure } from "@/lib/settlement-status";

export const maxDuration = 120;

const enc = new TextEncoder();

function sseLine(obj: unknown) {
  return enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Bootstrapped wallet for an agent, used only when the run never paid. */
async function payerFallback(agentName: string) {
  const [row] = await getDb()
    .select({ address: schema.agents.address })
    .from(schema.agents)
    .where(eq(schema.agents.name, agentName))
    .limit(1);
  return row?.address ?? "0x";
}

export async function POST(request: Request) {
  let scenarioIndex = 0;
  try {
    const body = (await request.json()) as { scenarioIndex?: unknown };
    if (typeof body.scenarioIndex === "number" && Number.isInteger(body.scenarioIndex)) {
      scenarioIndex = Math.min(Math.max(body.scenarioIndex, 0), DEMO_SCENARIO_AGENTS.length - 1);
    }
  } catch {
    /* no body */
  }

  const agentName = DEMO_SCENARIO_AGENTS[scenarioIndex]!;
  const route = getDemoReportRoute(DEMO_AGENT_ROUTE[agentName]);
  const targetUrl = `${new URL(request.url).origin}${route.path}`;

  const demoAgent = demoAgents.find((a) => a.id === agentName);
  const slot = (["A", "B", "C", "D"] as const)[scenarioIndex];

  const sharedSecret = env.METAL_AGENT_SHARED_SECRET?.trim();
  const client = new Client({
    host: env.AGENT_URL,
    ...(sharedSecret ? { auth: { basic: { username: "metal-web", password: sharedSecret } } } : {}),
  });

  const stream = new ReadableStream({
    async start(controller) {
      const finish = (result: Record<string, unknown>) => {
        const error = result["error"];
        controller.enqueue(
          sseLine({
            type: "done",
            result: {
              slot,
              agentKey: agentName,
              agent: demoAgent,
              route: { id: route.id, path: route.path, price: route.priceLabel },
              mandateValid: !isMandateFailure(error),
              ...result,
              body: error ? { error } : result["body"],
            },
          }),
        );
      };

      controller.enqueue(sseLine({ type: "gate", step: 0 }));

      const payer = await payerFallback(agentName);
      const runStartedAt = Date.now();
      let lastGate = 0;

      const flushLiveGates = async () => {
        if (payer === "0x") return;
        const gate = await readLivePipelineGate(env.FACILITATOR_URL, payer, runStartedAt);
        if (gate > lastGate) {
          lastGate = gate;
          controller.enqueue(sseLine({ type: "gate", step: gate }));
        }
      };

      const poll = setInterval(() => {
        flushLiveGates().catch(() => undefined);
      }, 80);

      try {
        const response = await client.session().send(demoPrompt(agentName, targetUrl));

        let primary: PaidRunOutcome | undefined;
        for await (const event of response) {
          if (event.type === "message.appended") {
            controller.enqueue(sseLine({ type: "token", text: event.data.messageDelta }));
          } else if (event.type === "action.result" && !primary) {
            const outcome = outcomeFromEvent(event, targetUrl, payer);
            if (outcome) {
              primary = outcome;
              if (lastGate < 1) {
                lastGate = 1;
                controller.enqueue(sseLine({ type: "gate", step: 1 }));
              }
            }
          }
        }

        primary ??= {
          payer,
          error: "agent_did_not_attempt_payment",
          httpStatus: 500,
        };

        await flushLiveGates();

        const done = await buildDoneResult(primary, env.AGENT_URL, env.FACILITATOR_URL);
        await flushLiveGates();
        for (const step of done.gates) {
          if (step <= lastGate) continue;
          lastGate = step;
          controller.enqueue(sseLine({ type: "gate", step }));
        }
        if (done.attestationStep && lastGate < 6) {
          controller.enqueue(sseLine({ type: "gate", step: 6 }));
        }
        finish(done.result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        finish({ httpStatus: 500, error: message, body: { error: message } });
      } finally {
        clearInterval(poll);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
