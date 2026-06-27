/**
 * `uploadAnswerSheetsService` (autograde.md §"Command services"). The SINGLE
 * canonical answer-sheet ingestion path (scanner-rn calls this exact method with
 * storage paths; it never writes the submission doc). Validates the storage paths
 * sit within `tenants/{ctx.tenantId}/` (⚷), denormalizes `studentName`/`rollNumber`,
 * creates `Submission(uploaded)`, advances exam published→grading, bumps the
 * `stats.totalSubmissions` counter, and kicks the pipeline. Idempotent on
 * `(uid, examId, studentId)`. Scanner role allowed.
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

  const key = `uploadAnswerSheets:${input.examId}:${input.studentId}`;
  return withIdempotency(ctx, tenantId, key, async () => {
    const exam = await ctx.repos.exams.get(tenantId, input.examId);
    if (!exam) fail("NOT_FOUND", `exam ${input.examId} not found`);

    const now = ctx.now();
    const student = await ctx.repos.students.get(tenantId, input.studentId);
    const studentName =
      (student?.["name"] as string | undefined) ??
      (student?.["fullName"] as string | undefined) ??
      "Unknown";
    const rollNumber = (student?.["rollNumber"] as string | undefined) ?? "";

    const submission = {
      examId: input.examId,
      studentId: input.studentId,
      studentName,
      rollNumber,
      classId: input.classId,
      answerSheets: {
        images: input.imageUrls,
        uploadedAt: now,
        uploadedBy: ctx.uid,
        uploadSource: resolveUploadSource(ctx.role),
      },
      summary: {
        totalScore: 0,
        maxScore: (exam["totalMarks"] as number | undefined) ?? 0,
        percentage: 0,
        // valid GradeLetter default for an ungraded submission ('' is not a grade).
        grade: "F",
        questionsGraded: 0,
        totalQuestions: 0,
        completedAt: null,
      },
      pipelineStatus: "uploaded",
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

    return { submissionId: id } as Res;
  });
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
