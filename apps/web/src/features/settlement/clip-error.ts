import { formatEther, parseEther } from "viem";

/** ETH the factory sends the clerk on rearm — two settle() calls plus publish, with headroom. */
export const CLIP_STIPEND = parseEther("0.005");
export const CLIP_STIPEND_ETH = formatEther(CLIP_STIPEND);

/** ETH the clerk should attach to rearm() so the factory can top the clerk back up. */
export function stipendToSend(opts: { stipend: bigint; clerk: bigint; factory: bigint }): bigint {
  const gap = opts.stipend > opts.factory ? opts.stipend - opts.factory : 0n;
  if (gap === 0n || opts.clerk <= gap + opts.stipend) {
    return 0n;
  }
  return gap;
}

/**
 * Viem dumps a page of request args when the clerk cannot pay gas. The room should name
 * the shortfall, not the library.
 */
export function parseHaveWant(error: unknown): { have: bigint; want: bigint } | null {
  const text = [
    error instanceof Error ? error.message : String(error),
    extra(error, "shortMessage"),
    extra(error, "details"),
  ].join("\n");
  const match = text.match(/have (\d+) want (\d+)/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { have: BigInt(match[1]), want: BigInt(match[2]) };
}

export function formatClipError(error: unknown): string {
  const need = parseHaveWant(error);
  if (need) {
    return `Clerk needs ${eth(need.want)} ETH (has ${eth(need.have)}).`;
  }
  const text = [
    error instanceof Error ? error.message : String(error),
    extra(error, "shortMessage"),
    extra(error, "details"),
  ].join("\n");
  const first =
    text
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? "transaction failed";
  return first.length > 80 ? "transaction failed" : first;
}

function extra(error: unknown, key: string): string {
  if (!error || typeof error !== "object" || !(key in error)) {
    return "";
  }
  return String((error as Record<string, unknown>)[key]);
}

function eth(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (n >= 0.001) {
    return String(n);
  }
  return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
