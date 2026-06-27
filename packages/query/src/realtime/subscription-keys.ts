/**
 * `SUBSCRIPTION_TARGET_KEYS` (query-infra.md §11, SDK-LAYERS-PLAN §3.3 / A10/DX-15).
 *
 * Each realtime channel writes into the SAME `*.detail(id)/sub(...)` query key
 * the REST read populates, so the server stream reconciles into the cache and
 * the server wins. This map declares, per `SubscriptionName`, the target-key
 * factory `(params) => queryKey`. The contract test asserts
 * `SUBSCRIPTION_TARGET_KEYS ⊇ keyof SUBSCRIPTIONS` and that every produced key is
 * a query-key array rooted at a `DomainName`.
 */
import {
  chatKeys,
  examKeys,
  leaderboardKeys,
  levelKeys,
  notificationBadgeKeys,
  progressKeys,
  submissionKeys,
  testSessionKeys,
  achievementKeys,
} from "../keys/registry.js";

const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));

/** A target-key factory: maps a subscription's params → the cache key it writes. */
export type TargetKeyFactory = (params: Record<string, unknown>) => readonly unknown[];

/**
 * One target-key factory per canonical subscription. Keyed by `SubscriptionName`
 * string (the contract owns the names; the test guards coverage).
 */
export const SUBSCRIPTION_TARGET_KEYS: Record<string, TargetKeyFactory> = {
  // levelup
  "v1.levelup.testSessionDeadline": (p) => testSessionKeys.detail(str(p.sessionId)),
  "v1.levelup.chatStream": (p) => chatKeys.sub(str(p.sessionId), "messages"),
  "v1.levelup.spaceProgressLive": (p) =>
    progressKeys.sub(str(p.spaceId), "space", { userId: str(p.userId) }),
  "v1.levelup.leaderboardLive": (p) =>
    leaderboardKeys.list({
      scope: str(p.scope),
      spaceId: p.spaceId !== undefined ? str(p.spaceId) : undefined,
      storyPointId: p.storyPointId !== undefined ? str(p.storyPointId) : undefined,
    }),
  "v1.levelup.studentLevelLive": () => levelKeys.detail("me"),
  "v1.levelup.achievementUnlock": () => achievementKeys.list({}),

  // autograde
  "v1.autograde.gradingStatus": (p) => submissionKeys.detail(str(p.submissionId)),
  "v1.autograde.examGrading": (p) => examKeys.sub(str(p.examId), "grading"),

  // notification (folded onto identity)
  "v1.notification.badge": () => notificationBadgeKeys.detail("me"),
};
