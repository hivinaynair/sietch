/**
 * The live Base Sepolia transactions behind the clip.
 *
 * These mirror `artifacts/demo/chain.json`, which is the source of truth — chain.test.ts
 * fails if the two drift, so re-running the clip cannot leave stale hashes on the page.
 * Full hashes only: the room truncates for display but always links the whole thing.
 */
export const CLIP_TX = {
  settlePending: "0xc445af618731c604614f36895bc952654cc9fb0548c089824b75624b7f768198",
  publishInboundV2: "0xfe31cfdd77f51e14825de3ba71fdf80db452064837c0c7819a0e77dd49a7417f",
  settleForPaul: "0xcf3117aa581fef8ba296cd26019ad62bff2f4b058516afc1581f7c537f928c27",
} as const;

export const DEPLOY_TX = {
  tbill: "0x1739beedf0cd9a1cb5a08b4e82e6f09fd46c3478d97bfc615ebe16c68753e90d",
  desk: "0x4e2c8646e9afc86a9aa11dc5c859f9894857f0bfe4fde0134a350d2f1d74e78f",
  mint: "0xfbebf93203bd1f86333c925280e909870a141694697f37953e1d8ef45c90a42a",
} as const;

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
