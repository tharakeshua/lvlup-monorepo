import type {
  ConversationCompletionRecommendation,
  ConversationContentBlock,
  ConversationEvidenceDoc,
  ConversationLease,
  ConversationMessage,
  ConversationMode,
  ConversationSessionDoc,
  ConversationSessionStatus,
  ConversationToolInvocation,
  ConversationTurn,
  ConversationTurnDoc,
  ConversationTurnStatus,
  ConversationMessageId,
  ConversationSessionId,
  ConversationTurnId,
  ItemSubmissionDoc,
  ItemSubmissionEvaluationAttemptDoc,
  ItemSubmissionId,
  StartConversationContext,
} from "@levelup/domain";

/**
 * The `Repos` handle contract (server-shared.md §5.2) — injected as `ctx.repos`.
 *
 * THIS IS THE ONLY SHAPE `@levelup/services` SEES. The concrete implementation in
 * this folder is the single direct-Firestore site (Admin SDK); an in-memory twin
 * (`./testing`) implements the *same* surface for service-unit tests. Both are
 * driven by the T6 conformance suite (tests/sdk/integration/repos-conformance).
 *
 * The interface intentionally mirrors `tests/sdk/fakes/in-memory-repos.ts`
 * (`InMemoryRepos`) — minus the `_*` test-introspection escape hatches, which the
 * testing twin re-adds. Documents move across this boundary as plain
 * `Record<string, unknown>` JSON: the converters (firestore.ts) do the
 * Timestamp↔ISO (D4) + brand strip/restore (D8) work, so services receive
 * already-normalized data and never see a Firestore snapshot or a raw brand.
 */

/** A page of documents + an opaque base64 cursor (null when exhausted). */
export interface RepoPage {
  items: Record<string, unknown>[];
  nextCursor: string | null;
}

export interface ListOptions {
  cursor?: string;
  limit?: number;
  /** Server-side predicate; applied as a Firestore query where possible, else in-memory. */
  filter?: (d: Record<string, unknown>) => boolean;
  /** Equality `where` clauses applied at the query level (field → value). */
  where?: Record<string, unknown>;
  /** Ordering field (default `id`). */
  orderBy?: string;
}

/** A single tenant-scoped entity collection accessor. */
export interface EntityRepo {
  get(tenantId: string, id: string): Promise<Record<string, unknown> | null>;
  /** Server-side N+1 collapse: chunk-of-10 `in` reads + Promise.all (DX-14). */
  getMany(tenantId: string, ids: string[]): Promise<Record<string, unknown>[]>;
  upsert(
    tenantId: string,
    data: Record<string, unknown>,
    now?: string
  ): Promise<{ id: string; created: boolean }>;
  list(tenantId: string, opts?: ListOptions): Promise<RepoPage>;
  delete(tenantId: string, id: string): Promise<void>;
}

/** Exact nested item read used by the conversational runtime.  The legacy
 * `get(tenantId, id)` remains collection-group based for compatibility only. */
export interface ScopedItemRepo extends EntityRepo {
  getScoped(
    tenantId: string,
    spaceId: string,
    storyPointId: string,
    itemId: string
  ): Promise<Record<string, unknown> | null>;
}

/** Flat agents are still scope-checked against the requested space before
 * they are returned to a conversation snapshot builder. */
export interface ScopedAgentRepo extends EntityRepo {
  getScoped(
    tenantId: string,
    spaceId: string,
    agentId: string
  ): Promise<Record<string, unknown> | null>;
}

