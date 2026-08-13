import { HttpResponse, http } from "msw";

/**
 * Shared network stubs for bun:test and Playwright.
 * Add third-party APIs here (Stripe, Clerk, etc.) — not your own Next.js routes.
 */
export const handlers = [
  http.get("https://api.example.com/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),
];
