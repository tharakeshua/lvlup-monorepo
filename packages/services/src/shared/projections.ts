/**
 * Role-aware response shaping (server-shared.md §3.1 `shared/projections.ts`).
 * Pure helpers that strip ⚷ fields out of authoritative docs before they leave the
 * server: rubric guidance (REVIEW §6.7), answer keys (§6.4), AI cost telemetry
 * (§6 AI row), and unreleased grades (§6.10). The access result drives which
 * projection a read service picks; these helpers do the actual stripping.
 */
import { toTimestamp } from "@levelup/domain";
import type { AuthContext } from "./context.js";

/** Authoring roles see rubric guidance + thresholds; everyone else gets them stripped. */
export function isAuthoringRole(ctx: AuthContext): boolean {
  return ctx.role === "teacher" || ctx.role === "tenantAdmin" || ctx.role === "staff";
}

/** Teacher/admin/staff see full submissions; student/parent get the released-only gate. */
export function isTeacherish(ctx: AuthContext): boolean {
  return isAuthoringRole(ctx);
}

type Doc = Record<string, unknown>;

// ── timestamp canonicalization (LVL-1) ────────────────────────────────────────
// Stored docs carry the timestamp trichotomy (Firestore Timestamp / epoch-millis /
// ISO w or w/o millis); every strict view schema requires the canonical ISO-ms
// `zTimestamp`. These are the ONE seam read projections normalize through
// (domain `toTimestamp()` — AD-4 precedent).

/** Nullable timestamp field: missing/null/unparseable → null (required-nullable views). */
export function tsOrNull(v: unknown): string | null {
  if (v == null) return null;
  try {
    return toTimestamp(v as never);
  } catch {
    return null;
  }
}

/** Required timestamp field: first parseable candidate wins (fallback chain). */
export function tsRequired(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c == null) continue;
    try {
      return toTimestamp(c as never);
    } catch {
      /* try next */
    }
  }
  throw new RangeError("no parseable timestamp among candidates");
}

/** Optional timestamp field: missing/unparseable → undefined (compact() drops it). */
export function tsOrUndefined(v: unknown): string | undefined {
  return tsOrNull(v) ?? undefined;
}

/**
 * Strip `modelAnswer`/`evaluatorGuidance` from a rubric and `promptGuidance` from
 * its dimensions, for non-authoring roles. Returns a shallow-copied rubric.
 */
export function projectRubric(rubric: unknown, authoring: boolean): unknown {
  if (authoring || !rubric || typeof rubric !== "object") return rubric;
  const r = { ...(rubric as Doc) };
  delete r["modelAnswer"];
  delete r["evaluatorGuidance"];
  if (Array.isArray(r["dimensions"])) {
    r["dimensions"] = (r["dimensions"] as Doc[]).map((d) => {
      const copy = { ...d };
      delete copy["promptGuidance"];
      return copy;
    });
  }
  if (Array.isArray(r["criteria"])) {
    r["criteria"] = (r["criteria"] as Doc[]).map((c) => {
      const copy = { ...c };
      delete copy["evaluatorGuidance"];
      return copy;
    });
  }
  return r;
}

/** Project a question view: strips rubric guidance for non-authoring roles. */
export function projectQuestion(q: Doc, authoring: boolean): Doc {
  return { ...q, rubric: projectRubric(q["rubric"], authoring) };
}

/**
 * Strip AI cost telemetry from a `UnifiedEvaluationResult` before it leaves the
 * server (cost is ⚷). The score/feedback/breakdown stay (they are the released
 * grade); `costUsd`/`tokenUsage`/`promptTokens` etc. are removed.
 */
export function stripEvaluationCost(evaluation: unknown): unknown {
  if (!evaluation || typeof evaluation !== "object") return evaluation;
  const e = { ...(evaluation as Doc) };
  delete e["costUsd"];
  delete e["cost"];
  delete e["tokenUsage"];
  delete e["promptTokens"];
  delete e["completionTokens"];
  delete e["rawProviderResponse"];
  return e;
}

/**
 * Canonicalize a stored SpaceProgress doc to the strict SpaceProgressSchema view —
 * DEFENSIVELY, so the response validates whether the doc is freshly written, already
 * canonical (real data), or carries seed/merge drift (`overallPercentage` instead of
 * `percentage`, a top-level `status` absent, per-storyPoint entries missing
 * `storyPointId`/`completedAt` or carrying a stray `completed`). Whitelists schema
 * keys (dropping audit fields like `createdBy`/`studentId` that the view omits).
 */
