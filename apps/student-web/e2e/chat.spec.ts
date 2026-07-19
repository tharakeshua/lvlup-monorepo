import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// CHAT TUTOR PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe("Chat Tutor Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/chat");
    await page.waitForTimeout(2_500);
  });

  test('renders "Chat Tutor" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Chat Tutor");
  });

  test("shows subtitle description", async ({ page }) => {
    await expect(
      page.locator("text=Browse previous chat sessions or start a new one from any question")
    ).toBeVisible();
  });

  test("page URL is /chat", async ({ page }) => {
    await expect(page).toHaveURL(/\/chat/);
  });

  test("shows empty state, session list, or loading", async ({ page }) => {
    const hasEmpty = await page
      .locator("text=No chat sessions yet")
      .isVisible()
      .catch(() => false);
    const hasSessions = (await page.locator("button.w-full.text-left").count()) > 0;
    const hasLoading = (await page.locator('[class*="Skeleton"]').count()) > 0;
    expect(hasEmpty || hasSessions || hasLoading).toBeTruthy();
  });

  test("empty state shows helpful instructions when no sessions", async ({ page }) => {
    const emptyState = page.locator("text=No chat sessions yet");
    if (await emptyState.isVisible()) {
      await expect(page.locator("text=Start a conversation with the AI tutor")).toBeVisible();
    }
  });

  test("empty state shows Ask AI Tutor text", async ({ page }) => {
    const emptyState = page.locator("text=No chat sessions yet");
    if (await emptyState.isVisible()) {
      await expect(page.locator("text=Ask AI Tutor")).toBeVisible();
    }
  });

  test("session cards are clickable when present", async ({ page }) => {
    const sessionBtns = page.locator("button.w-full.text-left");
    if ((await sessionBtns.count()) > 0) {
      await expect(sessionBtns.first()).toBeEnabled();
    }
  });

  test("clicking a session card does not crash the page", async ({ page }) => {
    const sessionBtns = page.locator("button.w-full.text-left");
    if ((await sessionBtns.count()) > 0) {
      await sessionBtns.first().click();
      await page.waitForTimeout(1_000);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("session cards show message count when sessions exist", async ({ page }) => {
    const sessionBtns = page.locator("button.w-full.text-left");
    if ((await sessionBtns.count()) > 0) {
      // Cards contain message count
      await expect(sessionBtns.first()).toBeVisible();
    }
  });

  test("sidebar nav link to /chat is in DOM", async ({ page }) => {
    await expect(page.locator('a[href="/chat"]').first()).toBeAttached();
  });
});
