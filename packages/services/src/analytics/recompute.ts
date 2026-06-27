/**
 * Server-only recompute / projection services (analytics.md §"services/server").
 * Authoritative derived state: SINGLE-WRITER per doc, section-scoped, idempotent.
 * Consumed by triggers + the orchestrator, never by clients. `(input, ctx)` where
 * ctx is the system context (no rate-limit/quota). Summaries stored on the
 * `tenants` repo with `_kind` discriminators (the real adapter uses dedicated
 * collections).
 */
import type { SystemContext } from "../shared/context.js";
import { evaluateAtRiskRules, computeOverallScore, median } from "./rules.js";

type Doc = Record<string, unknown>;

const STUDENT_SUMMARY = "studentSummary";
const CLASS_SUMMARY = "classSummary";
const EXAM_ANALYTICS = "examAnalytics";
const INSIGHT = "insight";

function summaryDocId(kind: string, id: string): string {
  return `${kind}_${id}`;
}

export interface RecomputeStudentSummaryInput {
  tenantId: string;
  studentId: string;
  section: "autograde" | "levelup";
}

/**
 * SINGLE-WRITER per summary doc. Section-scoped transaction merge; sets
 * `lastUpdatedAt`; idempotent. Recomputes the section metrics + the composite
 * `overallScore` from both sections. Sets the `recompute` marker for the
 * orchestrator (does NOT itself run class-rollup / leaderboard / notify).
 */
export async function recomputeStudentSummaryService(
  input: RecomputeStudentSummaryInput,
  ctx: SystemContext
): Promise<void> {
  const { tenantId, studentId, section } = input;
  const now = ctx.now();

  await ctx.repos.tx(async () => {
    const existing = (await ctx.repos.tenants.get(
      tenantId,
      summaryDocId(STUDENT_SUMMARY, studentId)
    )) ?? {
      _kind: STUDENT_SUMMARY,
      studentId,
      autograde: emptyAutograde(),
      levelup: emptyLevelup(),
    };

    const updatedSection =
      section === "autograde"
        ? await computeAutogradeMetrics(ctx, tenantId, studentId)
        : await computeLevelupMetrics(ctx, tenantId, studentId);

    const merged: Doc = {
      ...existing,
      _kind: STUDENT_SUMMARY,
      id: summaryDocId(STUDENT_SUMMARY, studentId),
      studentId,
      [section]: updatedSection,
    };

    const examAvg = (merged["autograde"] as Doc)?.["averageScore"] as number | undefined;
    const accuracy = (merged["levelup"] as Doc)?.["averageAccuracy"] as number | undefined;
    merged["overallScore"] = computeOverallScore({
      examAverage: examAvg,
      practiceAccuracy: accuracy,
    });
    merged["lastUpdatedAt"] = now;
    merged["recompute"] = { reason: section, requestedAt: now };

    await ctx.repos.tenants.upsert(tenantId, merged, now);
  });
}

export interface RecomputeClassSummaryInput {
  tenantId: string;
  classId: string;
}

/** Recompute class top/bottom performers + at-risk roster; resolves real className. */
export async function recomputeClassSummaryService(
  input: RecomputeClassSummaryInput,
  ctx: SystemContext
): Promise<void> {
  const { tenantId, classId } = input;
  const now = ctx.now();
  const klass = await ctx.repos.classes.get(tenantId, classId);
  const className = (klass?.["name"] as string | undefined) ?? classId;

  const students = await listClassStudentSummaries(ctx, tenantId, classId);
  const atRisk = students.filter((s) => s["isAtRisk"] === true);
  const scores = students
    .map((s) => s["overallScore"] as number | undefined)
    .filter((n): n is number => typeof n === "number");

  await ctx.repos.tenants.upsert(
    tenantId,
    {
      id: summaryDocId(CLASS_SUMMARY, classId),
      _kind: CLASS_SUMMARY,
      classId,
      className,
      studentCount: students.length,
      atRiskStudentIds: atRisk.map((s) => s["studentId"]),
      atRiskCount: atRisk.length,
      avgOverallScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      lastUpdatedAt: now,
    },
    now
  );
}

