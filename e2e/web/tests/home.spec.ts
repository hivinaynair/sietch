import { expect, test } from "../playwright.setup";

test("home page is the settlement room with Chani to move", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sietch", level: 1 })).toBeVisible();
  await expect(page.getByText("Chani to move")).toHaveCount(2);
  await expect(page.getByText("No instruction yet · 1 sTBILL · Chani → Paul")).toBeVisible();
});

test("Chani and Paul hold opposite ends and neither policy is readable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Chani", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paul", exact: true })).toBeVisible();
  await expect(page.getByText("Chani’s institution · directory book India")).toBeVisible();
  await expect(page.getByText("Paul’s institution · directory book US")).toBeVisible();
  await expect(page.getByText("sealed")).toHaveCount(2);
  await expect(page.getByText("Nothing on chain yet. Chani has not instructed.")).toBeVisible();
});

test("one control walks the room: refused, v2 published, same delivery settles", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();
  await expect(page.getByText("Settlement pending beneficiary policy ·")).toBeVisible();

  await page.getByRole("button", { name: "Paul’s institution publishes inbound v2" }).click();
  await expect(page.getByText("beneficiary door open · inbound v2")).toBeVisible();

  await page.getByRole("button", { name: "Chani instructs the same delivery" }).click();
  await expect(page.getByText("Settled for Paul ·")).toBeVisible();
  await expect(page.getByRole("button", { name: "Settled for Paul" })).toBeDisabled();

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
