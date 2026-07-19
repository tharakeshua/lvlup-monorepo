/**
 * The query-key registry (query-infra.md §4.2, SDK-LAYERS-PLAN §4.2).
 *
 * `QUERY_KEYS` is a frozen map of every `DomainName` → its key factory, built
 * from the contract's exhaustive `DOMAIN_NAMES` so `keyof typeof QUERY_KEYS ===
 * DomainName` holds (MERGE-DOMAINNAME totality). Named convenience factories
 * (`spaceKeys`, `examKeys`, …) are surfaced for the per-domain hook files.
 */
import { DOMAIN_NAMES } from "@levelup/api-contract";
import { createKeyFactory } from "./key-factory.js";
import type { DomainKeys, DomainName, KeyFactory } from "./types.js";

/**
 * The frozen registry: one factory per `DomainName`. Iterated by the
 * invalidation graph + contract tests; `keyof typeof QUERY_KEYS === DomainName`.
 */
export const QUERY_KEYS: DomainKeys = Object.freeze(
  Object.fromEntries(DOMAIN_NAMES.map((domain) => [domain, createKeyFactory(domain)])) as DomainKeys
);

/** Lookup a factory by domain (typed). */
export function keysFor<D extends DomainName>(domain: D): KeyFactory<D> {
  return QUERY_KEYS[domain];
}

// ---------------------------------------------------------------------------
// Named convenience factories (per-domain hook ergonomics). One per the common
// domains the hook files reach for; every name is a real `DomainName`.
// ---------------------------------------------------------------------------

// identity
export const meKeys = QUERY_KEYS.me;
export const tenantKeys = QUERY_KEYS.tenants;
export const studentKeys = QUERY_KEYS.students;
export const teacherKeys = QUERY_KEYS.teachers;
export const parentKeys = QUERY_KEYS.parents;
export const staffKeys = QUERY_KEYS.staff;
export const classKeys = QUERY_KEYS.classes;
export const sessionKeys = QUERY_KEYS.sessions;
export const academicSessionKeys = QUERY_KEYS.academicSessions;
export const announcementKeys = QUERY_KEYS.announcements;
export const notificationKeys = QUERY_KEYS.notifications;
export const notificationBadgeKeys = QUERY_KEYS.notificationBadge;
export const notificationPreferencesKeys = QUERY_KEYS.notificationPreferences;
export const userSearchKeys = QUERY_KEYS.userSearch;
export const membershipKeys = QUERY_KEYS.memberships;

// levelup content + testsession + gamification
export const spaceKeys = QUERY_KEYS.spaces;
export const storyPointKeys = QUERY_KEYS.storyPoints;
export const itemKeys = QUERY_KEYS.items;
export const versionKeys = QUERY_KEYS.versions;
export const questionBankKeys = QUERY_KEYS.questionBank;
export const rubricPresetKeys = QUERY_KEYS.rubricPresets;
export const chatKeys = QUERY_KEYS.chat;
/**
 * Conversation cache hierarchy. Unlike the generic domain factory this exposes
 * the conventional list/detail prefix helpers plus a transcript-page child key.
 * `detail(sessionId)` intentionally prefixes every `messages(sessionId, page)`
 * key, so one RTDB bump can invalidate the authoritative callable read without
 * putting transcript content into RTDB.
 */
// Derive the root from the exhaustive contract registry, so a contract-root
// rename fails at this query boundary instead of silently minting a stray key.
const CONVERSATION_ROOT = QUERY_KEYS.conversations.all();
const EMPTY_CONVERSATION_PARAMS = {} as const;

export const conversationKeys = {
  all: CONVERSATION_ROOT,
  lists: () => [...CONVERSATION_ROOT, "list"] as const,
  list: <F extends object>(filter: F = EMPTY_CONVERSATION_PARAMS as F) =>
    [...CONVERSATION_ROOT, "list", filter] as const,
  details: () => [...CONVERSATION_ROOT, "detail"] as const,
  detail: (sessionId: string) => [...CONVERSATION_ROOT, "detail", String(sessionId)] as const,
  messages: <P extends object>(sessionId: string, page: P = EMPTY_CONVERSATION_PARAMS as P) =>
    [...CONVERSATION_ROOT, "detail", String(sessionId), "messages", page] as const,
};
export const storeKeys = QUERY_KEYS.store;
export const reviewKeys = QUERY_KEYS.reviews;
export const enrollmentKeys = QUERY_KEYS.enrollment;
export const progressKeys = QUERY_KEYS.progress;
export const testSessionKeys = QUERY_KEYS.testSessions;
export const insightKeys = QUERY_KEYS.insights;
export const leaderboardKeys = QUERY_KEYS.leaderboard;
export const gamificationKeys = QUERY_KEYS.gamification;
export const achievementKeys = QUERY_KEYS.achievements;
export const levelKeys = QUERY_KEYS.levels;
export const studyGoalKeys = QUERY_KEYS.studyGoals;
export const studySessionKeys = QUERY_KEYS.studySessions;
export const studentSummaryKeys = QUERY_KEYS.studentSummary;

// autograde
export const examKeys = QUERY_KEYS.exams;
export const questionKeys = QUERY_KEYS.questions;
export const submissionKeys = QUERY_KEYS.submissions;
export const questionSubmissionKeys = QUERY_KEYS.questionSubmissions;
export const evaluationSettingsKeys = QUERY_KEYS.evaluationSettings;
export const deadLetterKeys = QUERY_KEYS.deadLetter;
export const examAnalyticsKeys = QUERY_KEYS.examAnalytics;
export const gradingReviewKeys = QUERY_KEYS.gradingReview;

// analytics
export const summaryKeys = QUERY_KEYS.summary;
export const trendsKeys = QUERY_KEYS.trends;
export const costKeys = QUERY_KEYS.cost;
export const analyticsKeys = QUERY_KEYS.analytics;
