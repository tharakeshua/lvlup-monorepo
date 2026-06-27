/**
 * Global query error policy (query-infra.md §7.3).
 *
 *   • `shouldThrowOnError`: auth/permission/not-found/suspended/feature-off →
 *     ALWAYS throw to the boundary (render an error UI, not an empty state — the
 *     parent-web fix). Otherwise throw ONLY when there is no existing data (a
 *     background refetch with data keeps the screen).
 *   • `defaultRetry`: never retry a non-retryable (4xx / ⚷); transient → up to 2.
 *   • `globalQueryErrorHandler`: last-resort logging seam (no user-facing copy).
 */
import { asApiError } from "./normalize.js";

/** Codes that must surface an error UI even when stale data exists. */
const ALWAYS_THROW: ReadonlySet<string> = new Set([
  "PERMISSION_DENIED",
  "NOT_FOUND",
  "TENANT_SUSPENDED",
  "FEATURE_DISABLED",
  "UNAUTHENTICATED",
]);

/** Structural view of the `Query` arg (only its `state.data` matters here). */
export interface QueryLike {
  readonly state?: { readonly data?: unknown };
}

export function shouldThrowOnError(error: unknown, query?: QueryLike): boolean {
  const api = asApiError(error);
  if (ALWAYS_THROW.has(api.code)) return true;
  // Background refetch with existing data → don't blow away the screen.
  return query?.state?.data === undefined;
}

export function defaultRetry(failureCount: number, error: unknown): boolean {
  const api = asApiError(error);
  if (api.retryable === false) return false; // 4xx / ⚷ → never retry
  return failureCount < 2; // transient → up to 2 retries
}

export function globalQueryErrorHandler(_error: unknown, _query?: QueryLike): void {
  // last-resort logging hook; user-facing copy comes from useApiError / boundary.
}
