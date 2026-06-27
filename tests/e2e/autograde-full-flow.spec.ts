/**
 * autograde-full-flow.spec.ts
 *
 * SCAFFOLD spec covering the full autograde exam lifecycle in teacher-web:
 *   1. Login (storageState reuse — Firebase Auth rate-limits per past lesson)
 *   2. Create exam (metadata → upload question paper → review → publish)
 *   3. Extract questions from question paper (AI)
 *   4. Publish exam
 *   5. Upload answer sheets per student
 *   6. Wait for grading pipeline (OCR → mapping → grading)  — via Admin-SDK onSnapshot
 *   7. Review grading results + approve
 *   8. Release results
 *
 * STATUS: scaffold only. AI-dependent steps are guarded by `RUN_AI` and skipped
 * by default. The coordinator must green-light the full paid run after the
 * backend mock-AI contract and frontend contracts are confirmed.
 *
 * Project: `autograde` (root playwright.config.ts:46-57, baseURL :4569, 300s timeout)
 * Run:     `npm run test:e2e -- --project=autograde -g "Autograde Full Flow"`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PRE-FLIGHT (manual — DO NOT auto-start; would collide with a running dev):
 *   1. apps/teacher-web dev server must be up on :4569
 *      └ start in a separate terminal: `cd apps/teacher-web && npm run dev`
 *      └ confirm: `lsof -i :4569`   (past lesson: dev server can die mid-run)
 *   2. Firebase backend (emulator OR deployed) reachable for Admin SDK seed:
 *      └ Emulator mode: `firebase emulators:start --only auth,firestore` and
 *        set FIRESTORE_EMULATOR_HOST=localhost:8080 + FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *      └ Live mode: GOOGLE_APPLICATION_CREDENTIALS pointing at a service account
 *        with Firestore + Auth admin perms.
 *   3. If RUN_AI=1: autograde callables (extractQuestions / gradeQuestion /
 *      uploadAnswerSheets) must be reachable from the teacher-web app.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ENV VARS (with defaults — all read at test startup):
 *   TENANT_CODE         seeded tenant code           (default 'AGE2E1')
 *   TEACHER_EMAIL       seeded teacher email         (default 'autograde-teacher@e2e.test')
 *   TEACHER_PASSWORD    seeded teacher password      (default 'Test@12345')
 *   STUDENT_EMAIL       seeded student email         (default 'autograde-student@e2e.test')
 *   RUN_AI              '1' to run AI-dependent steps (default unset → skipped)
 *   AI_STRATEGY         'live' | 'mock' | 'seeded'    (default 'live')
 *   GOOGLE_CLOUD_PROJECT  Admin SDK project id        (default 'lvlup-ff6fa')
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import { loginWithSchoolCode, expectDashboard } from "./helpers/auth";
import { SELECTORS } from "./helpers/selectors";
import { seedAutogradeTenant, AutogradeSeed } from "./helpers/autograde-seed";
import {
  waitForSubmissionStatus,
  waitForAllQuestionsGraded,
  waitForExtractedQuestions,
} from "./helpers/autograde-pipeline-waiter";

// ---------------------------------------------------------------------------
// Configuration (env-driven)
// ---------------------------------------------------------------------------

const RUN_AI = process.env["RUN_AI"] === "1";
const AI_STRATEGY = (process.env["AI_STRATEGY"] ?? "live") as "live" | "mock" | "seeded";

const STORAGE_STATE_PATH = path.join(__dirname, ".auth-state-autograde.json");

const FIXTURE_DIR = path.resolve(__dirname, "../../chaitanya");
const QUESTION_PAPER_IMAGES = [
  path.join(FIXTURE_DIR, "WhatsApp Image 2026-01-06 at 17.38.29.jpeg"),
  path.join(FIXTURE_DIR, "WhatsApp Image 2026-01-06 at 17.38.30.jpeg"),
];
const ANSWER_SHEET_IMAGES = [
  path.join(FIXTURE_DIR, "chaitanya-answers/WhatsApp Image 2026-01-06 at 17.40.59.jpeg"),
  path.join(FIXTURE_DIR, "chaitanya-answers/WhatsApp Image 2026-01-06 at 17.41.01.jpeg"),
  path.join(FIXTURE_DIR, "chaitanya-answers/WhatsApp Image 2026-01-06 at 17.41.01 (1).jpeg"),
];

const EXAM = {
  title: `Autograde Scaffold ${Date.now()}`,
  subject: "Science",
  topics: "Biology, Photosynthesis",
  totalMarks: "50",
  passingMarks: "20",
  duration: "60",
};

const NAV_TIMEOUT = 30_000;
const UPLOAD_TIMEOUT = 120_000;
const AI_EXTRACT_TIMEOUT = 180_000;
const PIPELINE_TIMEOUT = 300_000;

// ---------------------------------------------------------------------------
// Auth fixture: storageState reuse to dodge Firebase rate limits
// ---------------------------------------------------------------------------

async function loadAuthedContext(
  browser: import("@playwright/test").Browser,
  seed: AutogradeSeed
): Promise<BrowserContext> {
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    return browser.newContext({ storageState: STORAGE_STATE_PATH });
  }
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await loginWithSchoolCode(page, seed.tenantCode, seed.teacher.email, seed.teacher.password);
  await expectDashboard(page, SELECTORS.dashboards.teacher);
  await ctx.storageState({ path: STORAGE_STATE_PATH });
  await page.close();
  return ctx;
}

// ---------------------------------------------------------------------------
// AI mocking — TODO placeholders awaiting backend worker's CONTRACT REPORT
// ---------------------------------------------------------------------------

/**
 * TODO(coordinator wave-2): wire real fixture payloads here once the backend
 * worker delivers its CONTRACT REPORT for the autograde callables under
 * `functions/autograde`. The expected callables and their UI-side names:
 *
 *   - extractQuestions      ← invoked by ExamDetailPage Extract button
 *   - uploadAnswerSheets    ← invoked by SubmissionsPage Upload button
 *   - gradeQuestion         ← invoked by GradingReviewPage AI/Manual buttons
 *   - process-answer-mapping (background trigger; not directly callable from UI)
 *   - process-answer-grading (background trigger; not directly callable from UI)
 *
 * Do NOT invent response shapes — wait for the contract.
 */
