/**
 * `hooks/*` — typed convenience wrappers, exactly one per registered `SubscriptionName`
 * (transport-realtime layer §3.2). Each is a ~1-line wrapper over `useSubscription` so call
 * sites read domain-named and `hooks-coverage.test.ts` can assert completeness against the
 * `SUBSCRIPTIONS` registry (all 9 channels, including the reconciled `studentLevelLive` /
 * `achievementUnlock` and the canonical `v1.levelup.leaderboardLive`).
 */
import { useSubscription } from "../use-subscription.js";
import type { ParamsOf } from "../seam.js";
import type { UseSubscriptionOptions, UseSubscriptionResult } from "../types.js";
import type { PayloadOf } from "../seam.js";

// ── levelup ──
export const useTestSessionDeadline = (
  sessionId: string,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.levelup.testSessionDeadline">> =>
  useSubscription("v1.levelup.testSessionDeadline", { sessionId }, opts);

export const useChatStream = (
  sessionId: string,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.levelup.chatStream">> =>
  useSubscription("v1.levelup.chatStream", { sessionId }, opts);

export const useSpaceProgressLive = (
  spaceId: string,
  userId: string,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.levelup.spaceProgressLive">> =>
  useSubscription("v1.levelup.spaceProgressLive", { spaceId, userId }, opts);

export const useStudentLevelLive = (
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.levelup.studentLevelLive">> =>
  useSubscription("v1.levelup.studentLevelLive", {}, opts);

export const useAchievementUnlock = (
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.levelup.achievementUnlock">> =>
  useSubscription("v1.levelup.achievementUnlock", {}, opts);

export const useLeaderboardLive = (
  filter: ParamsOf<"v1.levelup.leaderboardLive">,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.levelup.leaderboardLive">> =>
  useSubscription("v1.levelup.leaderboardLive", filter, opts);

// ── autograde ──
export const useGradingStatus = (
  submissionId: string,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.autograde.gradingStatus">> =>
  useSubscription("v1.autograde.gradingStatus", { submissionId }, opts);

export const useExamGrading = (
  examId: string,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.autograde.examGrading">> =>
  useSubscription("v1.autograde.examGrading", { examId }, opts);

// ── notification (module identity) ──
export const useNotificationBadge = (
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<"v1.notification.badge">> =>
  useSubscription("v1.notification.badge", {}, opts);
