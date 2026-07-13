import { test, expect } from "@playwright/test";
import { loginStudentWithEmail, expectDashboard } from "./helpers/auth";
import { SCHOOL_CODE, SELECTORS, CREDENTIALS } from "./helpers/selectors";

test("debug: check spaces visible for student", async ({ page }) => {
  await page.goto("/login");
  await loginStudentWithEmail(
    page,
    SCHOOL_CODE,
    CREDENTIALS.student1.email,
    CREDENTIALS.student1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.student);

  // Navigate to spaces
  await page.goto("/spaces");
  await page.waitForSelector('h1:has-text("My Spaces")', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const spaceCards = page.locator('a[href^="/spaces/"]');
  const count = await spaceCards.count();
  console.log(`Found ${count} space cards`);

  // Aarav has classIds ['cls_g8_math', 'cls_g8_sci'] so should see 2 spaces
  expect(count).toBeGreaterThanOrEqual(1);

  await page.screenshot({ path: "test-results/debug-spaces-page.png", fullPage: true });
});