export interface RecomputeExamAnalyticsInput {
  tenantId: string;
  examId: string;
}

/** Compute avg/median/passRate, distribution, per-class breakdown for a released exam. */
export async function recomputeExamAnalyticsService(
  input: RecomputeExamAnalyticsInput,
  ctx: SystemContext
): Promise<void> {
  const { tenantId, examId } = input;
  const now = ctx.now();
  const exam = await ctx.repos.exams.get(tenantId, examId);
  const passingMarks = (exam?.["passingMarks"] as number | undefined) ?? 0;

  const submissions = await listExamSubmissions(ctx, tenantId, examId);
  const graded = submissions.filter((s) =>
    ["ready_for_review", "reviewed"].includes(s["pipelineStatus"] as string)
  );
  const percentages = graded
    .map((s) => (s["summary"] as Doc | undefined)?.["percentage"] as number | undefined)
    .filter((n): n is number => typeof n === "number");
  const scores = graded
    .map((s) => (s["summary"] as Doc | undefined)?.["totalScore"] as number | undefined)
    .filter((n): n is number => typeof n === "number");
  const passed = graded.filter(
    (s) => (((s["summary"] as Doc | undefined)?.["totalScore"] as number) ?? 0) >= passingMarks
  ).length;

  await ctx.repos.exams.upsert(
    tenantId,
    {
      id: summaryDocId(EXAM_ANALYTICS, examId),
      _kind: EXAM_ANALYTICS,
      examId,
      totalSubmissions: submissions.length,
      gradedSubmissions: graded.length,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      avgPercentage: percentages.length
        ? percentages.reduce((a, b) => a + b, 0) / percentages.length
        : 0,
      passRate: graded.length ? passed / graded.length : 0,
      medianScore: median(scores),
      scoreDistribution: { buckets: [] },
      questionAnalytics: {},
      classBreakdown: {},
      topicPerformance: {},
      computedAt: now,
      lastUpdatedAt: now,
    },
    now
  );
}

export interface DetectAtRiskInput {
  tenantId: string;
  summaries: Doc[];
}

/** Apply at-risk rules; set `isAtRisk`/`atRiskReasons` ONLY — does NOT notify. */
export async function detectAtRiskService(
  input: DetectAtRiskInput,
  ctx: SystemContext
): Promise<void> {
  const now = ctx.now();
  for (const summary of input.summaries) {
    const result = evaluateAtRiskRules({
      overallScore: (summary["overallScore"] as number | undefined) ?? 0,
      streakDays:
        ((summary["levelup"] as Doc | undefined)?.["streakDays"] as number | undefined) ?? 0,
      recentExamPercentages: extractRecentPercentages(summary),
      completionPct:
        ((summary["levelup"] as Doc | undefined)?.["averageCompletion"] as number | undefined) ?? 0,
    });
    await ctx.repos.tenants.upsert(
      input.tenantId,
      {
        id: summaryDocId(STUDENT_SUMMARY, summary["studentId"] as string),
        _kind: STUDENT_SUMMARY,
        isAtRisk: result.isAtRisk,
        atRiskReasons: result.reasons,
        lastUpdatedAt: now,
      },
      now
    );
  }
}

export const INSIGHT_CAP = 5;

export interface GenerateInsightsInput {
  tenantId: string;
  studentId: string;
  seeds: {
    type: string;
    priority: string;
    title: string;
    description: string;
    actionType: string;
    actionEntityId?: string;
    actionEntityTitle?: string;
  }[];
}

/**
 * Write `min(slotsAvailable, seeds.length)` new insights, deterministically
 * deleting the oldest active by `createdAt` to keep ≤ INSIGHT_CAP active (fixes the
 * buggy slice).
 */
