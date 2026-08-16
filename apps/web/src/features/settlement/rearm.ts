import { createLimiter } from "./rate-limit";

/**
 * Re-arm restores idle books without a Vercel env bump.
 *
 * A spent desk cannot settle again (transferId consumed; share already on Paul’s institution).
 * The factory deploys a fresh T-bill + desk and stores the pointer on chain. Receipts do not
 * bind the desk address, so the same Groth16 files work.
 */

export const REARM_LIMIT = {
  windowMs: 2 * 60_000,
  perIp: 1,
  global: 5,
} as const;

export const rearmLimit = createLimiter({
  ...REARM_LIMIT,
  refused: "too many re-arms, try again shortly",
});

export type DeskPointer = {
  desk: `0x${string}`;
  fromBlock: bigint;
};

export function resolveDeskPointer(opts: {
  factory: { desk: `0x${string}`; fromBlock: bigint } | null;
  envDesk?: string;
  envFromBlock?: string;
  artifactBlock?: number | null;
}): DeskPointer | null {
  if (opts.factory?.desk) {
    return { desk: opts.factory.desk, fromBlock: opts.factory.fromBlock };
  }
  const env = opts.envDesk;
  if (!env?.startsWith("0x") || env.length !== 42) {
    return null;
  }
  const fromBlock = opts.envFromBlock
    ? BigInt(opts.envFromBlock)
    : opts.artifactBlock
      ? BigInt(opts.artifactBlock)
      : 0n;
  return { desk: env as `0x${string}`, fromBlock };
}

export function isClipLive(opts: {
  clerk: boolean;
  desk: boolean;
  factory: boolean;
  liveFlag?: string;
}): boolean {
  if (opts.liveFlag === "0") {
    return false;
  }
  return opts.clerk && (opts.desk || opts.factory);
}

export type RearmRefusal = { status: 503; error: string };

export function refuseRearm(opts: { live: boolean; factory: boolean }): RearmRefusal | null {
  if (!opts.live) {
    return { status: 503, error: "not live" };
  }
  if (!opts.factory) {
    return { status: 503, error: "no factory" };
  }
  return null;
}

export function factoryAddress(raw: string | undefined): `0x${string}` | null {
  if (!raw?.startsWith("0x") || raw.length !== 42) {
    return null;
  }
  return raw as `0x${string}`;
}
