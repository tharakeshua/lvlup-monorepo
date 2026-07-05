/**
 * Extended repo surface for the identity / testsession-progress / gamification /
 * notification services.
 *
 * The base `Repos` seam (`repo-admin/types.ts`) is deliberately minimal — it
 * exposes the generic `EntityRepo` collections + authority repos that the
 * content/autograde services need. The identity + levelup-runtime services need a
 * few additional authority repos (memberships/claims helpers, consumer profiles,
 * notification badge, devices, the gamification/leaderboard/insight writers, and
 * the per-session submission subcollection).
 *
 * Rather than duplicate the seam, these are declared here as an EXTENSION the
 * concrete `@levelup/services/repo-admin` adapter (built in this same wave) grows
 * to satisfy; the typecheck/fix wave reconciles drift. `xrepos(ctx)` is the typed
 * accessor every service in these domains uses so it never reaches a raw
 * `Record<string,unknown>` repo by accident.
 *
 * Nothing here imports firebase-admin — these are pure interface shapes over the
 * injected seam.
 */
import type { AuthContext, SystemContext } from "./context.js";
import type { Repos, EntityRepo, TxHandle } from "../repo-admin/types.js";

type Doc = Record<string, unknown>;

/** Auth-user directory (Admin Auth bridge; profile read/update). */
export interface UserRepo {
  get(uidOrEmail: string): Promise<Doc | null>;
  updateProfile(uid: string, patch: { displayName?: string; photoURL?: string }): Promise<void>;
  create(input: {
    email?: string;
    displayName?: string;
    password?: string;
  }): Promise<{ uid: string }>;
}

/** Membership authority repo (⚷ Admin-SDK write only; rules `write:if false`). */
export interface MembershipRepo {
  get(uid: string, tenantId: string): Promise<Doc | null>;
  listForUser(uid: string): Promise<Doc[]>;
  getManagedClassIds(uid: string, tenantId: string): Promise<string[]>;
  upsert(
    uid: string,
    tenantId: string,
    data: Doc,
    now?: string
  ): Promise<{ id: string; created: boolean }>;
  setStatus(uid: string, tenantId: string, status: string, now?: string): Promise<void>;
}

/** Consumer (B2C) profile + enrollment authority (purchaseSpace is the only writer). */
export interface ConsumerProfileRepo {
  get(uid: string): Promise<Doc | null>;
  enroll(tx: TxHandle, uid: string, spaceId: string, record: Doc): void;
  isEnrolled(uid: string, spaceId: string): Promise<boolean>;
}

/** Notification badge state (RTDB epoch-ms fenced; single writer = emitNotificationService). */
export interface BadgeRepo {
  get(uid: string, tenantId: string): Promise<Doc>;
  set(uid: string, tenantId: string, state: Doc): Promise<void>;
}

/** Per-user notification read-state + counter (recipient flips only own isRead). */
export interface NotificationReadRepo {
  markRead(
    tenantId: string,
    uid: string,
    notificationId: string | null,
    now: string
  ): Promise<number>;
  getPreferences(tenantId: string, uid: string): Promise<Doc | null>;
  savePreferences(tenantId: string, uid: string, prefs: Doc, now: string): Promise<Doc>;
  unreadCount(tenantId: string, uid: string): Promise<number>;
}

/** Owner-write announcement `/reads/{uid}` subcollection. */
export interface AnnouncementReadRepo {
  markRead(tenantId: string, announcementId: string, uid: string, now: string): Promise<void>;
  isReadBy(tenantId: string, announcementId: string, uid: string): Promise<boolean>;
}

/** Device push-token registry (C4). */
export interface DeviceRepo {
  register(
    uid: string,
    tenantId: string,
    token: string,
    platform: string,
    appKey: string,
    now: string
  ): Promise<void>;
  unregister(uid: string, tenantId: string, token: string): Promise<void>;
  tokensForUser(uid: string, tenantId: string): Promise<string[]>;
}

/** Per-session item submissions (always-subcollection; D6). */
export interface TestSubmissionRepo {
  list(tenantId: string, sessionId: string): Promise<Doc[]>;
  put(tx: TxHandle, tenantId: string, sessionId: string, submission: Doc): void;
  get(tenantId: string, sessionId: string, itemId: string): Promise<Doc | null>;
}

