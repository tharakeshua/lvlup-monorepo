/**
 * The error funnel (api-client-core.md §3.3 / §6.3).
 *
 * `normalizeError` is the SINGLE place every thrown error becomes a stable
 * `ApiError`. No `firebase` import — the firebase `HttpsError` shape is
 * duck-typed (`{ code, message, details }`). Resolution order (§3.3):
 *   1. already an `ApiError`            → returned as-is (callable backfilled)
 *   2. a `ZodError`                     → VALIDATION_ERROR + validationErrors[]
 *   3. `{ details: { code:AppErrorCode } }` server `fail()` envelope → verbatim
 *   4. firebase-style `{ code:'…' }`    → HTTPS_TO_APP_ERROR, httpsCode set
 *   5. TypeError / AbortError / network → NETWORK_ERROR, retryable:true
 *   6. anything else                    → UNKNOWN, retryable:false, cause kept
 *
 * The `AppErrorCode` vocabulary, the transport maps, and `DEFAULT_RETRYABLE` are
 * owned by `@levelup/api-contract`; this layer only consumes them.
 */
import { ZodError } from "zod";
import { DEFAULT_RETRYABLE, HTTPS_TO_APP_ERROR, isApiErrorDetails } from "@levelup/api-contract";
import type {
  AppErrorCode,
  ApiErrorDetails,
  CallableName,
  FunctionsErrorCode,
  JsonValue,
  ValidationError,
} from "@levelup/api-contract";

/**
 * Client-only synthetic codes that are NOT part of the server `AppErrorCode`
 * vocabulary but are produced purely client-side by `normalizeError`:
 *  - `NETWORK_ERROR` — fetch/abort/offline failure (never reached the server).
 *  - `UNKNOWN`       — an unrecognized throw shape.
 * They widen the runtime `code` without polluting the contract enum.
 */
export type ClientErrorCode = "NETWORK_ERROR" | "UNKNOWN";

/** The full set of codes an `ApiError.code` may carry (server enum + client synthetics). */
export type ApiErrorCode = AppErrorCode | ClientErrorCode;

export interface ApiErrorInit {
  code: ApiErrorCode;
  message: string;
  retryable?: boolean;
  validationErrors?: ValidationError[];
  meta?: Record<string, JsonValue>;
  cause?: unknown;
  callable?: CallableName;
  httpsCode?: string;
}

/**
 * The stable client-side error every layer above catches. Carries the
 * transport-neutral `code`, a derived `retryable`, optional zod `validationErrors`,
 * server `meta`, the original `cause`, the producing `callable`, and the raw
 * firebase `httpsCode` (for a `useApiError` fallback).
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly validationErrors?: ValidationError[];
  readonly meta?: Record<string, JsonValue>;
  readonly cause?: unknown;
  callable?: CallableName;
  readonly httpsCode?: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.retryable = init.retryable ?? defaultRetryable(init.code);
    this.validationErrors = init.validationErrors;
    this.meta = init.meta;
    this.cause = init.cause;
    this.callable = init.callable;
    this.httpsCode = init.httpsCode;
    // Restore the prototype chain (ES2020 target + class extends Error).
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** The stable, serializable details shape (mirrors `ApiErrorDetails` + callable). */
  toJSON(): ApiErrorDetails & { callable?: CallableName } {
    return {
      code: this.code as AppErrorCode,
      message: this.message,
      ...(this.validationErrors ? { validationErrors: this.validationErrors } : {}),
      retryable: this.retryable,
      ...(this.meta ? { meta: this.meta } : {}),
      ...(this.callable ? { callable: this.callable } : {}),
    };
  }
}

/** Type guard for callers (query error boundary, repositories, retry loop). */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Retryability default for a code; client synthetics resolve here, not in the map. */
function defaultRetryable(code: ApiErrorCode): boolean {
  if (code === "NETWORK_ERROR") return true;
  if (code === "UNKNOWN") return false;
  return DEFAULT_RETRYABLE[code];
}

/** Build an `ApiError` from a `ZodError` (request/response validation failure). */
export function fromZodError(e: ZodError, callable?: CallableName): ApiError {
  const validationErrors: ValidationError[] = e.issues.map((issue) => ({
    path: issue.path.map((p) => String(p)).join("."),
    message: issue.message,
  }));
  return new ApiError({
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data.",
    retryable: false,
    validationErrors,
    cause: e,
    callable,
  });
}

/** Strip a leading `functions/` (or any `<ns>/`) prefix off a firebase-style code. */
function bareFirebaseCode(code: string): string {
  const slash = code.lastIndexOf("/");
  return slash >= 0 ? code.slice(slash + 1) : code;
}

