/**
 * Error model (SDK-LAYERS-PLAN §3.4 / api-contract-core.md §4).
 *
 * The transport-neutral error vocabulary BOTH `fail()` (server, in
 * `@levelup/functions-shared`) and `normalizeError()` (client, in
 * `@levelup/api-client`) import. Keeping `fail`/`normalizeError` out of this
 * layer preserves its firebase-free purity — this file owns only the shared
 * vocabulary: the `AppErrorCode` enum, `ApiErrorDetails`, the two transport
 * maps, the copy tables, and `DEFAULT_RETRYABLE`.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// §4.1 AppErrorCode enum + runtime mirror
// ---------------------------------------------------------------------------

/**
 * Application-level, transport-neutral error codes. The union is the SINGLE
 * source; `APP_ERROR_CODES` is its runtime mirror (kept in sync by the
 * type-level exhaustiveness check below).
 */
export type AppErrorCode =
  | "VALIDATION_ERROR" // Zod parseRequest failure → carries validationErrors[]
  | "INVALID_TRANSITION" // ALLOWED_TRANSITIONS violation (status state machine)
  | "NOT_FOUND"
  | "PERMISSION_DENIED" // authorize() denied (access policy)
  | "UNAUTHENTICATED" // no/invalid token
  | "RATE_LIMITED" // limiter tripped (retryable)
  | "QUOTA_EXCEEDED" // usage/plan quota (not retryable without upgrade)
  | "FEATURE_DISABLED" // tenant feature gate off
  | "TENANT_SUSPENDED" // tenant lifecycle deactivated
  | "CONFLICT" // already-exists / version conflict (optimistic)
  | "PRECONDITION_FAILED" // generic failed-precondition not covered by INVALID_TRANSITION
  | "IDEMPOTENCY_CONFLICT" // same idempotencyKey, in-flight lease
  | "PAYMENT_FAILED" // purchaseSpace gateway decline
  | "INTERNAL_ERROR"; // catch-all

export const APP_ERROR_CODES = [
  "VALIDATION_ERROR",
  "INVALID_TRANSITION",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "FEATURE_DISABLED",
  "TENANT_SUSPENDED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_FAILED",
  "INTERNAL_ERROR",
] as const satisfies readonly AppErrorCode[];

// Compile-time exhaustiveness: union ⊆ array AND array ⊆ union (no drift).
type _AppErrorCodeCheck = AppErrorCode extends (typeof APP_ERROR_CODES)[number] ? true : never;
const _appErrorCodeCheck: _AppErrorCodeCheck = true;
void _appErrorCodeCheck;

/**
 * Default retryability by code — consumed by `normalizeError` when the server
 * omits `retryable`. `IDEMPOTENCY_CONFLICT` is retryable: a transient in-flight
 * lease the client retries (SDK-LAYERS-PLAN §3.4 overrides the core draft).
 */
export const DEFAULT_RETRYABLE: Record<AppErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  INVALID_TRANSITION: false,
  NOT_FOUND: false,
  PERMISSION_DENIED: false,
  UNAUTHENTICATED: false,
  RATE_LIMITED: true,
  QUOTA_EXCEEDED: false,
  FEATURE_DISABLED: false,
  TENANT_SUSPENDED: false,
  CONFLICT: true,
  PRECONDITION_FAILED: false,
  IDEMPOTENCY_CONFLICT: true,
  PAYMENT_FAILED: false,
  INTERNAL_ERROR: true,
};

// ---------------------------------------------------------------------------
// §4.2 ApiErrorDetails + Zod mirror + guard
// ---------------------------------------------------------------------------

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface ValidationError {
  path: string;
  message: string;
}

/** The typed payload ALWAYS carried in `HttpsError.details` (common-api §6.1). */
export interface ApiErrorDetails {
  code: AppErrorCode;
  message: string; // user-safe default; client may localize via ERROR_MESSAGES
  validationErrors?: ValidationError[]; // present iff code === 'VALIDATION_ERROR'
  retryable?: boolean; // explicit server hint; else DEFAULT_RETRYABLE[code]
  meta?: Record<string, JsonValue>; // e.g. { resource:'space', id }, { retryAfterMs }
}

/** Zod mirror — the api-client safely PARSES an unknown `HttpsError.details` with this. */
export const ApiErrorDetailsSchema = z
  .object({
    code: z.enum(APP_ERROR_CODES),
    message: z.string(),
    validationErrors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    retryable: z.boolean().optional(),
    meta: z.record(z.string(), z.any()).optional(),
  })
  .strict();

/** Type guard for the client decoder (`normalizeError`). */
export function isApiErrorDetails(x: unknown): x is ApiErrorDetails {
  return ApiErrorDetailsSchema.safeParse(x).success;
}

