/**
 * Per-callable fixtures for `v1.autograde.*`. See callable-fixture.ts.
 *
 * Exercises the grading authority boundary (gradeQuestion — NEVER optimistic),
 * the release gate (getSubmission/getSubmissionForExam stripped until
 * resultsReleased), the Storage signed-PUT seam (requestUploadUrl), and the
 * scanner-allowed upload path.
 */
import { registerFixture } from "./callable-fixture";
import { localSeedId } from "../harness/fixtures-ids";

const EXAM = localSeedId("exam", "midterm");
const SUBMISSION = localSeedId("submission", "s1");
// A dedicated graded-but-NEVER-released submission for the pre-release strip test
// (order-independent of the releaseResults fixture that releases SUBMISSION).
const SUBMISSION_LOCKED = `${SUBMISSION}_locked`;
const STUDENT = localSeedId("student", "sam");
const CLASS = localSeedId("class", "10a");
const TENANT = localSeedId("tenant", "contract");

// --- exam lifecycle ---
registerFixture("v1.autograde.saveExam", {
  request: { data: { title: "New Exam", classIds: [CLASS] } },
  as: "teacher",
  seedState: "contract-tenant",
});
registerFixture("v1.autograde.releaseResults", {
  request: { examId: EXAM, classIds: [CLASS] },
  as: "teacher",
  seedState: "graded-submission",
});

// --- Storage signed-PUT seam (C1) ---
registerFixture("v1.autograde.requestUploadUrl", {
  request: {
    kind: "answer-sheet",
    examId: EXAM,
    studentId: STUDENT,
    classId: CLASS,
    contentType: "image/jpeg",
  },
  as: "scanner",
  seedState: "contract-tenant",
});

// --- scanner-allowed upload ---
registerFixture("v1.autograde.uploadAnswerSheets", {
  // ⚷ paths must be scoped under tenants/{tenantId}/ (REVIEW §6.13).
  request: {
    examId: EXAM,
    studentId: STUDENT,
    classId: CLASS,
    imageUrls: [`tenants/${TENANT}/answer-sheets/answer.jpg`],
  },
  as: "scanner",
  seedState: "contract-tenant",
});

// --- grading (⚷ score; NEVER optimistic; mode manual/retry/ai) ---
registerFixture("v1.autograde.gradeQuestion", {
  request: {
    mode: "manual",
    submissionId: SUBMISSION,
    questionId: localSeedId("examq", "1"),
    score: 5,
  },
  as: "teacher",
  seedState: "graded-submission",
});

// --- reads with release gate ---
registerFixture("v1.autograde.listExams", {
  request: { limit: 20 },
  as: "teacher",
  seedState: "contract-tenant",
});
registerFixture("v1.autograde.getSubmission", {
  // a student reading their own submission BEFORE release must not see score/grade.
  // Use the LOCKED submission (never released) so this is independent of the
  // releaseResults fixture (which releases SUBMISSION). Selector is `id`.
  request: { id: SUBMISSION_LOCKED },
  as: "student",
  seedState: "graded-submission",
  expect: (res) => {
    const json = JSON.stringify(res);
    if (/"totalScore"|"grade"|"percentage"|"summary"/.test(json)) {
      throw new Error("getSubmission leaked release-gated score fields before resultsReleased");
    }
  },
});
registerFixture("v1.autograde.getSubmissionForExam", {
  request: { examId: EXAM, studentId: STUDENT },
  as: "parent",
  seedState: "parent-linked",
});

// --- additional reads exercised by integration/autograde-analytics ----------
// rubric guidance is projected out for non-authoring roles; teacher = authoring view.
registerFixture("v1.autograde.listQuestions", {
  request: { examId: EXAM },
  as: "teacher",
  seedState: "released-exam",
});
// released-gate + ownership scoping; teacher = full grader view.
registerFixture("v1.autograde.listSubmissions", {
  request: { limit: 20, filter: { examId: EXAM } },
  as: "teacher",
  seedState: "graded-submission",
});
// per-question evaluation; released-gated + answer-key strip for non-graders.
registerFixture("v1.autograde.listQuestionSubmissions", {
  request: { submissionId: SUBMISSION },
  as: "teacher",
  seedState: "graded-submission",
});