async function installAiMocks(page: Page) {
  if (AI_STRATEGY !== "mock") return;

  // TODO(wave-2): replace these stub responses with the backend contract's exact shape.
  await page.route(/.*\/extractQuestions(\?.*)?$/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          /* TODO: backend contract shape */
        },
      }),
    })
  );
  await page.route(/.*\/gradeQuestion(\?.*)?$/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          /* TODO: backend contract shape */
        },
      }),
    })
  );
  await page.route(/.*\/uploadAnswerSheets(\?.*)?$/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          /* TODO: backend contract shape */
        },
      }),
    })
  );
}

// ---------------------------------------------------------------------------
// Selector helpers — role+aria first; no data-testid exists in exam pages
// (only data-override-input on GradingReviewPage:1200).
// ---------------------------------------------------------------------------

const sel = {
  examTitleInput: (p: Page) => p.getByPlaceholder("e.g. Mid-Term Mathematics"),
  subjectInput: (p: Page) => p.getByPlaceholder("Mathematics", { exact: true }),
  topicsInput: (p: Page) => p.getByPlaceholder("Algebra, Geometry"),
  totalMarksInput: (p: Page) => p.locator('input[type="number"]').nth(0),
  passingMarksInput: (p: Page) => p.locator('input[type="number"]').nth(1),
  durationInput: (p: Page) => p.locator('input[type="number"]').nth(2),

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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Autograde Full Flow (scaffold)", () => {
  test.describe.configure({ mode: "serial" });

  let seed: AutogradeSeed;
  let context: BrowserContext;
  let page: Page;
  let examId: string;
  let submissionId: string;

  test.beforeAll(async ({ browser }) => {
    // Admin-SDK pre-step: provision tenant + teacher + class + student.
    // Idempotent — safe to re-run.
    seed = await seedAutogradeTenant();
    console.log(
      `[seed] tenant=${seed.tenantId} (${seed.tenantCode}) teacher=${seed.teacher.email} class=${seed.classId} student=${seed.student.email}`
    );

    context = await loadAuthedContext(browser, seed);
    page = await context.newPage();
    await installAiMocks(page);

    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("getNotifications")) {
        console.log("CONSOLE ERROR:", msg.text());
      }
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  // ---------------------------------------------------------------------
  // STEP 1: Verify auth + reach /exams
  // ---------------------------------------------------------------------
  test("1. verifies teacher session and lands on /exams", async () => {
    await page.goto("/exams");
    await expect(page.getByRole("heading", { name: /^Exams$/ })).toBeVisible({
      timeout: NAV_TIMEOUT,
    });
    const hasEmpty = await page
      .getByText("No exams yet")
      .isVisible()
      .catch(() => false);
    const hasCards = (await page.locator('a[href^="/exams/"]').count()) > 0;
    expect(hasEmpty || hasCards).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // STEP 2: Create exam — metadata
  //   ExamCreatePage.tsx:172-293. Class picker is a ClassMultiSelect Popover
  //   (role=combobox) NOT a free-text input.
  // ---------------------------------------------------------------------
  test("2. fills exam metadata and advances to upload step", async () => {
    await page.goto("/exams/new");
    await expect(page.getByRole("heading", { name: /Create Exam/ })).toBeVisible();

    await sel.examTitleInput(page).fill(EXAM.title);
    await sel.subjectInput(page).fill(EXAM.subject);
    await sel.topicsInput(page).fill(EXAM.topics);
    await sel.totalMarksInput(page).fill(EXAM.totalMarks);
    await sel.passingMarksInput(page).fill(EXAM.passingMarks);
    await sel.durationInput(page).fill(EXAM.duration);

    // Open the ClassMultiSelect popover and pick the seeded class
    await page.getByRole("combobox").first().click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toBeVisible();
    // The seeded class name comes from autograde-seed.ts DEFAULTS.className
    await popover.locator(`button:has-text("${seed.className}")`).first().click();
    await page.keyboard.press("Escape");

    await sel.nextBtn(page).click();
    await expect(page.getByText("Click to upload or drag and drop")).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // STEP 3: Upload question paper images
  // ---------------------------------------------------------------------
  test("3. uploads question paper images and creates the exam", async () => {
    await page.locator('input[type="file"]').first().setInputFiles(QUESTION_PAPER_IMAGES);
    for (const fp of QUESTION_PAPER_IMAGES) {
      await expect(page.getByText(path.basename(fp))).toBeVisible();
    }

    await sel.uploadAndContinueBtn(page).click();
    await expect(page.getByText(/Review Exam Details/i)).toBeVisible({
      timeout: UPLOAD_TIMEOUT,
    });
    await expect(page.getByText("2 image(s) uploaded")).toBeVisible();

    await sel.continueToPublishBtn(page).click();
    await expect(page.getByText(/Ready to Create/i)).toBeVisible();

    await sel.createExamBtn(page).click();
    await page.waitForURL(/\/exams\/(?!new)[a-zA-Z0-9]+$/, { timeout: 60_000 });

    examId = page.url().split("/exams/")[1]!;
    expect(examId).toBeTruthy();
    console.log(`[scaffold] created examId=${examId}`);
  });

  // ---------------------------------------------------------------------
  // STEP 4: Extract questions (AI)  — gated on RUN_AI
  //   Waits via Admin SDK onSnapshot for the questions sub-collection to
  //   populate, instead of polling the DOM.
  // ---------------------------------------------------------------------
  test("4. extracts questions from the question paper", async () => {
    test.skip(!RUN_AI, "AI step — set RUN_AI=1 once coordinator green-lights");

    await expect(sel.extractQuestionsBtn(page)).toBeVisible({ timeout: NAV_TIMEOUT });
    await sel.extractQuestionsBtn(page).click();

    const count = await waitForExtractedQuestions(seed.tenantId, examId, {
      timeoutMs: AI_EXTRACT_TIMEOUT,
      onProgress: (msg) => console.log(`[wait:extract] ${msg}`),
    });
    console.log(`[scaffold] extracted ${count} questions`);
    expect(count).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------
  // STEP 5: Publish exam
  // ---------------------------------------------------------------------
  test("5. publishes the exam", async () => {
    test.skip(!RUN_AI, "Depends on extraction — skipped in scaffold mode");

    await sel.publishBtn(page).click();
    await expect(page.getByText(/published/i).first()).toBeVisible({
      timeout: NAV_TIMEOUT,
    });
  });

  // ---------------------------------------------------------------------
  // STEP 6: Upload answer sheets
  //   SubmissionsPage.tsx:343-461 — Class+Student Radix Selects, then file
  //   input. The Class select auto-picks the only class (line 100), so when
  //   the seeded teacher owns exactly one class we just confirm the value.
  // ---------------------------------------------------------------------
  test("6. uploads answer sheets for one student", async () => {
    test.skip(!RUN_AI, "Depends on published exam — skipped in scaffold mode");

    await page.goto(`/exams/${examId}/submissions`);
    await expect(page.getByRole("heading", { name: /Upload Answer Sheet/ })).toBeVisible();

    // Class picker — auto-selected if only one class exists, otherwise open + click
    const classCombo = page.getByRole("combobox").filter({ hasText: /class/i }).first();
    if (!(await classCombo.textContent())?.toLowerCase().includes(seed.className.toLowerCase())) {
      await classCombo.click();
      await page.getByRole("option", { name: seed.className }).click();
    }

    // Student picker — open and pick the seeded student
    const studentCombo = page
      .getByRole("combobox")
      .filter({ hasText: /student/i })
      .first();
    await studentCombo.click();
    await page.getByRole("option").filter({ hasText: seed.student.rollNumber }).first().click();

    await page.locator('input[type="file"]').setInputFiles(ANSWER_SHEET_IMAGES);
    for (const fp of ANSWER_SHEET_IMAGES) {
      await expect(page.getByText(path.basename(fp))).toBeVisible();
    }

    await sel.uploadAnswerBtn(page).click();
    await expect(page.getByText("Uploading...")).toBeHidden({ timeout: UPLOAD_TIMEOUT });

    await expect(page.locator('a[href*="/submissions/"]').first()).toBeVisible({
      timeout: NAV_TIMEOUT,
    });
    submissionId = (await page
      .locator('a[href*="/submissions/"]')
      .first()
      .getAttribute("href"))!.split("/submissions/")[1]!;
    console.log(`[scaffold] created submissionId=${submissionId}`);
  });

  // ---------------------------------------------------------------------
  // STEP 7: Wait for grading pipeline via Admin-SDK onSnapshot
  //   Replaces the previous page.reload() poll. Awaits the parent submission
  //   doc's `pipelineStatus` to reach grading_complete | ready_for_review.
  // ---------------------------------------------------------------------
  test("7. waits for grading pipeline to reach a terminal state", async () => {
    test.skip(!RUN_AI, "AI pipeline — skipped in scaffold mode");

    const finalStatus = await waitForSubmissionStatus(
      seed.tenantId,
      submissionId,
      ["grading_complete", "ready_for_review", "reviewed"],
      {
        timeoutMs: PIPELINE_TIMEOUT,
        onProgress: (s) => console.log(`[wait:submission] pipelineStatus=${s ?? "<none>"}`),
      }
    );
    console.log(`[scaffold] pipeline final status: ${finalStatus}`);
    expect(["grading_complete", "ready_for_review", "reviewed"]).toContain(finalStatus);

    // Also ensure every per-question doc has graded (no longer pending)
    await waitForAllQuestionsGraded(seed.tenantId, submissionId, {
      timeoutMs: PIPELINE_TIMEOUT,
      onProgress: (s) => console.log(`[wait:questions] ${s}`),
    });
  });

  // ---------------------------------------------------------------------
  // STEP 8: Open the grading review page + approve
  //   GradingReviewPage.tsx:76 — route /exams/:examId/submissions/:submissionId
  // ---------------------------------------------------------------------
  test("8. opens grading review and approves all", async () => {
    test.skip(!RUN_AI, "AI grading — skipped in scaffold mode");

    await page.goto(`/exams/${examId}/submissions/${submissionId}`);
    await expect(page.locator("text=/\\d+\\/\\d+/").first()).toBeVisible({
      timeout: NAV_TIMEOUT,
    });

    if (
      await sel
        .gradePendingBtn(page)
        .isVisible()
        .catch(() => false)
    ) {
      await sel.gradePendingBtn(page).click();
      await waitForAllQuestionsGraded(seed.tenantId, submissionId, {
        timeoutMs: AI_EXTRACT_TIMEOUT,
        onProgress: (s) => console.log(`[wait:grade-pending] ${s}`),
      });
    }

    await sel.approveAllBtn(page).click();
    const confirmBtn = page
      .locator('[role="alertdialog"] button')
      .filter({ hasText: /Approve|Confirm|Yes/ })
      .last();
    await confirmBtn.click();

    const finalStatus = await waitForSubmissionStatus(seed.tenantId, submissionId, ["reviewed"], {
      timeoutMs: NAV_TIMEOUT,
    });
    expect(finalStatus).toBe("reviewed");
  });

  // ---------------------------------------------------------------------
  // STEP 9: Release results (back on exam detail page)
  // ---------------------------------------------------------------------
  test("9. releases results from the exam detail page", async () => {
    test.skip(!RUN_AI, "Depends on reviewed submission — skipped in scaffold mode");

    await page.goto(`/exams/${examId}`);
    const releaseBtn = page.getByRole("button", { name: /Release Results/ });
    await expect(releaseBtn).toBeVisible({ timeout: NAV_TIMEOUT });
    await releaseBtn.click();

    await expect(page.getByText(/results_released|Results Released/i).first()).toBeVisible({
      timeout: NAV_TIMEOUT,
    });
  });
});
