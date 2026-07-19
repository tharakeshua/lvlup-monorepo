/**
 * Minimal auth smoke tests for CI — one successful login per app.
 * Hits production Firebase (GRN001 / Greenwood seed credentials).
 */
import { test } from "@playwright/test";
import {
  loginDirect,
  loginWithSchoolCode,
  loginStudentWithEmail,
  expectDashboard,
} from "./helpers/auth";
import { CREDENTIALS, SELECTORS, SCHOOL_CODE } from "./helpers/selectors";

const HOST = "127.0.0.1";

test.describe("CI Smoke @ci-smoke", () => {
  test("super-admin login reaches dashboard", async ({ page }) => {
    await page.goto(`http://${HOST}:4567/login`);
    await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
    await expectDashboard(page, SELECTORS.dashboards.superAdmin);
  });

  test("admin-web login reaches dashboard", async ({ page }) => {
    await page.goto(`http://${HOST}:4568/login`);
    await loginWithSchoolCode(
      page,
      SCHOOL_CODE,
      CREDENTIALS.tenantAdmin.email,
      CREDENTIALS.tenantAdmin.password
    );
    await expectDashboard(page, SELECTORS.dashboards.schoolAdmin);
  });

  test("teacher-web login reaches dashboard", async ({ page }) => {
    await page.goto(`http://${HOST}:4569/login`);
    await loginWithSchoolCode(
      page,
      SCHOOL_CODE,
      CREDENTIALS.teacher1.email,
      CREDENTIALS.teacher1.password
    );
    await expectDashboard(page, SELECTORS.dashboards.teacher);
  });

  test("student-web login reaches dashboard", async ({ page }) => {
    await page.goto(`http://${HOST}:4570/login`);
    await loginStudentWithEmail(
      page,
      SCHOOL_CODE,
      CREDENTIALS.student1.email,
      CREDENTIALS.student1.password
    );
    await expectDashboard(page, SELECTORS.dashboards.student);
  });

  test("parent-web login reaches dashboard", async ({ page }) => {
    await page.goto(`http://${HOST}:4571/login`);
    await loginWithSchoolCode(
      page,
      SCHOOL_CODE,
      CREDENTIALS.parent1.email,
      CREDENTIALS.parent1.password
    );
    await expectDashboard(page, SELECTORS.dashboards.parent);
  });
});
