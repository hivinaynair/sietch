import { expect, test } from "bun:test";
import {
  applyAction,
  availableAction,
  createClip,
  evidence,
  forbiddenCopy,
  seatCopy,
  setSeat,
  youAre,
} from "./clip";

test("default seat is Paul’s institution", () => {
  const clip = createClip();
  expect(clip.seat).toBe("paul-institution");
  expect(clip.phase).toBe("idle");
  expect(youAre(clip)).toBe("You are Paul’s institution.");
});

test("switching seats does not start a second world", () => {
  let clip = createClip();
  clip = applyAction(clip, "instruct");
  expect(clip.phase).toBe("idle");
  clip = setSeat(clip, "chani");
  clip = applyAction(clip, "instruct");
  expect(clip.phase).toBe("pending");
  clip = setSeat(clip, "paul");
  expect(clip.phase).toBe("pending");
});

test("only Chani can instruct; only Paul’s institution can publish after deny", () => {
  let clip = createClip();
  expect(availableAction(clip)).toBeNull();
  clip = setSeat(clip, "chani");
  expect(availableAction(clip)).toBe("instruct");
  clip = applyAction(clip, "instruct");
  expect(clip.phase).toBe("pending");
  expect(availableAction(clip)).toBeNull();
  clip = setSeat(clip, "paul-institution");
  expect(availableAction(clip)).toBe("publish");
  clip = setSeat(clip, "chani-institution");
  expect(availableAction(clip)).toBeNull();
  clip = applyAction(clip, "publish");
  expect(clip.phase).toBe("pending");
});

test("publish then instruct again settles for Paul", () => {
  let clip = setSeat(createClip(), "chani");
  clip = applyAction(clip, "instruct");
  clip = setSeat(clip, "paul-institution");
  clip = applyAction(clip, "publish");
  expect(clip.phase).toBe("published");
  clip = setSeat(clip, "chani");
  clip = applyAction(clip, "instruct");
  expect(clip.phase).toBe("settled");
});

test("pending evidence names the beneficiary institution, never a stub", () => {
  let clip = setSeat(createClip(), "chani");
  clip = applyAction(clip, "instruct");
  const row = evidence(clip);
  expect(row.senderAllowed).toBe(true);
  expect(row.receiverAllowed).toBe(false);
  expect(row.verdict).toBe("settlement pending beneficiary policy");
  expect(forbiddenCopy(JSON.stringify(row))).toEqual([]);
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
