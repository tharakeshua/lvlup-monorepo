/**
 * `insightRepo` — read + conservative write for the personalised
 * `LearningInsight` stream (SDK-LAYERS-PLAN §4.1, analytics.md §insightRepo).
 *
 * Insights are GENERATED server-side by the analytics rule engine (authority
 * boundary ⚷). The ONLY client-facing write is `dismissInsight` (sets
 * `dismissedAt`) — it is on the conservative optimistic allow-list (mark-read
 * class); the query layer owns the optimistic patch, the repo just issues the
 * call. (Method named `recordDismiss` to satisfy the build-time method-naming
 * verb convention — `record*` is the sanctioned mutate verb; the contract op is
 * `v1.analytics.dismissInsight`.)
 *
 *   • `list(filter)` / `paginate(filter)` — opaque-cursor reads.
 *   • `recordDismiss(insightId)` — the one conservative write.
 *   • `computeByPriority` / `computeTopActionable` — derived view-models computed
 *     once (no wire call).
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6).
 */
import type { InsightId, InsightPriority, LearningInsight } from "@levelup/domain";
import type {
  ApiClient,
  DismissInsightResponse,
  ListInsightsRequest,
  PageResponse,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";

export type InsightsByPriority = Record<InsightPriority, LearningInsight[]>;

/** Priority weight for "most actionable first" ordering (high → low). */
const PRIORITY_RANK: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };

export interface InsightRepo {
  list(filter: ListInsightsRequest): Promise<PageResponse<LearningInsight>>;
  paginate(filter: ListInsightsRequest): Promise<PageBag<LearningInsight>>;
  recordDismiss(insightId: InsightId): Promise<DismissInsightResponse>;
  /** Group a page's insights by priority band (derived, computed once). */
  computeByPriority(insights: readonly LearningInsight[]): InsightsByPriority;
  /** Top-N still-active insights, highest priority first (derived). */
  computeTopActionable(insights: readonly LearningInsight[], n: number): LearningInsight[];
}

export function createInsightRepo(api: ApiClient): InsightRepo {
  return {
    list: (filter) => listOnce((req) => api.analytics.listInsights(req), filter),

    paginate: (filter) => paginate((req) => api.analytics.listInsights(req), filter),

    recordDismiss: (insightId) => api.analytics.dismissInsight({ insightId }),

    computeByPriority: (insights) => {
      const out: InsightsByPriority = { high: [], medium: [], low: [] };
      for (const insight of insights) out[insight.priority].push(insight);
      return out;
    },

    computeTopActionable: (insights, n) => {
      const active = insights.filter((i) => i.dismissedAt == null);
      // Stable sort by priority weight; ties keep wire order (already createdAt-sorted).
      const sorted = [...active].sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      );
      return sorted.slice(0, Math.max(0, n));
    },
  };
}
