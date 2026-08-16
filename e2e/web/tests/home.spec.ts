import { expect, test } from "../playwright.setup";

test("home page is the settlement room with Chani to move", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sietch", level: 1 })).toBeVisible();
  await expect(page.getByText("Chani to move")).toBeVisible();
  await expect(page.getByText("1 sTBILL · Chani (India) → Paul (US)")).toBeVisible();
  await expect(page.getByText("1 share on the desk")).toBeVisible();
  await expect(page.getByText("0 shares on the books")).toBeVisible();
});

test("Chani and Paul hold opposite ends and neither policy is readable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Chani", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paul", exact: true })).toBeVisible();
  await expect(page.getByText("Chani’s institution · directory book India")).toBeVisible();
  await expect(page.getByText("Paul’s institution · directory book US")).toBeVisible();
  await expect(page.getByText("sealed", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Nothing on chain yet. Chani has not instructed.")).toBeVisible();
});

test("the clip reads as three beats, and an unplayed beat is not written as done", async ({
  page,
}) => {
  await page.goto("/");
  const spine = page.getByRole("list", { name: "clip progress" });

  await expect(spine.getByText("instruct the delivery")).toBeVisible();
  await expect(spine.getByText("publish inbound v2")).toBeVisible();
  await expect(spine.getByText("inbound v2 published")).toHaveCount(0);
  await expect(spine.getByText("refused")).toHaveCount(0);
});

test("this instance does not play a recording — the control waits for a live desk", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("· tape")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chani instructs the delivery" })).toBeDisabled();
  await expect(page.getByText("This instance is not connected to a live desk.")).toBeVisible();
});

test("settlement is shown as the AND of two receipts, not asserted in prose", async ({ page }) => {
  await page.goto("/");
  const band = page.getByRole("region", { name: "settlement" });

  await expect(band.getByText("outbound", { exact: true })).toBeVisible();
  await expect(band.getByText("inbound", { exact: true })).toBeVisible();
  await expect(band.getByText("AND", { exact: true })).toBeVisible();
  await expect(band.getByText("Chani’s institution", { exact: true })).toBeVisible();
  await expect(band.getByText("Paul’s institution", { exact: true })).toBeVisible();
});

test("the known limits are on the page", async ({ page }) => {
  await page.goto("/");
  const limits = page.getByRole("region", { name: "known limits" });
  await expect(limits.getByText("The v1 seal is enumerable")).toBeVisible();
  await expect(limits.getByText("The receipts name a demo token id")).toBeVisible();
});

test("the room announces the idle beat once", async ({ page }) => {
  await page.goto("/");

  const status = page.getByRole("status");
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText("Nothing instructed. No receipts yet.");
});

test("MSW stubs an external API in the browser", async ({ page }) => {
  await page.goto("/");

  const health = await page.evaluate(async () => {
    const response = await fetch("https://api.example.com/health");
    return response.json();
  });

  expect(health).toEqual({ status: "ok" });
});
