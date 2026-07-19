import { useCallback } from "react";
import { toast } from "sonner";
import type { AppErrorCode } from "@levelup/shared-types";
import { HTTPS_TO_APP_ERROR, ERROR_MESSAGES, ERROR_RECOVERY_HINTS } from "@levelup/shared-types";

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
    // Firebase callable errors have codes like "functions/not-found"
    const rawCode = error.code.replace("functions/", "");
    const appCode = HTTPS_TO_APP_ERROR[rawCode] ?? "INTERNAL_ERROR";
    // Use the server-provided message if available, otherwise use the default
    const message = error.message || ERROR_MESSAGES[appCode];
    return { code: appCode, message };
  }

  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }

  return { code: "INTERNAL_ERROR", message: ERROR_MESSAGES.INTERNAL_ERROR };
}

/**
 * Hook for handling API errors with Sonner toast notifications.
 *
 * @example
 * ```tsx
 * const { handleError } = useApiError();
 *
 * const onSubmit = async () => {
 *   try {
 *     await callSaveSpace(data);
 *     toast.success('Space saved!');
 *   } catch (error) {
 *     handleError(error, 'Failed to save space');
 *   }
 * };
 * ```
 */
export function useApiError() {
  const handleError = useCallback((error: unknown, fallbackMessage?: string) => {
    const { code, message } = getApiErrorMessage(error);

    // Use server message for specific errors, fallback for generic ones
    const displayMessage = code === "INTERNAL_ERROR" && fallbackMessage ? fallbackMessage : message;

    const recoveryHint = ERROR_RECOVERY_HINTS[code];
    toast.error(displayMessage, {
      description: recoveryHint ?? undefined,
    });

    // Log for debugging in development
    const isDev =
      typeof import.meta !== "undefined" &&
      Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
    if (isDev) {
      console.error(`[API Error] ${code}:`, error);
    }
  }, []);

  return { handleError, getApiErrorMessage };
}
