import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4569";

test("space settings tab — visual verification", async ({ page }) => {
  test.setTimeout(180000);

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.locator("#schoolCode").fill("GRN001");
  await page.locator('button[type="submit"]:has-text("Continue")').click();
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.locator("#email").fill("priya.sharma@greenwood.edu");
  await page.locator("#password").fill("Test@12345");
  await page.locator('button[type="submit"]:has-text("Sign In")').click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30000 });

  // Open a known space (Mathematics Fundamentals — has story points)
  await page.goto(`${BASE_URL}/spaces/gJRhiZo4Pt7jYFDPpm9s/edit`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);

  // Click Settings tab to be sure (it's the default but be explicit)
  const settingsTab = page.getByRole("tab", { name: "Settings" }).first();
  await settingsTab.click({ force: true });
  await page.waitForTimeout(800);

  // Verify section headings exist (case-insensitive, exact text)
  await expect(page.getByText("Basics", { exact: true })).toBeVisible();
  await expect(page.getByText("Access", { exact: true })).toBeVisible();
  await expect(page.getByText("Assessment behavior", { exact: true })).toBeVisible();
  await expect(page.getByText("Labels & taxonomy", { exact: true })).toBeVisible();
  await expect(page.getByText("Store listing", { exact: true })).toBeVisible();

  // Verify a few helper-text strings exist
  await expect(page.getByText("The headline name for this space.", { exact: false })).toBeVisible();
  await expect(page.getByText("Comma-separated tags.", { exact: false })).toBeVisible();

  // Verify save button exists
  await expect(page.getByRole("button", { name: /save settings/i })).toBeVisible();

  // Verify the description textarea grows with content
  const desc = page.locator("#space-description");
  const initialHeight = await desc.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
  await desc.fill(
    Array.from({ length: 10 })
      .map(() => "This is a meaningful sentence about what the space teaches and why it matters.")
      .join(" ")
  );
  await page.waitForTimeout(200);
  const grownHeight = await desc.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
  expect(grownHeight).toBeGreaterThan(initialHeight);

  // Counter is visible
  await expect(page.getByText(/\/600$/)).toBeVisible();

  // Screenshot full page (description grown)
  await page.screenshot({
    path: "e2e/space-settings-redesign.png",
    fullPage: true,
  });

  // Restore short description so save-roundtrip tests aren't affected by length
  await desc.fill("Core mathematics concepts for Grade 8.");
  await page.waitForTimeout(200);

  // Toggle the store listing switch and verify revealed fields
  const storeSwitch = page.locator("#published-to-store");
  await storeSwitch.click();
  await page.waitForTimeout(400);
  await expect(page.getByLabel("Price")).toBeVisible();
  await expect(page.getByLabel("Currency")).toBeVisible();
  await expect(page.getByLabel("Store description")).toBeVisible();
  await page.screenshot({
    path: "e2e/space-settings-redesign-store-on.png",
    fullPage: true,
  });

  // Toggle retakes — ensure switch state controls Maximum retakes visibility
  const retakesSwitch = page.locator("#allow-retakes");
  const initiallyChecked = await retakesSwitch.getAttribute("data-state");
  if (initiallyChecked !== "checked") {
    await retakesSwitch.click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByLabel("Maximum retakes")).toBeVisible();
});
