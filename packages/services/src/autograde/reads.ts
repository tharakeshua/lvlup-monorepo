/**
 * Autograde read / projection services (autograde.md §"Read / projection
 * services"). Authority enforced server-side; shaping is shareable. Each strips ⚷
 * fields by role: rubric guidance (non-authoring), answer keys (always), AI cost
 * (always), and unreleased grades (student/parent). `tenantId` from ctx.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import {
  zLegacyExamStatusRead,
  zLegacySubmissionPipelineStatusRead,
  zLegacyUploadSourceRead,
  zLegacyGradeLetterRead,
  zLegacyGradingPipelineStepRead,
} from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import {
  isAuthoringRole,
  isTeacherish,
  projectRubric,
  stripEvaluationCost,
  projectEvaluationSettings,
} from "../shared/projections.js";
import { listExamQuestions, listQuestionSubmissions } from "./pipeline/questions.js";
import { listEvaluationSettings } from "./save-evaluation-settings.js";

// ---- listExams ----
export async function listExamsService(
  input: ReqOf<"v1.autograde.listExams">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.listExams">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { tenantId });
  const filter = input.filter ?? {};
  const where: Record<string, unknown> = {};
  if (filter.status) where["status"] = filter.status;
  if (filter.classId) where["_classId"] = filter.classId; // denormalized membership
  if (filter.academicSessionId) where["academicSessionId"] = filter.academicSessionId;
  if (filter.linkedSpaceId) where["linkedSpaceId"] = filter.linkedSpaceId;

  const page = await ctx.repos.exams.list(tenantId, {
    where,
    filter: (d) =>
      d["_kind"] !== "examQuestion" &&
      d["_kind"] !== "evaluationSettings" &&
      (!filter.subject || d["subject"] === filter.subject) &&
      (!filter.classId ||
        ((d["classIds"] as string[] | undefined)?.includes(filter.classId) ?? false)),
    cursor: input.cursor,
    limit: input.limit,
  });
  return {
    items: page.items.map(toExamListView),
    nextCursor: page.nextCursor,
  } as ResOf<"v1.autograde.listExams">;
}

// ---- getExam ----
export async function getExamService(
  input: ReqOf<"v1.autograde.getExam">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.getExam">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.id, tenantId });
  const exam = await ctx.repos.exams.get(tenantId, input.id);
  if (!exam) fail("NOT_FOUND", `exam ${input.id} not found`);
  return toExamDetailView(exam) as ResOf<"v1.autograde.getExam">;
}

// ---- listQuestions (strips rubric guidance for non-authoring) ----
export async function listQuestionsService(
  input: ReqOf<"v1.autograde.listQuestions">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.listQuestions">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.examId, tenantId });
  const authoring = isAuthoringRole(ctx);
  const questions = await listExamQuestions(ctx, tenantId, input.examId);
  return {
    questions: questions.map((q) => toExamQuestionView(q, authoring)),
  } as ResOf<"v1.autograde.listQuestions">;
}

// ---- listSubmissions (released-gate + role scope) ----
export async function listSubmissionsService(
  input: ReqOf<"v1.autograde.listSubmissions">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.listSubmissions">> {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", { tenantId });
  const f = input.filter;

  const page = await ctx.repos.submissions.list(tenantId, {
    where: { examId: f.examId },
    filter: (d) => {
      if (d["_kind"] === "questionSubmission") return false;
      if (f.classId && d["classId"] !== f.classId) return false;
      if (f.studentId && d["studentId"] !== f.studentId) return false;
      if (f.pipelineStatus && d["pipelineStatus"] !== f.pipelineStatus) return false;
      if (f.uploadedBy) {
        const by = (d["answerSheets"] as Record<string, unknown> | undefined)?.["uploadedBy"];
        if (by !== f.uploadedBy) return false;
      }
      // role scope + released gate
      if (!teacherish) {
        if (d["resultsReleased"] !== true) return false;
        if (ctx.role === "student" && d["studentId"] !== ctx.entityIds.studentId) return false;
        if (ctx.role === "parent" && !ctx.studentIds.includes(d["studentId"] as string))
          return false;
      } else if (ctx.role === "teacher" && ctx.classIds.length > 0) {
        if (!ctx.classIds.includes(d["classId"] as string)) return false;
      }
      if (f.resultsReleasedOnly && d["resultsReleased"] !== true) return false;
      return true;
    },
    cursor: input.cursor,
    limit: input.limit,
  });
  return {
    items: page.items.map(toSubmissionListView),
    nextCursor: page.nextCursor,
  } as ResOf<"v1.autograde.listSubmissions">;
}

// ---- getSubmission (released-only vs full) ----
export async function getSubmissionService(
  input: ReqOf<"v1.autograde.getSubmission">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.getSubmission">> {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", {
    submissionId: input.id,
    tenantId,
  });
  const sub = await ctx.repos.submissions.get(tenantId, input.id);
  if (!sub) fail("NOT_FOUND", `submission ${input.id} not found`);
  if (!teacherish) {
    // Ownership gate first (a non-owner is DENIED outright).
    if (ctx.role === "student" && sub["studentId"] !== ctx.entityIds.studentId) {
      fail("PERMISSION_DENIED", "not your submission");
    }
    if (ctx.role === "parent" && !ctx.studentIds.includes(sub["studentId"] as string)) {
      fail("PERMISSION_DENIED", "not a linked child");
    }
    // The OWNER may read their submission, but the release gate (§6.10) WITHHOLDS
    // the score/grade/summary until results are released — a STRIPPED projection,
    // not a denial (so the client can render "results pending").
    if (sub["resultsReleased"] !== true) {
      return stripReleaseGated(toSubmissionDetailView(sub)) as ResOf<"v1.autograde.getSubmission">;
    }
  }
  return toSubmissionDetailView(sub) as ResOf<"v1.autograde.getSubmission">;
}

/** Project a stored Submission doc → the strict SubmissionDetailView. */
function toSubmissionDetailView(d: Record<string, unknown>): Record<string, unknown> {
  const ans = (d["answerSheets"] as Record<string, unknown> | undefined) ?? {};
  return compact({
    id: d["id"],
    examId: d["examId"],
    studentId: d["studentId"],
    studentName: d["studentName"] ?? "",
    rollNumber: d["rollNumber"] ?? "",
    classId: d["classId"],
    answerSheets: compact({
      images: ans["images"] ?? [],
      uploadedAt: ans["uploadedAt"] ?? d["createdAt"],
      uploadedBy: ans["uploadedBy"] ?? d["uploadedBy"],
      uploadSource: canonUploadSource(ans["uploadSource"] ?? "web"),
    }),
    scoutingResult: d["scoutingResult"],
    summary: toSubmissionSummary(d),
    pipelineStatus: canonPipelineStatus(d["pipelineStatus"]),
    pipelineError: d["pipelineError"],
    retryCount: d["retryCount"] ?? 0,
    gradingProgress: d["gradingProgress"],
    resultsReleased: d["resultsReleased"] ?? false,
    resultsReleasedAt: d["resultsReleasedAt"] ?? null,
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}

/** Normalize a stored submission `summary` to the strict SubmissionSummary shape. */
function toSubmissionSummary(d: Record<string, unknown>): Record<string, unknown> {
  const s = (d["summary"] as Record<string, unknown> | undefined) ?? {};
  return compact({
    totalScore: s["totalScore"] ?? d["totalScore"] ?? 0,
    maxScore: s["maxScore"] ?? d["maxScore"] ?? 0,
    percentage: s["percentage"] ?? d["percentage"] ?? 0,
    // '' is not a GradeLetter — coerce empty/missing to 'F'; canonicalize the rest
    // (legacy 'C+' etc. pass through the strict letter enum; unknown FAILS — AD-4).
    grade: canonGrade(s["grade"] ?? d["grade"]),
    questionsGraded: s["questionsGraded"] ?? 0,
    totalQuestions: s["totalQuestions"] ?? 0,
    completedAt: s["completedAt"] ?? null,
  });
}

/** Remove release-gated score/grade/summary fields from a submission projection (§6.10). */
function stripReleaseGated(sub: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...sub };
  for (const f of [
    "totalScore",
    "maxScore",
    "percentage",
    "grade",
    "summary",
    "score",
    "evaluation",
  ]) {
    delete copy[f];
  }
  return copy;
}

// ---- listQuestionSubmissions (released-gate + cost strip; never answer key) ----
export async function listQuestionSubmissionsService(
  input: ReqOf<"v1.autograde.listQuestionSubmissions">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.listQuestionSubmissions">> {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", {
    submissionId: input.submissionId,
    tenantId,
  });
  const released = sub["resultsReleased"] === true;
  // Ownership gate for a non-teacher (a non-owner is DENIED); the release gate only
  // STRIPS per-question evaluation/score, it does NOT deny the owner's read.
  if (!teacherish) {
    if (ctx.role === "student" && sub["studentId"] !== ctx.entityIds.studentId) {
      fail("PERMISSION_DENIED", "not your submission");
    }
    if (ctx.role === "parent" && !ctx.studentIds.includes(sub["studentId"] as string)) {
      fail("PERMISSION_DENIED", "not a linked child");
    }
  }

  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const visible = teacherish || released;
  return {
    questionSubmissions: qsubs.map((q) => {
      const view = toQuestionSubmissionView(q, sub["examId"] as string);
      if (visible) {
        // Full grader / post-release view: strip only ⚷ cost from the evaluation.
        if (view["evaluation"]) view["evaluation"] = stripEvaluationCost(view["evaluation"]);
        return view;
      }
      // Pre-release learner view (§6.10): withhold EVERY score/grade-bearing field —
      // the per-question evaluation, the manual override (per-question score +
      // teacher's override reason), and the grading error (pipeline internals) —
      // until results are released. `mapping` (the student's own answer pages) and
      // `gradingStatus` (process state, no score) remain visible.
      delete view["evaluation"];
      delete view["manualOverride"];
      delete view["gradingError"];
      return view;
    }),
  } as ResOf<"v1.autograde.listQuestionSubmissions">;
}

