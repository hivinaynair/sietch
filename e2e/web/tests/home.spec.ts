import { expect, test } from "../playwright.setup";

test("home page is the settlement room on Paul’s institution", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sietch", level: 1 })).toBeVisible();
  await expect(page.getByText("You are Paul’s institution.")).toBeVisible();
  await expect(page.getByText("No instruction yet · 1 sTBILL · Chani → Paul")).toBeVisible();
});

test("both institutions are present and neither policy is readable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Chani’s institution" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paul’s institution" })).toBeVisible();
  await expect(page.getByText("sealed")).toHaveCount(2);
  await expect(page.getByText("Nothing on chain yet. Chani has not instructed.")).toBeVisible();
});

test("the beneficiary refuses, publishes v2, and the same delivery settles", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Chani", exact: true }).click();
  await page.getByRole("button", { name: "Instruct my institution" }).click();
  await expect(page.getByText("Settlement pending beneficiary policy ·")).toBeVisible();

  await page.getByRole("button", { name: "Paul’s institution", exact: true }).click();
  await page.getByRole("button", { name: "Publish inbound v2" }).click();
  await expect(page.getByText("beneficiary door open · inbound v2")).toBeVisible();

  await page.getByRole("button", { name: "Chani", exact: true }).click();
  await page.getByRole("button", { name: "Instruct my institution" }).click();
  await expect(page.getByText("Settled for Paul ·")).toBeVisible();

  // The refusal stays on the tape after v2.
  await expect(page.getByText("Receipt · side inbound · allowed false")).toBeVisible();
});

test("MSW stubs an external API in the browser", async ({ page }) => {
  await page.goto("/");

  const health = await page.evaluate(async () => {
    const response = await fetch("https://api.example.com/health");
    return response.json();
  });

  expect(health).toEqual({ status: "ok" });
});
