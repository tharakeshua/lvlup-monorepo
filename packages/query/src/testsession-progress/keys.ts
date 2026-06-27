/**
 * testsession-progress query-key helpers (domain plan §Query hooks).
 *
 * Thin, domain-shaped facade over the shared `@levelup/query` key factories
 * (`testSessionKeys`/`progressKeys`/`insightKeys`/`studentSummaryKeys` from the
 * registry). The factories own the hierarchical `[domain, kind, …]` convention;
 * these helpers name the specific sub-keys this domain reads/writes so the hooks
 * and the invalidation fanout reference ONE place:
 *
 *   progress space    → progressKeys.sub(spaceId, 'space', { userId })
 *   progress storyPt  → progressKeys.sub(spaceId, 'storyPoint', { storyPointId, userId })
 *   test session      → testSessionKeys.detail(sessionId)
 *   sessions list     → testSessionKeys.infinite(filter)
 *   insights list     → insightKeys.infinite(filter)
 *   student summary   → studentSummaryKeys.detail(studentId)
 */
import {
  insightKeys,
  progressKeys,
  studentSummaryKeys,
  testSessionKeys,
} from "../keys/registry.js";

/** Normalize an optional id to a stable params object (additive, structural). */
function params(obj: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = String(v);
  return out;
}

export const testSessionProgressKeys = {
  /** Aggregate space progress (one learner). */
  space: (spaceId: string, userId?: string) =>
    progressKeys.sub(String(spaceId), "space", params({ userId })),
  /** Item-level story-point progress (one learner). */
  storyPoint: (spaceId: string, storyPointId: string, userId?: string) =>
    progressKeys.sub(String(spaceId), "storyPoint", params({ storyPointId, userId })),

  /** One live/result test-session view. */
  session: (sessionId: string) => testSessionKeys.detail(String(sessionId)),
  /** Paginated session history (infinite). */
  sessionList: (filter?: object) => testSessionKeys.infinite(filter ?? {}),

  /** Paginated learning-insight stream (infinite). */
  insightList: (filter?: object) => insightKeys.infinite(filter ?? {}),

  /** Cross-domain student summary (learner/parent dashboards). */
  studentSummary: (studentId: string) => studentSummaryKeys.detail(String(studentId)),
} as const;

export { insightKeys, progressKeys, studentSummaryKeys, testSessionKeys };