/** Per-storyPoint progress docs (per-item docs / capped; D6). */
export interface StoryPointProgressRepo {
  get(tenantId: string, uid: string, spaceId: string, storyPointId: string): Promise<Doc | null>;
}

/** Gamification authority repos (achievements / level — single writer). */
export interface GamificationRepo {
  getSummary(tenantId: string, uid: string): Promise<Doc>;
  getStudentLevel(tenantId: string, uid: string): Promise<Doc>;
  earnedAchievementIds(tenantId: string, uid: string): Promise<Set<string>>;
  awardAchievement(tx: TxHandle, tenantId: string, uid: string, achievement: Doc): void;
  markSeen(tenantId: string, uid: string, ids: string[] | "all", now: string): Promise<number>;
  applyLevelDelta(tx: TxHandle, tenantId: string, uid: string, xpDelta: number, now: string): void;
  saveDefinition(
    tenantId: string,
    input: { id?: string; data: Doc },
    now: string
  ): Promise<{ id: string; created: boolean }>;
  listSessions(
    tenantId: string,
    uid: string,
    range: { fromDate?: string; toDate?: string }
  ): Promise<{ sessions: Doc[]; streakDays: number; longestStreak: number }>;
}

/** Leaderboard read-model + single writer (RTDB runTransaction node). */
export interface LeaderboardRepo {
  getPage(
    tenantId: string,
    scope: string,
    params: { spaceId?: string; storyPointId?: string },
    opts: { cursor?: string; limit?: number }
  ): Promise<{ items: Doc[]; nextCursor: string | null }>;
  callerEntry(
    tenantId: string,
    uid: string,
    scope: string,
    params: { spaceId?: string; storyPointId?: string }
  ): Promise<Doc | null>;
  upsertEntry(tenantId: string, scope: string, entry: Doc): Promise<void>;
}

/** Learning-insight read + dismiss (testsession-owned). */
export interface InsightRepo {
  list(
    tenantId: string,
    filter: { studentId?: string; type?: string; cursor?: string; limit?: number }
  ): Promise<{ items: Doc[]; nextCursor: string | null }>;
  dismiss(tenantId: string, uid: string, insightId: string, now: string): Promise<void>;
}

/** Study-goal read + write (server-derived progress). */
export interface StudyGoalRepo {
  list(
    tenantId: string,
    uid: string,
    opts: { includeCompleted?: boolean; cursor?: string; limit?: number }
  ): Promise<{ items: Doc[]; nextCursor: string | null }>;
  save(
    tenantId: string,
    uid: string,
    input: { id?: string; data: Doc },
    now: string
  ): Promise<{ id: string; created: boolean }>;
}

/** Secret-manager bridge for `geminiApiKey` ingest (SEC-09). */
export interface SecretRepo {
  put(tenantId: string, key: string): Promise<{ secretRef: string }>;
}

/** Chat sessions + always-subcollection messages (sendChatMessage writer). */
export interface ChatRepo {
  getSession(tenantId: string, sessionId: string): Promise<Doc | null>;
  createSession(tenantId: string, data: Doc): Promise<string>;
  appendMessage(tenantId: string, sessionId: string, message: Doc): Promise<string>;
  /** Ordered (asc by `timestamp`) messages of a session — the getChatSession read. */
  listMessages(tenantId: string, sessionId: string): Promise<Doc[]>;
  /** Caller's own sessions, most-recently-updated first (listChatSessions read). */
  listSessions(
    tenantId: string,
    uid: string,
    filter: { spaceId?: string; itemId?: string; cursor?: string; limit?: number }
  ): Promise<{ items: Doc[]; nextCursor: string | null }>;
}

/** Read-token revocation list / impersonation-session ledger. */
export interface ImpersonationRepo {
  openSession(tx: TxHandle, record: Doc): { sessionId: string };
  endSession(tx: TxHandle, sessionId: string, now: string): void;
}

/** B2C store reviews — nested `spaces/{spaceId}/reviews/{uid}`, one doc per reviewer. */
export interface SpaceReviewRepo {
  get(tenantId: string, spaceId: string, uid: string): Promise<Doc | null>;
  upsert(
    tenantId: string,
    spaceId: string,
    uid: string,
    data: Doc
  ): Promise<{ id: string; created: boolean }>;
  list(
    tenantId: string,
    spaceId: string,
    filter?: { cursor?: string; limit?: number }
  ): Promise<{ items: Doc[]; nextCursor: string | null }>;
}

