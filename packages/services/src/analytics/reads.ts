/**
 * Analytics read / shared services (analytics.md §"services/shared"). Almost the
 * whole domain is read + derived-projection: the SDK reads projections, never
 * writes. Authority enforced server-side (student-self / parent-of-via-claims /
 * teacher-of / super-admin platform-health). `tenantId` from ctx. The summary docs
 * are stored on the `tenants` repo with `_kind` discriminators in the testing twin;
 * the real adapter uses dedicated collections.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { tsRequired } from "../shared/projections.js";

type Doc = Record<string, unknown>;

const STUDENT_SUMMARY = "studentSummary";
const CLASS_SUMMARY = "classSummary";
const EXAM_ANALYTICS = "examAnalytics";
const INSIGHT = "insight";
const COST_DAILY = "costDaily";
const COST_MONTHLY = "costMonthly";

// ---- getSummary (discriminated by scope) ----
export async function getSummaryService(
  input: ReqOf<"v1.analytics.getSummary">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getSummary">> {
  switch (input.scope) {
    case "student": {
      const tenantId = requireTenant(ctx);
      const studentId = input.studentId ?? ctx.entityIds.studentId;
      if (!studentId) fail("INVALID_ARGUMENT", "studentId required");
      assertStudentReadable(ctx, studentId);
      authorize(ctx, "summary.read", { studentId, tenantId });
      const doc = await getKinded(ctx, tenantId, STUDENT_SUMMARY, studentId);
      if (!doc) fail("NOT_FOUND", `no summary for student ${studentId}`);
      return {
        scope: "student",
        studentSummary: projectStudentSummary(doc),
      } as ResOf<"v1.analytics.getSummary">;
    }
    case "class": {
      const tenantId = requireTenant(ctx);
      const classId = input.classId;
      if (!classId) fail("INVALID_ARGUMENT", "classId required");
      authorize(ctx, "summary.read", { classId, tenantId });
      // Class-ownership (§6.9): a teacher may read ONLY a class they are assigned
      // to (admins/staff/super-admin have tenant-wide analytics authority).
      if (ctx.role === "teacher" && !ctx.classIds.map(String).includes(String(classId))) {
        fail("PERMISSION_DENIED", `class ${classId} is not assigned to this teacher`);
      }
      const doc = await getKinded(ctx, tenantId, CLASS_SUMMARY, classId);
      if (!doc) fail("NOT_FOUND", `no summary for class ${classId}`);
      return {
        scope: "class",
        classSummary: {
          ...doc,
          tenantRollup: doc["tenantRollup"] ?? { academyAvg: 0, perClass: [] },
          masteryDistribution: doc["masteryDistribution"] ?? {
            notStarted: 0,
            inProgress: 0,
            mastered: 0,
          },
        },
      } as ResOf<"v1.analytics.getSummary">;
    }
    case "platform": {
      if (!ctx.isSuperAdmin) fail("PERMISSION_DENIED", "platform scope is super-admin only");
      return {
        scope: "platform",
        platformSummary: await computePlatformSummary(ctx),
      } as ResOf<"v1.analytics.getSummary">;
    }
    case "health": {
      if (!ctx.isSuperAdmin) fail("PERMISSION_DENIED", "health scope is super-admin only");
      return {
        scope: "health",
        healthSummary: { snapshot: await computeHealthSnapshot(ctx) },
      } as ResOf<"v1.analytics.getSummary">;
    }
    default:
      return fail("INVALID_ARGUMENT", "unknown summary scope");
  }
}

// ---- getExamAnalytics ----
export async function getExamAnalyticsService(
  input: ReqOf<"v1.analytics.getExamAnalytics">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getExamAnalytics">> {
  const tenantId = requireTenant(ctx);
  // Exam analytics is a teacher/admin grader view (NOT a learner read).
  authorize(ctx, "report.generate", { examId: input.examId, tenantId });
  const doc = await getKinded(ctx, tenantId, EXAM_ANALYTICS, input.examId);
  if (!doc) fail("NOT_FOUND", `no analytics for exam ${input.examId}`);
  return doc as ResOf<"v1.analytics.getExamAnalytics">;
}

// ---- listInsights ----
export async function listInsightsService(
  input: ReqOf<"v1.analytics.listInsights">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.listInsights">> {
  const tenantId = requireTenant(ctx);
  assertStudentReadable(ctx, input.studentId);
  authorize(ctx, "summary.read", { studentId: input.studentId, tenantId });
  // Dedicated insights collection (real adapter); filter to the student + dismiss state.
  const page = await xrepos(ctx).analyticsInsights.list(tenantId, {
    where: { studentId: input.studentId },
    filter: (d) => (input.includeDismissed ? true : !d["dismissedAt"] && d["dismissed"] !== true),
    cursor: input.cursor,
    limit: input.limit,
  });
  return { items: page.items, nextCursor: page.nextCursor } as ResOf<"v1.analytics.listInsights">;
}

// ---- getPerformanceTrends (on-the-fly aggregation over the summary recentExams) ----
export async function getPerformanceTrendsService(
  input: ReqOf<"v1.analytics.getPerformanceTrends">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getPerformanceTrends">> {
  const tenantId = requireTenant(ctx);
  const studentId = input.studentId ?? ctx.entityIds.studentId;
  authorize(ctx, "analytics.trends.read", { studentId, classId: input.classId, tenantId });
  if (studentId) assertStudentReadable(ctx, studentId);

  const summary = studentId ? await getKinded(ctx, tenantId, STUDENT_SUMMARY, studentId) : null;
  const recent =
    ((summary?.["autograde"] as Record<string, unknown> | undefined)?.["recentExams"] as
      | { date: string; percentage?: number }[]
      | undefined) ?? [];

  const points = bucketTrends(recent, input.granularity);
  return { points } as ResOf<"v1.analytics.getPerformanceTrends">;
}

// ---- getChildSummary (parent; studentId ∈ ctx.studentIds) ----
export async function getChildSummaryService(
  input: ReqOf<"v1.analytics.getChildSummary">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getChildSummary">> {
  const tenantId = requireTenant(ctx);
  if (!ctx.studentIds.includes(input.studentId)) {
    fail("PERMISSION_DENIED", "student is not a linked child");
  }
  authorize(ctx, "child.read", { studentId: input.studentId, tenantId });
  const studentSummary = await getKinded(ctx, tenantId, STUDENT_SUMMARY, input.studentId);
  if (!studentSummary) fail("NOT_FOUND", `no summary for child ${input.studentId}`);
  const insightsPage = await ctx.repos.tenants.list(tenantId, {
    filter: (d) =>
      d["_kind"] === INSIGHT && d["studentId"] === input.studentId && !d["dismissedAt"],
    limit: 5,
  });
  return {
    studentSummary: projectStudentSummary(studentSummary),
    recentInsights: insightsPage.items,
  } as ResOf<"v1.analytics.getChildSummary">;
}

// ---- listLinkedChildren (parent; reads ctx.studentIds, batched fetch) ----
export async function listLinkedChildrenService(
  input: ReqOf<"v1.analytics.listLinkedChildren">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.listLinkedChildren">> {
  const tenantId = requireTenant(ctx);
  // The parent enumerates THEIR OWN linked children (`ctx.studentIds` is the gate).
  // `child.read`'s `linked-child` ownership check is per-target-student, so it can't
  // gate a list (no single studentId); enforce the role here instead.
  if (ctx.role !== "parent" && !ctx.isSuperAdmin) {
    fail("PERMISSION_DENIED", "linked children are a parent read");
  }
  void input;
  const childIds = ctx.studentIds;
  const summaries = await Promise.all(
    childIds.map(async (sid) => ({
      sid,
      doc: await getKinded(ctx, tenantId, STUDENT_SUMMARY, sid),
    }))
  );
  const items = await Promise.all(
    summaries.map(async ({ sid, doc }) => {
      const student = await ctx.repos.students.get(tenantId, sid);
      return {
        studentId: sid,
        name:
          (student?.["name"] as string | undefined) ??
          (student?.["fullName"] as string | undefined) ??
          "Unknown",
        classNames: (student?.["classNames"] as string[] | undefined) ?? [],
        overallScore: (doc?.["overallScore"] as number | undefined) ?? 0,
        isAtRisk: (doc?.["isAtRisk"] as boolean | undefined) ?? false,
        atRiskReasons: (doc?.["atRiskReasons"] as string[] | undefined) ?? [],
      };
    })
  );
  return { items, nextCursor: null } as ResOf<"v1.analytics.listLinkedChildren">;
}

// ---- listParentAlerts (C18 — parent alert feed over linked children) ----
export async function listParentAlertsService(
  input: ReqOf<"v1.analytics.listParentAlerts">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.listParentAlerts">> {
  const tenantId = requireTenant(ctx);
  if (ctx.role !== "parent" && !ctx.isSuperAdmin) {
    fail("PERMISSION_DENIED", "parent alerts are a parent read");
  }
  void input;
  const now = ctx.now();
  const alerts: Record<string, unknown>[] = [];
  for (const sid of ctx.studentIds) {
    const doc = await getKinded(ctx, tenantId, STUDENT_SUMMARY, sid);
    if (!doc) continue;
    const student = await ctx.repos.students.get(tenantId, sid);
    const name =
      (student?.["firstName"] && student?.["lastName"]
        ? `${student["firstName"]} ${student["lastName"]}`
        : (student?.["name"] as string | undefined)) ?? "Unknown";
    if (doc["isAtRisk"] === true) {
      const reasons = (doc["atRiskReasons"] as string[] | undefined) ?? [];
      alerts.push({
        studentId: sid,
        name,
        kind: "at_risk",
        detail: reasons.length ? reasons.join(", ") : "Flagged at risk",
        createdAt: (doc["lastUpdatedAt"] as string | undefined) ?? now,
      });
    }
  }
  return { items: alerts, nextCursor: null } as ResOf<"v1.analytics.listParentAlerts">;
}

// ---- listPlatformActivity (C25 — super-admin audit feed; top-level collection) ----

const PLATFORM_ACTIVITY_ACTION_SET = new Set<string>([
  "tenant_created",
  "tenant_updated",
  "tenant_deactivated",
  "tenant_reactivated",
  "user_created",
  "users_bulk_imported",
]);

/** Whitelist a stored activity row to the strict PlatformActivityLogSchema view. */
function projectPlatformActivity(d: Doc): Doc {
  const action = String(d["action"] ?? "tenant_updated");
  return {
    id: String(d["id"] ?? ""),
    action: PLATFORM_ACTIVITY_ACTION_SET.has(action) ? action : "tenant_updated",
    actorUid: String(d["actorUid"] ?? d["actorId"] ?? ""),
    actorEmail: String(d["actorEmail"] ?? ""),
    ...(typeof d["tenantId"] === "string" && d["tenantId"] ? { tenantId: d["tenantId"] } : {}),
    metadata: (d["metadata"] as Doc | undefined) ?? {},
    createdAt: tsRequired(d["createdAt"], d["timestamp"]),
  };
}