/** Project a stored question-submission doc → strict QuestionSubmissionView. */
function toQuestionSubmissionView(
  d: Record<string, unknown>,
  examId: string
): Record<string, unknown> {
  const ev = d["evaluation"] as Record<string, unknown> | undefined;
  const maxScore =
    (d["maxScore"] as number | undefined) ?? (ev?.["maxScore"] as number | undefined) ?? 0;
  return compact({
    id: d["id"],
    submissionId: d["submissionId"],
    questionId: d["questionId"],
    examId: (d["examId"] as string | undefined) ?? examId,
    mapping: (d["mapping"] as Record<string, unknown> | undefined) ?? {
      pageIndices: [],
      imageUrls: [],
      scoutedAt: d["createdAt"],
    },
    evaluation: ev ? toUnifiedEvaluation(ev, d, maxScore) : undefined,
    gradingStatus: d["gradingStatus"] ?? "pending",
    gradingError: d["gradingError"],
    manualOverride: d["manualOverride"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"] ?? d["createdAt"],
  });
}

/** Normalize a stored evaluation bag → strict UnifiedEvaluationResult. */
function toUnifiedEvaluation(
  ev: Record<string, unknown>,
  parent: Record<string, unknown>,
  maxScore: number
): Record<string, unknown> {
  const score = (ev["score"] as number | undefined) ?? (parent["score"] as number | undefined) ?? 0;
  return compact({
    score,
    maxScore: (ev["maxScore"] as number | undefined) ?? maxScore,
    correctness: (ev["correctness"] as number | undefined) ?? (maxScore > 0 ? score / maxScore : 0),
    percentage:
      (ev["percentage"] as number | undefined) ?? (maxScore > 0 ? (score / maxScore) * 100 : 0),
    structuredFeedback: ev["structuredFeedback"],
    strengths: ev["strengths"] ?? [],
    weaknesses: ev["weaknesses"] ?? [],
    missingConcepts: ev["missingConcepts"] ?? [],
    rubricBreakdown: ev["rubricBreakdown"],
    summary: (ev["summary"] as string | undefined) ?? (ev["feedback"] as string | undefined),
    confidence: (ev["confidence"] as number | undefined) ?? 1,
    mistakeClassification: ev["mistakeClassification"],
    // ⚷ `tokensUsed`/`costUsd` (cost telemetry) are NEVER emitted into a client
    // view — `stripEvaluationCost` only catches the legacy `tokenUsage` alias, so
    // mapping them here would leak the renamed field past the strip.
    gradedAt:
      (ev["gradedAt"] as string | undefined) ??
      (parent["updatedAt"] as string | undefined) ??
      (parent["createdAt"] as string | undefined),
  });
}

// ---- getExamAnalytics ----
export async function getExamAnalyticsService(
  input: ReqOf<"v1.autograde.getExamAnalytics">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.getExamAnalytics">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.examId, tenantId });
  const doc = await ctx.repos.exams.get(tenantId, `analytics_${input.examId}`);
  if (!doc) fail("NOT_FOUND", `exam analytics ${input.examId} not found`);
  return toExamAnalyticsView(doc) as ResOf<"v1.autograde.getExamAnalytics">;
}

// ---- listEvaluationSettings (thresholds for authoring only) ----
export async function listEvaluationSettingsService(
  input: ReqOf<"v1.autograde.listEvaluationSettings">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.listEvaluationSettings">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { tenantId });
  const authoring = isAuthoringRole(ctx);
  const all = await listEvaluationSettings(ctx, tenantId);
  const visible = all.filter((s) => authoring || s["isPublic"] === true || input.includePublic);
  return {
    settings: visible.map((s) => projectEvaluationSettings(toEvaluationSettingsView(s), authoring)),
  } as ResOf<"v1.autograde.listEvaluationSettings">;
}

// ---- listDeadLetter (teacher/admin only) ----
export async function listDeadLetterService(
  input: ReqOf<"v1.autograde.listDeadLetter">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.listDeadLetter">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "grade.retry", { tenantId });
  const entries = await ctx.repos.outbox.drain(tenantId);
  const f = input.filter ?? {};
  let dlq = entries.filter((e) => e["_kind"] === "gradingDeadLetter");
  if (f.resolved !== undefined) {
    dlq = dlq.filter((e) => Boolean(e["resolvedAt"]) === f.resolved);
  }
  if (f.pipelineStep) {
    // filter on the CANONICAL step so a legacy 'ocr' entry matches a 'scouting' filter.
    dlq = dlq.filter((e) => canonPipelineStep(e["pipelineStep"]) === f.pipelineStep);
  }
  // re-enqueue what we drained (drain is a read+clear; keep durable) — best effort.
  for (const e of entries) await ctx.repos.outbox.enqueue(tenantId, e);
  return {
    items: dlq.map(toDeadLetterView),
    nextCursor: null,
  } as ResOf<"v1.autograde.listDeadLetter">;
}

// ---- getSubmissionForExam (C16, released-gated single read) ----
export async function getSubmissionForExamService(
  input: ReqOf<"v1.autograde.getSubmissionForExam">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.getSubmissionForExam">> {
  const tenantId = requireTenant(ctx);
  const teacherish = isTeacherish(ctx);
  authorize(ctx, teacherish ? "submission.read" : "submission.readReleased", { tenantId });
  const page = await ctx.repos.submissions.list(tenantId, {
    where: { examId: input.examId, studentId: input.studentId },
    filter: (d) => d["_kind"] !== "questionSubmission",
    limit: 1,
  });
  const sub = page.items[0];
  if (!sub) return null as ResOf<"v1.autograde.getSubmissionForExam">;
  if (!teacherish && sub["resultsReleased"] !== true) {
    return null as ResOf<"v1.autograde.getSubmissionForExam">;
  }
  return toSubmissionDetailView(sub) as ResOf<"v1.autograde.getSubmissionForExam">;
}

// ---- view mappers ----
/** Drop UNDEFINED keys so absent OPTIONAL fields don't serialize as `null`
 *  (a Firebase callable turns `undefined`→`null` over the wire, which a strict
 *  `.optional()` schema then rejects). `null` is KEPT (nullable-required fields). */
function compact(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

// ---- legacy → canonical field collapse (U1.1 read-adapters). Every stored enum
// is parsed through the domain legacy-tolerant READ schema so a v1 read emits the
// CANONICAL value (which re-validates against the strict view schema). Un-migrated
// SUB001 seed + functions writes carry dropped legacy values (`completed`,
// `ocr_processing`, `gcs`, `ocr` step); these are the ONE boundary they collapse.
/** Exam status: legacy 'completed' → 'grading' (AD-10; NEVER 'results_released'). */
function canonExamStatus(v: unknown): unknown {
  return typeof v === "string" ? zLegacyExamStatusRead.parse(v) : v;
}
/** Submission pipeline status: 'ocr_processing'→'scouting', 'ocr_failed'→'scouting_failed'. */
function canonPipelineStatus(v: unknown): unknown {
  return typeof v === "string" ? zLegacySubmissionPipelineStatusRead.parse(v) : v;
}
/** Answer-sheet upload source: legacy 'gcs' → 'scanner'. */
function canonUploadSource(v: unknown): unknown {
  return typeof v === "string" ? zLegacyUploadSourceRead.parse(v) : v;
}
/** DLQ/grading pipeline step: legacy 'ocr' → 'scouting'. */
function canonPipelineStep(v: unknown): unknown {
  return typeof v === "string" ? zLegacyGradingPipelineStepRead.parse(v) : v;
}
/** Grade letter: '' / missing → 'F' (ungraded/withheld); else canonicalize (incl.
 *  'C+'). An unknown letter FAILS the parse — never guess a grade (AD-4). */
function canonGrade(v: unknown): string {
  return v ? zLegacyGradeLetterRead.parse(v) : "F";
}

function toExamListView(d: Record<string, unknown>): Record<string, unknown> {
  return compact({
    id: d["id"],
    title: d["title"],
    subject: d["subject"] ?? "",
    topics: d["topics"] ?? [],
    classIds: d["classIds"] ?? [],
    examDate: d["examDate"] ?? d["createdAt"],
    duration: d["duration"] ?? 0,
    totalMarks: d["totalMarks"] ?? 0,
    passingMarks: d["passingMarks"] ?? 0,
    status: canonExamStatus(d["status"]),
    academicSessionId: d["academicSessionId"],
    linkedSpaceId: d["linkedSpaceId"],
    linkedSpaceTitle: d["linkedSpaceTitle"],
    stats: d["stats"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}

/** Project a stored Exam doc → the strict ExamDetailView (drops entity-only
 *  `tenantId`/`createdBy`; canonicalizes `status`; resolves the deprecated nested
 *  `gradingConfig.evaluationSettingsId` up to the canonical top-level field). */
function toExamDetailView(d: Record<string, unknown>): Record<string, unknown> {
  const gradingConfig = (d["gradingConfig"] as Record<string, unknown> | undefined) ?? {};
  return compact({
    id: d["id"],
    title: d["title"],
    subject: d["subject"] ?? "",
    topics: d["topics"] ?? [],
    classIds: d["classIds"] ?? [],
    sectionIds: d["sectionIds"],
    examDate: d["examDate"] ?? d["createdAt"],
    duration: d["duration"] ?? 0,
    academicSessionId: d["academicSessionId"],
    totalMarks: d["totalMarks"] ?? 0,
    passingMarks: d["passingMarks"] ?? 0,
    status: canonExamStatus(d["status"]),
    questionPaper: d["questionPaper"],
    gradingConfig: d["gradingConfig"],
    // Canonical reader precedence (U1.3): top-level wins; nested is @deprecated read-only.
    evaluationSettingsId: d["evaluationSettingsId"] ?? gradingConfig["evaluationSettingsId"],
    linkedSpaceId: d["linkedSpaceId"],
    linkedSpaceTitle: d["linkedSpaceTitle"],
    linkedStoryPointId: d["linkedStoryPointId"],
    stats: d["stats"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}

/** Project a stored ExamQuestion doc → the strict ExamQuestionView. Whitelists the
 *  view keys (drops `_kind`/`tenantId`/`extractedBy`/`linkedItemId`/…), absorbs the
 *  legacy `orderIndex` alias for `order`, and strips rubric guidance for non-authors. */
function toExamQuestionView(
  d: Record<string, unknown>,
  authoring: boolean
): Record<string, unknown> {
  return compact({
    id: d["id"],
    examId: d["examId"],
    text: d["text"] ?? "",
    imageUrls: d["imageUrls"],
    maxMarks: d["maxMarks"] ?? 0,
    order: (d["order"] as number | undefined) ?? (d["orderIndex"] as number | undefined) ?? 0,
    rubric: projectRubric(d["rubric"], authoring),
    questionType: d["questionType"],
    subQuestions: d["subQuestions"],
    extractionConfidence: d["extractionConfidence"],
    readabilityIssue: d["readabilityIssue"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"] ?? d["createdAt"],
  });
}

/** Project a stored ExamAnalytics doc → the strict ExamAnalyticsView (drops the
 *  doc's `analytics_*` `id`/`_kind`/`tenantId` wrapper keys). */
function toExamAnalyticsView(d: Record<string, unknown>): Record<string, unknown> {
  return compact({
    examId: d["examId"],
    totalSubmissions: d["totalSubmissions"] ?? 0,
    gradedSubmissions: d["gradedSubmissions"] ?? 0,
    avgScore: d["avgScore"] ?? 0,
    avgPercentage: d["avgPercentage"] ?? 0,
    passRate: d["passRate"] ?? 0,
    medianScore: d["medianScore"] ?? 0,
    scoreDistribution: d["scoreDistribution"],
    questionAnalytics: d["questionAnalytics"] ?? {},
    classBreakdown: d["classBreakdown"] ?? {},
    topicPerformance: d["topicPerformance"] ?? {},
    computedAt: d["computedAt"] ?? d["lastUpdatedAt"] ?? d["createdAt"],
    lastUpdatedAt: d["lastUpdatedAt"] ?? d["computedAt"] ?? d["updatedAt"],
  });
}

/** Project a stored EvaluationSettings doc → the strict EvaluationSettingsView
 *  (drops `_kind`/`tenantId`/`createdBy` wrapper keys; nested content is written
 *  canonically by the v1 save path). Guidance/threshold stripping stays in
 *  `projectEvaluationSettings`, applied by the caller. */
function toEvaluationSettingsView(d: Record<string, unknown>): Record<string, unknown> {
  return compact({
    id: d["id"],
    name: d["name"] ?? "",
    description: d["description"],
    isDefault: d["isDefault"] ?? false,
    isPublic: d["isPublic"],
    enabledDimensions: d["enabledDimensions"] ?? [],
    displaySettings: d["displaySettings"],
    confidenceConfig: d["confidenceConfig"],
    usageQuota: d["usageQuota"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"] ?? d["createdAt"],
  });
}

/** Project a stored gradingDeadLetter entry → the strict DeadLetterView
 *  (whitelists view keys; canonicalizes the legacy `ocr` pipeline step → `scouting`). */
function toDeadLetterView(d: Record<string, unknown>): Record<string, unknown> {
  return compact({
    id: d["id"],
    submissionId: d["submissionId"],
    questionSubmissionId: d["questionSubmissionId"],
    pipelineStep: canonPipelineStep(d["pipelineStep"]),
    error: d["error"] ?? "",
    attempts: d["attempts"] ?? 0,
    lastAttemptAt: d["lastAttemptAt"] ?? d["createdAt"],
    resolvedAt: (d["resolvedAt"] as string | null | undefined) ?? null,
    resolutionMethod: d["resolutionMethod"],
    createdAt: d["createdAt"],
  });
}

function toSubmissionListView(d: Record<string, unknown>): Record<string, unknown> {
  return compact({
    id: d["id"],
    examId: d["examId"],
    studentId: d["studentId"],
    studentName: d["studentName"] ?? "",
    rollNumber: d["rollNumber"] ?? "",
    classId: d["classId"],
    pipelineStatus: canonPipelineStatus(d["pipelineStatus"]),
    summary: toSubmissionSummary(d),
    gradingProgress: d["gradingProgress"],
    resultsReleased: d["resultsReleased"] ?? false,
    uploadedBy:
      (d["uploadedBy"] as string | undefined) ??
      (d["answerSheets"] as Record<string, unknown> | undefined)?.["uploadedBy"],
    createdAt: d["createdAt"],
    updatedAt: d["updatedAt"],
  });
}
