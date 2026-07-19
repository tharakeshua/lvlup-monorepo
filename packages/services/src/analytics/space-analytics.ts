/**
 * Canonical per-space analytics projection. This read intentionally ignores the
 * denormalized `Space.stats` counters: progress authority lives in
 * `spaceProgress`, and the roster is resolved in two paged collection reads.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { fail, requireTenant } from "../shared/context.js";
import { isTeacherish } from "../shared/projections.js";
import type { EntityRepo, ListOptions } from "../repo-admin/types.js";

type Doc = Record<string, unknown>;
type Status = "not_started" | "in_progress" | "completed";

const clampPct = (value: number): number => Math.max(0, Math.min(100, value));
const finite = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const nonNegative = (value: unknown): number => Math.max(0, finite(value));
const asDocs = (value: unknown): Doc[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.values(value as Record<string, unknown>).filter((entry): entry is Doc =>
        Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
      )
    : [];
const asIso = (value: unknown): string | null => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

async function listAll(repo: EntityRepo, tenantId: string, opts: ListOptions = {}): Promise<Doc[]> {
  const items: Doc[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.list(tenantId, { ...opts, ...(cursor ? { cursor } : {}), limit: 500 });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

function completionPct(progress: Doc | undefined): number {
  if (!progress) return 0;
  const explicit = progress["percentage"] ?? progress["overallPercentage"];
  if (typeof explicit === "number") return clampPct(explicit);
  if (progress["completed"] === true || progress["status"] === "completed") return 100;

  const storyPoints = asDocs(progress["storyPoints"]);
  if (storyPoints.length > 0) {
    const expected = Math.max(storyPoints.length, finite(progress["totalStoryPoints"]));
    const earned = storyPoints.reduce((sum, sp) => {
      if (typeof sp["percentage"] === "number") return sum + clampPct(sp["percentage"]);
      if (sp["completed"] === true || sp["status"] === "completed") return sum + 100;
      const total = nonNegative(sp["totalPoints"]);
      return sum + (total > 0 ? clampPct((nonNegative(sp["pointsEarned"]) / total) * 100) : 0);
    }, 0);
    return expected > 0 ? clampPct(earned / expected) : 0;
  }

  const totalPoints = nonNegative(progress["totalPoints"]);
  return totalPoints > 0
    ? clampPct((nonNegative(progress["pointsEarned"]) / totalPoints) * 100)
    : 0;
}

function itemMetrics(progress: Doc | undefined): {
  completedItems: number;
  totalItems: number;
  timeSpentSeconds: number;
  attempts: number;
} {
  if (!progress) {
    return { completedItems: 0, totalItems: 0, timeSpentSeconds: 0, attempts: 0 };
  }
  const items = asDocs(progress["items"] ?? progress["itemProgress"]);
  const storyPoints = asDocs(progress["storyPoints"]);
  const completedItems =
    typeof progress["completedItems"] === "number"
      ? nonNegative(progress["completedItems"])
      : storyPoints.length > 0
        ? storyPoints.reduce((sum, sp) => sum + nonNegative(sp["completedItems"]), 0)
        : items.filter(
            (item) =>
              item["completed"] === true ||
              item["status"] === "completed" ||
              (item["questionData"] && (item["questionData"] as Doc)["solved"] === true)
          ).length;
  const totalItems =
    typeof progress["totalItems"] === "number"
      ? nonNegative(progress["totalItems"])
      : storyPoints.length > 0
        ? storyPoints.reduce((sum, sp) => sum + nonNegative(sp["totalItems"]), 0)
        : items.length;

  const itemTimeSeconds = items.reduce((sum, item) => {
    if (typeof item["timeSpentMs"] === "number")
      return sum + nonNegative(item["timeSpentMs"]) / 1000;
    return sum + nonNegative(item["timeSpent"]);
  }, 0);
  const timeSpentSeconds =
    typeof progress["timeSpentSeconds"] === "number"
      ? nonNegative(progress["timeSpentSeconds"])
      : typeof progress["totalTimeSpent"] === "number"
        ? nonNegative(progress["totalTimeSpent"])
        : itemTimeSeconds;

  const itemAttempts = items.reduce((sum, item) => {
    if (Array.isArray(item["attempts"])) return sum + item["attempts"].length;
    if (typeof item["attemptsCount"] === "number") return sum + nonNegative(item["attemptsCount"]);
    if (typeof item["interactions"] === "number") return sum + nonNegative(item["interactions"]);
    const questionData = item["questionData"] as Doc | undefined;
    if (typeof questionData?.["attemptsCount"] === "number") {
      return sum + nonNegative(questionData["attemptsCount"]);
    }
    return sum + 1;
  }, 0);
  const attempts =
    typeof progress["attempts"] === "number"
      ? nonNegative(progress["attempts"])
      : typeof progress["attemptCount"] === "number"
        ? nonNegative(progress["attemptCount"])
        : itemAttempts;

  return {
    completedItems: Math.trunc(completedItems),
    totalItems: Math.trunc(totalItems),
    timeSpentSeconds,
    attempts: Math.trunc(attempts),
  };
}

function progressUid(progress: Doc, spaceId: string): string {
  if (typeof progress["userId"] === "string") return progress["userId"];
  const id = String(progress["id"] ?? "");
  const suffix = `_${spaceId}`;
  return id.endsWith(suffix) ? id.slice(0, -suffix.length) : id;
}

function studentUid(student: Doc): string {
  return String(student["authUid"] ?? student["userId"] ?? student["id"] ?? "");
}

function displayName(student: Doc): string {
  const named =
    (typeof student["displayName"] === "string" && student["displayName"]) ||
    (typeof student["name"] === "string" && student["name"]);
  if (named) return named;
  const parts = [student["firstName"], student["lastName"]].filter(
    (value): value is string => typeof value === "string" && Boolean(value)
  );
  return parts.join(" ") || String(student["id"] ?? studentUid(student));
}

export function buildSpaceAnalyticsProjection(
  spaceId: string,
  space: Doc,
  allStudents: Doc[],
  progressDocs: Doc[],
  generatedAt: string
): ResOf<"v1.analytics.getSpaceAnalytics"> {
  const classIds = Array.isArray(space["classIds"]) ? space["classIds"].map(String) : [];
  const accessType = String(space["accessType"] ?? "class_assigned");
  const roster =
    classIds.length > 0
      ? allStudents.filter((student) => {
          const assigned = Array.isArray(student["classIds"])
            ? student["classIds"].map(String)
            : [];
          return assigned.some((classId) => classIds.includes(classId));
        })
      : accessType === "tenant_wide"
        ? allStudents
        : [];

  const progressByUid = new Map(
    progressDocs.map((progress) => [progressUid(progress, spaceId), progress] as const)
  );
  const studentsByUid = new Map(
    allStudents.map((student) => [studentUid(student), student] as const)
  );
  const participantUids = new Set(roster.map(studentUid));
  if (roster.length === 0) {
    for (const uid of progressByUid.keys()) participantUids.add(uid);
  }

  const sevenDaysAgo = Date.parse(generatedAt) - 7 * 24 * 60 * 60 * 1000;
  const students = [...participantUids]
    .filter(Boolean)
    .map((uid) => {
      const student = studentsByUid.get(uid);
      const progress = progressByUid.get(uid);
      const pct = completionPct(progress);
      const metrics = itemMetrics(progress);
      const lastActivityAt = asIso(
        progress?.["lastActivityAt"] ??
          progress?.["lastAccessedAt"] ??
          progress?.["updatedAt"] ??
          progress?.["startedAt"]
      );
      const status: Status =
        pct >= 100 || progress?.["completed"] === true || progress?.["status"] === "completed"
          ? "completed"
          : progress
            ? "in_progress"
            : "not_started";
      return {
        studentId: String(student?.["id"] ?? uid),
        name: student ? displayName(student) : uid,
        classIds: Array.isArray(student?.["classIds"]) ? student.classIds.map(String) : [],
        status,
        completionPct: Math.round(pct * 10) / 10,
        ...metrics,
        pointsEarned: nonNegative(progress?.["pointsEarned"]),
        totalPoints: nonNegative(progress?.["totalPoints"]),
        lastActivityAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const started = students.filter((student) => student.status !== "not_started");
  const completedStudents = students.filter((student) => student.status === "completed").length;
  const activeStudents7d = started.filter(
    (student) =>
      student.lastActivityAt !== null && Date.parse(student.lastActivityAt) >= sevenDaysAgo
  ).length;
  const divisor = students.length || 1;

  return {
    spaceId,
    generatedAt,
    summary: {
      totalStudents: students.length,
      startedStudents: started.length,
      completedStudents,
      activeStudents7d,
      avgCompletionPct:
        Math.round(
          (students.reduce((sum, student) => sum + student.completionPct, 0) / divisor) * 10
        ) / 10,
      avgTimeSpentSeconds: Math.round(
        students.reduce((sum, student) => sum + student.timeSpentSeconds, 0) / divisor
      ),
      totalAttempts: students.reduce((sum, student) => sum + student.attempts, 0),
    },
    students,
  } as ResOf<"v1.analytics.getSpaceAnalytics">;
}

export async function getSpaceAnalyticsService(
  input: ReqOf<"v1.analytics.getSpaceAnalytics">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getSpaceAnalytics">> {
  const tenantId = requireTenant(ctx);
  if (!ctx.isSuperAdmin && !isTeacherish(ctx)) {
    fail("PERMISSION_DENIED", "space analytics is a teaching-staff read");
  }
  authorize(ctx, "summary.read", { tenantId });
  const space = await ctx.repos.spaces.get(tenantId, String(input.spaceId));
  if (!space) fail("NOT_FOUND", `space ${input.spaceId} not found`);

  const [students, progressDocs] = await Promise.all([
    listAll(ctx.repos.students, tenantId),
    listAll(ctx.repos.progressDocs, tenantId, { where: { spaceId: String(input.spaceId) } }),
  ]);
  return buildSpaceAnalyticsProjection(
    String(input.spaceId),
    space,
    students,
    progressDocs,
    ctx.now()
  );
}
