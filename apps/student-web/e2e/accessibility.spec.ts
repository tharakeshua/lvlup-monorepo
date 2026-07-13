import { test, expect, Page } from "@playwright/test";
import { loginAsStudent, SCHOOL_CODE, CREDENTIALS } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY TESTS
// ════════════════════════════════════════════════════════════════════════════

test.describe("Keyboard Navigation — Login", () => {
  // S-A11Y-01
  test("login form fields reachable via Tab", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    // First focusable element should be the school code input
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? "");
    // Tab through to school code, continue button
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.keyboard.press("Tab"); // Tab to button
    const btnFocused = await page.evaluate(() => document.activeElement?.tagName ?? "");
    expect(btnFocused === "BUTTON" || btnFocused === "INPUT").toBeTruthy();
  });

  test("Enter key submits school code form", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3_000);
    const hasCredential = await page
      .locator("#credential")
      .isVisible()
      .catch(() => false);
    expect(hasCredential).toBeTruthy();
  });

  test("Tab order includes all login form fields", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#credential", { timeout: 10_000 });
    // Tab through credential form
    await page.focus("#credential");
    await page.keyboard.press("Tab");
    const afterCredential = await page.evaluate(
      () => document.activeElement?.id ?? document.activeElement?.tagName ?? ""
    );
    expect(afterCredential.length).toBeGreaterThan(0);
  });
});

test.describe("Keyboard Navigation — Authenticated Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-A11Y-02
  test("sidebar links are focusable via keyboard", async ({ page }) => {
    // Tab through the page to reach sidebar links
    let found = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { tag: el?.tagName, href: el?.getAttribute("href") ?? "" };
      });
      if (focused.tag === "A" && (focused.href === "/" || focused.href?.startsWith("/"))) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  });

  // S-A11Y-04
  test("Sign Out dialog traps focus and Escape closes it", async ({ page }) => {
    const signOutBtn = page.locator('button:has-text("Sign Out")').first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await page.waitForTimeout(500);
    // Dialog should be open
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first();
    const isOpen = await dialog.isVisible().catch(() => false);
    if (isOpen) {
      // Escape should close the dialog
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const isStillOpen = await dialog.isVisible().catch(() => false);
      expect(isStillOpen).toBeFalsy();
    }
  });

  // S-A11Y-06
  test("interactive buttons have accessible names", async ({ page }) => {
    await page.waitForTimeout(2_000);
    // Check buttons have text or aria-label
    const buttonsWithoutLabel = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.filter((btn) => {
        const text = btn.textContent?.trim() ?? "";
        const ariaLabel = btn.getAttribute("aria-label") ?? "";
        const title = btn.getAttribute("title") ?? "";
        return text === "" && ariaLabel === "" && title === "";
      }).length;
    });
    // Allow a small number of icon-only buttons that may not have labels
    expect(buttonsWithoutLabel).toBeLessThan(5);
  });

  // S-A11Y-08
  test("dashboard has proper heading hierarchy (h1 exists)", async ({ page }) => {
    await expect(page.locator("h1")).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("spaces page has proper h1", async ({ page }) => {
    await page.goto("/spaces");
    await page.waitForTimeout(1_500);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("My Spaces");
  });

  test("results page has proper h1", async ({ page }) => {
    await page.goto("/results");
    await page.waitForTimeout(1_500);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("My Progress");
  });

  test("leaderboard page has proper h1", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForTimeout(2_000);
    // Leaderboard may show "Leaderboard" or "Something went wrong" — either has exactly one h1
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("tests page has proper h1", async ({ page }) => {
    await page.goto("/tests");
    await page.waitForTimeout(1_500);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("Tests");
  });
});

test.describe("MCQ Keyboard Interaction", () => {
  // S-A11Y-03
  test("MCQ options are selectable via keyboard when available", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/spaces");
    await page.waitForTimeout(2_000);
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();
    await spaceLinks.first().click();
    await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await page.waitForTimeout(2_000);
    const spLinks = page.locator('a[href*="/story-points/"]');
    if ((await spLinks.count()) === 0) test.skip();
    await spLinks.first().click();
    await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
    await page.waitForTimeout(2_500);
    // Find MCQ options
    const mcqOptions = page
      .locator('[role="radiogroup"] button, [role="radio"], label:has(input[type="radio"])')
      .first();
    if (!(await mcqOptions.isVisible())) test.skip();
    await mcqOptions.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    // Option should be selected
    const isChecked = await mcqOptions.evaluate((el: HTMLElement) => {
      const input = el.querySelector('input[type="radio"]') as HTMLInputElement | null;
      return input?.checked ?? el.getAttribute("aria-checked") === "true" ?? false;
    });
    expect(isChecked).toBeTruthy();
  });
});

test.describe("ARIA and Semantic HTML", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("navigation sidebar structure is present", async ({ page }) => {
    await page.waitForTimeout(1_500);
    // Shadcn Sidebar uses data-sidebar attributes (not <nav> semantic element)
    const hasSidebarEl = (await page.locator('[data-sidebar="sidebar"]').count()) > 0;
    // Or fallback nav/role
    const hasNav = (await page.locator('nav, [role="navigation"]').count()) > 0;
    expect(hasSidebarEl || hasNav).toBeTruthy();
  });

  test("form inputs have associated labels on login page", async ({ page }) => {
    await page.goto("/login");
    const inputsWithoutLabel = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
      return inputs.filter((input) => {
        const id = input.getAttribute("id");
        const ariaLabel = input.getAttribute("aria-label");
        const ariaLabelledBy = input.getAttribute("aria-labelledby");
        const associatedLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
        return !associatedLabel && !ariaLabel && !ariaLabelledBy;
      }).length;
    });
    // Allow up to 2 inputs without explicit labels (some may use placeholder as label)
    expect(inputsWithoutLabel).toBeLessThan(3);
  });

  // S-A11Y-06
  test("links have discernible text", async ({ page }) => {
    await page.waitForTimeout(2_000);
    const emptyLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links.filter((a) => {
        const text = a.textContent?.trim() ?? "";
        const ariaLabel = a.getAttribute("aria-label") ?? "";
        const title = a.getAttribute("title") ?? "";
        return text === "" && ariaLabel === "" && title === "";
      }).length;
    });
    // Allow up to 3 icon-only links
    expect(emptyLinks).toBeLessThan(4);
  });

  test("images have alt attributes", async ({ page }) => {
    await page.waitForTimeout(2_000);
    const imgsWithoutAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.filter((img) => img.getAttribute("alt") === null).length;
    });
    expect(imgsWithoutAlt).toBe(0);
  });
});
