/**
 * The live Base Sepolia transactions behind the clip.
 *
 * `artifacts/demo/chain.json` is the source of truth — `bun run rearm` rewrites it.
 * Full hashes only: the room truncates for display but always links the whole thing.
 */
import artifact from "../../../../../artifacts/demo/chain.json";
import type { ClipTxes } from "./desk-phase";

export const CLIP_TX: ClipTxes = artifact.clip as ClipTxes;

/**
 * Block the live desk was deployed in. Anchors the event scan so the transcript cannot empty
 * itself as the clip's transactions fall behind a sliding window. `bun run rearm` rewrites it;
 * null means scan from genesis, which is slow but never silently wrong.
 */
export const DEPLOY_BLOCK: number | null = artifact.deployBlock ?? null;

export const DEPLOY_TX = artifact.deploy;

const EXPLORER = "https://sepolia.basescan.org";

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

/** Display form. The href keeps the full hash so a reader can verify the whole thing. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
