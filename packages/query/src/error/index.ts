/** `error/` barrel. */
export { ApiErrorBoundary } from "./ApiErrorBoundary.js";
export { useApiError } from "./useApiError.js";
export { asApiError } from "./normalize.js";
export { shouldThrowOnError, defaultRetry, globalQueryErrorHandler } from "./error-policy.js";
export type { QueryLike } from "./error-policy.js";
export type {
  ApiErrorBoundaryProps,
  ErrorFallbackProps,
  ErrorFallbackComponent,
  UseApiErrorResult,
  NormalizedApiError,
} from "./types.js";
