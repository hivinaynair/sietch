import { expect, test } from "bun:test";

test("MSW intercepts external HTTP in bun:test", async () => {
  const response = await fetch("https://api.example.com/health");

  expect(response.ok).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
