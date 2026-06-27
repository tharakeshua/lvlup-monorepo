/**
 * Shared harness for the @levelup/api-client unit/contract test suite.
 *
 * The api-client package is built in PARALLEL to these tests (SDK-LAYERS-PLAN.md
 * build step 4). So every test file loads the package barrel through this helper
 * and SELF-SKIPS the symbols it needs until the impl lands. A later validation
 * phase runs + tightens these tests once `createApiClient`, `normalizeError`,
 * `withRetry`, etc. are exported.
 *
 * The assertions are authored CONCRETELY against the FROZEN plan:
 *   • SDK-LAYERS-PLAN.md §3.1 (idempotency dedupe identity, NEVER an idempotencyKey
 *     request field), §3.4 (AppErrorCode), §4.4 (optimistic/authority — non-retry).
 *   • sdk-plan/layers/api-client-core.md §3–§6 (full public surface + required tests).
 *   • sdk-plan/layers/api-contract-core.md §4 (error codes, maps, DEFAULT_RETRYABLE).
 *
 * No `@levelup/api-contract` import at module-eval time (it may still be a
 * scaffold); we duck-type the registry where a test needs a real def, and fall
 * back to inline minimal defs otherwise.
 */
import * as client from "../index";

/* ------------------------------------------------------------------ *
 * Loosely-typed view of the (eventual) api-client public surface.
 * Mirrors sdk-plan/layers/api-client-core.md §3.
 * ------------------------------------------------------------------ */
export interface ApiErrorShape {
  name: string;
  code: string;
  retryable: boolean;
  validationErrors?: { path: string; message: string }[];
  meta?: Record<string, unknown>;
  cause?: unknown;
  callable?: string;
  httpsCode?: string;
  message: string;
  toJSON?: () => unknown;
}

type Fn = (...a: unknown[]) => unknown;

export interface ApiClientModule {
  createApiClient?: (
    transport: unknown,
    opts?: unknown
  ) => Record<string, unknown> & {
    identity?: Record<string, (d: unknown) => Promise<unknown>>;
    levelup?: Record<string, (d: unknown) => Promise<unknown>>;
    autograde?: Record<string, (d: unknown) => Promise<unknown>>;
    analytics?: Record<string, (d: unknown) => Promise<unknown>>;
    subscribe?: (name: string, params: unknown, cb: unknown) => { unsubscribe(): void };
    call?: <N extends string>(name: N) => (d: unknown) => Promise<unknown>;
  };

  // errors.ts
  ApiError?: new (init: Record<string, unknown>) => ApiErrorShape;
  normalizeError?: (e: unknown, callable?: string) => ApiErrorShape;
  isApiError?: (e: unknown) => boolean;
  fromZodError?: (e: unknown, callable?: string) => ApiErrorShape;
  fromTransportError?: (e: unknown, callable?: string) => ApiErrorShape;

  // validate.ts
  validateRequest?: (name: string, data: unknown) => unknown;
  validateResponse?: (name: string, res: unknown, enabled: boolean) => unknown;

  // retry.ts
  DEFAULT_RETRY_POLICY?: Record<string, unknown>;
  isRetryable?: (err: ApiErrorShape, def: unknown) => boolean;
  withRetry?: (
    attempt: (n: number) => Promise<unknown>,
    policy: unknown,
    ctx: { def: unknown; now: () => number; sleep?: (ms: number) => Promise<void> }
  ) => Promise<unknown>;
  computeBackoff?: (attempt: number, policy: unknown, rand?: () => number) => number;

  // idempotency.ts
  generateIdempotencyKey?: (name: string) => string;
  attachIdempotencyKey?: (name: string, req: unknown, def: unknown, key: string) => unknown;

  // offline.ts
  NoopOfflineQueue?: new () => OfflineQueueShape;
  routeThroughQueue?: (
    queue: OfflineQueueShape | undefined,
    name: string,
    data: unknown,
    key: string,
    deliver: () => Promise<unknown>
  ) => Promise<unknown>;

  // realtime.ts
  makeSubscribe?: (transport: unknown, opts: { validateResponses?: boolean }) => Fn;
}

