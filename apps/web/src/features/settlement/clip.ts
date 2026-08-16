import { CHANI_OUTBOUND, PAUL_INBOUND_V2, PROGRAM_VKEY } from "./clip-artifacts";

export const SEATS = ["chani", "chani-institution", "paul", "paul-institution"] as const;
export type Seat = (typeof SEATS)[number];
export type Phase = "idle" | "pending" | "published" | "settled";
export type Action = "instruct" | "publish";

export type ClipState = {
  phase: Phase;
};

/** Who moves next, and what they do. Nobody else in the room can take that move. */
export type Move = { actor: Seat; action: Action };

const FORBIDDEN = [
  /\bcap\b/i,
  /\bpayment\b/i,
  /\bpay\b/i,
  /correspondent/i,
  /allow this transfer/i,
];

export function createClip(): ClipState {
  return { phase: "idle" };
}

/**
 * The room has one move open at a time and one seat that owns it. There is no seat
 * to choose: the phase says whose turn it is, and the single control takes that turn.
 */
export function nextMove(phase: Phase): Move | null {
  switch (phase) {
    case "idle":
      return { actor: "chani", action: "instruct" };
    case "pending":
      return { actor: "paul-institution", action: "publish" };
    case "published":
      return { actor: "chani", action: "instruct" };
    case "settled":
      return null;
  }
}

export function availableAction(state: ClipState): Action | null {
  return nextMove(state.phase)?.action ?? null;
}

export function applyAction(state: ClipState, action: Action): ClipState {
  if (availableAction(state) !== action) {
    return state;
  }
  if (action === "instruct" && state.phase === "idle") {
    return { phase: "pending" };
  }
  if (action === "instruct" && state.phase === "published") {
    return { phase: "settled" };
  }
  if (action === "publish" && state.phase === "pending") {
    return { phase: "published" };
  }
  return state;
}

/** Takes whatever move is open. The room advances a beat; it never skips one. */
export function advance(state: ClipState): ClipState {
  const move = nextMove(state.phase);
  return move ? applyAction(state, move.action) : state;
}

/** The label on the one control, naming the actor so the move is never anonymous. */
export function moveLabel(phase: Phase): string {
  switch (phase) {
    case "idle":
      return "Chani instructs the delivery";
    case "pending":
      return "Paul’s institution publishes inbound v2";
    case "published":
      return "Chani instructs the same delivery";
    case "settled":
      return "Settled for Paul";
  }
}

export function whoseMove(phase: Phase): string {
  const move = nextMove(phase);
  return move ? `${seatLabel(move.actor)} to move` : "The room is settled";
}

/** Whose voice narrates the room right now — the actor who is up, or Paul once it lands. */
export function narrator(phase: Phase): Seat {
  return nextMove(phase)?.actor ?? "paul";
}

export function actionLabel(action: Action): string {
  return action === "instruct" ? "Instruct my institution" : "Publish inbound v2";
}

export function seatLabel(seat: Seat): string {
  switch (seat) {
    case "chani":
      return "Chani";
    case "chani-institution":
      return "Chani’s institution";
    case "paul":
      return "Paul";
    case "paul-institution":
      return "Paul’s institution";
  }
}

export function seatCopy(state: { seat: Seat; phase: Phase }): string {
  const lines: Record<Seat, Record<Phase, string>> = {
    chani: {
      idle: "Instruct my institution to deliver 1 T-bill share to Paul.",
      pending: "My institution allowed; his institution blocked.",
      published:
        "His institution published inbound T-bill policy v2. Instruct the same delivery again.",
      settled: "Settled for Paul.",
    },
    "chani-institution": {
      idle: "Waiting for Chani to instruct an outbound T-bill delivery.",
      pending: "Outbound allowed; settlement pending beneficiary policy.",
      published: "Outbound still allowed. Waiting for the same instruction.",
      settled: "Settled for Paul.",
    },
    paul: {
      idle: "Waiting for a delivery from Chani.",
      pending: "Incoming blocked by my institution.",
      published: "My institution published inbound T-bill policy v2.",
      settled: "Received. Settled for Paul.",
    },
    "paul-institution": {
      idle: "Inbound T-bill policy is in force. We have not seen this instruction yet.",
      pending: "We refused. Settlement pending beneficiary policy.",
      published: "Inbound T-bill policy v2 is live.",
      settled: "Allowed; settled on our books for Paul.",
    },
  };
  return lines[state.seat][state.phase];
}

/** The line the room speaks, in the voice of whoever is up. */
export function roomCopy(phase: Phase): string {
  return seatCopy({ seat: narrator(phase), phase });
}

export type Evidence = {
  senderAllowed: boolean | null;
  receiverAllowed: boolean | null;
  verdict: string;
  programVKey: string | null;
  publicValues: string | null;
};

export function evidence(phase: Phase): Evidence {
  if (phase === "idle") {
    return {
      senderAllowed: null,
      receiverAllowed: null,
      verdict: "No instruction yet.",
      programVKey: null,
      publicValues: null,
    };
  }
  if (phase === "pending" || phase === "published") {
    return {
      senderAllowed: true,
      receiverAllowed: false,
      verdict: "settlement pending beneficiary policy",
      programVKey: PROGRAM_VKEY,
      publicValues: CHANI_OUTBOUND.publicValues,
    };
  }
  return {
    senderAllowed: true,
    receiverAllowed: true,
    verdict: "settled for Paul",
    programVKey: PROGRAM_VKEY,
    publicValues: PAUL_INBOUND_V2.publicValues,
  };
}

export function forbiddenCopy(text: string): string[] {
  return FORBIDDEN.filter((re) => re.test(text)).map((re) => re.source);
}
