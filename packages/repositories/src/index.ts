/**
 * `@levelup/repositories` — public surface (THE CLIENT BRAIN, SDK-LAYERS-PLAN
 * §1.2 t3, §4.1).
 *
 * The **identity** agent owns this assembly: `createRepositories(api)` spreads
 * EVERY domain's `create<Domain>Repos(api)` factory into one flat bag keyed by
 * repo name (`spaceRepo`, `studentRepo`, `classRepo`, …). Each domain agent owns
 * its own factory; this barrel composes them. During the parallel build wave it
 * wires the factories that exist (identity + levelup-content today); the
 * typecheck/fix wave reconciles the remaining domains (testsession-progress,
 * gamification, autograde, analytics, views-and-storage-auth) as their barrels
 * land — the bag type stays an open `Record` so an appended repo typechecks
 * without editing this file.
 *
 * Answer-key editor cache-scope helpers (`isSensitiveKey`/`editItemKey`/
 * `EDIT_ITEM_SCOPE`, §4.2) are surfaced at the top level (single canonical source)
 * so `@levelup/query` can exclude sensitive keys from the persisted/offline store.
 *
 * Each domain factory declares its OWN structural `ApiClient` slice (the repos
 * import `@levelup/api-client` + `@levelup/domain` ONLY); the injected client is a
 * superset assignable to each slice, so `createRepositories` casts the shared
 * `api` to each factory's expected seam.
 */
import { createIdentityRepos, type IdentityRepos } from "./identity/index.js";
import type { ApiClient as IdentityApiClient } from "./internal/api-types.js";
import { createLevelupContentRepos, type LevelupContentRepos } from "./levelup-content/index.js";
import type { ApiClientLike } from "./levelup-content/_kit.js";
import {
  createTestSessionProgressRepos,
  type TestSessionProgressRepos,
} from "./testsession-progress/index.js";
import type { ApiClient as TestSessionProgressApiClient } from "./testsession-progress/index.js";
import { createGamificationRepos, type GamificationRepos } from "./gamification/index.js";
import type { ApiClient as GamificationApiClient } from "./gamification/index.js";
import { createAutogradeRepos, type AutogradeRepos } from "./autograde/index.js";
import type { ApiClient as AutogradeApiClient } from "./autograde/index.js";
import { createAnalyticsRepos, type AnalyticsRepos } from "./analytics/index.js";
import type { ApiClient as AnalyticsApiClient } from "./analytics/api-types.js";
import {
  createViewsStorageAuthRepos,
  type ViewsStorageAuthRepos,
} from "./views-and-storage-auth/index.js";
import type { ApiClientSeam as ViewsStorageAuthApiClient } from "./views-and-storage-auth/index.js";

// ---------------------------------------------------------------------------
// Cross-cutting cache-scope helpers (§4.2) — single canonical source.
// ---------------------------------------------------------------------------
export { EDIT_ITEM_SCOPE, editItemKey, isSensitiveKey } from "./internal/sensitive-keys.js";

// ---------------------------------------------------------------------------
// Per-domain factories + repo types on the public surface (apps/query import a
// slice). Identity is wired directly; levelup-content is the sibling already
// landed. `export *` is avoided for the cache-scope names so the canonical
// helpers above stay the single export of that name.
// ---------------------------------------------------------------------------
export { createIdentityRepos } from "./identity/index.js";
export type { IdentityRepos } from "./identity/index.js";
export type {
  MeRepo,
  TenantRepo,
  StudentRepo,
  TeacherRepo,
  ParentEntityRepo,
  StaffRepo,
  AcademicSessionRepo,
  OrgUserRepo,
  AnnouncementRepo,
  NotificationRepo,
  ClassRepo,
  UserSearchRepo,
} from "./identity/index.js";
export type { ApiClient } from "./internal/api-types.js";
export type { PageBag } from "./internal/paginate.js";

export { createLevelupContentRepos, type LevelupContentRepos } from "./levelup-content/index.js";

