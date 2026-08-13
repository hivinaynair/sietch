import { expect, test } from "../playwright.setup";

test("home page renders the primary call to action", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open alert" })).toBeVisible();
});

test("MSW stubs an external API in the browser", async ({ page }) => {
  await page.goto("/");

  const health = await page.evaluate(async () => {
    const response = await fetch("https://api.example.com/health");
    return response.json();
  });

  expect(health).toEqual({ status: "ok" });
});
