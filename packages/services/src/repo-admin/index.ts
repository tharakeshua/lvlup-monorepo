/**
 * `@levelup/services/repo-admin` — THE ONLY direct-Firestore code (Admin SDK).
 *
 * `createRepos()` assembles the injected `ctx.repos` handle: per-entity collection
 * accessors, the nested-content item repo (D1), the single-writer progress
 * aggregator, and the authority repos (claims / answerKeys / idempotency / outbox
 * / audit). Services touch Firestore ONLY through this surface; the lint boundary
 * forbids `firebase-admin/*` imports anywhere outside this folder.
 *
 * The `Repos` interface + cursor/path helpers are re-exported so siblings
 * (services, functions-shared, ai) type against the contract without importing
 * firebase-admin themselves.
 */
import { auth, db } from "./firestore.js";
import { makeEntityRepo } from "./entity-repo.js";
import { makeItemRepo } from "./item-repo.js";
import { makeProgressRepo } from "./progress.js";
import { makeTx } from "./tx.js";
import { encodeCursor, decodeCursor } from "./cursor.js";
import {
  makeAnswerKeyRepo,
  makeAuditRepo,
  makeClaimsRepo,
  makeIdempotencyRepo,
  makeOutboxRepo,
  makeRateLimitRepo,
} from "./authority.js";
import { makeTenantRepo } from "./tenant-repo.js";
import { tenantDoc } from "./paths.js";
import {
  makeUserRepo,
  makeMembershipRepo,
  makeConsumerProfileRepo,
  makeBadgeRepo,
  makeNotificationReadRepo,
  makeAnnouncementReadRepo,
  makeDeviceRepo,
  makeTestSubmissionRepo,
  makeStoryPointProgressRepo,
  makeGamificationRepo,
  makeLeaderboardRepo,
  makeInsightRepo,
  makeStudyGoalRepo,
  makeSecretRepo,
  makeImpersonationRepo,
  makeChatRepo,
} from "./extended.js";
import type { CreateReposOptions, Repos } from "./types.js";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;