export function projectSpaceProgress(p: Doc, nowFallback?: string): Doc {
  const spIn = (p["storyPoints"] ?? {}) as Record<string, unknown>;
  const storyPoints: Record<string, Doc> = {};
  for (const [k, v] of Object.entries(spIn)) {
    const e = (v ?? {}) as Doc;
    const pe = typeof e["pointsEarned"] === "number" ? (e["pointsEarned"] as number) : 0;
    const tp = typeof e["totalPoints"] === "number" ? (e["totalPoints"] as number) : 0;
    storyPoints[k] = {
      storyPointId: typeof e["storyPointId"] === "string" ? e["storyPointId"] : k,
      status: typeof e["status"] === "string" ? e["status"] : "not_started",
      pointsEarned: pe,
      totalPoints: tp,
      percentage:
        typeof e["percentage"] === "number"
          ? (e["percentage"] as number)
          : tp > 0
            ? Math.round((pe / tp) * 100)
            : 0,
      completedItems: typeof e["completedItems"] === "number" ? (e["completedItems"] as number) : 0,
      totalItems: typeof e["totalItems"] === "number" ? (e["totalItems"] as number) : 0,
      completedAt: tsOrNull(e["completedAt"]),
    };
  }
  const percentage =
    typeof p["percentage"] === "number"
      ? (p["percentage"] as number)
      : typeof p["overallPercentage"] === "number"
        ? (p["overallPercentage"] as number)
        : 0;
  const out: Doc = {
    id: p["id"],
    userId: p["userId"],
    tenantId: p["tenantId"],
    spaceId: p["spaceId"],
    status:
      typeof p["status"] === "string"
        ? p["status"]
        : percentage >= 100
          ? "completed"
          : percentage > 0
            ? "in_progress"
            : "not_started",
    pointsEarned: typeof p["pointsEarned"] === "number" ? (p["pointsEarned"] as number) : 0,
    totalPoints: typeof p["totalPoints"] === "number" ? (p["totalPoints"] as number) : 0,
    percentage,
    storyPoints,
    startedAt: tsOrNull(p["startedAt"]),
    completedAt: tsOrNull(p["completedAt"]),
    updatedAt: tsRequired(p["updatedAt"], p["completedAt"], p["startedAt"], nowFallback),
  };
  if (typeof p["marksEarned"] === "number") out["marksEarned"] = p["marksEarned"];
  if (typeof p["totalMarks"] === "number") out["totalMarks"] = p["totalMarks"];
  return out;
}

const NOTIFICATION_TYPES = new Set([
  "exam_results_released",
  "new_exam_assigned",
  "new_space_assigned",
  "submission_graded",
  "grading_complete",
  "student_at_risk",
  "deadline_reminder",
  "space_published",
  "bulk_import_complete",
  "ai_budget_alert",
  "system_announcement",
]);

const NOTIFICATION_ROLES = new Set(["teacher", "student", "parent", "tenantAdmin"]);
const NOTIFICATION_ENTITY_TYPES = new Set(["exam", "space", "submission", "student", "class"]);

/** Legacy / outbox type aliases → canonical NotificationType. */
const LEGACY_NOTIFICATION_TYPE: Record<string, string> = {
  exam_published: "new_exam_assigned",
  results_released: "exam_results_released",
  "exam.results.released": "exam_results_released",
  graded: "submission_graded",
  progress_milestone: "system_announcement",
  announcement: "system_announcement",
  direct_message: "system_announcement",
  assignment: "new_exam_assigned",
};

/**
 * Project a stored notification doc → strict NotificationSchema.
 * Accepts legacy `recipientId`, free-form `payload`, and outbox type aliases.
 */
export function projectNotification(n: Doc, tenantIdFallback: string, nowFallback?: string): Doc {
  const payload = (n["payload"] ?? {}) as Doc;
  const typeRaw = String(n["type"] ?? "system_announcement");
  const type = NOTIFICATION_TYPES.has(typeRaw)
    ? typeRaw
    : (LEGACY_NOTIFICATION_TYPE[typeRaw] ?? "system_announcement");
  const roleRaw = String(n["recipientRole"] ?? "student");
  const entityTypeRaw = n["entityType"] ?? payload["entityType"];
  const entityIdRaw =
    n["entityId"] ?? payload["entityId"] ?? payload["examId"] ?? payload["spaceId"];

  const out: Doc = {
    id: String(n["id"] ?? ""),
    tenantId: String(n["tenantId"] ?? tenantIdFallback),
    recipientUid: String(n["recipientUid"] ?? n["recipientId"] ?? ""),
    recipientRole: NOTIFICATION_ROLES.has(roleRaw) ? roleRaw : "student",
    type,
    title: String(n["title"] ?? "").slice(0, 200),
    body: String(n["body"] ?? "").slice(0, 1000),
    isRead: Boolean(n["isRead"]),
    createdAt: tsRequired(n["createdAt"], nowFallback),
    readAt: tsOrNull(n["readAt"]),
  };
  if (typeof entityTypeRaw === "string" && NOTIFICATION_ENTITY_TYPES.has(entityTypeRaw)) {
    out["entityType"] = entityTypeRaw;
  }
  if (typeof entityIdRaw === "string" && entityIdRaw.length > 0) {
    out["entityId"] = entityIdRaw;
  }
  if (typeof n["actionUrl"] === "string" && n["actionUrl"]) {
    out["actionUrl"] = n["actionUrl"];
  }
  return out;
}

/**
 * Strip the EvaluationSettings ⚷ thresholds + dimension prompt-guidance for
 * non-authoring roles.
 */
export function projectEvaluationSettings(s: Doc, authoring: boolean): Doc {
  if (authoring) return s;
  const copy = { ...s };
  delete copy["confidenceConfig"];
  if (Array.isArray(copy["enabledDimensions"])) {
    copy["enabledDimensions"] = (copy["enabledDimensions"] as Doc[]).map((d) => {
      const c = { ...d };
      delete c["promptGuidance"];
      return c;
    });
  }
  return copy;
}