export interface OfflineQueueShape {
  enqueue: (call: {
    name: string;
    data: unknown;
    idempotencyKey: string;
    enqueuedAt: number;
  }) => Promise<unknown>;
  flush: () => Promise<void>;
  status: "idle" | "flushing" | "offline";
}

export const C = client as unknown as ApiClientModule;

/** A symbol is "ready" once the parallel impl exports it. */
export function has<K extends keyof ApiClientModule>(k: K): boolean {
  return typeof (C as Record<string, unknown>)[k] !== "undefined";
}

/* ------------------------------------------------------------------ *
 * The reserved envelope key (api-client-core.md §3.5 / SDK-LAYERS-PLAN §3.1).
 * The UUIDv7 lives on the envelope, NEVER inside the .strict() request schema.
 * Tests accept either the canonical `__idempotencyKey` or a bare
 * `idempotencyKey` envelope field (impl detail not yet frozen across both docs),
 * but assert it is NOT a schema-validated body field elsewhere.
 * ------------------------------------------------------------------ */
export const ENVELOPE_IDEMPOTENCY_KEYS = ["__idempotencyKey", "idempotencyKey"] as const;

export function readEnvelopeKey(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;
  for (const k of ENVELOPE_IDEMPOTENCY_KEYS) {
    if (typeof obj[k] === "string") return obj[k] as string;
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * UUID v7 recognition (api-client-core.md §3.5 / §6.5).
 * version nibble === 7, RFC variant bits 10xx.
 * ------------------------------------------------------------------ */
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV7(s: unknown): boolean {
  return typeof s === "string" && UUID_V7_RE.test(s);
}

/** Extract the 48-bit unix-ms timestamp prefix from a v7 uuid (for ordering tests). */
export function uuidV7Time(s: string): number {
  const hex = s.replace(/-/g, "").slice(0, 12);
  return parseInt(hex, 16);
}

/* ------------------------------------------------------------------ *
 * Minimal stand-in CallableDef shapes — used where a test needs to feed a def
 * directly into isRetryable/withRetry/attachIdempotencyKey without importing the
 * real registry. Field names match api-contract-core.md §2.
 * ------------------------------------------------------------------ */
export interface MiniDef {
  name: string;
  module: "identity" | "levelup" | "autograde" | "analytics";
  rateTier: "write" | "read" | "ai" | "auth" | "report";
  authMode: "authed" | "public";
  idempotent?: boolean;
  authoritySensitive?: boolean;
  requestSchema?: unknown;
  responseSchema?: unknown;
}

export const defReadList: MiniDef = {
  name: "v1.levelup.listSpaces",
  module: "levelup",
  rateTier: "read",
  authMode: "authed",
};

export const defIdempotentMutation: MiniDef = {
  name: "v1.levelup.submitTestSession",
  module: "levelup",
  rateTier: "write",
  authMode: "authed",
  idempotent: true,
};

export const defNonIdempotentWrite: MiniDef = {
  name: "v1.autograde.gradeQuestion",
  module: "autograde",
  rateTier: "write",
  authMode: "authed",
  authoritySensitive: true,
};

export const defPurchase: MiniDef = {
  name: "v1.levelup.purchaseSpace",
  module: "levelup",
  rateTier: "write",
  authMode: "authed",
  idempotent: true,
  authoritySensitive: true,
};

/** AppErrorCode values that DEFAULT_RETRYABLE marks retryable (api-contract-core §4.1). */
export const RETRYABLE_CODES = ["RATE_LIMITED", "CONFLICT", "INTERNAL_ERROR"] as const;
/** A representative slice of the NON-retryable codes. */
export const NON_RETRYABLE_CODES = [
  "VALIDATION_ERROR",
  "INVALID_TRANSITION",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "UNAUTHENTICATED",
  "QUOTA_EXCEEDED",
  "FEATURE_DISABLED",
  "TENANT_SUSPENDED",
  "PRECONDITION_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_FAILED",
] as const;

/** Deterministic, monotonically-advancing clock for backoff/jitter tests. */
export function fakeClock(startMs = 1_700_000_000_000, stepMs = 1): () => number {
  let t = startMs;
  return () => {
    const cur = t;
    t += stepMs;
    return cur;
  };
}

/** A no-op sleep so withRetry tests don't actually wait. */
export const instantSleep = (_ms: number): Promise<void> => Promise.resolve();