/** Build the Admin-SDK-backed `Repos` handle injected as `ctx.repos`. */
export function createRepos(options: CreateReposOptions = {}): Repos {
  const firestore = db();
  const adminAuth = auth();
  const now = options.now ?? (() => new Date().toISOString());
  const leaseMs = options.idempotencyLeaseMs ?? DEFAULT_LEASE_MS;

  const entity = (name: string) => makeEntityRepo(firestore, name, now);
  const auditRepo = makeAuditRepo(firestore, now);

  // The extended-repo surface (`shared/extended-repos.ts`) the identity /
  // levelup-runtime / notification / gamification services reach via `xrepos(ctx)`.
  // `createRepos()` returns a structural SUPERSET (`ExtendedRepos`) so no service
  // crashes on an undefined repo; `xrepos` casts the base `Repos` to this superset.
  const extended = {
    tenants: makeTenantRepo(firestore, now), // top-level `tenants/{id}` (NOT nested)
    users: makeUserRepo(firestore, adminAuth, now),
    memberships: makeMembershipRepo(firestore, now),
    consumerProfiles: makeConsumerProfileRepo(firestore, now),
    badges: makeBadgeRepo(firestore, now),
    notificationReads: makeNotificationReadRepo(firestore, now),
    announcementReads: makeAnnouncementReadRepo(firestore, now),
    devices: makeDeviceRepo(firestore, now),
    testSubmissions: makeTestSubmissionRepo(firestore, now),
    storyPointProgress: makeStoryPointProgressRepo(firestore),
    gamification: makeGamificationRepo(firestore, now),
    leaderboard: makeLeaderboardRepo(firestore, now),
    insights: makeInsightRepo(firestore, now),
    studyGoals: makeStudyGoalRepo(firestore, now),
    secrets: makeSecretRepo(firestore, now),
    impersonation: makeImpersonationRepo(firestore, now),
    chat: makeChatRepo(firestore, now),
    // generic-collection aliases the services reference by friendly name.
    parents: entity("parents"),
    staff: entity("staff"),
    academicSessions: entity("academicSessions"),
    presets: entity("globalEvaluationPresets"),
    // analytics materialized-projection collections (dedicated, tenant-scoped).
    studentSummaries: entity("studentProgressSummaries"),
    classSummaries: entity("classProgressSummaries"),
    examAnalytics: entity("examAnalytics"),
    analyticsInsights: entity("insights"),
    // autograde evaluation-settings (its own collection, NOT the tenants repo).
    evaluationSettings: entity("evaluationSettings"),
    // AI-gateway cost/usage seam (`@levelup/ai` `AiRepos`: llm + costSummaries).
    llm: {
      async log(params: Record<string, unknown>) {
        const ref = firestore
          .collection(`${tenantDoc(String(params["tenantId"]))}/llmCallLogs`)
          .doc();
        const rec = { ...params, id: ref.id, createdAt: now() };
        await ref.set(rec);
        return rec;
      },
      async sumCostUsd(tenantId: string, fromIso: string, toIso: string) {
        const snap = await firestore
          .collection(`${tenantDoc(tenantId)}/llmCallLogs`)
          .where("createdAt", ">=", fromIso)
          .where("createdAt", "<", toIso)
          .get();
        return snap.docs.reduce(
          (s, d) => s + ((d.data()["costUSD"] as number | undefined) ?? 0),
          0
        );
      },
      async countCalls(tenantId: string, fromIso: string, toIso: string) {
        const snap = await firestore
          .collection(`${tenantDoc(tenantId)}/llmCallLogs`)
          .where("createdAt", ">=", fromIso)
          .where("createdAt", "<", toIso)
          .get();
        return snap.size;
      },
    },
    costSummaries: {
      async daily(tenantId: string, dateYmd: string) {
        const snap = await firestore
          .doc(`${tenantDoc(tenantId)}/costSummaries/daily_${dateYmd}`)
          .get();
        return snap.exists ? (snap.data() as Record<string, unknown>) : null;
      },
      async monthly(tenantId: string, monthYm: string) {
        const snap = await firestore
          .doc(`${tenantDoc(tenantId)}/costSummaries/monthly_${monthYm}`)
          .get();
        return snap.exists ? (snap.data() as Record<string, unknown>) : null;
      },
    },
    // audit + in-tx variant (fail-closed impersonation audit).
    audit: Object.assign(auditRepo, {
      writeInTx(
        _tx: unknown,
        actorUid: string,
        action: string,
        target: { type: string; id: string },
        meta?: Record<string, unknown>
      ) {
        void auditRepo.write("__platform__", { actorUid, action, target, ...(meta ?? {}) });
      },
    }),
  };

  return {
    spaces: entity("spaces"),
    storyPoints: entity("storyPoints"),
    items: makeItemRepo(firestore, now),
    students: entity("students"),
    teachers: entity("teachers"),
    classes: entity("classes"),
    exams: entity("exams"),
    submissions: entity("submissions"),
    testSessions: entity("digitalTestSessions"),
    progressDocs: entity("spaceProgress"),
    notifications: entity("notifications"),
    announcements: entity("announcements"),

    claims: makeClaimsRepo(adminAuth),
    answerKeys: makeAnswerKeyRepo(firestore, now),
    idempotency: makeIdempotencyRepo(firestore, now, leaseMs),
    outbox: makeOutboxRepo(firestore, now),
    rateLimits: makeRateLimitRepo(firestore, now),
    progress: makeProgressRepo(firestore, now),

    tx: makeTx(firestore, now),

    encodeCursor,
    decodeCursor,

    ...extended,
  } as Repos;
}

export type {
  Repos,
  EntityRepo,
  EntityCollectionName,
  ClaimsRepo,
  AnswerKeyRepo,
  IdempotencyRepo,
  IdempotencyBeginResult,
  OutboxRepo,
  AuditRepo,
  RateLimitRepo,
  ProgressRepo,
  ProgressUpdateInput,
  ProgressUpdateResult,
  ProgressItemUpdate,
  TxHandle,
  ListOptions,
  RepoPage,
  CreateReposOptions,
} from "./types.js";

export { encodeCursor, decodeCursor, encodePageCursor, decodePageCursor } from "./cursor.js";
export type { CursorPayload } from "./cursor.js";
export { BatchWriter, chunk, IN_CHUNK_SIZE } from "./batch-writer.js";
export { IDEMPOTENCY_CONFLICT, makeIdempotencyConflict } from "./errors.js";
export * as paths from "./paths.js";
export {
  db,
  auth,
  adminApp,
  fromFirestore,
  toFirestore,
  docFromFirestore,
  _resetFirestoreSingletons,
} from "./firestore.js";
