/**
 * `mapError` — the ONLY place an error becomes an `HttpsError` (server-shared.md §2.5).
 *
 *   AccessError(code) → HttpsError(APP_ERROR_TO_HTTPS[code], message, ApiErrorDetails)
 *   AiGatewayError    → HttpsError(APP_ERROR_TO_HTTPS[code], message, ApiErrorDetails)
 *   ZodError          → VALIDATION_ERROR
 *   HttpsError        → passthrough
 *   unknown           → INTERNAL_ERROR (no internal leak)
 */
import { HttpsError } from "firebase-functions/v2/https";
import { isAccessError } from "@levelup/access";
import {
  APP_ERROR_TO_HTTPS,
  DEFAULT_RETRYABLE,
  ERROR_MESSAGES,
  type AppErrorCode,
  type ApiErrorDetails,
  type ValidationError,
  type JsonValue,
} from "@levelup/api-contract";

/**
 * `@levelup/services` throws its own transport-neutral `ServiceError`
 * (`shared/context.ts`) — structurally identical to `AccessError` (a `code` +
 * optional `meta`) but a DISTINCT class (services sits above access and cannot
 * import it). It must map exactly like an AccessError; recognize it by shape so a
 * service `fail('PERMISSION_DENIED'|'NOT_FOUND'|…)` never degrades to INTERNAL.
 */
interface AppErrorLike {
  code: AppErrorCode;
  message: string;
  meta?: Record<string, JsonValue>;
}
function isServiceErrorLike(e: unknown): e is AppErrorLike {
  return (
    e instanceof Error &&
    e.name === "ServiceError" &&
    typeof (e as { code?: unknown }).code === "string"
  );
}

/** `@levelup/ai` gateway errors — duck-typed to avoid a hard dependency here. */
function isAiGatewayErrorLike(
  e: unknown
): e is AppErrorLike & { retryable?: boolean; meta?: Record<string, JsonValue> } {
  return (
    e instanceof Error &&
    e.name === "AiGatewayError" &&
    typeof (e as { code?: unknown }).code === "string"
  );
}

/** Map alias error codes some services throw to the canonical `AppErrorCode` set. */
const CODE_ALIASES: Record<string, AppErrorCode> = {
  FAILED_PRECONDITION: "PRECONDITION_FAILED",
  INVALID_ARGUMENT: "VALIDATION_ERROR",
  INVALID_API_KEY: "VALIDATION_ERROR",
  TENANT_REQUIRED: "PERMISSION_DENIED",
  ALREADY_EXISTS: "CONFLICT",
  ABORTED: "CONFLICT",
};
function normalizeCode(raw: string): AppErrorCode {
  return (CODE_ALIASES[raw] ?? raw) as AppErrorCode;
}

interface ZodLikeError {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}
function isZodLikeError(e: unknown): e is ZodLikeError {
  return (
    typeof e === "object" &&
    e !== null &&
    Array.isArray((e as { issues?: unknown }).issues) &&
    (e as { name?: string }).name === "ZodError"
  );
}

function buildDetails(
  code: AppErrorCode,
  message: string,
  meta?: Record<string, JsonValue>
): ApiErrorDetails {
  const details: ApiErrorDetails = {
    code,
    message: message || ERROR_MESSAGES[code],
    retryable: DEFAULT_RETRYABLE[code],
  };
  if (meta) {
    const rest: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (k === "validationErrors" && Array.isArray(v)) {
        details.validationErrors = v as unknown as ValidationError[];
      } else if (k === "retryable" && typeof v === "boolean") {
        details.retryable = v;
      } else if (v !== undefined) {
        rest[k] = v;
      }
    }
    if (Object.keys(rest).length > 0) details.meta = rest;
  }
  return details;
}

export function mapError(e: unknown): HttpsError {
  // already mapped
  if (e instanceof HttpsError) return e;

  if (isAccessError(e) || isServiceErrorLike(e) || isAiGatewayErrorLike(e)) {
    // Normalize the alias codes some services throw to the canonical AppErrorCode
    // set so they map cleanly instead of degrading to INTERNAL.
    const code = normalizeCode(String(e.code));
    // Guard against an out-of-band code string (unknown service codes degrade to
    // INTERNAL rather than crashing the lookup).
    const httpsCode = APP_ERROR_TO_HTTPS[code];
    if (httpsCode) {
      const gatewayRetryable =
        isAiGatewayErrorLike(e) && typeof e.retryable === "boolean" ? e.retryable : undefined;
      const details = buildDetails(code, e.message, {
        ...(e.meta as Record<string, JsonValue> | undefined),
        ...(gatewayRetryable !== undefined ? { retryable: gatewayRetryable } : {}),
      });
      return new HttpsError(httpsCode, details.message, details);
    }
  }

  if (isZodLikeError(e)) {
    const validationErrors: ValidationError[] = e.issues.map((i) => ({
      path: i.path.map(String).join("."),
      message: i.message,
    }));
    const details = buildDetails("VALIDATION_ERROR", "Invalid request", {
      validationErrors: validationErrors as unknown as JsonValue,
    });
    return new HttpsError(APP_ERROR_TO_HTTPS.VALIDATION_ERROR, details.message, details);
  }

  // unknown — never leak internals
  // eslint-disable-next-line no-console
  console.error(
    "[mapError] UNCLASSIFIED error →INTERNAL_ERROR:",
    e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : JSON.stringify(e)
  );
  const details = buildDetails("INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
  return new HttpsError(APP_ERROR_TO_HTTPS.INTERNAL_ERROR, details.message, details);
}
