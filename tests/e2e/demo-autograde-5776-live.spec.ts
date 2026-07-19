/**
 * Live production demo: Autograde → practice space (sample zip 5776).
 *
 * Run:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="...\lvlup-ff6fa-firebase-adminsdk-....json"
 *   $env:TEACHER_WEB_URL="https://lvlup-ff6fa-teacher.web.app"
 *   $env:STUDENT_WEB_URL="https://lvlup-ff6fa-student.web.app"
 *   npx playwright test tests/e2e/demo-autograde-5776-live.spec.ts --project=autograde-live
 */
import { test, expect, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import admin from "firebase-admin";
async function setReactInput(page: Page, selector: string, value: string) {
  await page.locator(selector).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function teacherLogin(page: Page) {
  await page.goto("/login");
  await setReactInput(page, "#schoolCode", SCHOOL_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#email").waitFor({ state: "visible", timeout: 120_000 });
  await setReactInput(page, "#email", TEACHER_EMAIL);
  await setReactInput(page, "#password", TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(dashboard|exams)/, { timeout: 120_000 });
}

async function studentLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/school code/i).fill(SCHOOL_CODE);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel(/email/i).waitFor({ state: "visible", timeout: 60_000 });
  const emailTab = page.getByRole("tab", { name: /email/i });
  if (await emailTab.isVisible().catch(() => false)) await emailTab.click();
  await page.locator("#credential").fill(STUDENT_EMAIL);
  await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|spaces|home)/, { timeout: 60_000 });
}
import {
  waitForExtractedQuestions,
  waitForSubmissionStatus,
  waitForAllQuestionsGraded,
} from "./helpers/autograde-pipeline-waiter";

const DEMO_ROOT = path.resolve(__dirname, "../../../../tmp/demo-autograde-5776");
const DEMO_DIR = path.join(DEMO_ROOT, "extracted2/Autograde - Testing");
const SCREENSHOT_DIR = DEMO_ROOT;

const SCHOOL_CODE = "SUB001";
const TEACHER_EMAIL = "subhang.rocklee@gmail.com";
const TEACHER_PASSWORD = "Test@12345";
const STUDENT_EMAIL = "student.test@subhang.academy";
const STUDENT_PASSWORD = "Test@12345";
const TENANT_ID = "tenant_subhang";

// Math question paper (IPE-I-MATH) + answer sheets from nested zip 15.22.23
const MATH_QP = path.join(DEMO_ROOT, "nested/compressed-images/compressed_IPE-I-MATH-1A-AP.png");
const ANSWER_DIR = path.join(DEMO_ROOT, "nested/WhatsApp Unknown 2026-01-06 at 15.22.23");

function initAdmin() {
  if (admin.apps.length) return;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS required");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8"))),
    projectId: "lvlup-ff6fa",
  });
}

