import { test, expect } from "@playwright/test";

/**
 * Teacher Web — Exam CRUD E2E Tests.
 *
 * Skeleton tests for exam creation, editing, and publishing flows.
 */

test.describe("Exam CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated teacher session
    await page.goto("http://localhost:3002/login");
  });

  test("should navigate to create exam page", async ({ page }) => {
    // Skeleton: After login, navigate to exams
    // await page.getByRole('link', { name: /exams/i }).click();
    // await page.getByRole('button', { name: /create exam/i }).click();
    // await expect(page).toHaveURL(/exams\/new/);
  });

  test("should create exam with required fields", async ({ page }) => {
    // Skeleton: Fill exam creation form
    // await page.getByLabel(/title/i).fill('Mid-Term Math Exam');
    // await page.getByLabel(/subject/i).fill('Mathematics');
    // await page.getByRole('button', { name: /create/i }).click();
    // await expect(page.getByText(/exam created/i)).toBeVisible();
  });

  test("should upload question paper", async ({ page }) => {
    // Skeleton: Upload question paper images
    // const fileChooserPromise = page.waitForEvent('filechooser');
    // await page.getByRole('button', { name: /upload.*question paper/i }).click();
    // const fileChooser = await fileChooserPromise;
    // await fileChooser.setFiles('fixtures/question-paper.pdf');
  });

  test("should publish exam", async ({ page }) => {
    // Skeleton: Navigate to exam and publish
    // await page.getByRole('button', { name: /publish/i }).click();
    // await expect(page.getByText(/published/i)).toBeVisible();
  });
});
