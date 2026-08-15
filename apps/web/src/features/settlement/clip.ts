export const SEATS = ["chani", "chani-institution", "paul", "paul-institution"] as const;
export type Seat = (typeof SEATS)[number];
export type Phase = "idle" | "pending" | "published" | "settled";
export type Action = "instruct" | "publish";

export type ClipState = {
  seat: Seat;
  phase: Phase;
};

export const DEFAULT_SEAT: Seat = "paul-institution";

const FORBIDDEN = [
  /\bcap\b/i,
  /\bpayment\b/i,
  /\bpay\b/i,
  /correspondent/i,
  /allow this transfer/i,
];

export function createClip(): ClipState {
  return { seat: DEFAULT_SEAT, phase: "idle" };
}

export function setSeat(state: ClipState, seat: Seat): ClipState {
  return { ...state, seat };
}

export function availableAction(state: ClipState): Action | null {
  if (state.seat === "chani" && (state.phase === "idle" || state.phase === "published")) {
    return "instruct";
  }
  if (state.seat === "paul-institution" && state.phase === "pending") {
    return "publish";
  }
  return null;
}

export function applyAction(state: ClipState, action: Action): ClipState {
  if (availableAction(state) !== action) {
    return state;
  }
  if (action === "instruct" && state.phase === "idle") {
    return { ...state, phase: "pending" };
  }
  if (action === "instruct" && state.phase === "published") {
    return { ...state, phase: "settled" };
  }
  if (action === "publish" && state.phase === "pending") {
    return { ...state, phase: "published" };
  }
  return state;
}

export function youAre(state: ClipState): string {
  switch (state.seat) {
    case "chani":
      return "You are Chani.";
    case "chani-institution":
      return "You are Chani’s institution.";
    case "paul":
      return "You are Paul.";
    case "paul-institution":
      return "You are Paul’s institution.";
  }
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

export function seatCopy(state: Pick<ClipState, "seat" | "phase">): string {
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

export type Evidence = {
  senderAllowed: boolean | null;
  receiverAllowed: boolean | null;
  verdict: string;
  programVKey: string | null;
  publicValues: string | null;
};

export function evidence(state: ClipState): Evidence {
  if (state.phase === "idle") {
    return {
      senderAllowed: null,
      receiverAllowed: null,
      verdict: "No instruction yet.",
      programVKey: null,
      publicValues: null,
    };
  }
  if (state.phase === "pending" || state.phase === "published") {
    return {
      senderAllowed: true,
      receiverAllowed: false,
      verdict: "settlement pending beneficiary policy",
      programVKey: "0x00035e8be65b2881b5409b3238047ddd679c9cce04cb4140973e04e9ed3330cd",
      publicValues: "0x3e9abaca0aad9ede81f4474766c846d8539f70688e1c8f521bbe1597874e3dc4",
    };
  }
  return {
    senderAllowed: true,
    receiverAllowed: true,
    verdict: "settled for Paul",
    programVKey: "0x00035e8be65b2881b5409b3238047ddd679c9cce04cb4140973e04e9ed3330cd",
    publicValues: "0x3e9abaca0aad9ede81f4474766c846d8539f70688e1c8f521bbe1597874e3dc4",
  };
}

export function forbiddenCopy(text: string): string[] {
  return FORBIDDEN.filter((re) => re.test(text)).map((re) => re.source);
}
