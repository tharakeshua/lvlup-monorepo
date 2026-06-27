/**
 * `@levelup/ai` error type.
 *
 * The AI gateway never imports `firebase-functions`; it throws a typed
 * `AiGatewayError` carrying an `AppErrorCode` (the api-contract vocabulary) so
 * the `functions-shared` `mapError`/`fail` layer can translate it into an
 * `HttpsError` with a typed `ApiErrorDetails`. This mirrors the `AccessError`
 * pattern (`authorize()` throws `PERMISSION_DENIED`, `assertTransition()` throws
 * `INVALID_TRANSITION`) — both are plain errors carrying an `AppErrorCode`.
 */
import type { AppErrorCode } from "@levelup/api-contract";

export class AiGatewayError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    opts: { retryable?: boolean; meta?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.meta = opts.meta;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
    Object.setPrototypeOf(this, AiGatewayError.prototype);
  }
}

export function isAiGatewayError(x: unknown): x is AiGatewayError {
  return x instanceof AiGatewayError;
}

/** Thrown when the monthly budget or daily call cap is exceeded. Not retryable. */
export const quotaExceeded = (message: string, meta?: Record<string, unknown>): AiGatewayError =>
  new AiGatewayError("QUOTA_EXCEEDED", message, { retryable: false, meta });

/** Thrown when AI is disabled for the tenant (no key, feature flag off). */
export const aiDisabled = (message: string, meta?: Record<string, unknown>): AiGatewayError =>
  new AiGatewayError("FEATURE_DISABLED", message, { retryable: false, meta });

/** Thrown when the provider call fails (after retries / circuit-open). */
export const providerFailed = (
  message: string,
  opts: { retryable?: boolean; meta?: Record<string, unknown>; cause?: unknown } = {}
): AiGatewayError => new AiGatewayError("INTERNAL_ERROR", message, opts);
