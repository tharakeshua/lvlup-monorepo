/**
 * `summaryRepo` — cross-entity VIEW repo for student/class/platform/health
 * summaries (SDK-LAYERS-PLAN §4.1, analytics.md §summaryRepo). Lives under
 * `src/analytics/views/**` — the sanctioned composition surface (R6 exception).
 *
 * `*ProgressSummary` docs are server-authored (⚷ — recompute-on-write); the SDK
 * only READS the projection via `v1.analytics.getSummary` and unwraps the
 * scope-discriminated response. The fat-SDK value is the shaping:
 *   • `computeOverallBand`   — `overallScore` 0–1 → label band (computed once).
 *   • `computeAtRiskBadges`  — `AtRiskReason[]` → display copy.
 *   • `computeSubjectRows`   — flattens autograde + levelup `subjectBreakdown`
 *     maps into ONE merged per-subject view-model (collapses the zip the UI would
 *     otherwise do client-side).
 *
 * Composes only `api` (never sibling repos) — but is a declared view repo so the
 * R6 import-isolation scan classifies it under views/**.
 */
import type {
  AtRiskReason,
  ClassProgressSummary,
  ClassId,
  StudentId,
  StudentProgressSummary,
} from "@levelup/domain";
import type { ApiClient, HealthSummary, PlatformSummary } from "../api-types.js";

/** Overall-score → UI band (computed once, never persisted). */
export type OverallBand = "excellent" | "good" | "fair" | "needs_attention";

/** Display copy for an at-risk reason badge. */
export interface AtRiskBadge {
  reason: AtRiskReason;
  label: string;
}

/** A merged per-subject row (autograde exam metrics + levelup completion). */
export interface SubjectRow {
  subject: string;
  examAvgScore?: number;
  examCount?: number;
  levelupCompletion?: number;
}

const AT_RISK_COPY: Record<AtRiskReason, string> = {
  low_exam_score: "Low exam scores",
  no_recent_activity: "No recent activity",
  low_space_completion: "Low course completion",
  declining_performance: "Declining performance",
  zero_streak: "Inactive streak",
};

export interface SummaryRepo {
  getStudent(studentId: StudentId): Promise<StudentProgressSummary>;
  getClass(classId: ClassId): Promise<ClassProgressSummary>;
  getPlatform(): Promise<PlatformSummary>;
  getHealth(): Promise<HealthSummary>;
  /** Map `overallScore` (0–1) to a UI band (derived, computed once). */
  computeOverallBand(summary: Pick<StudentProgressSummary, "overallScore">): OverallBand;
  /** Map `atRiskReasons` to display badges (derived). */
  computeAtRiskBadges(summary: Pick<StudentProgressSummary, "atRiskReasons">): AtRiskBadge[];
  /** Merge autograde + levelup `subjectBreakdown` into one per-subject view-model. */
  computeSubjectRows(summary: StudentProgressSummary): SubjectRow[];
}

export function createSummaryRepo(api: ApiClient): SummaryRepo {
  return {
    getStudent: async (studentId) => {
      const res = await api.analytics.getSummary({ scope: "student", studentId });
      if (res.scope !== "student") {
        throw new Error(`getSummary returned scope '${res.scope}', expected 'student'`);
      }
      return res.studentSummary;
    },

    getClass: async (classId) => {
      const res = await api.analytics.getSummary({ scope: "class", classId });
      if (res.scope !== "class") {
        throw new Error(`getSummary returned scope '${res.scope}', expected 'class'`);
      }
      return res.classSummary;
    },

    getPlatform: async () => {
      const res = await api.analytics.getSummary({ scope: "platform" });
      if (res.scope !== "platform") {
        throw new Error(`getSummary returned scope '${res.scope}', expected 'platform'`);
      }
      return res.platformSummary;
    },

    getHealth: async () => {
      const res = await api.analytics.getSummary({ scope: "health" });
      if (res.scope !== "health") {
        throw new Error(`getSummary returned scope '${res.scope}', expected 'health'`);
      }
      return res.healthSummary;
    },

    computeOverallBand: ({ overallScore }) => {
      if (overallScore >= 0.85) return "excellent";
      if (overallScore >= 0.65) return "good";
      if (overallScore >= 0.4) return "fair";
      return "needs_attention";
    },

    computeAtRiskBadges: ({ atRiskReasons }) =>
      atRiskReasons.map((reason) => ({ reason, label: AT_RISK_COPY[reason] })),

    computeSubjectRows: (summary) => {
      const rows = new Map<string, SubjectRow>();
      for (const [subject, b] of Object.entries(summary.autograde.subjectBreakdown)) {
        rows.set(subject, {
          subject,
          examAvgScore: b.avgScore,
          examCount: b.examCount,
        });
      }
      for (const [subject, completion] of Object.entries(summary.levelup.subjectBreakdown)) {
        const existing = rows.get(subject);
        if (existing) existing.levelupCompletion = completion;
        else rows.set(subject, { subject, levelupCompletion: completion });
      }
      return [...rows.values()];
    },
  };
}