export { createAutogradeRepos, type AutogradeRepos } from "./autograde/index.js";
export type {
  ExamRepo,
  ExamQuestionRepo,
  SubmissionRepo,
  QuestionSubmissionRepo,
  EvaluationSettingsRepo,
  DeadLetterRepo,
  ExamAnalyticsRepo,
  GradingReviewRepo,
  GradeAiInput,
  GradeManualInput,
  RetryGradingInput,
  ResolveDeadLetterInput,
} from "./autograde/index.js";
// Autograde wire request/response types (the public slice query hooks annotate).
export type {
  GradeQuestionRequest,
  GradeQuestionResponse,
  SaveEvaluationSettingsInput,
  SaveResponse,
  SaveExamInput,
  ResolveDeadLetterRequest,
  ResolveDeadLetterResponse,
  ExtractQuestionsRequest,
  ExtractQuestionsResponse,
  ReleaseResultsRequest,
  ReleaseResultsResponse,
  UploadAnswerSheetsRequest,
  UploadAnswerSheetsResponse,
  ListEvaluationSettingsResponse,
  ListQuestionSubmissionsResponse,
  ListQuestionsResponse,
} from "./autograde/api-types.js";

// --- analytics domain (§2.6) ---
export { createAnalyticsRepos, type AnalyticsRepos } from "./analytics/index.js";
export type {
  InsightRepo,
  CostRepo,
  ReportRepo,
  SummaryRepo,
  TrendsRepo,
  ParentRepo,
  LeaderboardRepo,
} from "./analytics/index.js";
// NB: `ExamAnalyticsRepo` is re-exported by the autograde barrel above; the
// analytics `ExamAnalyticsRepo` (the canonical view repo per analytics.md) is
// reachable via `createAnalyticsRepos`'s return + the `./analytics` entry. The
// name collision is left for the cross-domain typecheck/fix wave to dedupe.

// --- views-and-storage-auth domain (§3.7 C1, §9 C3/C4/C22) ---
export {
  createViewsStorageAuthRepos,
  type ViewsStorageAuthRepos,
} from "./views-and-storage-auth/index.js";
export type {
  StorageRepo,
  UploadImageInput,
  AuthRepo,
  DeviceRepo,
  MeAssetRepo,
} from "./views-and-storage-auth/index.js";

// ---------------------------------------------------------------------------
// The assembled bag. Identity (known) + levelup-content (known) + the open
// `Record` tail for the sibling domains still landing in this wave.
// ---------------------------------------------------------------------------

/** A single repo: a bag of named async/derived methods. */
export type Repo = Record<string, (...args: never[]) => unknown>;

/** The full client-brain repository bag. */
export type Repositories = IdentityRepos &
  LevelupContentRepos &
  TestSessionProgressRepos &
  GamificationRepos &
  AutogradeRepos &
  AnalyticsRepos &
  ViewsStorageAuthRepos &
  Record<string, Repo>;

/**
 * Assemble the full repository bag over an injected `ApiClient` (never the
 * transport — api-client-core.md §5). The same client is passed to each domain
 * factory cast to that factory's structural seam (the real client is a superset
 * assignable to all).
 */
export function createRepositories(api: IdentityApiClient): Repositories {
  const shared = api as unknown;
  const bag: Record<string, Repo> = {
    ...(createIdentityRepos(shared as IdentityApiClient) as unknown as Record<string, Repo>),
    ...(createLevelupContentRepos(shared as ApiClientLike) as unknown as Record<string, Repo>),
    ...(createTestSessionProgressRepos(shared as TestSessionProgressApiClient) as unknown as Record<
      string,
      Repo
    >),
    ...(createGamificationRepos(shared as GamificationApiClient) as unknown as Record<
      string,
      Repo
    >),
    ...(createAutogradeRepos(shared as AutogradeApiClient) as unknown as Record<string, Repo>),
    // analytics last: its `examAnalyticsRepo` is the canonical view repo
    // (analytics.md §examAnalyticsRepo) and wins the bag key over autograde's.
    ...(createAnalyticsRepos(shared as AnalyticsApiClient) as unknown as Record<string, Repo>),
    // views-and-storage-auth: cross-cutting transport-seam repos (storage/auth/
    // device/avatar) — distinct bag keys, no collision with the per-entity repos.
    ...(createViewsStorageAuthRepos(shared as ViewsStorageAuthApiClient) as unknown as Record<
      string,
      Repo
    >),
  };
  return bag as Repositories;
}
