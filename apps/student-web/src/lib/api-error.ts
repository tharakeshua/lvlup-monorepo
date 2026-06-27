/**
 * App-local mirror of the legacy `getApiErrorMessage` helper.
 *
 * `@levelup/query` exposes error handling only through the `useApiError` hook;
 * there is no plain (non-hook) function. Non-hook call sites (e.g. inside an
 * async submit handler before any hook context) use this thin util, which
 * mirrors the legacy `use-api-error` helper. Depends only on
 * `@levelup/shared-types` (which stays).
 */
import type { AppErrorCode } from "@levelup/shared-types";
import { HTTPS_TO_APP_ERROR, ERROR_MESSAGES } from "@levelup/shared-types";

interface FirebaseCallableError {
  code: string;
  message: string;
  details?: unknown;
}

function isFirebaseCallableError(error: unknown): error is FirebaseCallableError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as FirebaseCallableError).code === "string"
  );
}

/**
 * Extract a user-friendly error message from a Firebase callable error.
 * Falls back to generic messages for unknown error shapes.
 */
export function getApiErrorMessage(error: unknown): {
  code: AppErrorCode;
  message: string;
} {
  if (isFirebaseCallableError(error)) {
    const rawCode = error.code.replace("functions/", "");
    const appCode = HTTPS_TO_APP_ERROR[rawCode] ?? "INTERNAL_ERROR";
    const message = error.message || ERROR_MESSAGES[appCode];
    return { code: appCode, message };
  }

  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }

  return { code: "INTERNAL_ERROR", message: ERROR_MESSAGES.INTERNAL_ERROR };
}
