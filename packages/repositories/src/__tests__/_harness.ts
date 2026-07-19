/**
 * Shared local harness for the @levelup/repositories unit/contract suite
 * (MERGE-REPOSITORIES-PLAN / SDK-LAYERS-PLAN §4.1, §3.1, §4.4).
 *
 * Every repositories test runs over the FAKE ApiClient seam (no emulator). The
 * impl is being built in parallel, so each suite self-skips until
 * `createRepositories` (and friends) are exported. This module centralizes the
 * "is the package ready?" probe + loosely-typed views of the public surface so
 * each test file stays focused on the invariant it locks.
 *
 * Plan anchors:
 *   • §4.1 "Every repo owns paginate() opaque-cursor mgmt, getMany(ids) N+1
 *     collapse, canTransition pre-checks reading ALLOWED_TRANSITIONS, derived
 *     fields computed once."
 *   • §4.1 "Repos never import sibling repos except declared views (R6 lint)."
 *   • repositories.md (5): createRepositories(api) fake-ApiClient test seam.
 */
import * as reposModule from "../index";

/** Loosely-typed mirror of the public @levelup/repositories surface. */
export interface ReposSurface {
  createRepositories?: (api: unknown) => ReposBag;
  isSensitiveKey?: (key: readonly unknown[]) => boolean;
  editItemKey?: (itemId: string) => readonly unknown[];
  EDIT_ITEM_SCOPE?: string;
  /** Optional MERGE-REPOSITORIES-PLAN view-repo registry (names of view repos). */
  VIEW_REPO_NAMES?: readonly string[];
}

export type RepoMethod = (...a: unknown[]) => Promise<unknown> | unknown;
export type Repo = Record<string, RepoMethod>;
export type ReposBag = Record<string, Repo>;

export const R = reposModule as unknown as ReposSurface;

/** The package exports its factory → the real suite runs; else self-skip. */
export const ready = (): boolean => typeof R.createRepositories === "function";

/** Build the repos bag (guarded — only call inside a `ready()`-gated suite). */
export function buildRepos(api: unknown): ReposBag {
  return R.createRepositories!(api);
}

/**
 * The 12 cross-entity VIEW repos (§4.1) — the ONLY repos allowed to compose
 * other repos (`src/views/**`, R6 exception). Used by the import-isolation +
 * view-assembly suites.
 */
export const VIEW_REPO_NAMES = [
  "classRepo",
  "userSearchRepo",
  "spaceDetailViewRepo",
  "studentSummaryRepo",
  "gamificationViewRepo",
  "leaderboardRepo",
  "summaryRepo",
  "trendsRepo",
  "parentRepo",
  "examAnalyticsRepo",
  "gradingReviewRepo",
  "notificationCenterRepo",
] as const;

/** Per-entity repos (§4.1) that must NOT compose siblings (R6). */
export const PER_ENTITY_REPO_NAMES = [
  // identity
  "meRepo",
  "tenantRepo",
  "studentRepo",
  "teacherRepo",
  "parentRepoEntity",
  "staffRepo",
  "academicSessionRepo",
  "orgUserRepo",
  "announcementRepo",
  "notificationRepo",
  // levelup
  "spaceRepo",
  "storyPointRepo",
  "itemRepo",
  "questionBankRepo",
  "rubricPresetRepo",
  "agentRepo",
  "chatRepo",
  "conversationRepo",
  "storeRepo",
  "versionRepo",
  // testsession
  "testSessionRepo",
  "progressRepo",
  "learningInsightRepo",
  "evaluationRepo",
  // gamification
  "achievementRepo",
  "studentLevelRepo",
  "studyGoalRepo",
  "studySessionRepo",
  // autograde
  "examRepo",
  "examQuestionRepo",
  "submissionRepo",
  "questionSubmissionRepo",
  "evaluationSettingsRepo",
  "deadLetterRepo",
  // analytics
  "insightRepo",
  "costRepo",
  "reportRepo",
] as const;

/** Allowed IO/derived method verbs (repositories.md (1) method-naming convention). */
export const ALLOWED_VERB_PREFIXES = [
  "list",
  "get",
  "getMany",
  "save",
  "paginate",
  "fetchNextPage",
  "can",
  "is",
  "compute",
  "resolve",
  // domain-specific IO verbs explicitly named in §4.1 / §3.7
  "record",
  "requestUploadUrl",
  "uploadImage",
  "listForUser",
  "listAlerts",
  // identity domain-specific IO verbs explicitly named in identity.md
  // ("meRepo.switchTenant/joinByCode", "tenantRepo.lookupByCode/exportData/
  //  uploadAsset", "orgUserRepo.create/bulkImport*/bulkUpdateStatus",
  //  "notificationRepo.markRead/markAllRead/subscribeBadge")
  "switch",
  "join",
  "lookup",
  "export",
  "upload",
  "create",
  "bulk",
  "mark",
  "subscribe",
  "search",
  // views-and-storage-auth domain verbs explicitly named in SDK-LAYERS-PLAN §9
  // C3 (`authRepo.signIn/signOut/sendPasswordReset/restoreSession/onAuthState`)
  // and C4 (`deviceRepo.register/unregister`).
  "sign",
  "send",
  "start",
  "finish",
  "abandon",
  "restore",
  "register",
  "unregister",
] as const;
