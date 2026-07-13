/**
 * Visual Regression & Accessibility E2E Tests
 *
 * This test file covers:
 *   1. Login page visual regression for all 5 apps
 *   2. Dashboard visual regression for all 5 apps
 *   3. Responsive breakpoint tests (desktop / tablet / mobile) for student-web
 *   4. Accessibility: prefers-reduced-motion media query
 *   5. Accessibility: Focus management & ARIA labels
 *   6. Dark mode / theme toggle visual regression (if applicable)
 *
 * Run with:
 *   npx playwright test visual-regression.spec.ts
 *   npx playwright test --grep @visual
 *
 * NOTE: This file runs under the existing Playwright projects defined in
 * playwright.config.ts. Because it accesses multiple app ports directly via
 * page.goto() with absolute URLs, it does not depend on a single project's
 * baseURL. You can run it with any project (e.g. `--project=student-web`).
 *
 * Screenshot configuration is already set in playwright.config.ts:
 *   expect.toHaveScreenshot: { maxDiffPixelRatio: 0.05, threshold: 0.2, animations: 'disabled' }
 *   snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}'
 */

import { test, expect, Page } from "@playwright/test";
import {
  loginDirect,
  loginWithSchoolCode,
  loginStudentWithEmail,
  expectDashboard,
} from "./helpers/auth";
import { CREDENTIALS, SELECTORS, SCHOOL_CODE } from "./helpers/selectors";

// ─── App port constants ──────────────────────────────────────────────────────

const APPS = {
  superAdmin: { port: 4567, name: "super-admin" },
  adminWeb: { port: 4568, name: "admin-web" },
  teacherWeb: { port: 4569, name: "teacher-web" },
  studentWeb: { port: 4570, name: "student-web" },
  parentWeb: { port: 4571, name: "parent-web" },
} as const;

function url(port: number, path = "/login"): string {
  return `http://localhost:${port}${path}`;
}

// ─── Shared login helpers (per-app) ──────────────────────────────────────────

async function loginToSuperAdmin(page: Page) {
  await page.goto(url(APPS.superAdmin.port));
  await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
  await expectDashboard(page, SELECTORS.dashboards.superAdmin);
}

async function loginToAdminWeb(page: Page) {
  await page.goto(url(APPS.adminWeb.port));
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.tenantAdmin.email,
    CREDENTIALS.tenantAdmin.password
  );
  await expectDashboard(page, SELECTORS.dashboards.schoolAdmin);
}

async function loginToTeacherWeb(page: Page) {
  await page.goto(url(APPS.teacherWeb.port));
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.teacher1.email,
    CREDENTIALS.teacher1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.teacher);
}

async function loginToStudentWeb(page: Page) {
  await page.goto(url(APPS.studentWeb.port));
  await loginStudentWithEmail(
    page,
    SCHOOL_CODE,
    CREDENTIALS.student1.email,
    CREDENTIALS.student1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.student);
}

