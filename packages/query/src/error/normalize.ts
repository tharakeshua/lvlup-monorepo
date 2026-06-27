/**
 * `asApiError` — funnel any thrown value to a stable `NormalizedApiError`
 * (query-infra.md §7.2).
 *
 * Reads `ApiError.code` first (the api-client funnel already normalized it),
 * falling back to a firebase `https`-error `code` mapping and finally
 * `INTERNAL_ERROR`. The query layer NEVER reconstructs the firebase-code mapping
 * inline (the live `use-api-error.ts` bug); the canonical
 * https→app-error table lives in `@levelup/api-contract`.
 */
import { HTTPS_TO_APP_ERROR, DEFAULT_RETRYABLE } from "@levelup/api-contract";
import type { AppErrorCode } from "@levelup/api-contract";
import type { NormalizedApiError } from "./types.js";

const APP_CODE_SET: ReadonlySet<string> = new Set<string>(Object.keys(DEFAULT_RETRYABLE));

function readField(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
}

/** Normalize any error to `{ code, message, retryable, validationErrors }`. */
export function asApiError(error: unknown): NormalizedApiError {
  if (error == null || typeof error !== "object") {
    return {
      code: "INTERNAL_ERROR",
      message: typeof error === "string" ? error : "Unknown error",
      retryable: DEFAULT_RETRYABLE.INTERNAL_ERROR,
    };
  }

  const o = error as Record<string, unknown>;
  const rawCode = readField(o, "code");
  const message = readField(o, "message") ?? "Unknown error";
  const retryable = typeof o.retryable === "boolean" ? (o.retryable as boolean) : undefined;
  const validationErrors = Array.isArray(o.validationErrors)
    ? (o.validationErrors as NormalizedApiError["validationErrors"])
    : undefined;

  // Already an app code (the api-client funnel resolved it).
  if (rawCode && APP_CODE_SET.has(rawCode)) {
    const code = rawCode as AppErrorCode;
    return {
      code,
      message,
      retryable: retryable ?? DEFAULT_RETRYABLE[code],
      validationErrors,
    };
  }

  // Otherwise treat it as a firebase https-error code and map it.
  const mapped = rawCode
    ? (HTTPS_TO_APP_ERROR as Record<string, AppErrorCode | undefined>)[rawCode]
    : undefined;
  const code: AppErrorCode = mapped ?? "INTERNAL_ERROR";
  return {
    code,
    message,
    retryable: retryable ?? DEFAULT_RETRYABLE[code],
    validationErrors,
  };
}
