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

  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();
  await expect(spine.getByText("refused")).toBeVisible();

  await page.getByRole("button", { name: "Paul’s institution publishes inbound v2" }).click();
  await expect(spine.getByText("inbound v2 published")).toBeVisible();
});

test("one control walks the room: refused, v2 published, same delivery settles", async ({
  page,
}) => {
  await page.goto("/");
  const band = page.getByRole("region", { name: "settlement" });

  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();
  await expect(band.getByText("no transfer · settlement pending beneficiary policy")).toBeVisible();

  await page.getByRole("button", { name: "Paul’s institution publishes inbound v2" }).click();
  await expect(page.getByText("beneficiary door open · inbound v2")).toBeVisible();

  // Publishing a version is not a settlement: the pair on chain is still attempt 1.
  await expect(band.getByText("no transfer · the pair on chain is still attempt 1")).toBeVisible();

  await page.getByRole("button", { name: "Chani instructs the same delivery" }).click();
  await expect(band.getByText("1 share posted for Paul")).toBeVisible();
  await expect(page.getByRole("button", { name: "Settled for Paul" })).toBeDisabled();

  // The refusal stays on the tape after v2.
  await expect(page.getByText("Receipt · side inbound · allowed false")).toBeVisible();
});

test("settlement is shown as the AND of two receipts, not asserted in prose", async ({ page }) => {
  await page.goto("/");
  const band = page.getByRole("region", { name: "settlement" });
  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();

  await expect(band.getByText("outbound", { exact: true })).toBeVisible();
  await expect(band.getByText("inbound", { exact: true })).toBeVisible();
  await expect(band.getByText("AND", { exact: true })).toBeVisible();
  await expect(band.getByText("Chani’s institution", { exact: true })).toBeVisible();
  await expect(band.getByText("Paul’s institution", { exact: true })).toBeVisible();
});

test("every transaction the room shows can be opened on Base Sepolia", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();

  const links = page.locator('a[href^="https://sepolia.basescan.org/tx/"]');
  await expect(links.first()).toBeVisible();

  for (const href of await links.evaluateAll((all) =>
    all.map((a) => a.getAttribute("href") ?? ""),
  )) {
    expect(href).toMatch(/^https:\/\/sepolia\.basescan\.org\/tx\/0x[0-9a-f]{64}$/);
  }
});

test("the room announces the beat once, not five times at once", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();

  const status = page.getByRole("status");
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText(/Outbound allowed, inbound refused/);
});

test("Reset returns the room to nothing instructed", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Chani instructs the delivery" }).click();
  await expect(page.getByText("Receipt · side outbound · allowed true")).toBeVisible();

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Nothing on chain yet. Chani has not instructed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Chani instructs the delivery" })).toBeEnabled();
});

test("MSW stubs an external API in the browser", async ({ page }) => {
  await page.goto("/");

  const health = await page.evaluate(async () => {
    const response = await fetch("https://api.example.com/health");
    return response.json();
  });

  expect(health).toEqual({ status: "ok" });
});