export async function listPlatformActivityService(
  input: ReqOf<"v1.analytics.listPlatformActivity">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.listPlatformActivity">> {
  if (!ctx.isSuperAdmin) fail("PERMISSION_DENIED", "platform activity is super-admin only");
  // The REAL top-level `platformActivityLog` collection (the U2.4+5 replacement
  // for super-admin's rules-denied direct SDK read) — NOT the tenants store.
  // An explicit `tenantOverride` doubles as the per-tenant audit-feed filter
  // (the tenant-detail audit card); without it the feed is platform-global.
  const tenantFilter = (input as { tenantOverride?: string }).tenantOverride;
  const page = await xrepos(ctx).platformActivity.list({
    ...(input.action ? { action: input.action } : {}),
    ...(tenantFilter ? { tenantId: tenantFilter } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
    limit: input.limit ?? 20,
  });
  return {
    items: page.items.map(projectPlatformActivity),
    nextCursor: page.nextCursor,
  } as ResOf<"v1.analytics.listPlatformActivity">;
}

// ---- getCostSummary (admin; canonical costSummaries with legacy fallback) ----

/** Whitelist a stored summary doc to the strict Daily/MonthlyCostSummary view. */
function projectCostSummary(d: Doc, tenantId: string, granularity: "daily" | "monthly"): Doc {
  return {
    id: String(d["id"] ?? ""),
    tenantId: String(d["tenantId"] ?? tenantId),
    ...(granularity === "daily"
      ? { date: String(d["date"] ?? "") }
      : { month: String(d["month"] ?? "") }),
    totalCalls: typeof d["totalCalls"] === "number" ? Math.trunc(d["totalCalls"]) : 0,
    totalInputTokens:
      typeof d["totalInputTokens"] === "number" ? Math.trunc(d["totalInputTokens"]) : 0,
    totalOutputTokens:
      typeof d["totalOutputTokens"] === "number" ? Math.trunc(d["totalOutputTokens"]) : 0,
    totalCostUsd: typeof d["totalCostUsd"] === "number" ? d["totalCostUsd"] : 0,
    byPurpose: (d["byPurpose"] as Doc | undefined) ?? {},
    byModel: (d["byModel"] as Doc | undefined) ?? {},
    ...(typeof d["budgetLimitUsd"] === "number" ? { budgetLimitUsd: d["budgetLimitUsd"] } : {}),
    ...(typeof d["budgetUsedPercent"] === "number"
      ? { budgetUsedPercent: d["budgetUsedPercent"] }
      : {}),
    ...(typeof d["budgetAlertSent"] === "boolean" ? { budgetAlertSent: d["budgetAlertSent"] } : {}),
    computedAt: tsRequired(d["computedAt"], d["updatedAt"], d["createdAt"]),
  };
}

export async function getCostSummaryService(
  input: ReqOf<"v1.analytics.getCostSummary">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getCostSummary">> {
  const tenantId = requireTenant(ctx);
  if (!ctx.isSuperAdmin && ctx.role !== "tenantAdmin") {
    fail("PERMISSION_DENIED", "cost summary is admin only");
  }
  const granularity = input.granularity === "monthly" ? "monthly" : "daily";

  // Canonical U3.3 store: ONE `costSummaries` collection, `daily_*`/`monthly_*` ids.
  const range = input.range as { from?: string; to?: string } | undefined;
  const canonical =
    granularity === "monthly"
      ? await xrepos(ctx).costSummaries.listMonthly(tenantId, {
          ...(input.month ? { month: input.month } : {}),
        })
      : await xrepos(ctx).costSummaries.listDaily(tenantId, {
          ...(input.date ? { date: input.date } : {}),
          ...(range?.from ? { from: range.from.slice(0, 10) } : {}),
          ...(range?.to ? { to: range.to.slice(0, 10) } : {}),
        });

  // Legacy fallback: the pre-canon recompute wrote `_kind`-tagged docs into the
  // tenants generic store — keep serving them until the recompute is converged
  // (flagged for the analytics tree: its INPUT read is also off-canon).
  const docs =
    canonical.length > 0
      ? canonical
      : (
          await ctx.repos.tenants.list(tenantId, {
            filter: (d) => {
              if (d["_kind"] !== (granularity === "monthly" ? COST_MONTHLY : COST_DAILY))
                return false;
              if (input.date && d["date"] !== input.date) return false;
              if (input.month && d["month"] !== input.month) return false;
              return true;
            },
            limit: 200,
          })
        ).items;

  return {
    summaries: docs.map((d) => projectCostSummary(d as Doc, tenantId, granularity)),
  } as ResOf<"v1.analytics.getCostSummary">;
}

// ---- getLeaderboard (shapes RTDB snapshot) ----
export async function getLeaderboardService(
  input: ReqOf<"v1.analytics.getLeaderboard">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getLeaderboard">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "summary.read", { tenantId });
  const limit = input.limit ?? 20;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) =>
      d["_kind"] === "leaderboardEntry" &&
      d["scope"] === input.scope &&
      (input.spaceId ? d["spaceId"] === input.spaceId : true) &&
      (input.storyPointId ? d["storyPointId"] === input.storyPointId : true),
    limit: 200,
  });
  const sorted: Record<string, unknown>[] = page.items
    .sort((a, b) => ((b["score"] as number) ?? 0) - ((a["score"] as number) ?? 0))
    .map((e, i) => ({ ...e, rank: i + 1 }));
  const entries = sorted.slice(0, limit);
  const myEntry = sorted.find((e) => e["userId"] === ctx.uid);
  // Omit `myEntry` entirely when the caller has no entry — a Firebase callable turns
  // an `undefined` field into `null` over the wire, which the `.optional()` rejects.
  return { entries, ...(myEntry ? { myEntry } : {}) } as ResOf<"v1.analytics.getLeaderboard">;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function getKinded(
  ctx: AuthContext,
  tenantId: string,
  kind: string,
  id: string
): Promise<Record<string, unknown> | null> {
  // Prefer the dedicated materialized-projection collection (the real adapter);
  // fall back to the `_kind`-discriminated generic store (the in-memory twin).
  const dedicated = dedicatedRepoFor(ctx, kind);
  if (dedicated) {
    const doc = await dedicated.get(tenantId, id);
    if (doc) return doc;
  }
  const direct = await ctx.repos.tenants.get(tenantId, `${kind}_${id}`);
  if (direct) return direct;
  const page = await ctx.repos.tenants.list(tenantId, {
    filter: (d) =>
      d["_kind"] === kind &&
      (d["id"] === id || d["studentId"] === id || d["classId"] === id || d["examId"] === id),
    limit: 1,
  });
  return page.items[0] ?? null;
}

