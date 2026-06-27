/**
 * Mock dataset fragment — the "analytics · gamification · notification" vertical slice.
 *
 * This is the DERIVED / PROJECTION layer of the seed: everything a server trigger, scheduler or
 * the AI gateway would have *computed* from the base content/exam/progress fragments
 * (`greenwood.ts`, `riverside.ts`). It exercises every screen + entity type those three domains
 * own (SDK-LAYERS-PLAN §2.4 gamification, §2.6 analytics, §2.7 notification + §8 drift):
 *
 *   analytics      → ExamAnalytics (+questionAnalytics/classBreakdown/topicPerformance),
 *                    StudentProgressSummary (+autograde/levelup metrics, atRiskReasons),
 *                    ClassProgressSummary, LearningInsight, DailyCostSummary (byPurpose+byModel),
 *                    MonthlyCostSummary, LlmCallLog (~14 days), PerformanceTrendPoint series.
 *   gamification   → Achievement catalog, StudentAchievement unlocks, StudentLevel,
 *                    LeaderboardEntry (tenant + space + storyPoint scopes), StudyGoal/StudySession.
 *   notification   → Notification across all roles (mixed read/unread, discriminated payload),
 *                    NotificationPreferences per a few users, NotificationBadgeState (RTDB).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAPE THE ENGINE CONSUMES
 * ─────────────────────────────────────────────────────────────────────────────
 * Two consumption surfaces, both deterministic + idempotent (re-seed = no-op):
 *
 *  (A) `analyticsGamificationNotificationFragment` — a `SeedConfig`-fragment whose tenant
 *      slices overlay the existing tenants. Its array fields (`notifications`, `insights`,
 *      `costSummaries`, `achievements`, `studentGamification`, `progress`) are exactly the
 *      `TenantConfig` fields the current `SeedPipeline` already writes, so it runs through the
 *      stock pipeline with no engine change. Merge it into the base config with
 *      `mergeAnalyticsGamificationNotification(baseConfig)`.
 *
 *  (B) `analyticsGamificationNotificationDocs(clock)` — the richer DERIVED entities the pipeline
 *      does not (yet) materialize from the inline arrays: ExamAnalytics, Class/Student summaries
 *      with full metrics, LlmCallLog, Daily/Monthly cost with `byModel`, NotificationPreferences,
 *      and LeaderboardEntry. Each is returned as a `{ path, data }` pair using the SAME `Paths.*`
 *      + `seedId(...)` conventions the pipeline uses (so ids/paths line up byte-for-byte and a thin
 *      `ensureDoc` loop is fully idempotent). All timestamps come from the injected `Clock`.
 *
 * Every cross-reference resolves to the deterministic id the base pipeline produces for the same
 * logical key (students→users, exams→submissions, classes→students, spaces→storyPoints), via the
 * shared `IdResolver`, `Paths`, `seedId`, `spaceProgressId`, `studentAchievementId` helpers.
 */

import type { Clock, Timestamp } from "../engine/clock.js";
import { createFixedClock, DAY_MS, MINUTE_MS } from "../engine/clock.js";
import { Paths } from "../engine/paths.js";
import { IdResolver } from "../engine/resolver.js";
import { seedId } from "../engine/ids.js";
import type {
  AchievementConfig,
  CostSummaryConfig,
  InsightConfig,
  NotificationConfig,
  SeedConfig,
  SpaceProgressConfig,
  StudentGamificationConfig,
  TenantConfig,
} from "../config/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// §0 · Enums mirrored from @levelup/domain (SDK-LAYERS-PLAN §2.4/§2.6/§2.7)
// ─────────────────────────────────────────────────────────────────────────────

/** NotificationType (11) — notification.md enum. */
export type NotificationType =
  | "exam_results_released"
  | "new_exam_assigned"
  | "new_space_assigned"
  | "submission_graded"
  | "grading_complete"
  | "student_at_risk"
  | "deadline_reminder"
  | "space_published"
  | "bulk_import_complete"
  | "ai_budget_alert"
  | "system_announcement";

/** NotificationRecipientRole (4). */
export type NotificationRecipientRole = "teacher" | "student" | "parent" | "tenantAdmin";

/** NotificationEntityType (5). */
export type NotificationEntityType = "exam" | "space" | "submission" | "student" | "class";

/** InsightType (6) — analytics.md. */
export type InsightType =
  | "weak_topic_recommendation"
  | "exam_preparation"
  | "streak_encouragement"
  | "improvement_celebration"
  | "at_risk_intervention"
  | "cross_system_correlation";

export type InsightPriority = "high" | "medium" | "low";
export type InsightActionType = "practice_space" | "review_exam" | "seek_help" | "celebrate";

/** AtRiskReason (5) — drop `no_recent_activity`, keep `zero_streak` (§8 drift). */
export type AtRiskReason =
  | "low_average_score"
  | "declining_trend"
  | "incomplete_submissions"
  | "zero_streak"
  | "failed_recent_exam";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";
export type LeaderboardScope = "tenant" | "space" | "storyPoint";
export type LeaderboardTier = "diamond" | "platinum" | "gold" | "silver" | "bronze";

// ─────────────────────────────────────────────────────────────────────────────
// §1 · Per-tenant logical-key maps (FK source-of-truth, mirrors greenwood/riverside)
// ─────────────────────────────────────────────────────────────────────────────
//
// We reference the SAME logical keys the base fragments declare; the IdResolver namespaces by
// tenant so these resolve to identical deterministic ids. We register the people on a resolver
// (without writing them) purely to resolve uids/entityIds for FK fields.

interface TenantKeyset {
  tenantKey: string;
  studentKeys: string[];
  teacherKeys: string[];
  parentKeys: string[];
  staffKeys: string[]; // admins + staff (anyone needing prefs/notifications)
  scannerKeys: string[];
  classKeys: string[];
}

const GREENWOOD: TenantKeyset = {
  tenantKey: "greenwood",
  studentKeys: ["s-aarav", "s-diya", "s-rohan", "s-meera", "s-karan", "s-priya"],
  teacherKeys: ["t-asha", "t-vikram"],
  parentKeys: ["p-patel", "p-singh"],
  staffKeys: ["admin-main", "staff-office"],
  scannerKeys: ["scanner-1"],
  classKeys: ["g8-math", "g8-sci", "g10-phy"],
};

const RIVERSIDE: TenantKeyset = {
  tenantKey: "riverside",
  studentKeys: ["s-nikhil", "s-riya"],
  teacherKeys: ["t-asha"],
  parentKeys: ["p-saxena"],
  staffKeys: ["admin-main"],
  scannerKeys: [],
  classKeys: ["g8-math"],
};

