import { afterEach, expect, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettlementRoom } from "./settlement-room";

const idle = {
  live: true,
  phase: "idle" as const,
  desk: "0x1111111111111111111111111111111111111111",
  txs: {},
  deskShares: 1,
  paulShares: 0,
  rearmable: true,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(state = idle) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(state), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

test("Re-arm sits next to Refresh when the factory is live", async () => {
  stubFetch();
  render(<SettlementRoom initial={idle} />);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Re-arm" })).toBeTruthy();
  });
});

test("Re-arm is hidden when the factory is not configured", async () => {
  stubFetch({ ...idle, rearmable: false });
  render(<SettlementRoom initial={{ ...idle, rearmable: false }} />);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
  expect(screen.queryByRole("button", { name: "Re-arm" })).toBeNull();
});

test("Re-arm asks before spending gas", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(idle), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  render(<SettlementRoom initial={idle} />);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Re-arm" })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole("button", { name: "Re-arm" }));
  expect(screen.getByText(/spends gas.*starts a new desk/i)).toBeTruthy();
  expect(calls.some((url) => url.includes("/api/clip/rearm"))).toBe(false);
});
