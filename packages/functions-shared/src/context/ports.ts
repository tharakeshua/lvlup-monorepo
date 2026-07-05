/**
 * Injected-port type seams (server-shared.md §4.2, §5.2).
 *
 * `@levelup/functions-shared` sits BELOW `@levelup/repositories-admin` and
 * `@levelup/ai` in the wiring graph but ABOVE them in dependency order is NOT
 * allowed — instead it depends on their *shapes* structurally so the adapters can
 * inject `repos`/`ai` into the `AuthContext` without importing those packages here.
 *
 * The reconciliation wave replaces these local structural seams with
 * `import type { Repos } from '@levelup/repositories-admin'` and
 * `import type { AiGateway } from '@levelup/ai'` once those packages export them.
 * They are intentionally minimal — only the members this adapter layer touches
 * directly (idempotency, outbox, audit, tenants, memberships) are named; the rest
 * is an index signature so the full repo surface passes through to services.
 */
import type {
  TenantId,
  UserId,
  ClassId,
  Timestamp,
  PlatformClaims,
  TenantFeatures,
} from "@levelup/domain";
import type { JsonValue } from "@levelup/api-contract";

/** A transaction handle the admin adapter hands services for atomic state+outbox writes. */
export interface TxHandle {
  /** Read inside the transaction. */
  get<T>(path: string): Promise<T | null>;
  /** Stage a set inside the transaction. */
  set(path: string, data: unknown): void;
  /** Stage a merge update inside the transaction. */
  update(path: string, data: unknown): void;
  /** Stage a delete inside the transaction. */
  delete(path: string): void;
}

/** Idempotency dedupe store (server-shared.md §2.7 / §5.1). */
export interface IdempotencyRepo {
  /** Returns the cached response if (uid,key) already committed; else marks in-flight. */
  begin(
    tenantId: TenantId | null,
    uid: UserId | string,
    name: string,
    key: string
  ): Promise<{ cached: JsonValue | null; inFlight: boolean }>;
  /** Stores the response keyed (uid, key) after a successful run. */
  commit(
    tenantId: TenantId | null,
    uid: UserId | string,
    name: string,
    key: string,
    res: JsonValue
  ): Promise<void>;
  /** Releases an in-flight lease on failure. */
  release(
    tenantId: TenantId | null,
    uid: UserId | string,
    name: string,
    key: string
  ): Promise<void>;
}