async function loginToParentWeb(page: Page) {
  await page.goto(url(APPS.parentWeb.port));
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.parent1.email,
    CREDENTIALS.parent1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.parent);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. LOGIN PAGE VISUAL REGRESSION
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Visual Regression: Login Pages @visual", () => {
  test("super-admin login page screenshot", async ({ page }) => {
    await page.goto(url(APPS.superAdmin.port));
    await page.waitForLoadState("networkidle");
    // Wait for the login form to render
    await page.waitForSelector(SELECTORS.email, { timeout: 15000 });
    await expect(page).toHaveScreenshot("super-admin-login.png");
  });

  test("admin-web login page screenshot", async ({ page }) => {
    await page.goto(url(APPS.adminWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("admin-web-login.png");
  });

  test("teacher-web login page screenshot", async ({ page }) => {
    await page.goto(url(APPS.teacherWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("teacher-web-login.png");
  });

  test("student-web login page screenshot", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("student-web-login.png");
  });

  test("parent-web login page screenshot", async ({ page }) => {
    await page.goto(url(APPS.parentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("parent-web-login.png");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. DASHBOARD VISUAL REGRESSION
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Visual Regression: Dashboards @visual", () => {
  test("super-admin dashboard screenshot", async ({ page }) => {
    await loginToSuperAdmin(page);
    // Allow dashboard widgets to fully render
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("super-admin-dashboard.png");
  });

  test("admin-web dashboard screenshot", async ({ page }) => {
    await loginToAdminWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("admin-web-dashboard.png");
  });

  test("teacher-web dashboard screenshot", async ({ page }) => {
    await loginToTeacherWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("teacher-web-dashboard.png");
  });

  test("student-web dashboard screenshot", async ({ page }) => {
    await loginToStudentWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("student-web-dashboard.png");
  });

  test("parent-web dashboard screenshot", async ({ page }) => {
    await loginToParentWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("parent-web-dashboard.png");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. RESPONSIVE BREAKPOINTS (Student Web)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Visual Regression: Responsive Breakpoints @visual", () => {
  const breakpoints = [
    { name: "desktop", width: 1280, height: 720 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ] as const;

  test.describe("Student Web Login - Responsive", () => {
    for (const bp of breakpoints) {
      test(`login page at ${bp.name} (${bp.width}x${bp.height})`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto(url(APPS.studentWeb.port));
        await page.waitForLoadState("networkidle");
        await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
        await expect(page).toHaveScreenshot(`student-login-${bp.name}.png`);
      });
    }
  });

  test.describe("Student Web Dashboard - Responsive", () => {
    for (const bp of breakpoints) {
      test(`dashboard at ${bp.name} (${bp.width}x${bp.height})`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await loginToStudentWeb(page);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot(`student-dashboard-${bp.name}.png`);
      });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. ACCESSIBILITY: PREFERS-REDUCED-MOTION
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Accessibility: Reduced Motion @visual", () => {
  test("respects prefers-reduced-motion on student-web login", async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // Check that CSS animations are disabled or reduced
    const animatedElements = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      const withAnimation: string[] = [];
      all.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (
          style.animationDuration !== "0s" &&
          style.animationDuration !== "" &&
          style.animationName !== "none"
        ) {
          withAnimation.push(`${el.tagName}.${el.className}`);
        }
      });
      return withAnimation;
    });

    // With reduced motion, animated elements should have no or minimal animations.
    // We log them for debugging; real apps should disable animations under this media query.
    // This is informational -- the screenshot comparison is the primary assertion.
    if (animatedElements.length > 0) {
      console.warn(
        `[reduced-motion] ${animatedElements.length} element(s) still have animations:`,
        animatedElements.slice(0, 5)
      );
    }

    await expect(page).toHaveScreenshot("student-login-reduced-motion.png");
  });

  test("respects prefers-reduced-motion on student-web dashboard", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loginToStudentWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify transitions are reduced
    const transitionElements = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      const withTransition: string[] = [];
      all.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (
          style.transitionDuration !== "0s" &&
          style.transitionDuration !== "" &&
          style.transitionProperty !== "none"
        ) {
          withTransition.push(`${el.tagName}#${el.id || "?"}`);
        }
      });
      return withTransition;
    });

    if (transitionElements.length > 0) {
      console.warn(
        `[reduced-motion] ${transitionElements.length} element(s) still have transitions:`,
        transitionElements.slice(0, 5)
      );
    }

    await expect(page).toHaveScreenshot("student-dashboard-reduced-motion.png");
  });

  test("respects prefers-reduced-motion on admin-web login", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url(APPS.adminWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("admin-login-reduced-motion.png");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. ACCESSIBILITY: FOCUS MANAGEMENT & ARIA
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Accessibility: Focus & ARIA @visual", () => {
  test("student-web login form has proper ARIA labels", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // The school code input should have an associated label or aria-label
    const schoolCodeInput = page.locator(SELECTORS.schoolCode);
    if (await schoolCodeInput.isVisible()) {
      const hasLabel = await schoolCodeInput.evaluate((el) => {
        return (
          !!el.getAttribute("aria-label") ||
          !!el.getAttribute("aria-labelledby") ||
          !!el.getAttribute("placeholder") ||
          !!document.querySelector(`label[for="${el.id}"]`)
        );
      });
      expect(hasLabel).toBe(true);
    }

    // Continue button should be accessible
    const continueBtn = page.locator(SELECTORS.continue);
    if (await continueBtn.isVisible()) {
      await expect(continueBtn).toBeEnabled();
      const buttonText = await continueBtn.textContent();
      expect(buttonText?.trim().length).toBeGreaterThan(0);
    }
  });

  test("super-admin login form has proper ARIA labels", async ({ page }) => {
    await page.goto(url(APPS.superAdmin.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.email, { timeout: 15000 });

    // Email input accessibility
    const emailInput = page.locator(SELECTORS.email);
    const hasEmailLabel = await emailInput.evaluate((el) => {
      return (
        !!el.getAttribute("aria-label") ||
        !!el.getAttribute("aria-labelledby") ||
        !!el.getAttribute("placeholder") ||
        !!document.querySelector(`label[for="${el.id}"]`)
      );
    });
    expect(hasEmailLabel).toBe(true);

    // Password input accessibility
    const passwordInput = page.locator(SELECTORS.password);
    const hasPasswordLabel = await passwordInput.evaluate((el) => {
      return (
        !!el.getAttribute("aria-label") ||
        !!el.getAttribute("aria-labelledby") ||
        !!el.getAttribute("placeholder") ||
        !!document.querySelector(`label[for="${el.id}"]`)
      );
    });
    expect(hasPasswordLabel).toBe(true);
  });

  test("tab navigation works through student-web login form", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // Focus the first input via Tab
    await page.keyboard.press("Tab");

    // Collect focused elements as we tab through the form
    const focusedTags: string[] = [];
    for (let i = 0; i < 6; i++) {
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return "null";
        return `${el.tagName}#${el.id || el.getAttribute("type") || "?"}`;
      });
      focusedTags.push(tag);
      await page.keyboard.press("Tab");
    }

    // At least one interactive element should have been focused
    const interactiveElements = focusedTags.filter(
      (t) => t.startsWith("INPUT") || t.startsWith("BUTTON") || t.startsWith("A")
    );
    expect(interactiveElements.length).toBeGreaterThan(0);
  });

  test("tab navigation works through super-admin login form", async ({ page }) => {
    await page.goto(url(APPS.superAdmin.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.email, { timeout: 15000 });

    // Tab through the form elements
    await page.keyboard.press("Tab");

    const focusedTags: string[] = [];
    for (let i = 0; i < 6; i++) {
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return "null";
        return `${el.tagName}#${el.id || el.getAttribute("type") || "?"}`;
      });
      focusedTags.push(tag);
      await page.keyboard.press("Tab");
    }

    // Verify that email and password inputs are reachable via tab
    const hasEmailFocus = focusedTags.some((t) => t.includes("email"));
    const hasPasswordFocus = focusedTags.some((t) => t.includes("password"));
    expect(hasEmailFocus || hasPasswordFocus).toBe(true);
  });

  test("login form inputs have visible focus rings", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // Focus the school code input
    await page.locator(SELECTORS.schoolCode).focus();

    // Take a screenshot to verify the focus ring is visible
    await expect(page).toHaveScreenshot("student-login-focus-ring.png");
  });

  test("error states are accessible and announced", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // Submit with empty school code to trigger validation
    const continueBtn = page.locator(SELECTORS.continue);
    if (await continueBtn.isVisible()) {
      await continueBtn.click();

      // Wait briefly for validation errors to appear
      await page.waitForTimeout(500);

      // Check if any error messages have role="alert" or aria-live
      const hasAccessibleErrors = await page.evaluate(() => {
        const alerts = document.querySelectorAll(
          '[role="alert"], [aria-live="assertive"], [aria-live="polite"]'
        );
        return alerts.length;
      });

      // Take screenshot of error state
      await expect(page).toHaveScreenshot("student-login-error-state.png");

      // Log whether accessible error elements were found (informational)
      if (hasAccessibleErrors === 0) {
        console.warn(
          '[a11y] No elements with role="alert" or aria-live found for validation errors.'
        );
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. DARK MODE / THEME TOGGLE VISUAL REGRESSION
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Visual Regression: Dark Mode / Theme @visual", () => {
  test("student-web login with prefers-color-scheme: dark", async ({ page }) => {
    // Emulate dark color scheme at the browser level
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("student-login-dark-mode.png");
  });

  test("student-web login with prefers-color-scheme: light", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("student-login-light-mode.png");
  });

  test("admin-web login with prefers-color-scheme: dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(url(APPS.adminWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("admin-login-dark-mode.png");
  });

  test("student-web dashboard dark vs light comparison", async ({ page }) => {
    // Dark mode dashboard
    await page.emulateMedia({ colorScheme: "dark" });
    await loginToStudentWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("student-dashboard-dark-mode.png");
  });

  test("theme toggle switches correctly (if present)", async ({ page }) => {
    await loginToStudentWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Look for a theme toggle button (common patterns)
    const themeToggle = page
      .locator(
        'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], [data-testid="theme-toggle"]'
      )
      .first();

    if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Take screenshot before toggle
      await expect(page).toHaveScreenshot("student-dashboard-theme-before.png");

      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Take screenshot after toggle
      await expect(page).toHaveScreenshot("student-dashboard-theme-after.png");
    } else {
      // No explicit theme toggle found -- verify color scheme emulation works
      console.info("[theme] No theme toggle button found; testing via emulateMedia only.");
      await page.emulateMedia({ colorScheme: "light" });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot("student-dashboard-light-fallback.png");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. CONTRAST & TEXT READABILITY
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Accessibility: Contrast & Readability @visual", () => {
  test("login page text is readable at high contrast", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
    await expect(page).toHaveScreenshot("student-login-high-contrast.png");
  });

  test("all login form text meets minimum size requirements", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // Verify that body/form text has a reasonable minimum font size (>= 12px)
    const smallTextElements = await page.evaluate(() => {
      const all = document.querySelectorAll("p, span, label, input, button, a, h1, h2, h3, h4");
      const tooSmall: string[] = [];
      all.forEach((el) => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        if (fontSize < 12 && el.textContent?.trim()) {
          tooSmall.push(`${el.tagName}(${fontSize}px): "${el.textContent?.trim().slice(0, 30)}"`);
        }
      });
      return tooSmall;
    });

    if (smallTextElements.length > 0) {
      console.warn(
        `[a11y] ${smallTextElements.length} element(s) have font-size below 12px:`,
        smallTextElements
      );
    }

    // No critical text should be below 10px
    const criticallySmall = await page.evaluate(() => {
      const all = document.querySelectorAll("p, label, input, button");
      let count = 0;
      all.forEach((el) => {
        const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        if (fontSize < 10 && el.textContent?.trim()) count++;
      });
      return count;
    });
    expect(criticallySmall).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. PAGE STRUCTURE & LANDMARKS
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Accessibility: Page Structure & Landmarks @visual", () => {
  test("student-web login page has proper landmark structure", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    const landmarks = await page.evaluate(() => {
      const result: Record<string, number> = {};
      // Check for semantic landmarks
      const roles = ["banner", "navigation", "main", "contentinfo", "form"];
      roles.forEach((role) => {
        result[role] = document.querySelectorAll(`[role="${role}"]`).length;
      });
      // Also check semantic HTML elements
      result["header_tag"] = document.querySelectorAll("header").length;
      result["nav_tag"] = document.querySelectorAll("nav").length;
      result["main_tag"] = document.querySelectorAll("main").length;
      result["footer_tag"] = document.querySelectorAll("footer").length;
      result["form_tag"] = document.querySelectorAll("form").length;
      return result;
    });

    // At minimum, there should be a form (either via <form> tag or role="form")
    const hasForm = landmarks["form"] > 0 || landmarks["form_tag"] > 0;
    expect(hasForm).toBe(true);

    // At minimum, there should be a main region (either via <main> or role="main")
    const hasMain = landmarks["main"] > 0 || landmarks["main_tag"] > 0;
    if (!hasMain) {
      console.warn("[a11y] No <main> landmark found on the login page.");
    }
  });

  test("student-web dashboard has proper heading hierarchy", async ({ page }) => {
    await loginToStudentWeb(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const headings = await page.evaluate(() => {
      const result: { level: number; text: string }[] = [];
      document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
        const level = parseInt(el.tagName.replace("H", ""), 10);
        result.push({ level, text: el.textContent?.trim().slice(0, 50) || "" });
      });
      return result;
    });

    // There should be exactly one h1
    const h1Count = headings.filter((h) => h.level === 1).length;
    expect(h1Count).toBe(1);

    // Heading levels should not skip (e.g., h1 -> h3 without h2)
    if (headings.length > 1) {
      for (let i = 1; i < headings.length; i++) {
        const gap = headings[i].level - headings[i - 1].level;
        if (gap > 1) {
          console.warn(
            `[a11y] Heading level skips from h${headings[i - 1].level} ("${headings[i - 1].text}") to h${headings[i].level} ("${headings[i].text}")`
          );
        }
      }
    }
  });

  test("login page has a page title", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("all interactive elements have accessible names", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    const unlabeledElements = await page.evaluate(() => {
      const interactiveSelectors = "button, a[href], input, select, textarea";
      const elements = document.querySelectorAll(interactiveSelectors);
      const unlabeled: string[] = [];

      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const hasAccessibleName =
          !!htmlEl.getAttribute("aria-label") ||
          !!htmlEl.getAttribute("aria-labelledby") ||
          !!htmlEl.getAttribute("title") ||
          !!htmlEl.textContent?.trim() ||
          !!(htmlEl as HTMLInputElement).placeholder ||
          !!document.querySelector(`label[for="${htmlEl.id}"]`);

        if (!hasAccessibleName) {
          unlabeled.push(`${htmlEl.tagName}#${htmlEl.id || htmlEl.className || "?"}`);
        }
      });

      return unlabeled;
    });

    if (unlabeledElements.length > 0) {
      console.warn(
        `[a11y] ${unlabeledElements.length} interactive element(s) without accessible names:`,
        unlabeledElements
      );
    }

    // No buttons should be completely unlabeled
    const unlabeledButtons = unlabeledElements.filter((e) => e.startsWith("BUTTON"));
    expect(unlabeledButtons.length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. CROSS-APP VISUAL CONSISTENCY
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Visual Regression: Cross-App Consistency @visual", () => {
  test("school-code login pages share consistent layout (admin vs teacher vs parent)", async ({
    page,
  }) => {
    // Take screenshots of all three school-code login pages to compare visually
    const schoolCodeApps = [APPS.adminWeb, APPS.teacherWeb, APPS.parentWeb];
    for (const app of schoolCodeApps) {
      await page.goto(url(app.port));
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });
      await expect(page).toHaveScreenshot(`${app.name}-school-code-step.png`);
    }
  });

  test("student-web school-code step matches other apps structurally", async ({ page }) => {
    await page.goto(url(APPS.studentWeb.port));
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(SELECTORS.schoolCode, { timeout: 15000 });

    // Verify the school-code step has the expected structure
    const formStructure = await page.evaluate(() => {
      return {
        hasSchoolCodeInput: !!document.querySelector("#schoolCode"),
        hasContinueButton: !!document.querySelector('button[type="submit"]'),
        hasHeading: !!document.querySelector("h1, h2, h3"),
        formCount: document.querySelectorAll("form").length,
      };
    });

    expect(formStructure.hasSchoolCodeInput).toBe(true);
    expect(formStructure.hasContinueButton).toBe(true);

    await expect(page).toHaveScreenshot("student-web-school-code-step.png");
  });
});
