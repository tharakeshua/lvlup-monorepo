/**
 * Subscriptions module barrel (SDK-LAYERS-PLAN §3.3 / api-contract-core §7).
 *
 * Each realtime channel lives in ONE colocated file (def + slim-projection
 * payload schema + inferred type). This barrel:
 *   1. re-exports every per-channel def + schema + type, and
 *   2. exposes `SUBSCRIPTION_DEFS` — the named record the subscriptions
 *      `registry.ts` spreads into the frozen `SUBSCRIPTIONS` registry (mirrors the
 *      `IDENTITY_CALLABLES`-style module record the CALLABLES assembly spreads).
 *
 * The 9 channels (closes the SUBSCRIPTIONS(9) vs SOURCES(7) schism by including
 * `studentLevelLive` + `achievementUnlock`):
 *   levelup    — testSessionDeadline, chatStream, spaceProgressLive,
 *                studentLevelLive, achievementUnlock
 *   analytics  — leaderboardLive (single canonical leaderboard name)
 *   autograde  — gradingStatus, examGrading
 *   identity   — notificationBadge (v1.notification.badge name fold)
 */
import type { SubscriptionDef } from "../../subscriptions/subscription-def.js";

import { testSessionDeadline } from "./test-session-deadline.js";
import { chatStream } from "./chat-stream.js";
import { spaceProgressLive } from "./space-progress-live.js";
import { leaderboardLive } from "./leaderboard-live.js";
import { studentLevelLive } from "./student-level-live.js";
import { achievementUnlock } from "./achievement-unlock.js";
import { gradingStatus } from "./grading-status.js";
import { examGrading } from "./exam-grading.js";
import { notificationBadge } from "./notification-badge.js";

// Per-channel defs.
export { testSessionDeadline } from "./test-session-deadline.js";
export { chatStream } from "./chat-stream.js";
export { spaceProgressLive } from "./space-progress-live.js";
export { leaderboardLive } from "./leaderboard-live.js";
export { studentLevelLive } from "./student-level-live.js";
export { achievementUnlock } from "./achievement-unlock.js";
export { gradingStatus } from "./grading-status.js";
export { examGrading } from "./exam-grading.js";
export { notificationBadge } from "./notification-badge.js";

// Per-channel slim-projection payload + params schemas and inferred types.
export {
  TestSessionLiveSchema,
  TestSessionDeadlineParamsSchema,
  type TestSessionLive,
  type TestSessionDeadlineParams,
} from "./test-session-deadline.js";
export { ChatStreamParamsSchema, type ChatStreamParams } from "./chat-stream.js";
export {
  StoryPointProgressLiveSchema,
  SpaceProgressLiveSchema,
  SpaceProgressLiveParamsSchema,
  type StoryPointProgressLive,
  type SpaceProgressLive,
  type SpaceProgressLiveParams,
} from "./space-progress-live.js";
export {
  LeaderboardSnapshotSchema,
  LeaderboardLiveParamsSchema,
  type LeaderboardSnapshot,
  type LeaderboardLiveParams,
} from "./leaderboard-live.js";
export { StudentLevelLiveParamsSchema, type StudentLevelLiveParams } from "./student-level-live.js";
export {
  AchievementUnlockSchema,
  AchievementUnlockParamsSchema,
  type AchievementUnlock,
  type AchievementUnlockParams,
} from "./achievement-unlock.js";
export {
  SubmissionStatusSchema,
  GradingStatusParamsSchema,
  type SubmissionStatus,
  type GradingStatusParams,
} from "./grading-status.js";
export {
  ExamGradingProgressSchema,
  ExamGradingParamsSchema,
  type ExamGradingProgress,
  type ExamGradingParams,
} from "./exam-grading.js";
export {
  NotificationStateSchema,
  NotificationBadgeParamsSchema,
  type NotificationState,
  type NotificationBadgeParams,
} from "./notification-badge.js";

/**
 * The module's named def record — spread by `subscriptions/registry.ts` into the
 * frozen `SUBSCRIPTIONS` registry. Keyed by the versioned channel name so the
 * registry's `def.name === key` integrity assertion holds after the spread.
 */
export const SUBSCRIPTION_DEFS = {
  "v1.levelup.testSessionDeadline": testSessionDeadline,
  "v1.levelup.chatStream": chatStream,
  "v1.levelup.spaceProgressLive": spaceProgressLive,
  "v1.levelup.leaderboardLive": leaderboardLive,
  "v1.levelup.studentLevelLive": studentLevelLive,
  "v1.levelup.achievementUnlock": achievementUnlock,
  "v1.autograde.gradingStatus": gradingStatus,
  "v1.autograde.examGrading": examGrading,
  "v1.notification.badge": notificationBadge,
} as const satisfies Record<string, SubscriptionDef<any, any>>;
