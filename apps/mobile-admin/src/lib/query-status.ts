/**
 * Read-query status classifiers (shared across screens).
 *
 * The `@levelup/query` read hooks surface a NORMALIZED error (`{ code, ... }`).
 * For a FRESH real account, derived/aggregate docs (per-story-point progress,
 * cross-domain summary, gamification level, space progress) simply DON'T EXIST
 * yet — the read comes back `NOT_FOUND`. Likewise a read fired in the brief
 * window before auto-login settles comes back `UNAUTHENTICATED`. Neither is a
 * real failure: the screen must degrade to a zero/empty state, never a hard
 * error card and never a red-screen.
 *
 * `SdkProvider` already turns OFF `throwReadErrorsToBoundary`, so these errors
 * land in `query.isError` instead of throwing to the root. These helpers let a
 * screen tell a benign "doc not here yet" miss apart from a genuine failure.
 */
import { asApiError } from "@levelup/query";

/** Codes that mean "no doc yet / not ready" rather than "something broke". */
const SOFT_MISS_CODES = new Set<string>(["NOT_FOUND", "UNAUTHENTICATED", "PERMISSION_DENIED"]);

/** The normalized app error code for any thrown/returned error, or undefined. */
export function apiErrorCode(error: unknown): string | undefined {
  if (error == null) return undefined;
  return asApiError(error).code;
}

/**
 * A "soft miss": a derived doc that doesn't exist yet, or a transient
 * pre-autologin unauthenticated read. Render zero/empty — do NOT show an error.
 */
export function isSoftMissError(error: unknown): boolean {
  const code = apiErrorCode(error);
  return code !== undefined && SOFT_MISS_CODES.has(code);
}

/** Minimal structural view of a react-query result (only error state matters). */
interface QueryErrorLike {
  readonly isError: boolean;
  readonly error?: unknown;
}

/**
 * True only for a *real* failure worth showing an error UI for. A soft miss
 * (NOT_FOUND / UNAUTHENTICATED / PERMISSION_DENIED) returns false so the screen
 * falls through to its normal zero/empty render path.
 */
export function isHardError(q: QueryErrorLike): boolean {
  return q.isError && !isSoftMissError(q.error);
}
