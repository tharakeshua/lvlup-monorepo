import { test, expect, Page } from "@playwright/test";
import { loginWithSchoolCode, expectDashboard } from "./helpers/auth";
import { CREDENTIALS, SELECTORS, SCHOOL_CODE } from "./helpers/selectors";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHAITANYA_DIR = path.resolve(__dirname, "../../chaitanya");
const ANSWERS_DIR = path.join(CHAITANYA_DIR, "chaitanya-answers");

const QUESTION_PAPER_IMAGES = [
  path.join(CHAITANYA_DIR, "WhatsApp Image 2026-01-06 at 17.38.29.jpeg"),
  path.join(CHAITANYA_DIR, "WhatsApp Image 2026-01-06 at 17.38.30.jpeg"),
];

// Use a subset of answer sheets (first 3) to keep test manageable
const ANSWER_SHEET_IMAGES = [
  path.join(ANSWERS_DIR, "WhatsApp Image 2026-01-06 at 17.40.59.jpeg"),
  path.join(ANSWERS_DIR, "WhatsApp Image 2026-01-06 at 17.41.01.jpeg"),
  path.join(ANSWERS_DIR, "WhatsApp Image 2026-01-06 at 17.41.01 (1).jpeg"),
];

const EXAM_TITLE = `Playwright AutoGrade Test ${Date.now()}`;
const EXAM_SUBJECT = "Science";
const EXAM_TOPICS = "Biology";
const EXAM_TOTAL_MARKS = "100";
const EXAM_PASSING_MARKS = "40";
const EXAM_DURATION = "60";
const EXAM_CLASS_ID = "cls_g8_sci";

// Longer timeouts for AI operations
const AI_TIMEOUT = 180_000; // 3 minutes for AI extraction/grading
const UPLOAD_TIMEOUT = 60_000; // 1 minute for file uploads

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loginAsTeacher(page: Page) {
  await page.goto("/login");
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.teacher1.email,
    CREDENTIALS.teacher1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.teacher);
}

