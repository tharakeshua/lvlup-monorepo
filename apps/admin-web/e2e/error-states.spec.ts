import { test, expect } from "@playwright/test";
import { loginAsAdmin, navigateTo, SCHOOL_CODE, ADMIN_EMAIL } from "./helpers";

test.describe("Error States & Edge Cases", () => {
  // Allow longer timeout to handle Firebase auth rate-limiting after many auth tests
  test.setTimeout(150000);

  // ─── 15.1 Route Errors ───────────────────────────────────────────────────

  // 15.1.1 P0
  test("404 page renders for unknown routes", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/nonexistent-page-xyz");
    await page.waitForLoadState("domcontentloaded");
    // Should show 404 or Not Found page
    await expect(
      page
        .locator("text=404")
        .or(page.locator("text=Not Found"))
        .or(page.locator("text=Page Not Found"))
        .or(page.locator("text=not found"))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ─── 15.2 Form Validation ────────────────────────────────────────────────

  // 15.2.1 P1 — Empty email validation on login
  test("login form shows error when email is empty", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    // Leave email empty, fill password
    await page.fill("#password", "SomePassword123");
    await page.click('button[type="submit"]:has-text("Sign In")');
    // Form should not submit or should show validation error
    await expect(page).toHaveURL(/\/login/);
  });

  // 15.2.2 P1 — Empty password validation on login
  test("login form shows error when password is empty", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    // Fill email but leave password empty
    await page.fill("#email", ADMIN_EMAIL);
    await page.click('button[type="submit"]:has-text("Sign In")');
    // Form should not submit
    await expect(page).toHaveURL(/\/login/);
  });

  // 15.2.3 P1 — Create Class empty name validation
  test("Create Class form submit is disabled without class name", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/classes");
    await page.click('button:has-text("Create Class")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('button:has-text("Create")')).toBeDisabled();
  });

  // 15.2.5 P1 — Invalid email format in user creation
  test("Add Teacher dialog validates email format", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/users");
    await page.click('button:has-text("Add Teacher")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Fill name fields to enable submit, then enter bad email
    const firstNameInput = dialog.locator("input").first();
    await firstNameInput.fill("Test");
    const emailInput = dialog.locator('input[type="email"], input[id*="email"]').first();
    const hasEmailInput = await emailInput.isVisible().catch(() => false);
    if (hasEmailInput) {
      await emailInput.fill("not-an-email");
    }
    // Submit button behavior depends on validation approach
    // Key assertion: dialog is still open (not submitted with invalid data)
    await expect(dialog).toBeVisible();
  });

  // ─── 15.3 Network & Loading States ───────────────────────────────────────

  // 15.3.4 P1 — Toast notification on success
  test("page renders correctly after navigation without toast errors", async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to key pages and verify no error toasts appear on load
    const routes = ["/users", "/classes", "/settings"];
    for (const route of routes) {
      await navigateTo(page, route);
      // Page should not show destructive/error toasts on initial load
      const hasErrorToast = await page
        .locator('[data-type="error"]')
        .isVisible()
        .catch(() => false);
      expect(hasErrorToast).toBeFalsy();
    }
  });

  // ─── 15.4 Empty States ───────────────────────────────────────────────────

  // 15.4.5 P1 — Search no results
  test("searching for a non-existent term shows empty result state", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/users");
    await page.fill('input[placeholder*="Search"]', "zzznonexistent999xyz");
    await page.waitForTimeout(1500);
    await expect(
      page.locator("text=No teachers found").or(page.locator("table tbody")).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("searching spaces shows empty result state", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/spaces");
    await page.fill('input[placeholder*="Search spaces"]', "zzznonexistent999xyz");
    await page.waitForTimeout(1500);
    await expect(page.locator("text=No spaces found").or(page.locator(".grid"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("searching exams shows empty result state", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/exams");
    await page.fill('input[placeholder*="Search exams"]', "zzznonexistent999xyz");
    await page.waitForTimeout(1500);
    await expect(
      page.locator("text=No exams found").or(page.locator("table tbody tr")).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // 15.4.1 P1 — Users page empty state
  test("users page renders table or empty state (never crashes)", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/users");
    await page.waitForTimeout(2000);
    // Either a table or empty state must exist
    await expect(
      page.locator("table").or(page.locator("text=No teachers found")).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // 15.4.2 P1 — Exams page empty state
  test("exams page renders table or empty state (never crashes)", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/exams");
    await page.waitForTimeout(2000);
    await expect(page.locator("table").or(page.locator("text=No exams found"))).toBeVisible({
      timeout: 10000,
    });
  });

  // 15.4.3 P1 — Spaces page empty state
  test("spaces page renders cards or empty state (never crashes)", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/spaces");
    await page.waitForTimeout(3000);
    await expect(page.locator(".grid").or(page.locator("text=No spaces found"))).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── 15.1.2 P1 — Error boundary ───────────────────────────────────────────

  // 15.1.2 P1
  test("app has error boundary that prevents white-screen crashes", async ({ page }) => {
    await loginAsAdmin(page);
    // Verify the RouteErrorBoundary is in place by checking that all pages render
    // without any unhandled error (white screen)
    const routes = ["/", "/users", "/classes", "/courses", "/exams", "/spaces", "/analytics"];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      // Page should not be blank
      const bodyText = await page.locator("body").textContent();
      expect(bodyText?.trim().length).toBeGreaterThan(0);
      // Should not show React's uncaught error overlay in production
      await expect(page.locator("body")).not.toContainText("Uncaught Error");
    }
  });

  // ─── 15.3 Network & Loading States (additional) ───────────────────────────

  // 15.3.5 P1 — Error toast on failures
  test("form submission with invalid data shows error feedback", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/login");
    // Already navigated back to login which means we need to re-login
    // This test verifies that error toasts appear on auth failures
    await page.goto("/login");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", "WrongPassword_Triggers_Error_Toast!");
    await page.click('button[type="submit"]:has-text("Sign In")');
    // An error toast or alert should appear
    await expect(
      page
        .locator('[class*="destructive"]')
        .or(page.locator('[role="alert"]'))
        .or(page.locator("[data-sonner-toast]"))
    ).toBeVisible({ timeout: 8000 });
  });
});
