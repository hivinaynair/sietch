import { expect, test } from "bun:test";
import { createLimiter } from "./rate-limit";

test("five writes from one IP fit the window; the sixth is refused", () => {
  const now = 1_000;
  const limit = createLimiter({ now: () => now });

  for (let i = 0; i < 5; i += 1) {
    expect(limit.check("1.1.1.1").ok).toBe(true);
  }

  const sixth = limit.check("1.1.1.1");
  expect(sixth.ok).toBe(false);
  if (!sixth.ok) {
    expect(sixth.error).toBe("too many settlements, try again shortly");
  }
});

test("the per-IP window rolls: a sixth write is allowed once the first ages out", () => {
  let now = 0;
  const limit = createLimiter({ now: () => now, windowMs: 10 * 60_000 });

  for (let i = 0; i < 5; i += 1) {
    expect(limit.check("2.2.2.2").ok).toBe(true);
  }
  expect(limit.check("2.2.2.2").ok).toBe(false);

  now = 10 * 60_000;
  expect(limit.check("2.2.2.2").ok).toBe(true);
});

test("the global ceiling stops a twentieth distinct IP; the twenty-first is refused", () => {
  const now = 0;
  const limit = createLimiter({ now: () => now, perIp: 5, global: 20 });

  for (let i = 0; i < 20; i += 1) {
    expect(limit.check(`10.0.0.${i}`).ok).toBe(true);
  }

  const overflow = limit.check("10.0.0.99");
  expect(overflow.ok).toBe(false);
});

test("IPs do not share a bucket", () => {
  const limit = createLimiter({ now: () => 0 });
  for (let i = 0; i < 5; i += 1) {
    expect(limit.check("8.8.8.8").ok).toBe(true);
  }
  expect(limit.check("1.1.1.1").ok).toBe(true);
});