/** ContentVersion change-log — legacy-compatible `spaces/{spaceId}/versions`. */
export interface ContentVersionRepo {
  list(
    tenantId: string,
    spaceId: string,
    filter?: { cursor?: string; limit?: number }
  ): Promise<{ items: Doc[]; nextCursor: string | null }>;
  add(
    tenantId: string,
    spaceId: string,
    entry: {
      entityType: string;
      entityId: string;
      changeType: string;
      changeSummary: string;
      changedBy: string;
    }
  ): Promise<string>;
}

/** Top-level `platformActivityLog` feed (super-admin dashboard read). */
export interface PlatformActivityRepo {
  list(filter?: {
    action?: string;
    tenantId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Doc[]; nextCursor: string | null }>;
}

/** Canonical `tenants/{t}/costSummaries` accessor (`daily_*` / `monthly_*` ids). */
export interface CostSummariesRepo {
  daily(tenantId: string, dateYmd: string): Promise<Doc | null>;
  monthly(tenantId: string, monthYm: string): Promise<Doc | null>;
  listDaily(
    tenantId: string,
    filter?: { date?: string; from?: string; to?: string; limit?: number }
  ): Promise<Doc[]>;
  listMonthly(tenantId: string, filter?: { month?: string; limit?: number }): Promise<Doc[]>;
}

/** Audit repo extended with the in-tx variant (fail-closed impersonation audit). */
export interface AuditRepoExt {
  write(tenantId: string, entry: Doc): Promise<void>;
  writeInTx(
    tx: TxHandle,
    actorUid: string,
    action: string,
    target: { type: string; id: string },
    meta?: Doc
  ): void;
}

/** The superset of repos the identity / levelup-runtime / notification services use. */
export interface ExtendedRepos extends Repos {
  users: UserRepo;
  memberships: MembershipRepo;
  consumerProfiles: ConsumerProfileRepo;
  badges: BadgeRepo;
  notificationReads: NotificationReadRepo;
  announcementReads: AnnouncementReadRepo;
  devices: DeviceRepo;
  testSubmissions: TestSubmissionRepo;
  storyPointProgress: StoryPointProgressRepo;
  gamification: GamificationRepo;
  leaderboard: LeaderboardRepo;
  insights: InsightRepo;
  studyGoals: StudyGoalRepo;
  secrets: SecretRepo;
  impersonation: ImpersonationRepo;
  chat: ChatRepo;
  /** Audit with the in-tx variant (overrides the base `audit`). */
  audit: AuditRepoExt;
  /** Convenience aliases onto the base generic collections. */
  parents: EntityRepo;
  staff: EntityRepo;
  academicSessions: EntityRepo;
  presets: EntityRepo;
  /** Analytics materialized-projection collections (dedicated, tenant-scoped). */
  studentSummaries: EntityRepo;
  classSummaries: EntityRepo;
  examAnalytics: EntityRepo;
  analyticsInsights: EntityRepo;
  /** Autograde evaluation-settings (dedicated collection, NOT the tenants repo). */
  evaluationSettings: EntityRepo;
  /** Levelup authoring collections (LVL-2 — flat tenant-scoped, seed-Paths names). */
  agents: EntityRepo;
  rubricPresets: EntityRepo;
  questionBank: EntityRepo;
  /** Class-assignment metadata rows (`{contentType}_{contentId}_{classId}` ids). */
  assignments: EntityRepo;
  /** Nested-under-space collections (LVL-2). */
  spaceReviews: SpaceReviewRepo;
  contentVersions: ContentVersionRepo;
  /** Platform reads (LVL-2 super-admin replacement callables). */
  platformActivity: PlatformActivityRepo;
  costSummaries: CostSummariesRepo;
}

/**
 * Typed accessor for the extended repo surface. The concrete adapter satisfies
 * `ExtendedRepos`; this cast is the single, audited bridge so individual services
 * stay clean. (When the seam grows these repos natively, the cast becomes a no-op.)
 */
export function xrepos(ctx: AuthContext | SystemContext): ExtendedRepos {
  return ctx.repos as unknown as ExtendedRepos;
}