/** Authority repo: custom claims mint + token revocation (⚷ REVIEW §6.2). */
export interface ClaimsRepo {
  set(uid: string, claims: Record<string, unknown>): Promise<void>;
  get(uid: string): Promise<Record<string, unknown> | null>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

/** Server-only answer-key subcollection (⚷ REVIEW §6.4, rules deny-all). */
export interface AnswerKeyRepo {
  put(tenantId: string, itemId: string, key: Record<string, unknown>): Promise<void>;
  get(tenantId: string, itemId: string): Promise<Record<string, unknown> | null>;
  getScoped(
    tenantId: string,
    spaceId: string,
    storyPointId: string,
    itemId: string
  ): Promise<Record<string, unknown> | null>;
}

/**
 * Frozen exact-path conversation loader.  T-D consumes this rather than the
 * legacy ID-only entity repositories, so a duplicate item under another
 * parent/root can never enter a frozen configuration snapshot.
 */
export interface LevelupContentRepo {
  getSpace(tenantId: string, spaceId: string): Promise<Record<string, unknown> | null>;
  getStoryPoint(
    tenantId: string,
    spaceId: string,
    storyPointId: string
  ): Promise<Record<string, unknown> | null>;
  getItem(
    tenantId: string,
    spaceId: string,
    storyPointId: string,
    itemId: string
  ): Promise<Record<string, unknown> | null>;
  getAnswerKey(
    tenantId: string,
    spaceId: string,
    storyPointId: string,
    itemId: string
  ): Promise<Record<string, unknown> | null>;
  getAgent(
    tenantId: string,
    spaceId: string,
    agentId: string
  ): Promise<Record<string, unknown> | null>;
  getEvaluationSettings(
    tenantId: string,
    settingsId: string
  ): Promise<Record<string, unknown> | null>;
  getRubricPreset(
    tenantId: string,
    rubricPresetId: string
  ): Promise<Record<string, unknown> | null>;
}

export interface IdempotencyBeginResult {
  status: "new" | "committed";
  result?: unknown;
}

/** Atomic idempotency dedupe (MERGE-IDEMPOTENCY, §5.5). */
export interface IdempotencyRepo {
  /**
   * Transactionally create `tenants/{t}/idempotency/{uid}_{key}` with
   * `status:'in_flight'` + lease. Returns the committed result if present;
   * throws `IDEMPOTENCY_CONFLICT` on an unexpired in-flight lease; reclaims a
   * stale (expired-lease) record.
   */
  begin(tenantId: string, uid: string, key: string): Promise<IdempotencyBeginResult>;
  /** Flip `in_flight → committed` storing the result, in the SAME doc. */
  commit(tenantId: string, uid: string, key: string, result: unknown): Promise<void>;
  /** Free a still-`in_flight` lease (the body threw) so an immediate retry can run. */
  release(tenantId: string, uid: string, key: string): Promise<void>;
}

/** Transactional-outbox repo for must-deliver side effects (§5.3). */
export interface OutboxRepo {
  enqueue(tenantId: string, entry: Record<string, unknown>): Promise<void>;
  /**
   * Non-destructive read (SVC-4). Never mutates delivery status — use for
   * DLQ list/resolve and any other outbox introspection. Optional `kind`
   * filters on `_kind` (e.g. `'gradingDeadLetter'`).
   */
  list(tenantId: string, opts?: { kind?: string }): Promise<Record<string, unknown>[]>;
  /**
   * Patch a single outbox row by logical `id` (or Firestore doc id). Used by
   * `resolveDeadLetter` so sibling pending rows are never drained.
   */
  update(tenantId: string, id: string, patch: Record<string, unknown>): Promise<void>;
  /** Read + clear pending rows (drain worker ONLY). */
  drain(tenantId: string): Promise<Record<string, unknown>[]>;
}

export interface AuditRepo {
  write(tenantId: string, entry: Record<string, unknown>): Promise<void>;
}

/** Rate-limit counter store (server-shared §2.6). Atomically increment+read. */
export interface RateLimitRepo {
  /** Increment the `(subject,tier,window)` counter and return the NEW count. */
  hit(subject: string, tier: string, windowKey: string): Promise<number>;
}

/**
 * Transactional authoring write for tenant-scoped conversation agents.
 *
 * `version` is a frozen-configuration source version: it advances only when a
 * semantic field changes, never merely because an author re-saves the same
 * document or changes audit metadata. An optional `expectedVersion` provides a
 * normal optimistic-concurrency guard for callers that need it.
 */
export interface SaveVersionedAgentCreateInput {
  /** Optional deterministic id for imports; ordinary authoring lets Firestore allocate it. */
  id?: string;
  expectedVersion?: 0;
  actorUid: string;
  /** Canonical semantic agent fields only; identity/audit/version fields are rejected. */
  data: Record<string, unknown>;
}

export interface SaveVersionedAgentUpdateInput {
  id: string;
  /** Required optimistic concurrency fence for an existing agent. */
  expectedVersion: number;
  actorUid: string;
  /** Canonical semantic agent fields only; identity/audit/version fields are rejected. */
  data: Record<string, unknown>;
}

export type SaveVersionedAgentInput = SaveVersionedAgentCreateInput | SaveVersionedAgentUpdateInput;

export interface SaveVersionedAgentResult {
  id: string;
  created: boolean;
  semanticChanged: boolean;
  version: number;
  agent: Record<string, unknown>;
}

export interface VersionedAgentRepo {
  save(
    tenantId: string,
    input: SaveVersionedAgentInput,
    now?: string
  ): Promise<SaveVersionedAgentResult>;
}

// ── Conversational runtime persistence ────────────────────────────────────

export type ConversationSessionBase = Pick<
  ConversationSessionDoc,
  "title" | "locale" | "publicConfig" | "configurationSnapshot"
>;

export interface ConversationOpeningMessageInput {
  id: ConversationMessageId;
  content: ConversationContentBlock[];
}

export interface LearnerConversationMessageInput {
  id: ConversationMessageId;
  content: ConversationContentBlock[];
  createdAt: string;
}

export interface AssistantConversationMessageInput {
  id: ConversationMessageId;
  content: ConversationContentBlock[];
  createdAt: string;
  completedAt: string;
}

export interface ConversationPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ConversationListFilter {
  mode?: ConversationMode;
  status?: ConversationSessionStatus;
  contextBaseKey?: string;
  cursor?: string;
  limit?: number;
}

export interface MessagePageRequest {
  cursor?: string;
  limit?: number;
}

/** Version values re-read by start inside its write transaction. */
export interface ConversationSourceVersionCheck {
  resourceType:
    | "space"
    | "story_point"
    | "item"
    | "agent"
    | "evaluation_settings"
    | "answer_key"
    | "rubric";
  spaceId?: string;
  storyPointId?: string;
  resourceId: string;
  expectedVersion?: number;
  expectedCanonicalHash?: string;
}

export interface StartConversationTxInput {
  tenantId: string;
  ownerUid: string;
  learnerStudentId?: string;
  sessionId: ConversationSessionId;
  clientRequestId: string;
  mode: ConversationMode;
  /** Client-safe context with assessment attempt deliberately absent. */
  startContext: StartConversationContext;
  contextBaseKey: string;
  sessionBase: ConversationSessionBase;
  sourceVersionChecks: ConversationSourceVersionCheck[];
  openingMessage?: ConversationOpeningMessageInput;
  now: string;
}

export interface StartConversationTxResult {
  session: ConversationSessionDoc;
  messages: ConversationMessage[];
  /** The deterministic request session or an active context-key session was reused. */
  resumed: boolean;
}

export interface ClaimConversationTurnInput {
  tenantId: string;
  ownerUid: string;
  sessionId: ConversationSessionId;
  turnId: ConversationTurnId;
  clientMessageId: string;
  requestInputHash: string;
  learnerMessage: LearnerConversationMessageInput;
  lease: ConversationLease;
  now: string;
}

export interface ClaimConversationTurnResult {
  outcome: "claimed" | "reclaimed" | "completed_replay" | "terminal_replay";
  session: ConversationSessionDoc;
  turn: ConversationTurnDoc;
  learnerMessage: ConversationMessage;
  assistantMessages: ConversationMessage[];
}

export interface MarkTurnPhaseInput {
  tenantId: string;
  sessionId: ConversationSessionId;
  turnId: ConversationTurnId;
  leaseToken: string;
  status: Extract<ConversationTurnStatus, "model_running" | "tool_running">;
  modelRequestId?: string;
  toolInvocation?: ConversationToolInvocation;
  usageDelta?: ConversationTurnDoc["usageAggregate"];
  now: string;
}

export interface CommitConversationTurnInput {
  tenantId: string;
  sessionId: ConversationSessionId;
  turnId: ConversationTurnId;
  leaseToken: string;
  configurationFingerprint: string;
  assistantMessages: AssistantConversationMessageInput[];
  evidence: ConversationEvidenceDoc[];
  completionRecommendation?: ConversationCompletionRecommendation;
  modelRequestIds: string[];
  usageAggregate: NonNullable<ConversationTurnDoc["usageAggregate"]>;
  now: string;
}

export interface CommitConversationTurnResult {
  session: ConversationSessionDoc;
  turn: ConversationTurnDoc;
  assistantMessages: ConversationMessage[];
  hardLimitAutoFinalize: boolean;
}

export interface FailConversationTurnInput {
  tenantId: string;
  sessionId: ConversationSessionId;
  turnId: ConversationTurnId;
  leaseToken: string;
  error: NonNullable<ConversationTurn["error"]>;
  terminal: boolean;
  now: string;
}

export interface FailConversationTurnResult {
  session: ConversationSessionDoc;
  turn: ConversationTurnDoc;
  hardLimitAutoFinalize: boolean;
}

export type AcquireFinalizationInput = {
  tenantId: string;
  sessionId: ConversationSessionId;
  ownerRequestId: string;
  lease: ConversationLease;
  earlyFinishConfirmed?: boolean;
  now: string;
} & (
  | { source: "learner"; ownerUid: string; earlyFinishConfirmed?: boolean }
  | { source: "hard_limit" | "recovery" }
);

export interface FinalizationClaim {
  outcome: "claimed" | "submission_replay" | "completed_replay";
  session: ConversationSessionDoc;
  frozenThroughSequence: number;
  frozenRevision: number;
  submission?: ItemSubmissionDoc;
}

export interface FreezeSubmissionInput {
  tenantId: string;
  sessionId: ConversationSessionId;
  finalizationLeaseToken: string;
  submissionId: ItemSubmissionId;
  payload: ItemSubmissionDoc["payload"];
  now: string;
}

export interface FreezeSubmissionResult {
  session: ConversationSessionDoc;
  submission: ItemSubmissionDoc;
  replayed: boolean;
}

export interface CompleteConversationFinalizationInput {
  tenantId: string;
  sessionId: ConversationSessionId;
  submissionId: ItemSubmissionId;
  expectedFrozenRevision: number;
  expectedTranscriptHash: string;
  now: string;
}

export interface CompleteConversationFinalizationResult {
  session: ConversationSessionDoc;
  replayed: boolean;
}

export interface AbandonConversationResult {
  session: ConversationSessionDoc;
  replayed: boolean;
}

export interface AbandonConversationInput {
  tenantId: string;
  ownerUid: string;
  sessionId: ConversationSessionId;
  clientRequestId: string;
  now: string;
}

export interface ConversationRepo {
  start(input: StartConversationTxInput): Promise<StartConversationTxResult>;
  getSession(tenantId: string, sessionId: string): Promise<ConversationSessionDoc | null>;
  getTurn(tenantId: string, sessionId: string, turnId: string): Promise<ConversationTurnDoc | null>;
  listSessions(
    tenantId: string,
    ownerUid: string,
    filter: ConversationListFilter
  ): Promise<ConversationPage<ConversationSessionDoc>>;
  listMessages(
    tenantId: string,
    sessionId: string,
    page: MessagePageRequest
  ): Promise<ConversationPage<ConversationMessage>>;
  listRecoveryCandidates(
    tenantId: string,
    now: string,
    limit: number
  ): Promise<ConversationSessionDoc[]>;
  claimTurn(input: ClaimConversationTurnInput): Promise<ClaimConversationTurnResult>;
  markTurnPhase(input: MarkTurnPhaseInput): Promise<ConversationTurn>;
  commitTurn(input: CommitConversationTurnInput): Promise<CommitConversationTurnResult>;
  failTurn(input: FailConversationTurnInput): Promise<FailConversationTurnResult>;
  acquireFinalization(input: AcquireFinalizationInput): Promise<FinalizationClaim>;
  freezeSubmission(input: FreezeSubmissionInput): Promise<FreezeSubmissionResult>;
  completeFinalization(
    input: CompleteConversationFinalizationInput
  ): Promise<CompleteConversationFinalizationResult>;
  abandon(input: AbandonConversationInput): Promise<AbandonConversationResult>;
}

export interface AcquireEvaluationInput {
  tenantId: string;
  submissionId: ItemSubmissionId;
  ownerRequestId: string;
  lease: ConversationLease;
  now: string;
}

export interface EvaluationClaim {
  outcome: "claimed" | "evaluated_replay" | "terminal_failure";
  submission: ItemSubmissionDoc;
  attempt?: ItemSubmissionEvaluationAttemptDoc;
}

export interface CommitSubmissionEvaluationInput {
  tenantId: string;
  submissionId: ItemSubmissionId;
  attemptId: string;
  leaseToken: string;
  evaluation: NonNullable<ItemSubmissionDoc["evaluation"]>;
  now: string;
}

export interface FailSubmissionEvaluationInput {
  tenantId: string;
  submissionId: ItemSubmissionId;
  attemptId: string;
  leaseToken: string;
  error: NonNullable<ItemSubmissionDoc["workflow"]["lastError"]>;
  nextRetryAt?: string;
  now: string;
}

export interface ItemSubmissionRepo {
  get(tenantId: string, submissionId: string): Promise<ItemSubmissionDoc | null>;
  acquireEvaluation(input: AcquireEvaluationInput): Promise<EvaluationClaim>;
  commitEvaluation(input: CommitSubmissionEvaluationInput): Promise<ItemSubmissionDoc>;
  failEvaluation(input: FailSubmissionEvaluationInput): Promise<ItemSubmissionDoc>;
  /** Retry workers must scope to a tenant so they use the per-tenant composite index. */
  listRetryable(tenantId: string, now: string, limit: number): Promise<ItemSubmissionDoc[]>;
  listRecoveryCandidates(
    tenantId: string,
    now: string,
    limit: number
  ): Promise<ItemSubmissionDoc[]>;
}

/** Atomic-handle passed to `tx()` — staged outbox commits only on success. */
export interface TxHandle {
  get(
    coll: EntityCollectionName,
    tenantId: string,
    id: string
  ): Promise<Record<string, unknown> | null>;
  upsert(
    coll: EntityCollectionName,
    tenantId: string,
    data: Record<string, unknown>
  ): { id: string };
  enqueueOutbox(tenantId: string, entry: Record<string, unknown>): void;
}

/** The names of the tenant-scoped entity collections exposed on `Repos`. */
export type EntityCollectionName =
  | "spaces"
  | "storyPoints"
  | "items"
  | "tenants"
  | "students"
  | "teachers"
  | "classes"
  | "exams"
  | "submissions"
  | "testSessions"
  | "progressDocs"
  | "notifications"
  | "announcements";

/**
 * The injected admin-repo handle. Services touch Firestore ONLY through this.
 * Both the real Admin-SDK adapter and the in-memory testing twin satisfy it.
 */
export interface Repos {
  // entity repos
  spaces: EntityRepo;
  storyPoints: EntityRepo;
  items: ScopedItemRepo;
  tenants: EntityRepo;
  students: EntityRepo;
  teachers: EntityRepo;
  classes: EntityRepo;
  exams: EntityRepo;
  submissions: EntityRepo;
  testSessions: EntityRepo;
  progressDocs: EntityRepo;
  notifications: EntityRepo;
  announcements: EntityRepo;

