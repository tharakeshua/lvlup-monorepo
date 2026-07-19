/**
 * `uploadAnswerSheetsService` (autograde.md §"Command services"). The SINGLE
 * canonical answer-sheet ingestion path (scanner-rn calls this exact method with
 * storage paths; it never writes the submission doc). Validates the storage paths
 * sit within `tenants/{ctx.tenantId}/` (⚷), denormalizes `studentName`/`rollNumber`,
 * creates `Submission(uploaded)`, advances exam published→grading, bumps the
 * `stats.totalSubmissions` counter, and kicks the pipeline. Idempotent on
 * `(uid, examId, studentId, imageUrls-hash)` — a scanner retry dedupes, but a genuine
 * re-upload runs and hits the REPLACE path (§ below).
 *
 * REPLACE semantics (owner directive 2026-07-19): exactly one submission per
 * `(examId, studentId)`. If one already exists, a re-upload is REJECTED with
 * FAILED_PRECONDITION (`meta.reason='submission_exists'`) unless `input.replace===true`,
 * which re-points the existing submission at the new sheets, resets its grading/release
 * state, and re-kicks the pipeline — so a re-upload can never silently destroy released
 * results (the old permanent-idempotency-key bug: uploads succeeded to Storage but the
 * cached submissionId replayed with HTTP 200, orphaning the new files with no error).
 * Scanner role allowed.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, canTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { withIdempotency } from "../shared/idempotency.js";
import { enqueuePipelineAdvance } from "./pipeline/advance-pipeline.js";

type Req = ReqOf<"v1.autograde.uploadAnswerSheets">;
type Res = ResOf<"v1.autograde.uploadAnswerSheets">;

export async function uploadAnswerSheetsService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "answerSheets.upload", { examId: input.examId, classId: input.classId, tenantId });

  // ⚷ Storage-path tenant scoping: every path must live under this tenant.
  validatePathsInTenant(input.imageUrls, tenantId);

  // Content-versioned idempotency key (v2). The old key `uploadAnswerSheets:{exam}:
  // {student}` was a PERMANENT business key: once committed, EVERY later upload for
  // that student replayed the cached submissionId with HTTP 200 — so a teacher's
  // re-upload silently no-op'd (new storage files orphaned, no error, UI cleared).
  // Keying on a hash of the (sorted) imageUrls means a true scanner network-retry
  // (identical paths) still dedupes, while a genuine re-upload (fresh scan paths)
  // gets a NEW key and actually runs — where replace/reject semantics apply.
  const contentHash = hashImagePaths(input.imageUrls);
  const key = `uploadAnswerSheets:v2:${input.examId}:${input.studentId}:${contentHash}`;
  return withIdempotency(ctx, tenantId, key, async () => {
    const exam = await ctx.repos.exams.get(tenantId, input.examId);
    if (!exam) fail("NOT_FOUND", `exam ${input.examId} not found`);

    // ⚷ Rubric-completion GATE (ARCHITECTURE-PLAN §3.4, owner directive 2026-07-18):
    // an exam is grading-eligible ONLY after rubric generation completes. Enforced
    // on `questionPaper.rubricsGeneratedAt` (set ⇔ every question rubricStatus:'generated').
    const questionPaper = exam["questionPaper"] as Record<string, unknown> | undefined;
    if (!questionPaper?.["rubricsGeneratedAt"]) {
      fail(
        "FAILED_PRECONDITION",
        "rubric generation incomplete — finish question extraction (mode 'rubrics') before uploading answer sheets"
      );
    }

    const now = ctx.now();
    const student = await ctx.repos.students.get(tenantId, input.studentId);
    const studentName =
      (student?.["name"] as string | undefined) ??
      (student?.["fullName"] as string | undefined) ??
      "Unknown";
    const rollNumber = (student?.["rollNumber"] as string | undefined) ?? "";
    const subjectUserId = student?.["authUid"] as string | undefined;

    const answerSheets = {
      images: input.imageUrls,
      uploadedAt: now,
      uploadedBy: ctx.uid,
      uploadSource: resolveUploadSource(ctx.role),
    };
    const llmCausation = {
      initiatedByUserId: ctx.uid,
      initiatorRole: ctx.role ?? "unknown",
      ...(subjectUserId ? { subjectUserId, billingUserId: subjectUserId } : {}),
    };
    // Ungraded score summary (a fresh upload and a replace both reset to this).
    const emptySummary = {
      totalScore: 0,
      maxScore: (exam["totalMarks"] as number | undefined) ?? 0,
      percentage: 0,
      // valid GradeLetter default for an ungraded submission ('' is not a grade).
      grade: "F",
      questionsGraded: 0,
      totalQuestions: 0,
      completedAt: null,
    };

    // ⚷ Exactly-one-submission-per-student invariant. A submission may already exist
    // for (examId, studentId) — the idempotency key no longer guarantees uniqueness
    // (it is content-scoped), so the body enforces it explicitly.
    const existing = await findExistingSubmission(ctx, tenantId, input.examId, input.studentId);

    if (existing) {
      const existingId = existing["id"] as string;
      const resultsReleased = existing["resultsReleased"] === true;
      const pipelineStatus = (existing["pipelineStatus"] as string | undefined) ?? "uploaded";

      // Never silently overwrite an existing submission — REQUIRE explicit replace.
      // The client surfaces `meta.reason` to prompt a confirm-replace dialog (and
      // warns loudly when the results were already released to the student/parent).
      if (input.replace !== true) {
        fail(
          "FAILED_PRECONDITION",
          resultsReleased
            ? "This student's results were already RELEASED. Re-uploading will discard the released grade and re-grade the new sheets. Confirm replace to proceed."
            : "This student already has a submission for this exam. Confirm replace to overwrite it with the new answer sheets.",
          {
            reason: "submission_exists",
            existingSubmissionId: existingId,
            resultsReleased,
            pipelineStatus,
            retryable: false,
          }
        );
      }

      // REPLACE: re-point the existing submission at the new sheets and reset its
      // grading/release state, then re-kick the pipeline. Merge-upsert preserves the
      // doc id (invariant held); the re-scout upserts the same deterministic
      // QuestionSubmission ids, so no duplicates accrue.
      await ctx.repos.submissions.upsert(
        tenantId,
        {
          id: existingId,
          studentName,
          rollNumber,
          classId: input.classId,
          answerSheets,
          summary: emptySummary,
          pipelineStatus: "uploaded",
          llmCausation,
          retryCount: 0,
          gradingProgress: { graded: 0, total: 0 },
          needsScoutReview: false,
          resultsReleased: false,
          resultsReleasedAt: null,
        },
        now
      );

      // Re-kick the grading pipeline from scouting (exam is already `grading`; the
      // per-exam stats counter is NOT bumped — this is not a new submission).
      await enqueuePipelineAdvance(ctx, existingId, "scouting");

      return { submissionId: existingId, replaced: true } as Res;
    }

    const submission = {
      examId: input.examId,
      studentId: input.studentId,
      studentName,
      rollNumber,
      classId: input.classId,
      answerSheets,
      summary: emptySummary,
      pipelineStatus: "uploaded",
      // Durable root causation for delayed mapping/grading Cloud Tasks.
      llmCausation,
      retryCount: 0,
      resultsReleased: false,
      resultsReleasedAt: null,
    };

    const { id } = await ctx.repos.submissions.upsert(tenantId, submission, now);

    // Advance the exam published → grading (idempotent; only first submission flips).
    const examStatus = (exam["status"] as string) ?? "published";
    if (examStatus === "published" && canTransition("exam", "published", "grading")) {
      await ctx.repos.exams.upsert(tenantId, { id: input.examId, status: "grading" }, now);
    }

    // Bump the denormalized submission counter (⚷ server-maintained).
    const stats = (exam["stats"] as Record<string, number> | undefined) ?? {
      totalSubmissions: 0,
      gradedSubmissions: 0,
      avgScore: 0,
      passRate: 0,
    };
    await ctx.repos.exams.upsert(
      tenantId,
      {
        id: input.examId,
        stats: { ...stats, totalSubmissions: (stats.totalSubmissions ?? 0) + 1 },
      },
      now
    );

    // Kick the grading pipeline (Cloud Tasks single-writer reducer).
    await enqueuePipelineAdvance(ctx, id, "scouting");

    return { submissionId: id, replaced: false } as Res;
  });
}

/**
 * Find the (at most one) existing submission for `(examId, studentId)`. Filters out
 * the flat `_kind:'questionSubmission'` children that share the collection.
 */