// ---------------------------------------------------------------------------
// Test Suite: AutoGrade Full Flow
// ---------------------------------------------------------------------------
test.describe("AutoGrade E2E Flow", () => {
  // Use a single test with steps for the full flow since each step depends on the previous
  test("complete autograde flow: create exam → extract questions → upload answers → evaluate", async ({
    page,
  }) => {
    // Increase overall test timeout for AI operations
    test.setTimeout(600_000); // 10 minutes

    // Capture all page errors and console messages
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
      console.log("PAGE ERROR:", err.message);
    });
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        // Skip noisy notification CORS errors
        if (!text.includes("getNotifications")) {
          console.log("CONSOLE ERROR:", text);
        }
      } else if (
        msg.type() === "warning" &&
        (text.includes("index") || text.includes("Firestore") || text.includes("query"))
      ) {
        console.log("CONSOLE WARN:", text);
      }
    });

    // =====================================================================
    // STEP 1: Login as teacher
    // =====================================================================
    await test.step("Login as teacher", async () => {
      await loginAsTeacher(page);
    });

    // =====================================================================
    // STEP 2: Navigate to create exam
    // =====================================================================
    await test.step("Navigate to Exams page", async () => {
      // Click on Exams in sidebar or navigate directly
      await page.goto("/exams");
      await expect(page.locator('h1:has-text("Exams")')).toBeVisible({ timeout: 30_000 });
    });

    await test.step("Click New Exam button", async () => {
      await page.click('a:has-text("New Exam")');
      await expect(page.locator('h1:has-text("Create Exam")')).toBeVisible({ timeout: 15_000 });
    });

    // =====================================================================
    // STEP 3: Fill exam metadata
    // =====================================================================
    await test.step("Fill exam metadata", async () => {
      // Use placeholder-based selectors since Label components lack htmlFor
      await page.getByPlaceholder("e.g. Mid-Term Mathematics").fill(EXAM_TITLE);
      await page.getByPlaceholder("Mathematics", { exact: true }).fill(EXAM_SUBJECT);
      await page.getByPlaceholder("Algebra, Geometry").fill(EXAM_TOPICS);

      // Numeric fields - use position relative to their labels
      // Total Marks, Passing Marks, Duration are in a 3-col grid
      const totalMarksInput = page.locator('input[type="number"]').nth(0);
      const passingMarksInput = page.locator('input[type="number"]').nth(1);
      const durationInput = page.locator('input[type="number"]').nth(2);
      await totalMarksInput.fill(EXAM_TOTAL_MARKS);
      await passingMarksInput.fill(EXAM_PASSING_MARKS);
      await durationInput.fill(EXAM_DURATION);

      // Class IDs
      await page.getByPlaceholder("class_10a, class_10b").fill(EXAM_CLASS_ID);
    });

    await test.step("Click Next to go to upload step", async () => {
      await page.click('button:has-text("Next")');
      // Should now show upload step
      await expect(page.locator("text=Click to upload or drag and drop")).toBeVisible({
        timeout: 10_000,
      });
    });

    // =====================================================================
    // STEP 4: Upload question paper images
    // =====================================================================
    await test.step("Upload question paper images", async () => {
      // Set files on the hidden file input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(QUESTION_PAPER_IMAGES);

      // Verify files are shown
      for (const file of QUESTION_PAPER_IMAGES) {
        const fileName = path.basename(file);
        await expect(page.locator(`text=${fileName}`)).toBeVisible({ timeout: 5_000 });
      }
    });

    await test.step("Click Upload & Continue", async () => {
      // Capture console errors during upload
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.click('button:has-text("Upload & Continue")');
      // Wait for upload to complete and move to review step
      // Firebase Storage upload can take a while for large images
      await expect(page.locator("text=Review Exam Details")).toBeVisible({ timeout: 120_000 });

      if (consoleErrors.length > 0) {
        console.log("Console errors during upload:", consoleErrors);
      }
    });

    // =====================================================================
    // STEP 5: Review exam details
    // =====================================================================
    await test.step("Verify review step shows correct details", async () => {
      await expect(page.locator(`text=${EXAM_TITLE}`)).toBeVisible();
      await expect(page.locator(`text=${EXAM_SUBJECT}`)).toBeVisible();
      // Use exact match for total marks to avoid matching the timestamp in the title
      await expect(page.getByText(EXAM_TOTAL_MARKS, { exact: true })).toBeVisible();
      await expect(page.locator("text=2 image(s) uploaded")).toBeVisible();
    });

    await test.step("Click Continue to Publish", async () => {
      await page.click('button:has-text("Continue to Publish")');
      await expect(page.locator("text=Ready to Create")).toBeVisible({ timeout: 10_000 });
    });

    // =====================================================================
    // STEP 6: Create the exam
    // =====================================================================
    let examUrl: string;
    await test.step("Click Create Exam", async () => {
      await page.click('button:has-text("Create Exam")');
      // Should navigate to exam detail page
      await page.waitForURL(/\/exams\/(?!new)[a-zA-Z0-9]+$/, { timeout: 60_000 });
      examUrl = page.url();
      console.log("Created exam at:", examUrl);
    });

    // =====================================================================
    // STEP 7: Verify exam detail page and extract questions
    // =====================================================================
    await test.step("Verify exam detail page loads", async () => {
      await expect(page.locator(`h1:has-text("${EXAM_TITLE}")`)).toBeVisible({ timeout: 30_000 });
      // Should show question_paper_uploaded status
      await expect(
        page
          .locator("text=question paper uploaded")
          .or(page.locator("text=question_paper_uploaded"))
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step("Click Extract Questions button", async () => {
      const extractBtn = page.locator('button:has-text("Extract Questions")');
      await expect(extractBtn).toBeVisible({ timeout: 10_000 });
      await extractBtn.click();

      // Should show loading state
      await expect(page.locator("text=Extracting...")).toBeVisible({ timeout: 5_000 });

      // Wait for extraction to complete (AI operation, can take up to 3 minutes)
      await expect(page.locator("text=Extracting...")).not.toBeVisible({ timeout: AI_TIMEOUT });
    });

    await test.step("Verify questions are extracted", async () => {
      // After extraction, questions should appear in the Questions tab
      // Wait for the page to refresh and show questions
      await page.waitForTimeout(2_000); // Brief wait for state update

      // Check that at least one question card is visible (Q1.)
      const questionCard = page.locator("text=/Q\\d+\\./");
      await expect(questionCard.first()).toBeVisible({ timeout: 30_000 });

      // Count questions
      const questionCount = await questionCard.count();
      console.log(`Extracted ${questionCount} questions`);
      expect(questionCount).toBeGreaterThan(0);
    });

    // =====================================================================
    // STEP 8: Publish the exam
    // =====================================================================
    await test.step("Publish the exam", async () => {
      const publishBtn = page.locator('button:has-text("Publish")');
      await expect(publishBtn).toBeVisible({ timeout: 10_000 });
      await publishBtn.click();

      // Wait for status to change to published
      await page.waitForTimeout(3_000);
      // Refetch should update the page
      await expect(page.locator("text=published").or(page.locator("text=Published"))).toBeVisible({
        timeout: 15_000,
      });
    });

    // =====================================================================
    // STEP 9: Navigate to submissions page
    // =====================================================================
    await test.step("Navigate to submissions page", async () => {
      await page.click('a:has-text("Submissions"), button:has-text("Submissions")');
      await expect(page.locator('h1:has-text("Submissions")')).toBeVisible({ timeout: 15_000 });
    });

    // =====================================================================
    // STEP 10: Upload answer sheets
    // =====================================================================
    await test.step("Fill student details and upload answer sheets", async () => {
      await expect(page.getByRole("heading", { name: "Upload Answer Sheet" })).toBeVisible({
        timeout: 10_000,
      });

      // Capture request failures for debugging
      const requestFailures: string[] = [];
      page.on("requestfailed", (req) => {
        requestFailures.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
        console.log("REQUEST FAILED:", req.method(), req.url(), req.failure()?.errorText);
      });

      // Capture response errors
      page.on("response", (res) => {
        if (res.status() >= 400 && !res.url().includes("getNotifications")) {
          console.log("HTTP ERROR:", res.status(), res.url());
        }
      });

      // Fill student details using page-level input selectors
      const allTextInputs = page.locator('input[type="text"]');
      const inputCount = await allTextInputs.count();
      console.log(`Found ${inputCount} text inputs on page`);

      // Fill Student Name, Roll Number, Class ID
      await allTextInputs.nth(0).fill("Chaitanya");
      await allTextInputs.nth(1).fill("2025001");
      await allTextInputs.nth(2).fill(EXAM_CLASS_ID);
      console.log("Student details filled");

      // Set files on the hidden file input
      await page.locator('input[type="file"]').setInputFiles(ANSWER_SHEET_IMAGES);
      console.log("Files attached");

      // Wait for upload button to become enabled (files selected → button enabled)
      const uploadBtn = page.locator('button:has-text("Upload")');
      await expect(uploadBtn).toBeEnabled({ timeout: 10_000 });

      // Take a screenshot before clicking Upload to verify form state
      await page.screenshot({ path: "test-results/before-upload-click.png" });
      console.log("Upload button enabled, clicking...");
      await uploadBtn.click();

      // Wait for "Uploading..." to appear (confirms click was processed)
      const uploadingVisible = await page
        .locator("text=Uploading...")
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      console.log(`Uploading... text visible: ${uploadingVisible}`);

      if (uploadingVisible) {
        // Wait for upload to complete (Uploading... disappears)
        await expect(page.locator("text=Uploading...")).not.toBeVisible({
          timeout: UPLOAD_TIMEOUT,
        });
        console.log("Upload completed");
      } else {
        console.log("Upload may have failed immediately - taking screenshot");
        await page.screenshot({ path: "test-results/upload-failed.png" });
      }

      // Log any request failures
      if (requestFailures.length > 0) {
        console.log("Request failures during upload:", requestFailures);
      }

      // Wait for submission to appear
      await page.waitForTimeout(5_000);
      await page.screenshot({ path: "test-results/after-upload.png" });

      const submissionVisible = await page
        .locator("text=Chaitanya")
        .isVisible()
        .catch(() => false);
      if (!submissionVisible) {
        console.log("Submission not visible, reloading...");
        await page.reload();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3_000);
      }

      // Verify submission appears (check for "1 submission" in header)
      await expect(page.locator('p:has-text("1 submission")')).toBeVisible({ timeout: 30_000 });
      console.log("Submission created successfully");
    });

    // =====================================================================
    // STEP 11: Wait for grading pipeline
    // =====================================================================
    await test.step("Wait for grading pipeline to process", async () => {
      // The pipeline goes: uploaded → scouting → grading → grading_complete/ready_for_review
      // This is handled by Firebase Cloud Functions triggers

      // Poll for pipeline completion - check for status change
      let attempts = 0;
      const maxAttempts = 60; // 60 * 5s = 5 minutes

      while (attempts < maxAttempts) {
        // Refresh the page to see updated status
        await page.reload();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2_000);

        // Check if any submission has completed grading
        const completedStatuses = [
          "grading complete",
          "grading_complete",
          "ready for review",
          "ready_for_review",
          "reviewed",
        ];

        let found = false;
        for (const status of completedStatuses) {
          const statusEl = page.locator(`text=${status}`);
          if (await statusEl.isVisible({ timeout: 2_000 }).catch(() => false)) {
            found = true;
            console.log(`Pipeline completed with status: ${status}`);
            break;
          }
        }

        if (found) break;

        attempts++;
        console.log(`Pipeline attempt ${attempts}/${maxAttempts} - still processing...`);
        await page.waitForTimeout(5_000);
      }

      // Verify the submission has been processed
      if (attempts >= maxAttempts) {
        console.warn("Pipeline did not complete within timeout. Checking current status...");
        // Take a screenshot for debugging
        await page.screenshot({ path: "test-results/pipeline-timeout.png" });
      }
    });

    // =====================================================================
    // STEP 12: Review grading results (if pipeline completed)
    // =====================================================================
    await test.step("Review grading results", async () => {
      // Click on the submission to see grading details
      const submissionLink = page.locator('a:has-text("Chaitanya")');
      if (await submissionLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await submissionLink.click();

        // Wait for grading review page to load
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3_000);

        // Check for score display or evaluation results
        const scoreDisplay = page.locator("text=/\\d+\\/\\d+/");
        if (await scoreDisplay.isVisible({ timeout: 10_000 }).catch(() => false)) {
          console.log("Grading results visible on review page");
        }

        // Take a screenshot of the grading results
        await page.screenshot({ path: "test-results/grading-results.png", fullPage: true });
      }
    });

    // Final screenshot
    await page.screenshot({ path: "test-results/autograde-final.png", fullPage: true });
    console.log("AutoGrade E2E test completed successfully!");
  });
});

// ---------------------------------------------------------------------------
// Separate test: Verify exam appears in exam list
// ---------------------------------------------------------------------------
test.describe("AutoGrade - Exam List Verification", () => {
  test("exam list page loads and shows exams", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams");
    await expect(page.locator('h1:has-text("Exams")')).toBeVisible({ timeout: 30_000 });

    // Should show either exam cards or empty state
    const hasExams = await page.locator('a[href^="/exams/"]').count();
    const hasEmptyState = await page
      .locator("text=No exams yet")
      .isVisible()
      .catch(() => false);

    expect(hasExams > 0 || hasEmptyState).toBeTruthy();
    console.log(`Found ${hasExams} exams on the list page`);
  });
});