  // authority repos
  claims: ClaimsRepo;
  answerKeys: AnswerKeyRepo;
  idempotency: IdempotencyRepo;
  outbox: OutboxRepo;
  audit: AuditRepo;
  /** Per-(subject,tier,window) atomic rate-limit counter (server-shared §2.6). */
  rateLimits: RateLimitRepo;

  /** Transactional semantic-version writer for `tenants/{t}/agents/{id}`. */
  agentVersions: VersionedAgentRepo;

  /** Durable conversation/session/turn authority; callable/Admin SDK only. */
  conversations: ConversationRepo;

  /** Immutable assessment-submission workflow and evaluation lease authority. */
  itemSubmissions: ItemSubmissionRepo;

  /** Exact-path content/configuration reads for frozen conversation snapshots. */
  levelupContent: LevelupContentRepo;

  /** Single-writer transactional progress aggregator (testsession-progress §progressUpdater). */
  progress: ProgressRepo;

  /** Run a body atomically. On throw, all writes since begin roll back. */
  tx<T>(body: (tx: TxHandle) => Promise<T>): Promise<T>;

  // cursor helpers (base64; must match the testing twin)
  encodeCursor(value: unknown): string;
  decodeCursor(cursor: string): unknown;
}

/** A single per-item progress contribution handed to the progress writer. */
export interface ProgressItemUpdate {
  storyPointId: string;
  itemId: string;
  score: number;
  maxScore: number;
  correct: boolean;
  timeSpentMs?: number;
  /** Cost/answer-stripped client-readable evaluation projection (StoredEvaluation). */
  evaluation?: Record<string, unknown>;
}

export interface ProgressUpdateInput {
  userId: string;
  spaceId: string;
  items: ProgressItemUpdate[];
  /** Total story points in the space, for completion detection. */
  totalStoryPoints?: number;
}

/** Per-story-point rollup slice returned by the progress writer (bounded numerics). */
export interface ProgressStoryPointRollup {
  storyPointId: string;
  pointsEarned: number;
  totalPoints: number;
  completed: boolean;
}

export interface ProgressUpdateResult {
  spaceProgressId: string;
  completed: boolean;
  pointsEarned: number;
  totalPoints: number;
  /**
   * The transaction's per-story-point rollup — feeds the `spaceProgressLive`
   * RTDB projection (AD-12) without a post-tx re-read. Bounded numerics only.
   */
  storyPoints: Record<string, ProgressStoryPointRollup>;
}

/** Frozen alias used by the conversation workflow contract. */
export type ProgressResult = ProgressUpdateResult;

/**
 * Single transactional progress writer (the BRAIN of testsession-progress).
 * Read-modify-write on the aggregate doc inside one Firestore tx so N concurrent
 * AI-item completions serialize (Firestore aborts+retries on contention).
 */
export interface ProgressRepo {
  update(tenantId: string, input: ProgressUpdateInput, now?: string): Promise<ProgressUpdateResult>;
  applySubmission(
    tenantId: string,
    submissionId: ItemSubmissionId,
    now?: string
  ): Promise<{ applied: boolean; progress: ProgressResult }>;
  get(tenantId: string, userId: string, spaceId: string): Promise<Record<string, unknown> | null>;
}

/** Options accepted by `createRepos()` / the testing twin. */
export interface CreateReposOptions {
  /** Injected clock (ISO-8601). Defaults to `new Date().toISOString()`. */
  now?: () => string;
  /** Idempotency lease TTL in ms (default 5 min). */
  idempotencyLeaseMs?: number;
}
