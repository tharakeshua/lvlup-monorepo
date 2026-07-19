/**
 * AG-3 — v1 autograde reads canonicalize legacy Firestore drift (plan §5.2).
 *
 * The un-migrated SUB001 seed + writes still emitted by `functions/{autograde,levelup}`
 * carry DROPPED legacy enum values and key drift:
 *   - Exam.status            'completed'      → 'grading'  (AD-10; NEVER 'results_released')
 *   - Submission.pipelineStatus 'ocr_processing' → 'scouting'
 *   - AnswerSheet.uploadSource  'gcs'         → 'scanner'
 *   - SubmissionSummary.grade   'C+'          → canonical 8-letter enum (no aliasing)
 *   - ExamQuestion.orderIndex                 → the canonical `order` key
 *   - gradingDeadLetter.pipelineStep 'ocr'    → 'scouting'
 *   - Exam.gradingConfig.evaluationSettingsId (@deprecated) → top-level evaluationSettingsId
 *
 * These lock that a v1 READ collapses each legacy value forward via the domain
 * U1.1 read-adapters and emits a CANONICAL view that PASSES the strict CONTRACT
 * view schema — so `validateResponses:true` can safely run in every app. Each case
 * also documents that the RAW legacy value would FAIL that same strict schema.
 */
import { describe, it, expect } from "vitest";
import { getCallable } from "@levelup/api-contract";
import {
  zExamStatus,
  zSubmissionPipelineStatus,
  zUploadSource,
  gradeForPercentage,
} from "@levelup/domain";
import { makeAuthContext, makeSystemContext } from "../../../../tests/sdk/harness/auth-context";
import {
  listExamsService,
  getExamService,
  listQuestionsService,
  listSubmissionsService,
  getSubmissionService,
  getSubmissionForExamService,
  listQuestionSubmissionsService,
  listDeadLetterService,
} from "./reads";
import { gradeFor } from "./pipeline/finalize-submission";
import { resolveRubricService } from "./pipeline/resolve-rubric";

const TS = "2026-01-01T00:00:00.000Z";

/** A minimal-but-VALID canonical rubric (criteria mode). */
const RUBRIC = { scoringMode: "criteria_based", criteria: [] };
/** A minimal-but-VALID canonical grading config. */
const GRADING_CONFIG = {
  autoGrade: true,
  allowRubricEdit: true,
  allowManualOverride: true,
  requireOverrideReason: false,
  releaseResultsAutomatically: false,
};

