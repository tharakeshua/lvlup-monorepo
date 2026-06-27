/**
 * `SUBSCRIPTION_SOURCES` (transport-realtime.md §2.2 subscribe/subscription-sources.ts).
 *
 * The wire-location table: the ONLY place that knows *where* each subscription's
 * data physically lives (Firestore doc, Firestore query, or RTDB node). Mirrors the
 * `CALLABLES`-style data table. An exhaustive `satisfies Record<SubscriptionName,…>`
 * forces a descriptor for every registered subscription (coverage test §8.1) — add a
 * subscription to api-contract without a source here and the build fails.
 *
 * `__tenant__` / `__uid__` placeholders are substituted at subscribe time from the
 * `PathContext` (claim-derived tenantId + auth uid) — never from caller input
 * (principle 4 + §9 open-Q #1). The descriptor `resolve` builds the placeholdered
 * path/query from the typed params; `applyPathContext` does the substitution.
 */
import type { ParamsOf, SubscriptionName } from "@levelup/api-contract";
import { TENANT_PLACEHOLDER, UID_PLACEHOLDER, type PathContext } from "../path-context.js";

/**
 * A serializable Firestore query constraint spec. Kept as data (not live
 * `QueryConstraint` objects) so the descriptor table stays pure + the constraint is
 * rebuilt against the live `Firestore` instance in `subscribe-via-firestore.ts`.
 */
export type QueryConstraintSpec =
  | readonly ["where", string, "==" | "!=" | "<" | "<=" | ">" | ">=", unknown]
  | readonly ["orderBy", string, "asc" | "desc"];

/** Resolved Firestore target — a single doc, or a collection + ordered/filtered query. */
export type FirestoreTarget =
  | { kind: "doc"; path: string }
  | { kind: "query"; collectionPath: string; constraints: QueryConstraintSpec[] };

/** Resolved RTDB target — a single node path. */
export interface RtdbTarget {
  kind: "rtdb";
  nodePath: string;
}

export type SubscriptionBackend = "firestore" | "rtdb";

export interface FirestoreSourceDescriptor<S extends SubscriptionName> {
  backend: "firestore";
  /** Builds a placeholdered Firestore doc/query target from typed params. */
  resolve: (params: ParamsOf<S>) => FirestoreTarget;
}

export interface RtdbSourceDescriptor<S extends SubscriptionName> {
  backend: "rtdb";
  /** Builds a placeholdered RTDB node path from typed params. */
  resolve: (params: ParamsOf<S>) => RtdbTarget;
}

export type SourceDescriptor<S extends SubscriptionName> =
  | FirestoreSourceDescriptor<S>
  | RtdbSourceDescriptor<S>;

const T = TENANT_PLACEHOLDER;
const U = UID_PLACEHOLDER;

/** Leaderboard RTDB node grammar (single canonical leaderboardLive channel). */
function leaderboardNode(
  scope: "tenant" | "class" | "space" | "storyPoint",
  spaceId?: string,
  storyPointId?: string
): string {
  switch (scope) {
    case "tenant":
      return `leaderboards/${T}/tenant`;
    case "class":
      return `leaderboards/${T}/class`;
    case "space":
      return `leaderboards/${T}/space/${spaceId ?? "_"}`;
    case "storyPoint":
      return `leaderboards/${T}/storyPoint/${spaceId ?? "_"}/${storyPointId ?? "_"}`;
  }
}

/**
 * EXHAUSTIVE map keyed by `SubscriptionName`. The `satisfies` clause forces a
 * descriptor for every registered subscription (build-time coverage).
 */
export const SUBSCRIPTION_SOURCES = {
  // ── Firestore-backed (doc/query listeners) ──
  "v1.levelup.testSessionDeadline": {
    backend: "firestore",
    resolve: ({ sessionId }) => ({
      kind: "doc",
      path: `tenants/${T}/digitalTestSessions/${sessionId}/live/current`,
    }),
  },
  "v1.levelup.chatStream": {
    backend: "firestore",
    resolve: ({ sessionId }) => ({
      kind: "query",
      collectionPath: `tenants/${T}/chatSessions/${sessionId}/messages`,
      constraints: [["orderBy", "createdAt", "asc"]],
    }),
  },
  "v1.levelup.spaceProgressLive": {
    backend: "firestore",
    resolve: ({ spaceId, userId }) => ({
      kind: "doc",
      path: `tenants/${T}/spaceProgress/${userId}_${spaceId}/live/current`,
    }),
  },
  "v1.levelup.studentLevelLive": {
    backend: "firestore",
    resolve: () => ({
      kind: "doc",
      path: `tenants/${T}/students/${U}/level/current`,
    }),
  },
  "v1.levelup.achievementUnlock": {
    backend: "firestore",
    resolve: () => ({
      kind: "query",
      collectionPath: `tenants/${T}/students/${U}/achievements`,
      constraints: [
        ["where", "seen", "==", false],
        ["orderBy", "unlockedAt", "asc"],
      ],
    }),
  },
  "v1.autograde.gradingStatus": {
    backend: "firestore",
    resolve: ({ submissionId }) => ({
      kind: "doc",
      path: `tenants/${T}/submissions/${submissionId}/live/current`,
    }),
  },
  "v1.autograde.examGrading": {
    backend: "firestore",
    resolve: ({ examId }) => ({
      kind: "doc",
      path: `tenants/${T}/examGradingProgress/${examId}`,
    }),
  },
  // ── RTDB-backed (read-only projections) ──
  "v1.levelup.leaderboardLive": {
    backend: "rtdb",
    resolve: ({ scope, spaceId, storyPointId }) => ({
      kind: "rtdb",
      nodePath: leaderboardNode(scope, spaceId, storyPointId),
    }),
  },
  "v1.notification.badge": {
    backend: "rtdb",
    resolve: () => ({ kind: "rtdb", nodePath: `notifications/${T}/${U}` }),
  },
} as const satisfies { [S in SubscriptionName]: SourceDescriptor<S> };

/** Substitute `__tenant__`/`__uid__` placeholders in a resolved path from PathContext. */
export function applyPathContext(path: string, ctx: PathContext): string {
  return path.split(TENANT_PLACEHOLDER).join(ctx.tenantId).split(UID_PLACEHOLDER).join(ctx.uid);
}