/**
 * Wire-view projection for a StudentProgressSummary read.
 *
 * The summary is a ⚷ trigger-maintained projection: the recompute orchestrator
 * upserts it through the generic entity repo (which stamps an internal `updatedAt`
 * audit field) and CLEARS the single-consumer `recompute` marker by writing
 * `recompute: null`. Neither belongs on the wire view — the domain
 * `StudentProgressSummarySchema` is `.strict()` (no `updatedAt`) and types
 * `recompute` as an OPTIONAL object (absent, never `null`). Strip the internal
 * audit timestamps and drop a null/absent `recompute` so the response validates.
 */
function projectStudentSummary(doc: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt: _u, createdAt: _c, recompute, ...rest } = doc;
  return recompute == null ? rest : { ...rest, recompute };
}

/** The dedicated projection collection backing a `kind`, when one exists. */
function dedicatedRepoFor(
  ctx: AuthContext,
  kind: string
): { get(t: string, id: string): Promise<Record<string, unknown> | null> } | null {
  const x = xrepos(ctx);
  switch (kind) {
    case STUDENT_SUMMARY:
      return x.studentSummaries;
    case CLASS_SUMMARY:
      return x.classSummaries;
    case EXAM_ANALYTICS:
      return x.examAnalytics;
    default:
      return null;
  }
}