/** Build a fully-registered resolver for a tenant keyset (resolves uids/entityIds for FKs). */
function resolverFor(ks: TenantKeyset): IdResolver {
  const r = new IdResolver(ks.tenantKey);
  ks.teacherKeys.forEach((k) => r.registerTeacher(k, `${k}@${ks.tenantKey}.edu`));
  ks.studentKeys.forEach((k) => r.registerStudent(k, `${k}@${ks.tenantKey}.edu`));
  ks.parentKeys.forEach((k) => r.registerParent(k, `${k}@${ks.tenantKey}.edu`));
  ks.scannerKeys.forEach((k) => r.registerScanner(k, `${k}@${ks.tenantKey}.edu`));
  // admins register on the admin map; everyone else as staff.
  for (const k of ks.staffKeys) {
    if (k.startsWith("admin")) r.registerAdmin(k, `${k}@${ks.tenantKey}.edu`);
    else r.registerStaff(k, `${k}@${ks.tenantKey}.edu`);
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 · (A) SeedConfig-fragment tenant slices — consumed by the stock pipeline
// ─────────────────────────────────────────────────────────────────────────────
//
// These use ONLY the existing `TenantConfig` array fields, so `SeedPipeline` writes them as-is.
// They are deliberately rich enough to exercise the student/parent/teacher/admin screens.

// ---- Gamification catalog (shared shape across tenants) ----
const ACHIEVEMENTS: AchievementConfig[] = [
  {
    key: "ach-first-test",
    name: "First Test Complete",
    description: "Completed your first test",
    tier: "bronze",
    category: "milestone",
    criteria: { type: "tests_completed", target: 1 },
  },
  {
    key: "ach-perfect-score",
    name: "Perfect Score",
    description: "Scored 100% on a test",
    tier: "gold",
    category: "mastery",
    criteria: { type: "perfect_scores", target: 1 },
  },
  {
    key: "ach-streak-7",
    name: "7-Day Streak",
    description: "Studied 7 days in a row",
    tier: "silver",
    category: "streak",
    criteria: { type: "streak_days", target: 7 },
  },
  {
    key: "ach-streak-30",
    name: "30-Day Streak",
    description: "Studied 30 days in a row",
    tier: "platinum",
    category: "streak",
    criteria: { type: "streak_days", target: 30 },
  },
  {
    key: "ach-100-items",
    name: "Century",
    description: "Completed 100 practice items",
    tier: "gold",
    category: "volume",
    criteria: { type: "items_completed", target: 100 },
  },
  {
    key: "ach-early-bird",
    name: "Early Bird",
    description: "Completed a session before 8am",
    tier: "bronze",
    category: "habit",
    criteria: { type: "early_sessions", target: 1 },
  },
];

const GREENWOOD_STUDENT_GAMIFICATION: StudentGamificationConfig[] = [
  {
    studentKey: "s-aarav",
    level: { level: 5, xp: 2480, tier: "gold" },
    unlockedAchievementKeys: ["ach-first-test", "ach-streak-7", "ach-100-items"],
    streakDays: 12,
    longestStreak: 14,
    studyGoals: [
      {
        key: "goal-algebra",
        title: "Master Algebra",
        targetType: "items_completed",
        targetCount: 20,
        startDate: "2025-11-01",
        endDate: "2025-12-31",
        currentCount: 17,
      },
      {
        key: "goal-daily",
        title: "Daily 30 minutes",
        targetType: "minutes_per_day",
        targetCount: 30,
        startDate: "2025-12-01",
        endDate: "2025-12-31",
        currentCount: 30,
        completed: true,
      },
    ],
    studySessions: [
      { key: "ss-1", date: "2025-12-09", minutes: 45, itemsCompleted: 6 },
      { key: "ss-2", date: "2025-12-10", minutes: 30, itemsCompleted: 4 },
      { key: "ss-3", date: "2025-12-11", minutes: 50, itemsCompleted: 7 },
    ],
  },
  {
    studentKey: "s-diya",
    level: { level: 3, xp: 1180, tier: "silver" },
    unlockedAchievementKeys: ["ach-first-test"],
    streakDays: 3,
    longestStreak: 6,
    studyGoals: [
      {
        key: "goal-catchup",
        title: "Catch up on Equations",
        targetType: "items_completed",
        targetCount: 10,
        startDate: "2025-12-05",
        endDate: "2025-12-20",
        currentCount: 2,
      },
    ],
    studySessions: [
      { key: "ss-1", date: "2025-12-09", minutes: 20, itemsCompleted: 2 },
      { key: "ss-2", date: "2025-12-11", minutes: 15, itemsCompleted: 1 },
    ],
  },
  {
    studentKey: "s-rohan",
    level: { level: 4, xp: 1920, tier: "gold" },
    unlockedAchievementKeys: ["ach-first-test", "ach-streak-7", "ach-perfect-score"],
    streakDays: 8,
    longestStreak: 8,
    studySessions: [{ key: "ss-1", date: "2025-12-11", minutes: 40, itemsCompleted: 5 }],
  },
  {
    studentKey: "s-karan",
    level: { level: 2, xp: 540, tier: "bronze" },
    streakDays: 0,
    longestStreak: 4,
  },
  {
    studentKey: "s-priya",
    level: { level: 6, xp: 3120, tier: "platinum" },
    unlockedAchievementKeys: [
      "ach-first-test",
      "ach-streak-7",
      "ach-streak-30",
      "ach-100-items",
      "ach-early-bird",
    ],
    streakDays: 31,
    longestStreak: 31,
    studySessions: [
      { key: "ss-1", date: "2025-12-10", minutes: 60, itemsCompleted: 9 },
      { key: "ss-2", date: "2025-12-11", minutes: 55, itemsCompleted: 8 },
    ],
  },
];

const RIVERSIDE_STUDENT_GAMIFICATION: StudentGamificationConfig[] = [
  {
    studentKey: "s-nikhil",
    level: { level: 2, xp: 720, tier: "bronze" },
    unlockedAchievementKeys: ["ach-first-test"],
    streakDays: 2,
    longestStreak: 3,
    studySessions: [{ key: "ss-1", date: "2025-12-11", minutes: 25, itemsCompleted: 3 }],
  },
  {
    studentKey: "s-riya",
    level: { level: 3, xp: 1340, tier: "silver" },
    unlockedAchievementKeys: ["ach-first-test", "ach-streak-7"],
    streakDays: 7,
    longestStreak: 7,
  },
];

// ---- Extra progress (so summaries/leaderboards have more than the base 2 students) ----
const GREENWOOD_EXTRA_PROGRESS: SpaceProgressConfig[] = [
  {
    studentKey: "s-rohan",
    spaceKey: "space-algebra",
    overallPercentage: 100,
    pointsEarned: 6,
    totalPoints: 6,
    storyPoints: [
      {
        storyPointKey: "sp-intro",
        completedItems: 2,
        totalItems: 2,
        pointsEarned: 1,
        totalPoints: 1,
        status: "completed",
      },
      {
        storyPointKey: "sp-equations",
        completedItems: 2,
        totalItems: 2,
        pointsEarned: 5,
        totalPoints: 5,
        status: "completed",
      },
    ],
  },
];

// ---- Insights (analytics rule-engine output; type ∈ InsightType) ----
const GREENWOOD_INSIGHTS: InsightConfig[] = [
  {
    key: "ins-diya-weak",
    studentKey: "s-diya",
    type: "weak_topic_recommendation",
    severity: "warning",
    message: "Linear Equations accuracy is 40%. Try the Equations practice set.",
  },
  {
    key: "ins-diya-atrisk",
    studentKey: "s-diya",
    type: "at_risk_intervention",
    severity: "critical",
    message: "Diya has not started the Linear Equations test and her streak dropped to 3.",
  },
  {
    key: "ins-aarav-celebrate",
    studentKey: "s-aarav",
    type: "improvement_celebration",
    severity: "info",
    message: "Aarav improved 18% on Algebra this week. Keep it up!",
  },
  {
    key: "ins-aarav-streak",
    studentKey: "s-aarav",
    type: "streak_encouragement",
    severity: "info",
    message: "You are on a 12-day streak — 2 days from a new record.",
  },
  {
    key: "ins-karan-exam",
    studentKey: "s-karan",
    type: "exam_preparation",
    severity: "warning",
    message: "Physics midterm is in 5 days. Review Newtons laws.",
  },
  {
    key: "ins-priya-corr",
    studentKey: "s-priya",
    type: "cross_system_correlation",
    severity: "info",
    message: "High practice activity correlates with your strong exam scores.",
  },
];

const RIVERSIDE_INSIGHTS: InsightConfig[] = [
  {
    key: "ins-nikhil-streak",
    studentKey: "s-nikhil",
    type: "streak_encouragement",
    severity: "info",
    message: "Study tomorrow to keep your streak alive.",
  },
];

// ---- Notifications (mixed read/unread, across roles; discriminated payload context) ----
const GREENWOOD_NOTIFICATIONS: NotificationConfig[] = [
  {
    key: "ntf-aarav-result",
    recipientKey: "s-aarav",
    type: "exam_results_released",
    title: "Your Midterm results are out",
    body: "You scored 16/20 (80%). Great job!",
    payload: {
      entityType: "exam",
      examKey: "exam-math-mid",
      score: 16,
      maxScore: 20,
      percentage: 80,
    },
    isRead: false,
  },
  {
    key: "ntf-aarav-ach",
    recipientKey: "s-aarav",
    type: "space_published",
    title: "New badge unlocked: Century",
    body: "You completed 100 practice items.",
    payload: { entityType: "space", achievementKey: "ach-100-items" },
    isRead: true,
  },
  {
    key: "ntf-diya-result",
    recipientKey: "s-diya",
    type: "submission_graded",
    title: "Your submission was graded",
    body: "Your Midterm has been graded. View feedback.",
    payload: { entityType: "submission", examKey: "exam-math-mid" },
    isRead: false,
  },
  {
    key: "ntf-diya-atrisk-self",
    recipientKey: "s-diya",
    type: "deadline_reminder",
    title: "Linear Equations test due soon",
    body: "The Linear Equations timed test closes in 2 days.",
    payload: { entityType: "space", spaceKey: "space-algebra", storyPointKey: "sp-equations" },
    isRead: false,
  },
  {
    key: "ntf-rohan-newspace",
    recipientKey: "s-rohan",
    type: "new_space_assigned",
    title: "New space assigned: Algebra Foundations",
    body: "Your teacher assigned a new learning space.",
    payload: { entityType: "space", spaceKey: "space-algebra" },
    isRead: true,
  },
  {
    key: "ntf-karan-newexam",
    recipientKey: "s-karan",
    type: "new_exam_assigned",
    title: "Physics midterm scheduled",
    body: "A new exam was assigned to Grade 10 Physics.",
    payload: { entityType: "class", classKey: "g10-phy" },
    isRead: false,
  },
  {
    key: "ntf-parent-patel",
    recipientKey: "p-patel",
    type: "exam_results_released",
    title: "Aarav's Midterm results",
    body: "Aarav scored 80% on the Mathematics Midterm.",
    payload: {
      entityType: "student",
      studentKey: "s-aarav",
      examKey: "exam-math-mid",
      percentage: 80,
    },
    isRead: false,
  },
  {
    key: "ntf-parent-singh-atrisk",
    recipientKey: "p-singh",
    type: "student_at_risk",
    title: "Karan may need support",
    body: "Karan has a zero study streak this week.",
    payload: { entityType: "student", studentKey: "s-karan" },
    isRead: false,
  },
  {
    key: "ntf-asha-grading",
    recipientKey: "t-asha",
    type: "grading_complete",
    title: "Midterm grading complete",
    body: "All submissions for the Grade 8 Mathematics Midterm are graded.",
    payload: { entityType: "exam", examKey: "exam-math-mid" },
    isRead: true,
  },
  {
    key: "ntf-vikram-graded",
    recipientKey: "t-vikram",
    type: "submission_graded",
    title: "New submission graded",
    body: "A Physics submission was auto-graded and is awaiting review.",
    payload: { entityType: "submission" },
    isRead: false,
  },
  {
    key: "ntf-admin-budget",
    recipientKey: "admin-main",
    type: "ai_budget_alert",
    title: "AI budget at 82%",
    body: "This month AI spend reached 82% of the configured budget.",
    payload: { entityType: "class", usedPercent: 82 },
    isRead: false,
  },
  {
    key: "ntf-admin-bulk",
    recipientKey: "admin-main",
    type: "bulk_import_complete",
    title: "Student import complete",
    body: "6 students imported, 0 errors.",
    payload: { created: 6, skipped: 0 },
    isRead: true,
  },
  {
    key: "ntf-aarav-announce",
    recipientKey: "s-aarav",
    type: "system_announcement",
    title: "Midterm Exam Schedule Released",
    body: "Grade 8 Mathematics Midterm is on Dec 15.",
    payload: { entityType: "class", announcementKey: "anc-midterm" },
    isRead: true,
  },
];

const RIVERSIDE_NOTIFICATIONS: NotificationConfig[] = [
  {
    key: "ntf-nikhil-welcome",
    recipientKey: "s-nikhil",
    type: "space_published",
    title: "New space: Geometry Basics",
    body: "Start with Shapes & Angles.",
    payload: { entityType: "space", spaceKey: "space-geometry" },
    isRead: false,
  },
  {
    key: "ntf-asha-rvs",
    recipientKey: "t-asha",
    type: "system_announcement",
    title: "Welcome to Riverside on LevelUp",
    body: "We are piloting the platform this term.",
    payload: { announcementKey: "anc-welcome" },
    isRead: false,
  },
];

// ---- Cost summaries (byPurpose only — the field the stock pipeline writes) ----
const GREENWOOD_COST_SUMMARIES: CostSummaryConfig[] = buildDailyCostConfigs("greenwood").concat([
  {
    key: "cost-m-2025-12",
    granularity: "monthly",
    period: "2025-12",
    totalUsd: 0.486,
    totalTokens: 412_900,
    callCount: 318,
    byPurpose: {
      answer_grading: 0.214,
      question_extraction: 0.121,
      insight_generation: 0.058,
      chat_tutor: 0.093,
    },
  },
]);

const RIVERSIDE_COST_SUMMARIES: CostSummaryConfig[] = [
  {
    key: "cost-d-2025-12-11",
    granularity: "daily",
    period: "2025-12-11",
    totalUsd: 0.0019,
    totalTokens: 1_640,
    callCount: 2,
    byPurpose: { answer_grading: 0.0019 },
  },
  {
    key: "cost-m-2025-12",
    granularity: "monthly",
    period: "2025-12",
    totalUsd: 0.0142,
    totalTokens: 12_400,
    callCount: 11,
    byPurpose: { answer_grading: 0.0142 },
  },
];

/** 14 days of daily cost configs ending 2025-12-14 (byPurpose). */
function buildDailyCostConfigs(tenantKey: string): CostSummaryConfig[] {
  void tenantKey;
  const out: CostSummaryConfig[] = [];
  for (let i = 0; i < 14; i++) {
    const period = isoDateMinus("2025-12-14", 13 - i); // 2025-12-01 .. 2025-12-14
    const grading = round4(0.012 + (i % 5) * 0.0021);
    const extraction = round4(0.006 + (i % 3) * 0.0015);
    const insight = round4(0.002 + (i % 4) * 0.0008);
    const chat = round4(0.004 + (i % 6) * 0.0011);
    const totalUsd = round4(grading + extraction + insight + chat);
    out.push({
      key: `cost-d-${period}`,
      granularity: "daily",
      period,
      totalUsd,
      totalTokens: 9_400 + i * 730,
      callCount: 14 + (i % 7),
      byPurpose: {
        answer_grading: grading,
        question_extraction: extraction,
        insight_generation: insight,
        chat_tutor: chat,
      },
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The (A) fragment — overlay tenant slices
// ─────────────────────────────────────────────────────────────────────────────

/** Per-tenant overlay slices (only analytics/gamification/notification fields). */
export const tenantOverlays: Record<string, Partial<TenantConfig>> = {
  greenwood: {
    achievements: ACHIEVEMENTS,
    studentGamification: GREENWOOD_STUDENT_GAMIFICATION,
    progress: GREENWOOD_EXTRA_PROGRESS,
    insights: GREENWOOD_INSIGHTS,
    notifications: GREENWOOD_NOTIFICATIONS,
    costSummaries: GREENWOOD_COST_SUMMARIES,
  },
  riverside: {
    achievements: ACHIEVEMENTS,
    studentGamification: RIVERSIDE_STUDENT_GAMIFICATION,
    insights: RIVERSIDE_INSIGHTS,
    notifications: RIVERSIDE_NOTIFICATIONS,
    costSummaries: RIVERSIDE_COST_SUMMARIES,
  },
};

/**
 * A standalone `SeedConfig` fragment (tenant shells carrying ONLY the overlay arrays). Useful for
 * seeding this slice in isolation against already-seeded base tenants — every doc is an idempotent
 * upsert keyed by the same logical keys, so it merges cleanly with the base config's tenant docs.
 */
export const analyticsGamificationNotificationFragment: SeedConfig = {
  version: "1.0.0-agn",
  tenants: [
    { key: "greenwood", name: "Greenwood Academy", code: "GRN001", ...tenantOverlays.greenwood },
    { key: "riverside", name: "Riverside High", code: "RVS002", ...tenantOverlays.riverside },
  ],
};

/**
 * Merge the overlay slices into an existing `SeedConfig` (e.g. `mockSeedConfig`), CONCATENATING
 * onto any base arrays so nothing is dropped, while keeping deterministic keys (re-run safe).
 */
export function mergeAnalyticsGamificationNotification(base: SeedConfig): SeedConfig {
  return {
    ...base,
    tenants: base.tenants.map((t) => {
      const overlay = tenantOverlays[t.key];
      if (!overlay) return t;
      return {
        ...t,
        achievements: dedupeByKey([...(t.achievements ?? []), ...(overlay.achievements ?? [])]),
        studentGamification: mergeStudentGamification(
          t.studentGamification,
          overlay.studentGamification
        ),
        progress: [...(t.progress ?? []), ...(overlay.progress ?? [])],
        insights: dedupeByKey([...(t.insights ?? []), ...(overlay.insights ?? [])]),
        notifications: dedupeByKey([...(t.notifications ?? []), ...(overlay.notifications ?? [])]),
        costSummaries: dedupeByKey([...(t.costSummaries ?? []), ...(overlay.costSummaries ?? [])]),
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 · (B) Rich DERIVED docs — { path, data } pairs for a thin ensureDoc loop
// ─────────────────────────────────────────────────────────────────────────────
//
// These materialize the entities the stock pipeline does not synthesize from the inline arrays:
// ExamAnalytics, full Student/Class summaries, LlmCallLog, byModel cost, NotificationPreferences,
// LeaderboardEntry. Shapes match @levelup/domain §2 (branded ids, ISO timestamps, bounded maps).

export interface SeedDoc {
  /** Firestore path (from `Paths.*`) — even component count (document path). */
  path: string;
  /** The doc body (ISO timestamps, branded ids as strings). */
  data: Record<string, unknown>;
  /** The logical id kind (for logging / verify grouping). */
  kind: string;
}

/**
 * Produce all rich derived docs for both tenants. Deterministic given the clock; default uses the
 * engine's fixed clock so a stand-alone run is byte-reproducible.
 */
export function analyticsGamificationNotificationDocs(
  clock: Clock = createFixedClock()
): SeedDoc[] {
  const docs: SeedDoc[] = [];
  docs.push(...greenwoodDerivedDocs(clock));
  docs.push(...riversideDerivedDocs(clock));
  return docs;
}

// ── Greenwood derived docs ──

function greenwoodDerivedDocs(clock: Clock): SeedDoc[] {
  const r = resolverFor(GREENWOOD);
  const t = r.tenantId;
  const now = clock.now();
  const docs: SeedDoc[] = [];

  // -- ExamAnalytics for the released midterm (exam-math-mid) --
  const examId = r.examId("exam-math-mid");
  const q1 = r.examQuestionId("exam-math-mid", "q1");
  const q2 = r.examQuestionId("exam-math-mid", "q2");
  const g8math = r.classId("g8-math");
  docs.push({
    kind: "examAnalytics",
    path: Paths.examAnalytics(t, examId),
    data: {
      id: examId,
      tenantId: t,
      examId,
      totalSubmissions: 2,
      gradedSubmissions: 2,
      avgScore: 17.5, // (16 + 19) / 2
      avgPercentage: 87.5,
      passRate: 1, // both >= 8
      medianScore: 17.5,
      scoreDistribution: {
        buckets: [
          { label: "0-49%", count: 0 },
          { label: "50-69%", count: 0 },
          { label: "70-89%", count: 1 },
          { label: "90-100%", count: 1 },
        ],
        gradeDistribution: { A: 2, B: 0, C: 0, D: 0, F: 0 },
      },
      // bounded record-map keyed by ExamQuestionId (D6)
      questionAnalytics: {
        [q1]: {
          questionId: q1,
          maxMarks: 10,
          avgScore: 9,
          avgPercentage: 90,
          difficultyIndex: 0.9,
          attempts: 2,
          correctRate: 0.9,
        },
        [q2]: {
          questionId: q2,
          maxMarks: 10,
          avgScore: 8.5,
          avgPercentage: 85,
          difficultyIndex: 0.85,
          attempts: 2,
          correctRate: 0.85,
        },
      },
      classBreakdown: {
        [g8math]: {
          classId: g8math,
          className: "Grade 8 - Mathematics",
          submissionCount: 2,
          avgPercentage: 87.5,
          passRate: 1,
        },
      },
      topicPerformance: {
        Algebra: { topic: "Algebra", avgPercentage: 90, questionCount: 1 },
        Geometry: { topic: "Geometry", avgPercentage: 85, questionCount: 1 },
      },
      computedAt: now,
      lastUpdatedAt: now,
    },
  });

  // -- StudentProgressSummary (full metrics) for each student with activity --
  docs.push(
    studentSummaryDoc(r, clock, {
      studentKey: "s-aarav",
      overallScore: 0.83,
      strengthAreas: ["Algebra"],
      weaknessAreas: [],
      isAtRisk: false,
      atRiskReasons: [],
      autograde: {
        totalExams: 1,
        completedExams: 1,
        averageScore: 0.8,
        averagePercentage: 80,
        totalMarksObtained: 16,
        totalMarksAvailable: 20,
        subjectBreakdown: {
          Mathematics: { subject: "Mathematics", averagePercentage: 80, examCount: 1 },
        },
        recentExams: [
          {
            examId: r.examId("exam-math-mid"),
            title: "Grade 8 Mathematics Midterm",
            percentage: 80,
            date: "2025-12-15",
          },
        ],
      },
      levelup: {
        totalSpaces: 1,
        completedSpaces: 0,
        averageCompletion: 75,
        totalPointsEarned: 5,
        totalPointsAvailable: 6,
        averageAccuracy: 0.83,
        streakDays: 12,
        subjectBreakdown: { Mathematics: { subject: "Mathematics", averageCompletion: 75 } },
        recentActivity: [
          {
            spaceId: r.spaceId("space-algebra"),
            title: "Algebra Foundations",
            completion: 75,
            date: "2025-12-11",
          },
        ],
      },
    }),
    studentSummaryDoc(r, clock, {
      studentKey: "s-diya",
      overallScore: 0.46,
      strengthAreas: [],
      weaknessAreas: ["Linear Equations"],
      isAtRisk: true,
      atRiskReasons: ["low_average_score", "incomplete_submissions"],
      autograde: {
        totalExams: 1,
        completedExams: 1,
        averageScore: 0.95,
        averagePercentage: 95,
        totalMarksObtained: 19,
        totalMarksAvailable: 20,
        subjectBreakdown: {
          Mathematics: { subject: "Mathematics", averagePercentage: 95, examCount: 1 },
        },
        recentExams: [
          {
            examId: r.examId("exam-math-mid"),
            title: "Grade 8 Mathematics Midterm",
            percentage: 95,
            date: "2025-12-15",
          },
        ],
      },
      levelup: {
        totalSpaces: 1,
        completedSpaces: 0,
        averageCompletion: 50,
        totalPointsEarned: 3,
        totalPointsAvailable: 6,
        averageAccuracy: 0.4,
        streakDays: 3,
        subjectBreakdown: { Mathematics: { subject: "Mathematics", averageCompletion: 50 } },
        recentActivity: [
          {
            spaceId: r.spaceId("space-algebra"),
            title: "Algebra Foundations",
            completion: 50,
            date: "2025-12-11",
          },
        ],
      },
    }),
    studentSummaryDoc(r, clock, {
      studentKey: "s-rohan",
      overallScore: 0.92,
      strengthAreas: ["Algebra"],
      weaknessAreas: [],
      isAtRisk: false,
      atRiskReasons: [],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averageScore: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 1,
        completedSpaces: 1,
        averageCompletion: 100,
        totalPointsEarned: 6,
        totalPointsAvailable: 6,
        averageAccuracy: 0.92,
        streakDays: 8,
        subjectBreakdown: { Mathematics: { subject: "Mathematics", averageCompletion: 100 } },
        recentActivity: [
          {
            spaceId: r.spaceId("space-algebra"),
            title: "Algebra Foundations",
            completion: 100,
            date: "2025-12-11",
          },
        ],
      },
    }),
    studentSummaryDoc(r, clock, {
      studentKey: "s-karan",
      overallScore: 0.38,
      strengthAreas: [],
      weaknessAreas: ["Physics"],
      isAtRisk: true,
      atRiskReasons: ["zero_streak", "declining_trend"],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averageScore: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 0,
        completedSpaces: 0,
        averageCompletion: 0,
        totalPointsEarned: 0,
        totalPointsAvailable: 0,
        averageAccuracy: 0,
        streakDays: 0,
        subjectBreakdown: {},
        recentActivity: [],
      },
    }),
    studentSummaryDoc(r, clock, {
      studentKey: "s-priya",
      overallScore: 0.95,
      strengthAreas: ["Physics", "Consistency"],
      weaknessAreas: [],
      isAtRisk: false,
      atRiskReasons: [],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averageScore: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 0,
        completedSpaces: 0,
        averageCompletion: 0,
        totalPointsEarned: 0,
        totalPointsAvailable: 0,
        averageAccuracy: 0.95,
        streakDays: 31,
        subjectBreakdown: {},
        recentActivity: [],
      },
    })
  );

  // -- ClassProgressSummary per class --
  docs.push(
    classSummaryDoc(r, clock, {
      classKey: "g8-math",
      className: "Grade 8 - Mathematics",
      studentKeys: ["s-aarav", "s-diya", "s-rohan"],
      atRiskKeys: ["s-diya"],
      autogradeAvg: 87.5,
      levelupAvg: 75,
    }),
    classSummaryDoc(r, clock, {
      classKey: "g8-sci",
      className: "Grade 8 - Science",
      studentKeys: ["s-aarav", "s-diya", "s-meera"],
      atRiskKeys: ["s-diya"],
      autogradeAvg: 0,
      levelupAvg: 41,
    }),
    classSummaryDoc(r, clock, {
      classKey: "g10-phy",
      className: "Grade 10 - Physics",
      studentKeys: ["s-karan", "s-priya"],
      atRiskKeys: ["s-karan"],
      autogradeAvg: 0,
      levelupAvg: 48,
    })
  );

  // -- LearningInsight (rich shape mirroring the InsightConfig overlay, but full @levelup/domain) --
  docs.push(
    learningInsightDoc(r, clock, {
      key: "diya-weak",
      studentKey: "s-diya",
      type: "weak_topic_recommendation",
      priority: "high",
      title: "Practice Linear Equations",
      description: "Accuracy is 40% on Linear Equations.",
      actionType: "practice_space",
      actionEntityId: r.spaceId("space-algebra"),
      actionEntityTitle: "Algebra Foundations",
    }),
    learningInsightDoc(r, clock, {
      key: "diya-atrisk",
      studentKey: "s-diya",
      type: "at_risk_intervention",
      priority: "high",
      title: "Diya needs a check-in",
      description: "Incomplete submissions and a low average.",
      actionType: "seek_help",
    }),
    learningInsightDoc(r, clock, {
      key: "aarav-celebrate",
      studentKey: "s-aarav",
      type: "improvement_celebration",
      priority: "low",
      title: "Great progress!",
      description: "18% improvement on Algebra this week.",
      actionType: "celebrate",
    }),
    learningInsightDoc(r, clock, {
      key: "karan-exam",
      studentKey: "s-karan",
      type: "exam_preparation",
      priority: "medium",
      title: "Prepare for the Physics midterm",
      description: "Exam in 5 days; review Newtons laws.",
      actionType: "review_exam",
      actionEntityId: r.examId("exam-math-mid"),
      actionEntityTitle: "Midterm",
    })
  );

  // -- DailyCostSummary (byPurpose + byModel) for 14 days, MonthlyCostSummary, LlmCallLog --
  docs.push(...costAndLlmDocs(r, clock));

  // -- NotificationPreferences for a few users --
  docs.push(
    notificationPrefsDoc(r, clock, "s-aarav", "student", { muteUntil: null }),
    notificationPrefsDoc(r, clock, "s-diya", "student", { disabled: ["ai_budget_alert"] }),
    notificationPrefsDoc(r, clock, "p-patel", "parent", { muteUntil: clock.at(2 * DAY_MS) }),
    notificationPrefsDoc(r, clock, "t-asha", "teacher", {}),
    notificationPrefsDoc(r, clock, "admin-main", "tenantAdmin", {})
  );

  // -- LeaderboardEntry (tenant scope + space scope + storyPoint scope) --
  docs.push(...leaderboardDocs(r, clock));

  return docs;
}

// ── Riverside derived docs (smaller; proves multi-tenant isolation) ──

function riversideDerivedDocs(clock: Clock): SeedDoc[] {
  const r = resolverFor(RIVERSIDE);
  const docs: SeedDoc[] = [];

  docs.push(
    studentSummaryDoc(r, clock, {
      studentKey: "s-nikhil",
      overallScore: 0.55,
      strengthAreas: [],
      weaknessAreas: ["Geometry"],
      isAtRisk: false,
      atRiskReasons: [],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averageScore: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 1,
        completedSpaces: 0,
        averageCompletion: 30,
        totalPointsEarned: 1,
        totalPointsAvailable: 3,
        averageAccuracy: 0.55,
        streakDays: 2,
        subjectBreakdown: { Mathematics: { subject: "Mathematics", averageCompletion: 30 } },
        recentActivity: [
          {
            spaceId: r.spaceId("space-geometry"),
            title: "Geometry Basics",
            completion: 30,
            date: "2025-12-11",
          },
        ],
      },
    }),
    studentSummaryDoc(r, clock, {
      studentKey: "s-riya",
      overallScore: 0.71,
      strengthAreas: ["Geometry"],
      weaknessAreas: [],
      isAtRisk: false,
      atRiskReasons: [],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averageScore: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 1,
        completedSpaces: 0,
        averageCompletion: 60,
        totalPointsEarned: 2,
        totalPointsAvailable: 3,
        averageAccuracy: 0.71,
        streakDays: 7,
        subjectBreakdown: { Mathematics: { subject: "Mathematics", averageCompletion: 60 } },
        recentActivity: [],
      },
    })
  );

  docs.push(
    classSummaryDoc(r, clock, {
      classKey: "g8-math",
      className: "Grade 8 - Mathematics",
      studentKeys: ["s-nikhil", "s-riya"],
      atRiskKeys: [],
      autogradeAvg: 0,
      levelupAvg: 45,
    })
  );

  docs.push(notificationPrefsDoc(r, clock, "s-nikhil", "student", {}));

  // tenant leaderboard for the 2 riverside students
  const now = clock.now();
  const entries = [
    { studentKey: "s-riya", score: 1340, rank: 1 },
    { studentKey: "s-nikhil", score: 720, rank: 2 },
  ];
  for (const e of entries) {
    const uid = r.student(e.studentKey).uid;
    const id = seedId("leaderboardEntry", `${r.tenantKey}:tenant:${uid}`);
    docs.push({
      kind: "leaderboardEntry",
      path: `tenants/${r.tenantId}/leaderboards/tenant/entries/${uid}`,
      data: {
        id,
        tenantId: r.tenantId,
        scope: "tenant",
        userId: uid,
        score: e.score,
        rank: e.rank,
        tier: tierFor(e.rank),
        displayName: e.studentKey,
        updatedAt: now,
      },
    });
  }

  return docs;
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 · Doc builders (shared shapes — match @levelup/domain §2)
// ─────────────────────────────────────────────────────────────────────────────

interface StudentSummaryInput {
  studentKey: string;
  overallScore: number;
  strengthAreas: string[];
  weaknessAreas: string[];
  isAtRisk: boolean;
  atRiskReasons: AtRiskReason[];
  autograde: Record<string, unknown>;
  levelup: Record<string, unknown>;
}

function studentSummaryDoc(r: IdResolver, clock: Clock, i: StudentSummaryInput): SeedDoc {
  const student = r.student(i.studentKey);
  return {
    kind: "studentSummary",
    path: Paths.studentProgressSummary(r.tenantId, student.entityId),
    data: {
      id: student.entityId,
      tenantId: r.tenantId,
      studentId: student.entityId,
      autograde: i.autograde,
      levelup: i.levelup,
      overallScore: i.overallScore,
      strengthAreas: i.strengthAreas,
      weaknessAreas: i.weaknessAreas,
      isAtRisk: i.isAtRisk,
      atRiskReasons: i.atRiskReasons,
      // denormalized fan-out targets (analytics.md nightlyAtRiskDetection)
      teacherUids: [],
      parentUids: [],
      lastUpdatedAt: clock.now(),
    },
  };
}

interface ClassSummaryInput {
  classKey: string;
  className: string;
  studentKeys: string[];
  atRiskKeys: string[];
  autogradeAvg: number;
  levelupAvg: number;
}

function classSummaryDoc(r: IdResolver, clock: Clock, i: ClassSummaryInput): SeedDoc {
  const classId = r.classId(i.classKey);
  const atRiskIds = i.atRiskKeys.map((k) => r.student(k).entityId);
  return {
    kind: "classSummary",
    path: Paths.classProgressSummary(r.tenantId, classId),
    data: {
      id: classId,
      tenantId: r.tenantId,
      classId,
      className: i.className,
      studentCount: i.studentKeys.length,
      autograde: {
        averageClassScore: i.autogradeAvg,
        examCompletionRate: i.autogradeAvg > 0 ? 80 : 0,
        topPerformers: [],
        bottomPerformers: [],
      },
      levelup: {
        averageClassCompletion: i.levelupAvg,
        activeStudentRate: i.studentKeys.length > 0 ? 100 : 0,
        topPointEarners: [],
      },
      atRiskStudentIds: atRiskIds,
      atRiskCount: atRiskIds.length,
      lastUpdatedAt: clock.now(),
    },
  };
}

interface InsightDocInput {
  key: string;
  studentKey: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  actionType: InsightActionType;
  actionEntityId?: string;
  actionEntityTitle?: string;
}

function learningInsightDoc(r: IdResolver, clock: Clock, i: InsightDocInput): SeedDoc {
  const student = r.student(i.studentKey);
  const id = seedId("insight", `${r.tenantKey}:rich:${i.key}`);
  return {
    kind: "insight",
    path: Paths.insight(r.tenantId, id),
    data: {
      id,
      tenantId: r.tenantId,
      studentId: student.entityId,
      type: i.type,
      priority: i.priority,
      title: i.title,
      description: i.description,
      actionType: i.actionType,
      actionEntityId: i.actionEntityId,
      actionEntityTitle: i.actionEntityTitle,
      createdAt: clock.now(),
      dismissedAt: null,
    },
  };
}

// -- cost + llm --

const LLM_MODELS = ["gemini-2.0-flash", "gemini-1.5-pro"] as const;
const LLM_PURPOSES = [
  "answer_grading",
  "question_extraction",
  "insight_generation",
  "chat_tutor",
] as const;

function costAndLlmDocs(r: IdResolver, clock: Clock): SeedDoc[] {
  const t = r.tenantId;
  const docs: SeedDoc[] = [];

  // 14 daily summaries (byPurpose + byModel) ending 2025-12-14
  let monthCalls = 0;
  let monthUsd = 0;
  let monthIn = 0;
  let monthOut = 0;
  for (let i = 0; i < 14; i++) {
    const date = isoDateMinus("2025-12-14", 13 - i);
    const grading = round4(0.012 + (i % 5) * 0.0021);
    const extraction = round4(0.006 + (i % 3) * 0.0015);
    const insight = round4(0.002 + (i % 4) * 0.0008);
    const chat = round4(0.004 + (i % 6) * 0.0011);
    const totalCostUsd = round4(grading + extraction + insight + chat);
    const flashUsd = round4(totalCostUsd * 0.7);
    const proUsd = round4(totalCostUsd - flashUsd);
    const inTok = 6_200 + i * 480;
    const outTok = 3_200 + i * 250;
    const calls = 14 + (i % 7);
    monthCalls += calls;
    monthUsd = round4(monthUsd + totalCostUsd);
    monthIn += inTok;
    monthOut += outTok;
    docs.push({
      kind: "costSummary",
      path: Paths.dailyCostSummary(t, date),
      data: {
        id: date,
        tenantId: t,
        date,
        totalCalls: calls,
        totalInputTokens: inTok,
        totalOutputTokens: outTok,
        totalCostUsd,
        byPurpose: {
          answer_grading: {
            calls: Math.round(calls * 0.4),
            costUsd: grading,
            inputTokens: Math.round(inTok * 0.4),
            outputTokens: Math.round(outTok * 0.4),
          },
          question_extraction: {
            calls: Math.round(calls * 0.2),
            costUsd: extraction,
            inputTokens: Math.round(inTok * 0.2),
            outputTokens: Math.round(outTok * 0.2),
          },
          insight_generation: {
            calls: Math.round(calls * 0.15),
            costUsd: insight,
            inputTokens: Math.round(inTok * 0.15),
            outputTokens: Math.round(outTok * 0.15),
          },
          chat_tutor: {
            calls: Math.round(calls * 0.25),
            costUsd: chat,
            inputTokens: Math.round(inTok * 0.25),
            outputTokens: Math.round(outTok * 0.25),
          },
        },
        byModel: {
          "gemini-2.0-flash": {
            calls: Math.round(calls * 0.8),
            costUsd: flashUsd,
            inputTokens: Math.round(inTok * 0.8),
            outputTokens: Math.round(outTok * 0.8),
          },
          "gemini-1.5-pro": {
            calls: Math.round(calls * 0.2),
            costUsd: proUsd,
            inputTokens: Math.round(inTok * 0.2),
            outputTokens: Math.round(outTok * 0.2),
          },
        },
        budgetLimitUsd: 0.6,
        budgetUsedPercent: round2((monthUsd / 0.6) * 100),
        budgetAlertSent: monthUsd / 0.6 >= 0.8,
        computedAt: clock.now(),
      },
    });
  }

  // monthly roll-up
  docs.push({
    kind: "costSummary",
    path: Paths.monthlyCostSummary(t, "2025-12"),
    data: {
      id: "2025-12",
      tenantId: t,
      month: "2025-12",
      totalCalls: monthCalls,
      totalInputTokens: monthIn,
      totalOutputTokens: monthOut,
      totalCostUsd: monthUsd,
      byPurpose: {
        answer_grading: { calls: Math.round(monthCalls * 0.4), costUsd: round4(monthUsd * 0.44) },
        question_extraction: {
          calls: Math.round(monthCalls * 0.2),
          costUsd: round4(monthUsd * 0.25),
        },
        insight_generation: {
          calls: Math.round(monthCalls * 0.15),
          costUsd: round4(monthUsd * 0.12),
        },
        chat_tutor: { calls: Math.round(monthCalls * 0.25), costUsd: round4(monthUsd * 0.19) },
      },
      byModel: {
        "gemini-2.0-flash": {
          calls: Math.round(monthCalls * 0.8),
          costUsd: round4(monthUsd * 0.7),
        },
        "gemini-1.5-pro": { calls: Math.round(monthCalls * 0.2), costUsd: round4(monthUsd * 0.3) },
      },
      budgetLimitUsd: 0.6,
      budgetUsedPercent: round2((monthUsd / 0.6) * 100),
      budgetAlertSent: monthUsd / 0.6 >= 0.8,
      computedAt: clock.now(),
    },
  });

  // LlmCallLog — a handful per day for the last 3 days (read-only; written by @levelup/ai)
  const examId = r.examId("exam-math-mid");
  const spaceId = r.spaceId("space-algebra");
  for (let d = 0; d < 3; d++) {
    const dayOffsetMs = -(d * DAY_MS);
    for (let c = 0; c < 4; c++) {
      const purpose = LLM_PURPOSES[c % LLM_PURPOSES.length]!;
      const model = LLM_MODELS[c % LLM_MODELS.length]!;
      const key = `2025-12-${14 - d}:${c}`;
      const id = seedId("llmCallLog", `${r.tenantKey}:${key}`);
      const isError = d === 1 && c === 3;
      docs.push({
        kind: "llmCallLog",
        path: Paths.llmCallLog(t, id),
        data: {
          id,
          tenantId: t,
          functionName: purpose,
          model,
          inputTokens: 820 + c * 130,
          outputTokens: 240 + c * 60,
          totalTokens: 1060 + c * 190,
          costUSD: round4(0.0011 + c * 0.0004),
          latencyMs: 640 + c * 180,
          status: isError ? "error" : "success",
          errorMessage: isError ? "Deadline exceeded" : undefined,
          examId:
            purpose === "answer_grading" || purpose === "question_extraction" ? examId : undefined,
          spaceId: purpose === "chat_tutor" ? spaceId : undefined,
          createdAt: clock.at(dayOffsetMs - c * 7 * MINUTE_MS),
        },
      });
    }
  }

  return docs;
}

interface PrefsOpts {
  muteUntil?: Timestamp | null;
  disabled?: NotificationType[];
}

const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  "exam_results_released",
  "new_exam_assigned",
  "new_space_assigned",
  "submission_graded",
  "grading_complete",
  "student_at_risk",
  "deadline_reminder",
  "space_published",
  "bulk_import_complete",
  "ai_budget_alert",
  "system_announcement",
];

function notificationPrefsDoc(
  r: IdResolver,
  clock: Clock,
  personKey: string,
  _role: NotificationRecipientRole,
  opts: PrefsOpts
): SeedDoc {
  const uid = r.uidOf(personKey);
  const disabled = new Set(opts.disabled ?? []);
  const enabledTypes = ALL_NOTIFICATION_TYPES.filter((tp) => !disabled.has(tp));
  return {
    kind: "notificationPreferences",
    path: Paths.notificationPreferences(r.tenantId, uid),
    data: {
      id: uid,
      tenantId: r.tenantId,
      userId: uid,
      enabledTypes,
      muteUntil: opts.muteUntil ?? null,
      updatedAt: clock.now(),
    },
  };
}

// -- leaderboards (tenant + space + storyPoint scopes) --

function leaderboardDocs(r: IdResolver, clock: Clock): SeedDoc[] {
  const now = clock.now();
  const docs: SeedDoc[] = [];

  // tenant scope — by total XP
  const tenantRanked: { studentKey: string; score: number }[] = [
    { studentKey: "s-priya", score: 3120 },
    { studentKey: "s-aarav", score: 2480 },
    { studentKey: "s-rohan", score: 1920 },
    { studentKey: "s-diya", score: 1180 },
    { studentKey: "s-karan", score: 540 },
  ];
  tenantRanked.forEach((e, idx) => {
    const uid = r.student(e.studentKey).uid;
    const rank = idx + 1;
    const id = seedId("leaderboardEntry", `${r.tenantKey}:tenant:${uid}`);
    docs.push({
      kind: "leaderboardEntry",
      path: `tenants/${r.tenantId}/leaderboards/tenant/entries/${uid}`,
      data: {
        id,
        tenantId: r.tenantId,
        scope: "tenant",
        spaceId: null,
        storyPointId: null,
        userId: uid,
        score: e.score,
        rank,
        tier: tierFor(rank),
        displayName: e.studentKey,
        updatedAt: now,
      },
    });
  });

  // space scope — space-algebra completion points
  const spaceId = r.spaceId("space-algebra");
  const spaceRanked: { studentKey: string; score: number }[] = [
    { studentKey: "s-rohan", score: 6 },
    { studentKey: "s-aarav", score: 5 },
    { studentKey: "s-diya", score: 3 },
  ];
  spaceRanked.forEach((e, idx) => {
    const uid = r.student(e.studentKey).uid;
    const rank = idx + 1;
    const id = seedId("leaderboardEntry", `${r.tenantKey}:space:${spaceId}:${uid}`);
    docs.push({
      kind: "leaderboardEntry",
      path: `tenants/${r.tenantId}/leaderboards/space_${spaceId}/entries/${uid}`,
      data: {
        id,
        tenantId: r.tenantId,
        scope: "space",
        spaceId,
        storyPointId: null,
        userId: uid,
        score: e.score,
        rank,
        tier: tierFor(rank),
        displayName: e.studentKey,
        updatedAt: now,
      },
    });
  });

  // storyPoint scope — sp-equations
  const storyPointId = r.storyPointId("space-algebra", "sp-equations");
  const spRanked: { studentKey: string; score: number }[] = [
    { studentKey: "s-rohan", score: 5 },
    { studentKey: "s-aarav", score: 4 },
  ];
  spRanked.forEach((e, idx) => {
    const uid = r.student(e.studentKey).uid;
    const rank = idx + 1;
    const id = seedId("leaderboardEntry", `${r.tenantKey}:sp:${storyPointId}:${uid}`);
    docs.push({
      kind: "leaderboardEntry",
      path: `tenants/${r.tenantId}/leaderboards/storyPoint_${storyPointId}/entries/${uid}`,
      data: {
        id,
        tenantId: r.tenantId,
        scope: "storyPoint",
        spaceId,
        storyPointId,
        userId: uid,
        score: e.score,
        rank,
        tier: tierFor(rank),
        displayName: e.studentKey,
        updatedAt: now,
      },
    });
  });

  return docs;
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 · NotificationBadgeState (RTDB projection — epoch-ms fenced exception)
// ─────────────────────────────────────────────────────────────────────────────
//
// RTDB lives at `/notifications/{tenantId}/{uid}`; returned separately because it is NOT a
// Firestore doc. `createdAt` deliberately stays epoch-ms (notification.md §3 fence).

export interface BadgeState {
  rtdbPath: string;
  data: {
    unreadCount: number;
    latest?: { id: string; title: string; type: NotificationType; createdAt: number };
  };
}

/** Derive the RTDB unread badge per recipient from the notification overlays (single-writer projection). */
export function notificationBadgeStates(clock: Clock = createFixedClock()): BadgeState[] {
  const states: BadgeState[] = [];
  const epoch = Date.parse(clock.now());
  for (const ks of [GREENWOOD, RIVERSIDE]) {
    const r = resolverFor(ks);
    const overlay = tenantOverlays[ks.tenantKey];
    const notifs = overlay?.notifications ?? [];
    const byRecipient = new Map<string, NotificationConfig[]>();
    for (const n of notifs) {
      const arr = byRecipient.get(n.recipientKey) ?? [];
      arr.push(n);
      byRecipient.set(n.recipientKey, arr);
    }
    for (const [recipientKey, list] of byRecipient) {
      const uid = r.uidOf(recipientKey);
      const unread = list.filter((n) => !n.isRead);
      const latest = list[list.length - 1]!;
      states.push({
        rtdbPath: `/notifications/${r.tenantId}/${uid}`,
        data: {
          unreadCount: unread.length,
          latest: {
            id: seedId("notification", `${r.tenantKey}:${latest.key}`),
            title: latest.title,
            type: latest.type as NotificationType,
            createdAt: epoch,
          },
        },
      });
    }
  }
  return states;
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 · small pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function tierFor(rank: number): LeaderboardTier {
  if (rank === 1) return "diamond";
  if (rank === 2) return "platinum";
  if (rank === 3) return "gold";
  if (rank <= 5) return "silver";
  return "bronze";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** ISO date (YYYY-MM-DD) minus N days. */
function isoDateMinus(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function dedupeByKey<T extends { key: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const it of items) seen.set(it.key, it); // last wins (overlay overrides base)
  return [...seen.values()];
}

function mergeStudentGamification(
  base: StudentGamificationConfig[] | undefined,
  overlay: StudentGamificationConfig[] | undefined
): StudentGamificationConfig[] {
  const byStudent = new Map<string, StudentGamificationConfig>();
  for (const g of base ?? []) byStudent.set(g.studentKey, g);
  for (const g of overlay ?? []) byStudent.set(g.studentKey, g); // overlay wins per student
  return [...byStudent.values()];
}

// re-export for convenience (a caller can prove the slices align with the base tenants)
export { ACHIEVEMENTS as achievementCatalog };