describe("AG-3 — v1 autograde reads canonicalize legacy drift", () => {
  // -------------------------------------------------------------------------
  // EXAMS — status 'completed' → 'grading' (AD-10) + gradingConfig eval-settings fallback
  // -------------------------------------------------------------------------
  describe("exam status 'completed' → 'grading' (AD-10, never 'results_released')", () => {
    async function seedLegacyExam() {
      const ctx = makeAuthContext("teacher");
      const tenantId = ctx.tenantId!;
      await ctx.repos.exams.upsert(tenantId, {
        id: "exam_legacy",
        title: "Legacy Midterm",
        subject: "Math",
        topics: ["algebra"],
        classIds: ctx.classIds,
        examDate: TS,
        duration: 60,
        totalMarks: 100,
        passingMarks: 40,
        status: "completed", // legacy graded-but-unreleased
        gradingConfig: { ...GRADING_CONFIG, evaluationSettingsId: "evalset_legacy" }, // nested-only
        stats: { totalSubmissions: 0, gradedSubmissions: 0, avgScore: 0, passRate: 0 },
        createdBy: "uid_author", // entity-only field — MUST be dropped from the view
        createdAt: TS,
        updatedAt: TS,
      });
      return { ctx, tenantId };
    }

    it("documents the drift: raw 'completed' FAILS the strict ExamStatus enum", () => {
      expect(zExamStatus.safeParse("completed").success).toBe(false);
    });

    it("listExams emits status 'grading' and passes the ExamListView contract", async () => {
      const { ctx } = await seedLegacyExam();
      const res = await listExamsService({}, ctx);
      const row = res.items.find((e) => e.id === "exam_legacy")!;
      expect(row.status).toBe("grading");
      // No entity-only leak (strict view would reject `createdBy`/`tenantId`).
      expect("createdBy" in row).toBe(false);
      expect(getCallable("v1.autograde.listExams").responseSchema.safeParse(res).success).toBe(
        true
      );
    });

    it("getExam emits 'grading' + surfaces the nested @deprecated evaluationSettingsId", async () => {
      const { ctx } = await seedLegacyExam();
      const view = await getExamService({ id: "exam_legacy" }, ctx);
      expect(view.status).toBe("grading");
      // U1.3 reader precedence: nested gradingConfig.* surfaces at the canonical top-level.
      expect(view.evaluationSettingsId).toBe("evalset_legacy");
      expect("createdBy" in view).toBe(false);
      expect(getCallable("v1.autograde.getExam").responseSchema.safeParse(view).success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // QUESTIONS — legacy `orderIndex` alias → canonical `order`; strict whitelisting
  // -------------------------------------------------------------------------
  describe("exam questions: legacy 'orderIndex' → 'order', drops entity-only keys", () => {
    it("listQuestions maps orderIndex→order and passes ExamQuestionView", async () => {
      const ctx = makeAuthContext("teacher");
      const tenantId = ctx.tenantId!;
      await ctx.repos.exams.upsert(tenantId, {
        id: "examq_legacy",
        _kind: "examQuestion",
        examId: "exam_legacy",
        text: "What is 2+2?",
        maxMarks: 5,
        orderIndex: 3, // legacy key — canonical view uses `order`
        rubric: RUBRIC,
        rubricStatus: "pending",
        linkedItemId: "item_x", // entity-only — MUST be dropped
        extractedBy: "uid_author", // entity-only — MUST be dropped
        createdAt: TS,
        updatedAt: TS,
      });
      const res = await listQuestionsService({ examId: "exam_legacy" }, ctx);
      const q = res.questions.find((x) => x.id === "examq_legacy")!;
      expect(q.order).toBe(3);
      expect(q.rubricStatus).toBe("pending");
      expect("orderIndex" in q).toBe(false);
      expect("linkedItemId" in q).toBe(false);
      expect("extractedBy" in q).toBe(false);
      expect(getCallable("v1.autograde.listQuestions").responseSchema.safeParse(res).success).toBe(
        true
      );
    });
  });

  // -------------------------------------------------------------------------
  // SUBMISSIONS — pipelineStatus / uploadSource / grade collapse
  // -------------------------------------------------------------------------
  describe("submissions: 'ocr_processing'→'scouting', 'gcs'→'scanner', grade 'C+'", () => {
    function legacySubmission(ctx: ReturnType<typeof makeAuthContext>) {
      return {
        id: "sub_legacy",
        examId: "exam_legacy",
        studentId: "student_1",
        studentName: "Sam",
        rollNumber: "R1",
        classId: ctx.classIds[0],
        answerSheets: {
          images: ["tenants/t/exams/e/sheets/s1.jpg"],
          uploadedAt: TS,
          uploadedBy: "uid_scanner",
          uploadSource: "gcs", // legacy → scanner
        },
        summary: {
          totalScore: 55,
          maxScore: 100,
          percentage: 55,
          grade: "C+", // canonical 8-letter incl. C+
          questionsGraded: 5,
          totalQuestions: 5,
          completedAt: TS,
        },
        pipelineStatus: "ocr_processing", // legacy → scouting
        retryCount: 0,
        resultsReleased: true,
        resultsReleasedAt: TS,
        createdAt: TS,
        updatedAt: TS,
      };
    }

    it("documents the drift: raw legacy enums FAIL their strict schemas", () => {
      expect(zSubmissionPipelineStatus.safeParse("ocr_processing").success).toBe(false);
      expect(zUploadSource.safeParse("gcs").success).toBe(false);
    });

    it("listSubmissions emits 'scouting' + valid grade and passes SubmissionListView", async () => {
      const ctx = makeAuthContext("teacher");
      await ctx.repos.submissions.upsert(ctx.tenantId!, legacySubmission(ctx));
      const res = await listSubmissionsService({ filter: { examId: "exam_legacy" } }, ctx);
      const row = res.items.find((s) => s.id === "sub_legacy")!;
      expect(row.pipelineStatus).toBe("scouting");
      expect(row.summary.grade).toBe("C+");
      expect(
        getCallable("v1.autograde.listSubmissions").responseSchema.safeParse(res).success
      ).toBe(true);
    });

    it("getSubmission canonicalizes pipelineStatus + uploadSource and passes the view", async () => {
      const ctx = makeAuthContext("teacher");
      await ctx.repos.submissions.upsert(ctx.tenantId!, legacySubmission(ctx));
      const view = await getSubmissionService({ id: "sub_legacy" }, ctx);
      expect(view.pipelineStatus).toBe("scouting");
      expect(view.answerSheets.uploadSource).toBe("scanner");
      expect(view.summary!.grade).toBe("C+");
      expect(getCallable("v1.autograde.getSubmission").responseSchema.safeParse(view).success).toBe(
        true
      );
    });

    it("getSubmissionForExam returns a canonical Submission (not the raw legacy doc)", async () => {
      const ctx = makeAuthContext("teacher");
      await ctx.repos.submissions.upsert(ctx.tenantId!, legacySubmission(ctx));
      const view = await getSubmissionForExamService(
        { examId: "exam_legacy", studentId: "student_1" },
        ctx
      );
      expect(view!.pipelineStatus).toBe("scouting");
      expect(view!.answerSheets.uploadSource).toBe("scanner");
      expect(
        getCallable("v1.autograde.getSubmissionForExam").responseSchema.safeParse(view).success
      ).toBe(true);
    });

    it("a missing/empty grade coerces to 'F' (never guessed)", async () => {
      const ctx = makeAuthContext("teacher");
      const sub = legacySubmission(ctx);
      sub.id = "sub_nograde";
      sub.summary = { ...sub.summary, grade: "" } as never;
      await ctx.repos.submissions.upsert(ctx.tenantId!, sub);
      const view = await getSubmissionService({ id: "sub_nograde" }, ctx);
      expect(view.summary!.grade).toBe("F");
    });
  });

  // -------------------------------------------------------------------------
  // DEAD-LETTER — pipelineStep 'ocr' → 'scouting'
  // -------------------------------------------------------------------------
  describe("dead-letter: legacy pipelineStep 'ocr' → 'scouting'", () => {
    it("listDeadLetter emits canonical 'scouting' and passes DeadLetterView", async () => {
      const ctx = makeAuthContext("tenantAdmin");
      const tenantId = ctx.tenantId!;
      await ctx.repos.outbox.enqueue(tenantId, {
        id: "dlq_legacy",
        _kind: "gradingDeadLetter",
        submissionId: "sub_legacy",
        pipelineStep: "ocr", // legacy → scouting
        error: "gemini timeout",
        attempts: 3,
        lastAttemptAt: TS,
        resolvedAt: null,
        createdAt: TS,
      });
      const res = await listDeadLetterService({}, ctx);
      const entry = res.items.find((e) => e.id === "dlq_legacy")!;
      expect(entry.pipelineStep).toBe("scouting");
      expect("_kind" in entry).toBe(false);
      expect(getCallable("v1.autograde.listDeadLetter").responseSchema.safeParse(res).success).toBe(
        true
      );
    });
  });

  // -------------------------------------------------------------------------
  // SUBMISSION DETAIL EMBEDS — pipeline writes RICHER embeds than the strict view
  // (the answer-mapping pipeline persists server-only routing detail on
  // `scoutingResult`, and an additive `otherQuestionIds` seam on question
  // `mapping`). The RAW blobs made the strict getSubmission /
  // listQuestionSubmissions response validation throw client-side ("Submission
  // not found" on the grading-review page). The projection must whitelist to the
  // contract fields so the views pass `validateResponses:true`.
  // -------------------------------------------------------------------------
  describe("submission embeds: rich pipeline detail whitelisted to the strict view", () => {
    /** A submission whose `scoutingResult` carries the pipeline's server-only detail. */
    function scoutedSubmission(ctx: ReturnType<typeof makeAuthContext>): Record<string, unknown> {
      return {
        id: "sub_scouted",
        examId: "exam_scouted",
        studentId: "student_1",
        studentName: "Unknown",
        rollNumber: "R1",
        classId: ctx.classIds[0],
        answerSheets: {
          images: ["tenants/t/exams/e/sheets/s1.jpg"],
          uploadedAt: TS,
          uploadedBy: "uid_scanner",
          uploadSource: "web",
        },
        // The EXACT shape process-answer-mapping.ts writes: the 3 contract fields
        // PLUS server-only routing detail that the strict view schema forbids.
        scoutingResult: {
          routingMap: {},
          confidence: {},
          completedAt: TS,
          pageMappings: [{ pageIndex: 0, foundContent: [], hasUnknownContent: false }],
          unmappedPages: [0, 1, 2],
          edgeCases: [
            { type: "orphan_page", needsReview: true, affectedPages: [0], affectedQuestions: [] },
          ],
          aggregateConfidence: 0,
        },
        // Another stray top-level key the pipeline sets (not in the view schema).
        needsScoutReview: true,
        summary: {
          totalScore: 0,
          maxScore: 100,
          percentage: 0,
          grade: "F",
          questionsGraded: 0,
          totalQuestions: 24,
          completedAt: TS,
        },
        pipelineStatus: "ready_for_review",
        retryCount: 0,
        resultsReleased: false,
        resultsReleasedAt: null,
        createdAt: TS,
        updatedAt: TS,
      };
    }

    it("documents the drift: the RAW scoutingResult FAILS the strict view schema", () => {
      const raw = scoutedSubmission(makeAuthContext("teacher")).scoutingResult as unknown;
      // The full SubmissionDetailView carrying the raw embed would not validate;
      // ScoutingResultSchema is `.strict()` (only routingMap/confidence/completedAt).
      const detail = getCallable("v1.autograde.getSubmission").responseSchema;
      const withRaw = {
        id: "sub_scouted",
        examId: "exam_scouted",
        studentId: "student_1",
        studentName: "Unknown",
        rollNumber: "R1",
        classId: makeAuthContext("teacher").classIds[0],
        answerSheets: {
          images: [],
          uploadedAt: TS,
          uploadedBy: "uid_scanner",
          uploadSource: "web",
        },
        scoutingResult: raw,
        pipelineStatus: "ready_for_review",
        retryCount: 0,
        resultsReleased: false,
        resultsReleasedAt: null,
        createdAt: TS,
        updatedAt: TS,
      };
      expect(detail.safeParse(withRaw).success).toBe(false);
    });

    it("getSubmission whitelists scoutingResult to the 3 contract fields and passes the view", async () => {
      const ctx = makeAuthContext("teacher");
      await ctx.repos.submissions.upsert(ctx.tenantId!, scoutedSubmission(ctx));
      const view = await getSubmissionService({ id: "sub_scouted" }, ctx);
      // The server-only routing detail is stripped; only the contract shape remains.
      expect(Object.keys(view.scoutingResult!).sort()).toEqual([
        "completedAt",
        "confidence",
        "routingMap",
      ]);
      expect("needsScoutReview" in view).toBe(false);
      expect(getCallable("v1.autograde.getSubmission").responseSchema.safeParse(view).success).toBe(
        true
      );
    });

    it("listQuestionSubmissions strips the additive mapping.otherQuestionIds seam and passes the view", async () => {
      const ctx = makeAuthContext("teacher");
      // Parent submission (listQuestionSubmissions gates on it existing).
      await ctx.repos.submissions.upsert(ctx.tenantId!, scoutedSubmission(ctx));
      // A flat `_kind:'questionSubmission'` row whose `mapping` carries the seam.
      await ctx.repos.submissions.upsert(ctx.tenantId!, {
        id: "sub_scouted_q1",
        _kind: "questionSubmission",
        submissionId: "sub_scouted",
        questionId: "exam_scouted_q1",
        examId: "exam_scouted",
        mapping: {
          pageIndices: [],
          imageUrls: [],
          scoutedAt: TS,
          otherQuestionIds: ["exam_scouted_q2"], // additive seam — not in the view schema
        },
        evaluation: { score: 0, maxScore: 2, confidence: 0, feedback: "needs review" },
        gradingStatus: "needs_review",
        gradingRetryCount: 0,
        createdAt: TS,
        updatedAt: TS,
      });
      const res = await listQuestionSubmissionsService({ submissionId: "sub_scouted" }, ctx);
      const row = res.questionSubmissions.find((q) => q.id === "sub_scouted_q1")!;
      expect(Object.keys(row.mapping).sort()).toEqual(["imageUrls", "pageIndices", "scoutedAt"]);
      expect(
        getCallable("v1.autograde.listQuestionSubmissions").responseSchema.safeParse(res).success
      ).toBe(true);
    });

    it("listQuestionSubmissions passes a stored OBJECT summary + canonical rubricBreakdown through the view", async () => {
      const ctx = makeAuthContext("teacher");
      await ctx.repos.submissions.upsert(ctx.tenantId!, scoutedSubmission(ctx));
      // A graded question submission written by the evaluation engine: `summary`
      // is the OBJECT {keyTakeaway, overallComment} and rubricBreakdown carries the
      // canonical {criterionName, score, maxScore} shape.
      await ctx.repos.submissions.upsert(ctx.tenantId!, {
        id: "sub_scouted_q2",
        _kind: "questionSubmission",
        submissionId: "sub_scouted",
        questionId: "exam_scouted_q2",
        examId: "exam_scouted",
        mapping: { pageIndices: [1], imageUrls: ["u"], scoutedAt: TS },
        evaluation: {
          score: 4,
          maxScore: 5,
          correctness: 0.8,
          percentage: 80,
          strengths: ["clear derivation"],
          weaknesses: [],
          missingConcepts: [],
          rubricBreakdown: [{ criterionName: "Correctness", score: 4, maxScore: 5 }],
          summary: { keyTakeaway: "Strong answer", overallComment: "Minor arithmetic slip." },
          confidence: 0.9,
          gradedAt: TS,
        },
        gradingStatus: "graded",
        gradingRetryCount: 0,
        createdAt: TS,
        updatedAt: TS,
      });
      const res = await listQuestionSubmissionsService({ submissionId: "sub_scouted" }, ctx);
      const row = res.questionSubmissions.find((q) => q.id === "sub_scouted_q2")!;
      // The object summary survives the projection intact…
      expect(row.evaluation!.summary).toEqual({
        keyTakeaway: "Strong answer",
        overallComment: "Minor arithmetic slip.",
      });
      // …as does the canonical rubric shape…
      expect(row.evaluation!.rubricBreakdown).toEqual([
        { criterionName: "Correctness", score: 4, maxScore: 5 },
      ]);
      // …and the whole response validates against the (now object-summary) view.
      expect(
        getCallable("v1.autograde.listQuestionSubmissions").responseSchema.safeParse(res).success
      ).toBe(true);
    });

    it("normalizes a legacy STRING summary into the object shape and passes the view", async () => {
      const ctx = makeAuthContext("teacher");
      await ctx.repos.submissions.upsert(ctx.tenantId!, scoutedSubmission(ctx));
      await ctx.repos.submissions.upsert(ctx.tenantId!, {
        id: "sub_scouted_q3",
        _kind: "questionSubmission",
        submissionId: "sub_scouted",
        questionId: "exam_scouted_q3",
        examId: "exam_scouted",
        mapping: { pageIndices: [2], imageUrls: ["u"], scoutedAt: TS },
        // Legacy shape: summary stored as a bare string.
        evaluation: { score: 1, maxScore: 2, confidence: 0.5, summary: "Partially correct." },
        gradingStatus: "graded",
        gradingRetryCount: 0,
        createdAt: TS,
        updatedAt: TS,
      });
      const res = await listQuestionSubmissionsService({ submissionId: "sub_scouted" }, ctx);
      const row = res.questionSubmissions.find((q) => q.id === "sub_scouted_q3")!;
      expect(row.evaluation!.summary).toEqual({
        keyTakeaway: "Partially correct.",
        overallComment: "Partially correct.",
      });
      expect(
        getCallable("v1.autograde.listQuestionSubmissions").responseSchema.safeParse(res).success
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// FINALIZE — canonical grade bands (U1.2/B5): gradeFor delegates to the domain
// boundary; diverges from legacy on the 33–59 range (C+ 50–59, C 40–49, D floor 33).
// ---------------------------------------------------------------------------
describe("AG-3 — finalize-submission grade bands are the canonical domain scale", () => {
  it("gradeFor IS the domain gradeForPercentage boundary (no local table)", () => {
    expect(gradeFor).toBe(gradeForPercentage);
  });

  it("maps each canonical band boundary correctly", () => {
    const cases: [number, string][] = [
      [100, "A+"],
      [90, "A+"],
      [89.9, "A"],
      [80, "A"],
      [70, "B+"],
      [60, "B"],
      [59, "C+"],
      [50, "C+"], // legacy would score this 'F' — the locked divergence
      [49, "C"],
      [40, "C"],
      [39, "D"],
      [33, "D"], // canonical D floor
      [32, "F"],
      [0, "F"],
    ];
    for (const [pct, letter] of cases) {
      expect(gradeFor(pct), `${pct}% → ${letter}`).toBe(letter);
    }
  });

  it("clamps negative / NaN to 'F'", () => {
    expect(gradeFor(-10)).toBe("F");
    expect(gradeFor(Number.NaN)).toBe("F");
  });
});

// ---------------------------------------------------------------------------
// RESOLVE-RUBRIC — U1.3 evaluationSettingsId reader fallback (nested-only exam)
// ---------------------------------------------------------------------------
describe("AG-3 — resolveRubric falls back to the @deprecated nested evaluationSettingsId", () => {
  it("a legacy exam with only gradingConfig.evaluationSettingsId still resolves its thresholds", async () => {
    const ctx = makeSystemContext("tenant_x");
    // The threshold doc (distinctive value, NOT the hardcoded default 0.7).
    await ctx.repos.tenants.upsert("tenant_x", {
      id: "evalset_legacy",
      confidenceConfig: {
        confidenceThreshold: 0.42,
        autoApproveThreshold: 0.88,
        requireReviewForPartialCredit: false,
      },
    });
    const legacyExam = {
      id: "exam_nested_only",
      // top-level evaluationSettingsId is ABSENT — only the deprecated nested one is set.
      gradingConfig: { ...GRADING_CONFIG, evaluationSettingsId: "evalset_legacy" },
    };
    const resolved = await resolveRubricService(ctx, "tenant_x", legacyExam, { rubric: null });
    expect((resolved.confidenceConfig as { confidenceThreshold: number }).confidenceThreshold).toBe(
      0.42
    );
  });
});