function answerSheetImages(): string[] {
  if (!fs.existsSync(ANSWER_DIR)) {
    // fallback: chaitanya answers subset
    const fallback = path.join(DEMO_DIR, "chaitanya/chaitanya-answers");
    return fs
      .readdirSync(fallback)
      .filter((f) => f.endsWith(".jpeg"))
      .slice(0, 6)
      .map((f) => path.join(fallback, f));
  }
  return fs
    .readdirSync(ANSWER_DIR)
    .filter((f) => f.endsWith(".jpeg"))
    .map((f) => path.join(ANSWER_DIR, f));
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

const sel = {
  examTitleInput: (p: Page) => p.getByPlaceholder("e.g. Mid-Term Mathematics"),
  subjectInput: (p: Page) => p.getByPlaceholder("Mathematics", { exact: true }),
  topicsInput: (p: Page) => p.getByPlaceholder("Algebra, Geometry"),
  nextBtn: (p: Page) => p.getByRole("button", { name: /^Next/ }),
  uploadAndContinueBtn: (p: Page) => p.getByRole("button", { name: /Upload & Continue/ }),
  continueToPublishBtn: (p: Page) => p.getByRole("button", { name: /Continue to Publish/ }),
  createExamBtn: (p: Page) => p.getByRole("button", { name: /^Create Exam/ }),
  extractQuestionsBtn: (p: Page) => p.getByRole("button", { name: /Extract Questions/ }),
  publishBtn: (p: Page) => p.getByRole("button", { name: /^Publish$/ }),
  uploadAnswerBtn: (p: Page) =>
    p.locator('button:has(svg.lucide-upload):has-text("Upload")').last(),
  gradePendingBtn: (p: Page) => p.getByRole("button", { name: /Grade \d+ Pending/ }),
  approveAllBtn: (p: Page) => p.getByRole("button", { name: /Approve All/ }),
};

test.describe("Demo Autograde 5776 — live SUB001", () => {
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  let examId = "";
  let submissionId = "";
  let spaceId = "";
  let storyPointId = "";
  let className = "";

  test.beforeAll(() => {
    initAdmin();
    if (!fs.existsSync(MATH_QP)) {
      throw new Error(`Math QP not found: ${MATH_QP}`);
    }
  });

  test("teacher: create Math exam, extract, grade, practice space", async ({ browser }) => {
    const teacherBase = process.env.TEACHER_WEB_URL ?? "https://lvlup-ff6fa-teacher.web.app";
    const ctx = await browser.newContext({ baseURL: teacherBase });
    const page = await ctx.newPage();

    await teacherLogin(page);
    await snap(page, "01-teacher-dashboard");

    // Create exam
    await page.goto("/exams/new");
    const title = `Math Demo 5776 ${Date.now()}`;
    await sel.examTitleInput(page).fill(title);
    await sel.subjectInput(page).fill("Mathematics");
    await sel.topicsInput(page).fill("Algebra, Geometry, Trigonometry");
    await page.locator('input[type="number"]').nth(0).fill("50");
    await page.locator('input[type="number"]').nth(1).fill("20");
    await page.locator('input[type="number"]').nth(2).fill("90");

    await page.getByRole("combobox").first().click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toBeVisible();
    const classOption = popover.getByRole("button", { name: /System Design|DSA|10 A/i }).first();
    className = (await classOption.textContent())?.trim() ?? "";
    await classOption.click();
    await page.keyboard.press("Escape");
    await sel.nextBtn(page).click();

    await page.locator('input[type="file"]').first().setInputFiles([MATH_QP]);
    await sel.uploadAndContinueBtn(page).click();
    await expect(page.getByText(/Review Exam Details/i)).toBeVisible({ timeout: 120_000 });
    await sel.continueToPublishBtn(page).click();
    await sel.createExamBtn(page).click();
    await page.waitForURL(/\/exams\/(?!new)[^/]+$/, { timeout: 120_000 });
    examId = page.url().split("/exams/")[1]!;
    await snap(page, "02-exam-created");

    // Extract questions
    await expect(sel.extractQuestionsBtn(page)).toBeVisible({ timeout: 60_000 });
    await sel.extractQuestionsBtn(page).click();
    const qCount = await waitForExtractedQuestions(TENANT_ID, examId, {
      timeoutMs: 300_000,
      onProgress: (m) => console.log("[extract]", m),
    });
    expect(qCount).toBeGreaterThan(0);
    await page.reload();
    await snap(page, "03-questions-extracted");

    // Publish
    await sel.publishBtn(page).click();
    await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 60_000 });
    await snap(page, "04-exam-published");

    // Upload answer sheets for test student
    await page.goto(`/exams/${examId}/submissions`);
    const studentCombo = page
      .getByRole("combobox")
      .filter({ hasText: /student/i })
      .first();
    await studentCombo.click();
    await page
      .getByRole("option")
      .filter({ hasText: /test|student/i })
      .first()
      .click();
    const answers = answerSheetImages();
    await page.locator('input[type="file"]').setInputFiles(answers);
    await sel.uploadAnswerBtn(page).click();
    await expect(page.locator('a[href*="/submissions/"]').first()).toBeVisible({
      timeout: 120_000,
    });
    submissionId = (await page
      .locator('a[href*="/submissions/"]')
      .first()
      .getAttribute("href"))!.split("/submissions/")[1]!;
    await snap(page, "05-answers-uploaded");

    // Wait for grading pipeline
    const pipelineStatus = await waitForSubmissionStatus(
      TENANT_ID,
      submissionId,
      ["grading_complete", "ready_for_review", "reviewed"],
      { timeoutMs: 600_000, onProgress: (s) => console.log("[pipeline]", s) }
    );
    console.log("pipelineStatus", pipelineStatus);

    // Review + approve
    await page.goto(`/exams/${examId}/submissions/${submissionId}`);
    if (
      await sel
        .gradePendingBtn(page)
        .isVisible()
        .catch(() => false)
    ) {
      await sel.gradePendingBtn(page).click();
      await waitForAllQuestionsGraded(TENANT_ID, submissionId, { timeoutMs: 300_000 });
    }
    await sel.approveAllBtn(page).click();
    const confirmBtn = page
      .locator('[role="alertdialog"] button')
      .filter({ hasText: /Approve|Confirm|Yes/ })
      .last();
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
    await waitForSubmissionStatus(TENANT_ID, submissionId, ["reviewed"], { timeoutMs: 120_000 });
    await snap(page, "06-grading-approved");

    // Create practice space BEFORE release (required for progress reconciliation)
    await page.goto(`/exams/${examId}`);
    const createPracticeBtn = page.getByRole("button", { name: /Create Practice Space/i });
    await expect(createPracticeBtn).toBeVisible({ timeout: 60_000 });
    await createPracticeBtn.click();
    await expect(page.getByText(/practice space/i).first()).toBeVisible({ timeout: 120_000 });
    await snap(page, "07-practice-space-created");

    // Release results
    const releaseBtn = page.getByRole("button", { name: /Release Results/ });
    await releaseBtn.click();
    await expect(page.getByText(/results_released|Results Released/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await snap(page, "08-results-released");

    // Read linked space ids from Firestore
    const examDoc = await admin.firestore().doc(`tenants/${TENANT_ID}/exams/${examId}`).get();
    spaceId = String(examDoc.data()?.linkedSpaceId ?? "");
    storyPointId = String(examDoc.data()?.linkedStoryPointId ?? "");

    const out = {
      examId,
      submissionId,
      spaceId,
      storyPointId,
      className,
      teacherUrl: `${teacherBase}/exams/${examId}`,
      studentSpaceUrl: `${process.env.STUDENT_WEB_URL ?? "https://lvlup-ff6fa-student.web.app"}/spaces/${spaceId}`,
    };
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "demo-result.json"), JSON.stringify(out, null, 2));
    console.log("DEMO_RESULT", JSON.stringify(out));

    await ctx.close();
  });

  test("student: open practice space and attempt wrong-topic items", async ({ browser }) => {
    const resultPath = path.join(SCREENSHOT_DIR, "demo-result.json");
    test.skip(!fs.existsSync(resultPath), "teacher step must run first");
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    spaceId = result.spaceId;
    storyPointId = result.storyPointId;
    test.skip(!spaceId, "no practice space id");

    const studentBase = process.env.STUDENT_WEB_URL ?? "https://lvlup-ff6fa-student.web.app";
    const ctx = await browser.newContext({ baseURL: studentBase });
    const page = await ctx.newPage();

    await studentLogin(page);
    await snap(page, "09-student-dashboard");

    await page.goto(`/spaces/${spaceId}`);
    await expect(page.getByText(/practice/i).first()).toBeVisible({ timeout: 60_000 });
    await snap(page, "10-student-space-overview");

    if (storyPointId) {
      await page.goto(`/spaces/${spaceId}/practice/${storyPointId}`);
    } else {
      await page
        .getByRole("link")
        .filter({ hasText: /practice/i })
        .first()
        .click();
    }
    await expect(page.locator("button").filter({ hasText: /^1$/ }).first()).toBeVisible({
      timeout: 60_000,
    });
    await snap(page, "11-student-practice-items");

    // Click first incomplete / wrong item and verify question UI
    const itemBtn = page.locator("button.rounded-full, button[class*='nav']").first();
    if (await itemBtn.isVisible().catch(() => false)) {
      await itemBtn.click();
      await snap(page, "12-student-practice-question");
    }

    await ctx.close();
  });
});
