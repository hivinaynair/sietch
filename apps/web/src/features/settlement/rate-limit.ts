/**
 * In-memory fixed window in front of settle() / publishInbound.
 * Unauthenticated POST /api/clip/advance spends the clerk's gas; this is the
 * cheap brake. Serverless isolates do not share memory, so it is a ceiling
 * per instance, not a global lock.
 */

export type LimitResult = { ok: true } | { ok: false; error: string };

const REFUSED = "too many settlements, try again shortly";

export function createLimiter(options?: {
  windowMs?: number;
  perIp?: number;
  global?: number;
  now?: () => number;
}) {
  const windowMs = options?.windowMs ?? 10 * 60_000;
  const perIp = options?.perIp ?? 5;
  const global = options?.global ?? 20;
  const now = options?.now ?? Date.now;
  const hits: { ip: string; at: number }[] = [];

  function prune(at: number) {
    const floor = at - windowMs;
    while (hits.length > 0 && hits[0]!.at <= floor) {
      hits.shift();
    }
  }

  return {
    check(ip: string): LimitResult {
      const at = now();
      prune(at);
      const ipCount = hits.filter((hit) => hit.ip === ip).length;
      if (ipCount >= perIp || hits.length >= global) {
        return { ok: false, error: REFUSED };
      }
      hits.push({ ip, at });
      return { ok: true };
    },
  };
}

export const advanceLimit = createLimiter();
