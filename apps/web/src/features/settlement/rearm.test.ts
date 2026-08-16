import { expect, test } from "bun:test";
import { createLimiter } from "./rate-limit";
import { isClipLive, REARM_LIMIT, refuseRearm, resolveDeskPointer } from "./rearm";

const FACTORY_DESK = "0x1111111111111111111111111111111111111111" as const;
const ENV_DESK = "0x2222222222222222222222222222222222222222" as const;

test("factory pointer wins over SIETCH_DESK_ADDRESS", () => {
  const pointer = resolveDeskPointer({
    factory: { desk: FACTORY_DESK, fromBlock: 99n },
    envDesk: ENV_DESK,
    envFromBlock: "12",
    artifactBlock: 1,
  });
  expect(pointer).toEqual({ desk: FACTORY_DESK, fromBlock: 99n });
});

test("falls back to env desk and from-block when the factory is unset", () => {
  const pointer = resolveDeskPointer({
    factory: null,
    envDesk: ENV_DESK,
    envFromBlock: "45565919",
    artifactBlock: 1,
  });
  expect(pointer).toEqual({ desk: ENV_DESK, fromBlock: 45565919n });
});

test("a clerk plus factory is live even without an env desk", () => {
  expect(isClipLive({ clerk: true, desk: false, factory: true })).toBe(true);
});

test("SIETCH_LIVE=0 forces tape mode even when a factory is set", () => {
  expect(isClipLive({ clerk: true, desk: true, factory: true, liveFlag: "0" })).toBe(false);
});

test("re-arm is refused with 503 when the clip is not live", () => {
  expect(refuseRearm({ live: false, factory: true })).toEqual({
    status: 503,
    error: "not live",
  });
});

test("re-arm is refused with 503 when no factory is configured", () => {
  expect(refuseRearm({ live: true, factory: false })).toEqual({
    status: 503,
    error: "no factory",
  });
});

test("a second re-arm from the same IP in the window is refused", () => {
  const limit = createLimiter({ ...REARM_LIMIT, now: () => 0 });
  expect(limit.check("1.1.1.1").ok).toBe(true);
  const second = limit.check("1.1.1.1");
  expect(second.ok).toBe(false);
});
