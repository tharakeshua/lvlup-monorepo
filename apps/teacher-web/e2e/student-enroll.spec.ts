import { test } from "@playwright/test";

/**
 * Teacher Web — Student enrolment E2E Tests.
 *
 * Covers W2 (ClassDetail enroll/unenroll) and W3 (StudentsPage create/edit/archive).
 */

test.describe("Student enrolment", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated teacher session
    await page.goto("http://localhost:3002/login");
  });

  test("should create a student linking an existing UID", async ({ page }) => {
    // await page.getByRole('link', { name: /students/i }).first().click();
    // await page.getByRole('button', { name: /create student/i }).click();
    // await page.getByLabel(/firebase auth uid/i).fill('uid_abc123');
    // await page.getByLabel(/roll number/i).fill('21');
    // await page.getByLabel(/^grade$/i).fill('10');
    // await page.getByRole('button', { name: /create student/i }).click();
    // await expect(page.getByText(/student created/i)).toBeVisible();
  });

  test("should enroll students into a class via class detail page", async ({ page }) => {
    // await page.goto('http://localhost:3002/classes/abc');
    // await page.getByRole('tab', { name: /students/i }).click();
    // await page.getByRole('button', { name: /add student/i }).click();
    // await page.getByPlaceholder(/search by name/i).fill('Roll 21');
    // await page.getByRole('button', { name: /roll: 21/i }).click();
    // await page.getByRole('button', { name: /enroll 1 student/i }).click();
    // await expect(page.getByText(/enrolled 1 student/i)).toBeVisible();
  });

  test("should remove a student from a class without deleting the student", async ({ page }) => {
    // await page.getByRole('button', { name: /remove .* from class/i }).first().click();
    // await page.getByRole('button', { name: /^remove$/i }).click();
    // await expect(page.getByText(/student removed from class/i)).toBeVisible();
  });

  test("should archive a student", async ({ page }) => {
    // await page.getByRole('link', { name: /students/i }).first().click();
    // await page.getByRole('button', { name: /archive .*/i }).first().click();
    // await page.getByRole('button', { name: /^archive$/i }).click();
    // await expect(page.getByText(/student archived/i)).toBeVisible();
  });
});
