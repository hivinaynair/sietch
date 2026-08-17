import { expect, test } from "bun:test";
import { clipRpcUrls } from "./clip-rpc";

test("always keeps a public fallback even when the env RPC is the official Base URL", () => {
  const urls = clipRpcUrls("https://sepolia.base.org");
  expect(urls[0]).toBe("https://sepolia.base.org");
  expect(urls).toContain("https://base-sepolia-rpc.publicnode.com");
});

test("dedupes the preferred URL against the fallbacks", () => {
  expect(clipRpcUrls("https://base-sepolia-rpc.publicnode.com")).toEqual([
    "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.base.org",
  ]);
});

test("still has public endpoints when no env RPC is set", () => {
  const urls = clipRpcUrls();
  expect(urls[0]).toBe("https://base-sepolia-rpc.publicnode.com");
  expect(urls).toContain("https://sepolia.base.org");
});
