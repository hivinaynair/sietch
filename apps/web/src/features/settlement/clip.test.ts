import { expect, test } from "bun:test";
import {
  advance,
  applyAction,
  availableAction,
  createClip,
  evidence,
  forbiddenCopy,
  moveLabel,
  nextMove,
  roomCopy,
  seatCopy,
  whoseMove,
} from "./clip";

test("the room opens idle with Chani to move", () => {
  const clip = createClip();
  expect(clip.phase).toBe("idle");
  expect(nextMove("idle")).toEqual({ actor: "chani", action: "instruct" });
  expect(whoseMove("idle")).toBe("Chani to move");
});

test("one move is open at a time, and it names its actor", () => {
  expect(nextMove("pending")).toEqual({ actor: "paul-institution", action: "publish" });
  expect(nextMove("published")).toEqual({ actor: "chani", action: "instruct" });
  expect(nextMove("settled")).toBeNull();
  expect(whoseMove("settled")).toBe("The room is settled");
});

test("the wrong action is refused; only the open one advances the room", () => {
  const clip = createClip();
  expect(availableAction(clip)).toBe("instruct");
  expect(applyAction(clip, "publish").phase).toBe("idle");
  expect(applyAction(clip, "instruct").phase).toBe("pending");
});

test("three presses of the one control: refused, v2, settled", () => {
  let clip = createClip();
  clip = advance(clip);
  expect(clip.phase).toBe("pending");
  clip = advance(clip);
  expect(clip.phase).toBe("published");
  clip = advance(clip);
  expect(clip.phase).toBe("settled");
  clip = advance(clip);
  expect(clip.phase).toBe("settled");
});

test("the control label names who acts on each beat", () => {
  expect(moveLabel("idle")).toBe("Chani instructs the delivery");
  expect(moveLabel("pending")).toBe("Paul’s institution publishes inbound v2");
  expect(moveLabel("published")).toBe("Chani instructs the same delivery");
  expect(moveLabel("settled")).toBe("Settled for Paul");
});

test("pending evidence names the beneficiary institution, never a stub", () => {
  const clip = advance(createClip());
  const row = evidence(clip.phase);
  expect(row.senderAllowed).toBe(true);
  expect(row.receiverAllowed).toBe(false);
  expect(row.verdict).toBe("settlement pending beneficiary policy");
  expect(forbiddenCopy(JSON.stringify(row))).toEqual([]);
});

test("the room speaks in the voice of whoever is up, and Paul once it lands", () => {
  expect(roomCopy("idle")).toBe(seatCopy({ seat: "chani", phase: "idle" }));
  expect(roomCopy("pending")).toBe(seatCopy({ seat: "paul-institution", phase: "pending" }));
  expect(roomCopy("published")).toBe(seatCopy({ seat: "chani", phase: "published" }));
  expect(roomCopy("settled")).toBe(seatCopy({ seat: "paul", phase: "settled" }));
});

test("each seat speaks the clip, never payment or cap", () => {
  const seats = ["chani", "chani-institution", "paul", "paul-institution"] as const;
  const phases = ["idle", "pending", "published", "settled"] as const;
  for (const seat of seats) {
    for (const phase of phases) {
      const text = seatCopy({ seat, phase });
      expect(forbiddenCopy(text)).toEqual([]);
      if (phase === "pending") {
        expect(text.toLowerCase()).not.toContain("cap");
      }
      if (phase === "settled") {
        expect(text.toLowerCase()).toContain("paul");
      }
    }
  }
  expect(seatCopy({ seat: "paul-institution", phase: "pending" })).toMatch(
    /refused|pending beneficiary policy/i,
  );
  expect(seatCopy({ seat: "paul-institution", phase: "settled" })).toMatch(/settled/i);
});

test("no control label leaks a policy clause", () => {
  const phases = ["idle", "pending", "published", "settled"] as const;
  for (const phase of phases) {
    expect(forbiddenCopy(moveLabel(phase))).toEqual([]);
    expect(forbiddenCopy(whoseMove(phase))).toEqual([]);
  }
});