function assertStudentReadable(ctx: AuthContext, studentId: string): void {
  if (ctx.isSuperAdmin) return;
  if (ctx.role === "student" && ctx.entityIds.studentId === studentId) return;
  if (ctx.role === "parent" && ctx.studentIds.includes(studentId)) return;
  if (ctx.role === "teacher" || ctx.role === "tenantAdmin" || ctx.role === "staff") return;
  fail("PERMISSION_DENIED", "not permitted to read this student");
}

function bucketTrends(
  recent: { date: string; percentage?: number }[],
  _granularity: string
): Record<string, unknown>[] {
  // On-the-fly aggregation: one point per recent exam (v1 — analytics.md open-Q #1).
  return recent.map((e) => ({
    periodStart: e.date,
    periodEnd: e.date,
    avgPercentage: e.percentage ?? 0,
    examCount: 1,
    completionPct: 1,
    overallScore: (e.percentage ?? 0) / 100,
  }));
}

async function computePlatformSummary(ctx: AuthContext): Promise<Record<string, unknown>> {
  void ctx;
  // Platform KPIs via aggregation (analytics.md open-Q #2 — .count() in v1). The
  // real adapter exposes count-aggregation repos; the projection shape is fixed.
  return {
    kpis: { tenantCount: 0, userCount: 0, examCount: 0, activeTenantCount: 0 },
    growthSeries: [],
    planDistribution: {},
    topTenants: [],
    tenantComparison: [],
  };
}

async function computeHealthSnapshot(ctx: AuthContext): Promise<Record<string, unknown>> {
  const now = ctx.now();
  return {
    date: now.slice(0, 10),
    status: "healthy",
    services: {},
    checkedAt: now,
  };
}
