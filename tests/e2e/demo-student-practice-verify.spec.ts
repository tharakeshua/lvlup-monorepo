/** Quick student practice space verification */
import { test, expect } from "@playwright/test";
import { loginStudentWithEmail } from "./helpers/auth";

const SPACE_ID = process.env.DEMO_SPACE_ID ?? "y8YPp9jvifpJLPdHb1cz";
const STORY_POINT_ID = process.env.DEMO_STORY_POINT_ID ?? "hdPTazHzsAF4q1FVhZ7g";
const BASE = process.env.STUDENT_WEB_URL ?? "https://lvlup-ff6fa-student.web.app";

test("student opens practice space", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await loginStudentWithEmail(page, "SUB001", "student.test@subhang.academy", "Test@12345");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 120_000 });

  await page.goto(`${BASE}/spaces/${SPACE_ID}/practice/${STORY_POINT_ID}`);
  await expect(page.getByText(/question|practice|Q1/i).first()).toBeVisible({ timeout: 60_000 });
  await page.screenshot({
    path: "../../tmp/demo-autograde-5776/13-student-practice-verified.png",
    fullPage: true,
  });
});
