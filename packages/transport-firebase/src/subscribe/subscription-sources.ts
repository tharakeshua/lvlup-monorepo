/**
 * `SUBSCRIPTION_SOURCES` (transport-realtime.md §2.2 subscribe/subscription-sources.ts).
 *
 * The wire-location table: the ONLY place that knows *where* each subscription's
 * data physically lives — an RTDB node, always (AD-12 end state, reached by
 * CHAT-1). Mirrors the `CALLABLES`-style data table. An exhaustive
 * `satisfies Record<SubscriptionName,…>` forces a descriptor for every registered
 * subscription (coverage test §8.1) — add a subscription to api-contract without
 * a source here and the build fails.
 *
 * AD-12 (U2.6 + AG-5 + CHAT-1): client realtime = RTDB projections ONLY. Every
 * channel reads a slim server-written RTDB node; the firestore subscriber
 * machinery (query descriptors, orderBy plumbing, `subscribe-via-firestore.ts`)
 * is DELETED — the transport needs NO collection-prefix awareness and never
 * touches Firestore for realtime.
 *
 * `__tenant__` / `__uid__` placeholders are substituted at subscribe time from the
 * `PathContext` (claim-derived tenantId + auth uid) — never from caller input
 * (principle 4 + §9 open-Q #1). The descriptor `resolve` builds the placeholdered
 * node path from the typed params; `applyPathContext` does the substitution.
 */
import type { ParamsOf, SubscriptionName } from "@levelup/api-contract";
import { TENANT_PLACEHOLDER, UID_PLACEHOLDER, type PathContext } from "../path-context.js";

/** Resolved RTDB target — a single node path. */
export interface RtdbTarget {
  kind: "rtdb";
  nodePath: string;
}

/** AD-12 end state: RTDB is the ONLY realtime backend. */
export type SubscriptionBackend = "rtdb";

export interface RtdbSourceDescriptor<S extends SubscriptionName> {
  backend: "rtdb";
  /** Builds a placeholdered RTDB node path from typed params. */
  resolve: (params: ParamsOf<S>) => RtdbTarget;
}

export type SourceDescriptor<S extends SubscriptionName> = RtdbSourceDescriptor<S>;

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
  // U2.6: levelup live tickers (AD-12) — slim RTDB projections written by the
  // levelup services (packages/services levelup/levelup-projection.ts), NOT
  // Firestore. All roots are USER-owned ({userId} == auth uid, AD-9); the RTDB
  // read rules gate owner access on the path segment.
  // CHAT-1 (AD-12 addendum): the BUMP node — {rev, lastMessageAt} only; message
  // content NEVER rides RTDB. Each bump debounce-refetches getChatSession
  // (signal-over-RTDB, data-over-callable). Was the last firestore-backed sub.
  "v1.levelup.chatStream": {
    backend: "rtdb",
    resolve: ({ sessionId }) => ({
      kind: "rtdb",
      nodePath: `chatBump/${T}/${U}/${sessionId}`,
    }),
  },
  "v1.levelup.testSessionDeadline": {
    backend: "rtdb",
    resolve: ({ sessionId }) => ({
      kind: "rtdb",
      nodePath: `testSessionLive/${T}/${U}/${sessionId}`,
    }),
  },
  "v1.levelup.spaceProgressLive": {
    backend: "rtdb",
    // `userId` is a PARAM (a teacher/parent may watch another learner's node —
    // the RTDB rules grant roles + owner), unlike the self-only `__uid__` channels.
    resolve: ({ spaceId, userId }) => ({
      kind: "rtdb",
      nodePath: `spaceProgressLive/${T}/${userId}/${spaceId}`,
    }),
  },
  "v1.levelup.studentLevelLive": {
    backend: "rtdb",
    resolve: () => ({ kind: "rtdb", nodePath: `studentLevelLive/${T}/${U}` }),
  },
  "v1.levelup.achievementUnlock": {
    backend: "rtdb",
    // The LATEST unlock event (last-write-wins node; cleared on mark-seen).
    resolve: () => ({ kind: "rtdb", nodePath: `achievementUnlocks/${T}/${U}/latest` }),
  },
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
  // AG-5: autograde live grading ticker (AD-12) — slim RTDB projections written by
  // the pipeline (packages/services autograde/pipeline/grading-projection.ts), NOT
  // Firestore. The client reads the payload LEAF (`/status`, `/agg`); the sibling
  // gate/index nodes stay server-only via the RTDB read rules.
  "v1.autograde.gradingStatus": {
    backend: "rtdb",
    resolve: ({ submissionId }) => ({
      kind: "rtdb",
      nodePath: `gradingProgress/${T}/submission/${submissionId}/status`,
    }),
  },
  "v1.autograde.examGrading": {
    backend: "rtdb",
    resolve: ({ examId }) => ({
      kind: "rtdb",
      nodePath: `gradingProgress/${T}/exam/${examId}/agg`,
    }),
  },
} as const satisfies { [S in SubscriptionName]: SourceDescriptor<S> };

/** Substitute `__tenant__`/`__uid__` placeholders in a resolved path from PathContext. */
export function applyPathContext(path: string, ctx: PathContext): string {
  return path.split(TENANT_PLACEHOLDER).join(ctx.tenantId).split(UID_PLACEHOLDER).join(ctx.uid);
}