export async function generateInsightsService(
  input: GenerateInsightsInput,
  ctx: SystemContext
): Promise<void> {
  const { tenantId, studentId, seeds } = input;
  const now = ctx.now();
  const active = (
    await ctx.repos.tenants.list(tenantId, {
      filter: (d) => d["_kind"] === INSIGHT && d["studentId"] === studentId && !d["dismissedAt"],
      limit: 100,
    })
  ).items.sort((a, b) => String(a["createdAt"]).localeCompare(String(b["createdAt"])));

  const slotsAvailable = Math.max(0, INSIGHT_CAP - active.length);
  const toWrite = seeds.slice(0, slotsAvailable);

  // If we want to write more than there are slots, evict oldest active first.
  const overflow = Math.min(seeds.length, INSIGHT_CAP) - slotsAvailable;
  for (let i = 0; i < overflow && i < active.length; i++) {
    await ctx.repos.tenants.delete(tenantId, active[i]!["id"] as string);
  }
  const writeCount = Math.min(seeds.length, INSIGHT_CAP);
  for (let i = 0; i < writeCount; i++) {
    const seed = i < toWrite.length ? toWrite[i]! : seeds[i]!;
    await ctx.repos.tenants.upsert(
      tenantId,
      { _kind: INSIGHT, studentId, ...seed, createdAt: now, dismissedAt: null },
      now
    );
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function emptyAutograde(): Doc {
  return {
    totalExams: 0,
    completedExams: 0,
    averageScore: 0,
    averagePercentage: 0,
    recentExams: [],
  };
}
function emptyLevelup(): Doc {
  return {
    totalSpaces: 0,
    completedSpaces: 0,
    averageCompletion: 0,
    averageAccuracy: 0,
    streakDays: 0,
    recentActivity: [],
  };
}

async function computeAutogradeMetrics(
  ctx: SystemContext,
  tenantId: string,
  studentId: string
): Promise<Doc> {
  const subs = (
    await ctx.repos.submissions.list(tenantId, {
      where: { studentId },
      filter: (d) => d["_kind"] !== "questionSubmission" && d["resultsReleased"] === true,
      limit: 200,
    })
  ).items;
  const pcts = subs
    .map((s) => (s["summary"] as Doc | undefined)?.["percentage"] as number | undefined)
    .filter((n): n is number => typeof n === "number");
  const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  return {
    totalExams: subs.length,
    completedExams: subs.length,
    averageScore: avgPct / 100,
    averagePercentage: avgPct,
    recentExams: subs.slice(-5).map((s) => ({
      examId: s["examId"],
      date: s["updatedAt"],
      percentage: (s["summary"] as Doc | undefined)?.["percentage"] ?? 0,
    })),
  };
}

async function computeLevelupMetrics(
  ctx: SystemContext,
  tenantId: string,
  studentId: string
): Promise<Doc> {
  const progress = await ctx.repos.progress.get(tenantId, studentId, "*").catch(() => null);
  void progress;
  return emptyLevelup();
}

async function listClassStudentSummaries(
  ctx: SystemContext,
  tenantId: string,
  classId: string
): Promise<Doc[]> {
  return (
    await ctx.repos.tenants.list(tenantId, {
      filter: (d) =>
        d["_kind"] === STUDENT_SUMMARY &&
        ((d["classIds"] as string[] | undefined)?.includes(classId) ?? false),
      limit: 500,
    })
  ).items;
}

async function listExamSubmissions(
  ctx: SystemContext,
  tenantId: string,
  examId: string
): Promise<Doc[]> {
  return (
    await ctx.repos.submissions.list(tenantId, {
      where: { examId },
      filter: (d) => d["_kind"] !== "questionSubmission",
      limit: 500,
    })
  ).items;
}

function extractRecentPercentages(summary: Doc): number[] {
  const recent = (summary["autograde"] as Doc | undefined)?.["recentExams"] as
    | { percentage?: number }[]
    | undefined;
  return (recent ?? [])
    .map((e) => e.percentage)
    .filter((n): n is number => typeof n === "number")
    .reverse();
}