/** Transactional outbox store (server-shared.md §2.8 / §5.1). */
export interface OutboxRepo {
  /** Stage an outbox record INSIDE a transaction (atomic with the state change). */
  enqueue(tx: TxHandle, rec: OutboxRecordInput): void;
  /** Drain: claim a batch of pending records. */
  claimPending(limit: number): Promise<OutboxRecord[]>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

/** Best-effort audit store (server-shared.md §2.10). */
export interface AuditRepo {
  write(rec: AuditRecord): Promise<void>;
}

/** Rate-limit counter store (server-shared.md §2.6). */
export interface RateLimitRepo {
  /** Atomically increment+read the per-(subject,tier,window) counter. Returns the new count. */
  hit(subject: string, tier: string, windowKey: string): Promise<number>;
}

/** Tenant reads used by feature-gate / quota / claim mint. */
export interface TenantRepo {
  get(tenantId: TenantId | string): Promise<TenantLike | null>;
}

/** Membership reads used by buildAuthContext overflow fallback. */
export interface MembershipRepo {
  getManagedClassIds(
    uid: UserId | string,
    tenantId: TenantId | string | null
  ): Promise<(ClassId | string)[]>;
}

/** Claims mint (Admin Auth) used by syncMembershipClaims. */
export interface ClaimsRepo {
  set(uid: UserId | string, claims: PlatformClaims): Promise<void>;
  revokeRefreshTokens(uid: UserId | string): Promise<void>;
}

/** A minimal tenant projection for gates (counts + features + status). */
export interface TenantLike {
  status?: string;
  features?: TenantFeatures;
  usage?: Record<string, number>;
  limits?: Record<string, number>;
}

export interface OutboxRecordInput {
  type: string;
  tenantId: TenantId | string;
  payload: JsonValue;
  createdAt?: Timestamp;
}

export interface OutboxRecord extends OutboxRecordInput {
  id: string;
  createdAt: Timestamp;
  status: "pending" | "delivered" | "failed";
  attempts: number;
}

export interface AuditRecord {
  tenantId: TenantId | string | null;
  actorUid: UserId | string;
  action: string;
  target: { type: string; id: string };
  meta?: JsonValue;
  at: Timestamp;
}

/**
 * The injected admin-repos handle. Only the members this layer touches directly
 * are named; the index signature lets the full `@levelup/repositories-admin`
 * surface pass through to services unchanged.
 */
export interface Repos {
  tx<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T>;
  idempotency: IdempotencyRepo;
  outbox: OutboxRepo;
  audit: AuditRepo;
  rateLimits: RateLimitRepo;
  tenants: TenantRepo;
  memberships: MembershipRepo;
  claims: ClaimsRepo;
  // Pass-through to the full server repo surface (spaces/items/exams/...).
  [repo: string]: unknown;
}

// --- AI gateway seam (server-shared.md §4.2) -------------------------------

export interface TokenUsage {
  // DP-1 (RR-T1 §6.3): aligned to the real `@levelup/ai` gateway
  // (`ai/src/gateway.ts` + `cost/cost-tracker.ts`) — was `promptTokens`/
  // `completionTokens` (a fiction that renamed the wire fields).
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}
export interface AiCallContext {
  tenantId: TenantId | string;
  uid: UserId | string;
  role: string;
  resourceType: string;
  resourceId: string;
}
export interface AiRequest {
  purpose: "question_extraction" | "answer_mapping" | "answer_grading" | "ai_chat" | "insights";
  operation: string;
  promptKey: string;
  variables: Record<string, JsonValue>;
  images?: { base64: string; mimeType: string }[];
  responseSchema?: unknown;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
export interface AiResponse<T = unknown> {
  data: T;
  /** DP-1 (RR-T1 §6.3): the real gateway ALWAYS returns the raw text completion;
   *  the port previously omitted it. Added to match `ai/src/gateway.ts` `AiResponse`. */
  text: string;
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  model: string;
}
export interface AiGateway {
  generate<T = unknown>(req: AiRequest, ctx: AiCallContext): Promise<AiResponse<T>>;
}

// --- storage signer seam (SDK-LAYERS-PLAN §3.7 Storage seam C1) -------------

/**
 * Signed-upload-URL port consumed by `requestUploadUrlService` via
 * `ctx.storage.signUploadUrl(path, contentType, ttlMs)`. The service computes the
 * tenant-scoped path (`buildScopedPath`) and delegates ONLY the signing here.
 * When absent (emulator/unit tests) the service falls back to a
 * `https://storage.local/…` stub URL.
 */
export interface StorageSignerPort {
  signUploadUrl(path: string, contentType: string, ttlMs: number): Promise<string>;
}

// --- pipeline enqueue seam (autograde single-writer reducer) ----------------

/** One pipeline-advance enqueue request (tenantId rides the task payload so the
 *  `makeTaskHandler` consumer can rebuild a tenant-scoped SystemContext). */
export interface PipelineAdvanceRequest {
  tenantId: string | null;
  submissionId: string;
  step: string;
}

/**
 * Cloud Tasks enqueue port consumed (curried over the ctx tenant) by
 * `enqueuePipelineAdvance` in `@levelup/services` via
 * `ctx.enqueuePipelineAdvance(submissionId, step)`. When absent
 * (emulator/unit tests) the service runs the step INLINE instead.
 */
export type PipelineEnqueuePort = (req: PipelineAdvanceRequest) => Promise<void>;
