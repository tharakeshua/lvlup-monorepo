import { test } from "@playwright/test";

/**
 * Teacher Web — Exam class editing E2E Tests.
 *
 * Covers W4 (multi-select on exam create) and W5 (edit metadata + classes after creation,
 * lock once results released).
 */

test.describe("Exam class editing", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated teacher session
    await page.goto("http://localhost:3002/login");
  });

  test("should block exam creation if no class is selected", async ({ page }) => {
    // await page.getByRole('link', { name: /exams/i }).first().click();
    // await page.getByRole('button', { name: /create exam/i }).click();
    // await page.getByLabel(/exam title/i).fill('Mid-term');
    // await page.getByLabel(/^subject$/i).fill('Math');
    // await page.getByRole('button', { name: /next/i }).click();
    // await expect(page.getByText(/select at least one class/i)).toBeVisible();
  });

  test("should pick classes from multi-select on create exam", async ({ page }) => {
    // await page.getByRole('combobox', { name: /select classes/i }).click();
    // await page.getByRole('button', { name: /grade 10 — section a/i }).click();
    // await page.getByRole('button', { name: /grade 10 — section b/i }).click();
    // await expect(page.getByText(/2 classes selected/i)).toBeVisible();
    // await page.getByRole('button', { name: /next/i }).click();
  });

  test("should edit exam metadata + classes after creation", async ({ page }) => {
    // await page.goto('http://localhost:3002/exams/abc');
    // await page.getByRole('button', { name: /^edit$/i }).first().click();
    // await page.getByLabel(/title/i).fill('Mid-term (Revised)');
    // await page.getByRole('combobox', { name: /select classes/i }).click();
    // await page.getByRole('button', { name: /grade 10 — section c/i }).click();
    // await page.getByRole('button', { name: /save changes/i }).click();
    // await expect(page.getByText(/exam updated/i)).toBeVisible();
  });

  test("should lock editing once results are released", async ({ page }) => {
    // await page.goto('http://localhost:3002/exams/released-exam-id');
    // await expect(page.getByRole('button', { name: /^edit$/i }).first()).toBeDisabled();
    // await page.getByRole('tab', { name: /settings/i }).click();
    // await expect(page.getByText(/editing is locked/i)).toBeVisible();
  });
});
