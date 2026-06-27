/**
 * Role-aware response shaping (server-shared.md §3.1 `shared/projections.ts`).
 * Pure helpers that strip ⚷ fields out of authoritative docs before they leave the
 * server: rubric guidance (REVIEW §6.7), answer keys (§6.4), AI cost telemetry
 * (§6 AI row), and unreleased grades (§6.10). The access result drives which
 * projection a read service picks; these helpers do the actual stripping.
 */
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
export function projectSpaceProgress(p: Doc): Doc {
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
      completedAt: (e["completedAt"] as string | null | undefined) ?? null,
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
    startedAt: (p["startedAt"] as string | null | undefined) ?? null,
    completedAt: (p["completedAt"] as string | null | undefined) ?? null,
    updatedAt: p["updatedAt"],
  };
  if (typeof p["marksEarned"] === "number") out["marksEarned"] = p["marksEarned"];
  if (typeof p["totalMarks"] === "number") out["totalMarks"] = p["totalMarks"];
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