async function findExistingSubmission(
  ctx: AuthContext,
  tenantId: string,
  examId: string,
  studentId: string
): Promise<Record<string, unknown> | undefined> {
  const page = await ctx.repos.submissions.list(tenantId, {
    where: { examId },
    filter: (d) => d["_kind"] !== "questionSubmission" && d["studentId"] === studentId,
    limit: 1,
  });
  return page.items[0];
}

/**
 * Deterministic, order-insensitive FNV-1a hash of the answer-sheet storage paths.
 * Used to content-version the idempotency key so an identical scanner retry dedupes
 * while a genuine re-upload (different paths) runs. No crypto dependency (runs in any
 * JS runtime); collision risk is irrelevant — a false dedupe only requires the SAME
 * (uid, examId, studentId) AND the exact same set of paths, i.e. a true retry.
 */
function hashImagePaths(paths: string[]): string {
  const joined = [...paths].sort().join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const TENANT_PREFIX = "tenants/";

/** Reject any storage path not scoped to the caller's tenant (⚷ REVIEW §6.13). */
export function validatePathsInTenant(paths: string[], tenantId: string): void {
  const prefix = `${TENANT_PREFIX}${tenantId}/`;
  for (const p of paths) {
    if (!p.startsWith(prefix)) {
      fail("PERMISSION_DENIED", `storage path "${p}" is not scoped to tenant ${tenantId}`);
    }
  }
}

function resolveUploadSource(role: string | null): "web" | "scanner" | "rn" {
  if (role === "scanner") return "scanner";
  return "web";
}
