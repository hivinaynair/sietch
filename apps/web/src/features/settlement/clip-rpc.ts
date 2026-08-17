/**
 * Public Base Sepolia RPCs. Official sepolia.base.org often refuses cloud IPs (Vercel),
 * so the live room must have a second line.
 */
export const BASE_SEPOLIA_RPCS = [
  "https://base-sepolia-rpc.publicnode.com",
  "https://sepolia.base.org",
] as const;

export function clipRpcUrls(preferred?: string): string[] {
  const urls = [preferred, ...BASE_SEPOLIA_RPCS].filter((url): url is string => Boolean(url));
  return [...new Set(urls)];
}
