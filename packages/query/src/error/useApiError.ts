/**
 * `useApiError` (query-infra.md §7.2) — moved here, RN-safe.
 *
 * `notify` is injected (no `sonner`) and `isDev` is a prop (no `import.meta`).
 * Copy comes from the contract's `ERROR_MESSAGES` / `ERROR_RECOVERY_HINTS`; the
 * hook never reconstructs a firebase-code map.
 */
import { useCallback } from "react";
import { ERROR_MESSAGES, ERROR_RECOVERY_HINTS } from "@levelup/api-contract";
import type { AppErrorCode } from "@levelup/api-contract";
import { useApi } from "../provider/useApi.js";
import { asApiError } from "./normalize.js";
import type { NormalizedApiError, UseApiErrorResult } from "./types.js";

const messageFor = (code: string): string | undefined =>
  (ERROR_MESSAGES as Partial<Record<AppErrorCode, string>>)[code as AppErrorCode];
const hintFor = (code: string): string | undefined =>
  (ERROR_RECOVERY_HINTS as Partial<Record<AppErrorCode, string>>)[code as AppErrorCode];

export function useApiError(): UseApiErrorResult {
  const { notify, isDev } = useApi();

  const handleError = useCallback(
    (error: unknown, fallback?: string): NormalizedApiError => {
      const api = asApiError(error);
      const copy =
        api.code === "INTERNAL_ERROR" && fallback
          ? fallback
          : (messageFor(api.code) ?? api.message);
      notify.error(copy, { description: hintFor(api.code) });
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error(`[ApiError] ${api.code}:`, error);
      }
      return api;
    },
    [notify, isDev]
  );

  return { handleError, toApiError: asApiError };
}
