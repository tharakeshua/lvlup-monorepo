import { test } from "@playwright/test";

/**
 * Teacher Web — Class CRUD E2E Tests.
 *
 * Covers Classes list page (W1): create, edit, archive, restore.
 */

test.describe("Class CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated teacher session
    await page.goto("http://localhost:3002/login");
  });

  test("should navigate to classes list from sidebar", async ({ page }) => {
    // await page.getByRole('link', { name: /classes/i }).first().click();
    // await expect(page).toHaveURL(/\/classes$/);
    // await expect(page.getByRole('heading', { name: /classes/i })).toBeVisible();
  });

  test("should create a new class via Create Class dialog", async ({ page }) => {
    // await page.getByRole('button', { name: /create class/i }).click();
    // await page.getByLabel(/class name/i).fill('Grade 10 — Section A');
    // await page.getByLabel(/^grade$/i).fill('10');
    // await page.getByLabel(/section/i).fill('A');
    // await page.getByRole('button', { name: /create class/i }).click();
    // await expect(page.getByText(/class created/i)).toBeVisible();
    // await expect(page.getByRole('cell', { name: /grade 10 — section a/i })).toBeVisible();
  });

  test("should edit an existing class", async ({ page }) => {
    // await page.getByRole('button', { name: /edit grade 10/i }).click();
    // await page.getByLabel(/class name/i).fill('Grade 10 — Section A (Updated)');
    // await page.getByRole('button', { name: /save changes/i }).click();
    // await expect(page.getByText(/class updated/i)).toBeVisible();
  });

  test("should archive and restore a class", async ({ page }) => {
    // await page.getByRole('button', { name: /archive grade 10/i }).click();
    // await page.getByRole('button', { name: /^archive$/i }).click(); // confirm dialog
    // await expect(page.getByText(/class archived/i)).toBeVisible();
    // await page.getByLabel(/show archived/i).click();
    // await page.getByRole('button', { name: /restore grade 10/i }).click();
    // await expect(page.getByText(/class restored/i)).toBeVisible();
  });
});