// ---------------------------------------------------------------------------
// §4.3 Code ↔ transport maps
// ---------------------------------------------------------------------------

/** Firebase Callable error code union (mirrors `FunctionsErrorCode` — re-declared, NOT imported). */
export type FunctionsErrorCode =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss"
  | "unauthenticated";

/** Server: AppErrorCode → HttpsError code (used by `fail()`). Total over the enum. */
export const APP_ERROR_TO_HTTPS: Record<AppErrorCode, FunctionsErrorCode> = {
  VALIDATION_ERROR: "invalid-argument",
  INVALID_TRANSITION: "failed-precondition",
  NOT_FOUND: "not-found",
  PERMISSION_DENIED: "permission-denied",
  UNAUTHENTICATED: "unauthenticated",
  RATE_LIMITED: "resource-exhausted",
  QUOTA_EXCEEDED: "resource-exhausted",
  FEATURE_DISABLED: "failed-precondition",
  TENANT_SUSPENDED: "failed-precondition",
  CONFLICT: "already-exists",
  PRECONDITION_FAILED: "failed-precondition",
  IDEMPOTENCY_CONFLICT: "already-exists",
  PAYMENT_FAILED: "failed-precondition",
  INTERNAL_ERROR: "internal",
};

/**
 * Client: HttpsError code → AppErrorCode FALLBACK only. `normalizeError` prefers
 * `details.code` (the authoritative AppErrorCode) and uses this map only when an
 * error arrives WITHOUT typed details (legacy / non-app errors). Many→one is fine.
 */
export const HTTPS_TO_APP_ERROR: Record<FunctionsErrorCode, AppErrorCode> = {
  ok: "INTERNAL_ERROR",
  cancelled: "INTERNAL_ERROR",
  unknown: "INTERNAL_ERROR",
  "invalid-argument": "VALIDATION_ERROR",
  "deadline-exceeded": "INTERNAL_ERROR",
  "not-found": "NOT_FOUND",
  "already-exists": "CONFLICT",
  "permission-denied": "PERMISSION_DENIED",
  "resource-exhausted": "RATE_LIMITED",
  "failed-precondition": "PRECONDITION_FAILED",
  aborted: "CONFLICT",
  "out-of-range": "VALIDATION_ERROR",
  unimplemented: "INTERNAL_ERROR",
  internal: "INTERNAL_ERROR",
  unavailable: "INTERNAL_ERROR",
  "data-loss": "INTERNAL_ERROR",
  unauthenticated: "UNAUTHENTICATED",
};

// ---------------------------------------------------------------------------
// §4.4 User-facing copy
// ---------------------------------------------------------------------------

/** Default user-safe message per code (client may localize). Total over the enum. */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION_ERROR: "The request contains invalid data.",
  INVALID_TRANSITION: "That action is not allowed from the current state.",
  NOT_FOUND: "The requested resource was not found.",
  PERMISSION_DENIED: "You do not have permission to perform this action.",
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  RATE_LIMITED: "Too many requests. Please try again in a moment.",
  QUOTA_EXCEEDED: "You have exceeded your usage quota.",
  FEATURE_DISABLED: "This feature is not enabled for your organization.",
  TENANT_SUSPENDED: "Your organization account is currently suspended.",
  CONFLICT: "This resource was modified elsewhere. Refresh and retry.",
  PRECONDITION_FAILED: "The operation cannot be performed in the current state.",
  IDEMPOTENCY_CONFLICT: "A conflicting request with the same key is already in progress.",
  PAYMENT_FAILED: "The payment could not be completed.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
};

/** Recovery hint shown alongside the toast; null = no actionable hint. Total over the enum. */
export const ERROR_RECOVERY_HINTS: Record<AppErrorCode, string | null> = {
  VALIDATION_ERROR: "Check the highlighted fields and try again.",
  INVALID_TRANSITION: "Refresh to see the current status, then retry.",
  NOT_FOUND: "The item may have been deleted. Try refreshing.",
  PERMISSION_DENIED: "Contact your administrator if you need access.",
  UNAUTHENTICATED: "Please sign in and try again.",
  RATE_LIMITED: "Wait a few seconds before trying again.",
  QUOTA_EXCEEDED: "Contact your administrator to upgrade your plan.",
  FEATURE_DISABLED: "Ask your administrator to enable this feature.",
  TENANT_SUSPENDED: "Contact support to restore your account.",
  CONFLICT: "Refresh the page to load the latest version.",
  PRECONDITION_FAILED: "Refresh the page and verify the current status.",
  IDEMPOTENCY_CONFLICT: "Wait for the in-flight request to finish.",
  PAYMENT_FAILED: "Check your payment details and try again.",
  INTERNAL_ERROR: "If the problem persists, contact support.",
};
