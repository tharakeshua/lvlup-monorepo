/**
 * `DomainName` roots + `INVALIDATION_GRAPH` seed (SDK-LAYERS-PLAN §4.2/§4.3 /
 * MERGE-DOMAINNAME).
 *
 * `DomainName` is the single exhaustive union of query-key roots: every
 * `CallableDef.invalidates` string AND every hand-authored cross-domain fanout
 * root ∈ `DomainName`. The contract layer owns the canonical union and a
 * registry-seeded graph; `@levelup/query` maps these string roots → its key
 * factories (importing key factories here would violate downward-only).
 */
import { CALLABLES } from "./registry";
import type { CallableDef } from "./callable-def";

/**
 * The exhaustive query-key-root union (the §4.2 factory list + the ~16 added
 * roots + the C1–C31 roots). `keyof typeof QUERY_KEYS === DomainName` is asserted
 * in `@levelup/query`; here it is the closed set every `invalidates` root must ∈.
 */
export const DOMAIN_NAMES = [
  // identity
  "me",
  "tenants",
  "students",
  "teachers",
  "parents",
  "staff",
  "classes",
  "sessions",
  "announcements",
  "notifications",
  "notificationBadge",
  "userSearch",
  "preset",
  "platformConfig",
  "notificationPreferences",
  "device",
  "message",
  "exportJob",
  "memberships",
  "claims",
  "academicSessions",
  // levelup (content + testsession + gamification)
  "spaces",
  "storyPoints",
  "items",
  "versions",
  "questionBank",
  "rubricPresets",
  "agents",
  "chat",
  "conversations",
  "store",
  "reviews",
  "enrollment",
  "enrollments",
  "progress",
  "testSessions",
  "insights",
  "leaderboard",
  "gamification",
  "achievements",
  "levels",
  "studyGoals",
  "studySessions",
  "studentSummary",
  "assignment",
  "aiGeneration",
  "storage",
  // autograde
  "exams",
  "questions",
  "submissions",
  "questionSubmissions",
  "evalSettings",
  "evaluationSettings",
  "deadLetter",
  "gradingDeadLetter",
  "examAnalytics",
  "gradingReview",
  // analytics
  "summary",
  "trends",
  "cost",
  "analytics",
  "parentAlert",
  "platformActivity",
] as const;

export type DomainName = (typeof DOMAIN_NAMES)[number];

const DOMAIN_NAME_SET: ReadonlySet<string> = new Set<string>(DOMAIN_NAMES);

/** A single invalidation rule: the precise roots a mutation dirties. */
export interface InvalidationRule {
  readonly roots: readonly DomainName[];
}

/**
 * The registry-seeded invalidation graph. Seeded from each mutating def's
 * `invalidates` hint (the cross-domain fanout overrides + coarse-suppression
 * rules live in `@levelup/query`, which consumes this seed). Reads (no
 * `invalidates`) are omitted.
 */
export const INVALIDATION_GRAPH: Readonly<Record<string, InvalidationRule>> = Object.freeze(
  Object.fromEntries(
    (Object.values(CALLABLES) as unknown as CallableDef[])
      .filter((d) => d.invalidates && d.invalidates.length > 0)
      .map((d) => {
        const roots = (d.invalidates ?? []).filter((r): r is DomainName => DOMAIN_NAME_SET.has(r));
        return [d.name, { roots }] as const;
      })
  )
);

/** Every root referenced by any `invalidates` hint must be a declared `DomainName`. */
export function unknownInvalidationRoots(): string[] {
  const bad: string[] = [];
  for (const d of Object.values(CALLABLES) as unknown as CallableDef[]) {
    for (const r of d.invalidates ?? []) {
      if (!DOMAIN_NAME_SET.has(r)) bad.push(`${d.name} → ${r}`);
    }
  }
  return bad;
}