function isFunctionsErrorCode(code: string): code is FunctionsErrorCode {
  return code in HTTPS_TO_APP_ERROR;
}

function asRecord(e: unknown): Record<string, unknown> | undefined {
  return e && typeof e === "object" ? (e as Record<string, unknown>) : undefined;
}

function coerceMeta(meta: unknown): Record<string, JsonValue> | undefined {
  return meta && typeof meta === "object" ? (meta as Record<string, JsonValue>) : undefined;
}

/**
 * Build an `ApiError` from a transport/`HttpsError`-shaped object (duck-typed —
 * no firebase import). Prefers a typed `details` envelope (the server `fail()`
 * payload); falls back to mapping the raw firebase code via `HTTPS_TO_APP_ERROR`.
 */
export function fromTransportError(e: unknown, callable?: CallableName): ApiError {
  const obj = asRecord(e);
  const rawMessage =
    obj && typeof obj["message"] === "string" ? (obj["message"] as string) : undefined;

  // (3) Typed server fail() envelope: details carries the authoritative AppErrorCode.
  const details = obj?.["details"];
  if (isApiErrorDetails(details)) {
    const rawCode = obj && typeof obj["code"] === "string" ? (obj["code"] as string) : undefined;
    return new ApiError({
      code: details.code,
      message: details.message ?? rawMessage ?? "An unexpected error occurred. Please try again.",
      retryable: details.retryable ?? DEFAULT_RETRYABLE[details.code],
      validationErrors: details.validationErrors,
      meta: details.meta,
      cause: e,
      callable,
      ...(rawCode ? { httpsCode: rawCode } : {}),
    });
  }

  // (4) Firebase-style { code: 'functions/unavailable' | 'permission-denied' }.
  const rawCode = obj && typeof obj["code"] === "string" ? (obj["code"] as string) : undefined;
  if (rawCode) {
    const bare = bareFirebaseCode(rawCode);
    if (isFunctionsErrorCode(bare)) {
      const appCode = HTTPS_TO_APP_ERROR[bare];
      return new ApiError({
        code: appCode,
        message: rawMessage ?? "An unexpected error occurred. Please try again.",
        retryable: DEFAULT_RETRYABLE[appCode],
        meta: coerceMeta(obj?.["meta"]),
        cause: e,
        callable,
        httpsCode: rawCode,
      });
    }
  }

  // (6) Unrecognized shape → UNKNOWN.
  return new ApiError({
    code: "UNKNOWN",
    message: rawMessage ?? "An unexpected error occurred. Please try again.",
    retryable: false,
    cause: e,
    callable,
    ...(rawCode ? { httpsCode: rawCode } : {}),
  });
}

/** Network-failure detection (no DOM/node import): name/shape duck-typing. */
function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const obj = asRecord(e);
  const name = obj && typeof obj["name"] === "string" ? (obj["name"] as string) : undefined;
  if (name === "AbortError" || name === "TimeoutError") return true;
  // fetch offline / network failure messages, when no firebase code is present.
  const hasCode = obj && typeof obj["code"] === "string";
  const msg = obj && typeof obj["message"] === "string" ? (obj["message"] as string) : "";
  return !hasCode && /network|fetch|offline|connection/i.test(msg);
}

/**
 * Map ANY thrown error → `ApiError`. The single normalization funnel; idempotent
 * (normalizing an `ApiError` returns it, only backfilling `callable`).
 */
export function normalizeError(e: unknown, callable?: CallableName): ApiError {
  // (1) Already normalized — backfill callable, return as-is.
  if (isApiError(e)) {
    if (callable && !e.callable) e.callable = callable;
    return e;
  }

  // (2) ZodError → VALIDATION_ERROR.
  if (e instanceof ZodError) {
    return fromZodError(e, callable);
  }

  const obj = asRecord(e);

  // (3) Typed server fail() envelope wins over raw firebase code.
  if (isApiErrorDetails(obj?.["details"])) {
    return fromTransportError(e, callable);
  }

  // (4) Firebase-style coded error.
  if (obj && typeof obj["code"] === "string") {
    return fromTransportError(e, callable);
  }

  // (5) Network / abort / offline.
  if (isNetworkError(e)) {
    return new ApiError({
      code: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "A network error occurred.",
      retryable: true,
      cause: e,
      callable,
    });
  }

  // (6) Anything else → UNKNOWN.
  return new ApiError({
    code: "UNKNOWN",
    message: e instanceof Error ? e.message : "An unexpected error occurred. Please try again.",
    retryable: false,
    cause: e,
    callable,
  });
}
