"use client";

import { useCallback, useEffect, useState } from "react";
import { BeatSpine } from "./beat-spine";
import { booksFor } from "./books";
import { addressUrl } from "./chain";
import { Channel } from "./channel";
import { type Action, availableAction, nextMove } from "./clip";
import type { ClipTxes } from "./desk-phase";
import { type Activity, InstitutionSlab } from "./institution-slab";
import { KnownLimits } from "./known-limits";
import { announcement } from "./narrative";
import { PrivacyLedger } from "./privacy-ledger";
import { DELIVERY, DESK, history, NETWORK, PROGRAM_VKEY, receipts } from "./settlement";
import { Transcript } from "./transcript";
import { VerdictBand } from "./verdict-band";

type RoomState = {
  live: boolean;
  phase: "idle" | "pending" | "published" | "settled";
  desk: string;
  txs: ClipTxes;
  deskShares: number;
  paulShares: number;
  error?: string;
};

function activityFor(action: Action | null): { outbound: Activity; inbound: Activity } {
  if (action === "instruct") {
    return { outbound: "issuing", inbound: "issuing" };
  }
  if (action === "publish") {
    return { outbound: null, inbound: "publishing" };
  }
  return { outbound: null, inbound: null };
}

async function fetchState(): Promise<RoomState> {
  const res = await fetch("/api/clip/state");
  const body = (await res.json()) as Partial<RoomState>;
  return {
    live: Boolean(body.live),
    phase: body.phase ?? "idle",
    desk: body.desk ?? DESK,
    txs: body.txs ?? {},
    deskShares: body.deskShares ?? 1,
    paulShares: body.paulShares ?? 0,
    error: body.error,
  };
}

export function SettlementRoom({ initial }: { initial?: RoomState }) {
  const [live, setLive] = useState<RoomState | null>(initial ?? null);
  const [inFlight, setInFlight] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchState()
      .then((state) => {
        setLive(state);
        if (state.error) {
          setError(state.error);
        }
      })
      .catch(() => {
        setLive(
          (prev) =>
            prev ?? {
              live: false,
              phase: "idle",
              desk: DESK,
              txs: {},
              deskShares: 1,
              paulShares: 0,
            },
        );
        setError("desk unread");
      });
  }, []);

  const phase = live?.phase ?? "idle";
  const txs = live?.txs ?? {};
  const desk = live?.desk ?? DESK;
  const armed = Boolean(live?.live);

  const run = useCallback(async () => {
    if (!armed) {
      return;
    }
    const taken = availableAction({ phase });
    setInFlight(taken);
    setError(null);
    const res = await fetch("/api/clip/advance", { method: "POST" }).catch(() => undefined);
    let body = (await res?.json().catch(() => undefined)) as Partial<RoomState> | undefined;
    if (!res?.ok || !body) {
      setError(body?.error ?? "settle() did not land");
      setInFlight(null);
      return;
    }
    // Public RPC can return the pre-write phase for a beat after the receipt.
    if (body.live && (body.phase ?? phase) === phase) {
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        const next = await fetchState();
        if (next.phase !== phase) {
          body = next;
          break;
        }
      }
    }
    setLive({
      live: true,
      phase: body.phase ?? phase,
      desk: body.desk ?? desk,
      txs: body.txs ?? txs,
      deskShares: body.deskShares ?? 0,
      paulShares: body.paulShares ?? 0,
    });
    setInFlight(null);
  }, [armed, desk, phase, txs]);

  const refresh = useCallback(() => {
    setInFlight(null);
    setError(null);
    void fetchState().then(setLive);
  }, []);

  const [outbound, inbound] = receipts(phase);
  const books = booksFor(
    phase,
    live ? { deskShares: live.deskShares, paulShares: live.paulShares } : undefined,
  );
  const move = nextMove(phase);
  const busy = inFlight !== null;
  const activity = activityFor(inFlight);
  const sendingIsUp = move?.actor === "chani" || move?.actor === "chani-institution";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-8 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="font-semibold text-[16px] tracking-[-0.02em]">Sietch</h1>
            <span className="text-[12px] text-muted-foreground">
              Inter-institutional settlement · demo
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="font-mono text-[11px] text-muted-foreground">
                {NETWORK}
                {armed ? " · live" : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={refresh}
              className="text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <p className="sr-only" role="status">
        {announcement(phase)}
      </p>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-8 pt-8 pb-16">
        <p className="text-[13px] text-muted-foreground">
          {DELIVERY.amount} {DELIVERY.symbol} · {DELIVERY.sender} ({DELIVERY.senderBook}) →{" "}
          {DELIVERY.beneficiary} ({DELIVERY.beneficiaryBook})
        </p>

        <div className="mt-6">
          <BeatSpine phase={phase} />
        </div>

        {/*
         * On a phone the room is three screens tall, so source order would bury the one
         * control below both institutions. CSS order lifts the verdict band above them
         * under lg without duplicating the node — a second copy would announce twice.
         */}
        <div className="mt-9 flex flex-col gap-8">
          <div className="order-2 grid items-stretch gap-6 lg:order-1 lg:grid-cols-[1fr_auto_1fr]">
            <InstitutionSlab
              receipt={outbound}
              active={sendingIsUp}
              activity={activity.outbound}
              shares={books.deskShares}
            />
            <Channel phase={phase} busy={busy} />
            <InstitutionSlab
              receipt={inbound}
              active={!sendingIsUp}
              activity={activity.inbound}
              shares={books.paulShares}
              align="right"
            />
          </div>

          <div className="order-1 lg:order-2">
            <VerdictBand
              phase={phase}
              busy={busy}
              armed={armed}
              txs={txs}
              onAdvance={() => void run()}
            />

            {error && !(phase === "settled" && error === "already settled") ? (
              <p className="mt-4 text-[13px] text-destructive" aria-live="polite">
                {error}
              </p>
            ) : null}

            {!armed && live !== null ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                This instance is not connected to a live desk.
              </p>
            ) : null}

            {busy && armed ? (
              <p className="mt-3 text-[12px] text-muted-foreground" aria-live="polite">
                submitting on Base Sepolia…
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <PrivacyLedger phase={phase} />
        </div>

        <div className="mt-8">
          <KnownLimits />
        </div>

        <div className="mt-10">
          <Transcript entries={history(phase, txs)} />
          <p className="mt-5 break-all font-mono text-[11px] text-muted-foreground">
            desk{" "}
            <a
              href={addressUrl(desk)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              {desk}
            </a>
            <br />
            vkey {PROGRAM_VKEY}
          </p>
        </div>
      </main>
    </div>
  );
}
