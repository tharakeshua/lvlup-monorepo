/**
 * Error layer types (query-infra.md §7).
 *
 * The query layer is platform-neutral and reads a NORMALIZED `ApiError` shape:
 * `{ code, message, retryable, validationErrors }`. The concrete `ApiError`
 * class lives in `@levelup/api-client`; here we describe only the structural
 * shape the boundary + `useApiError` consume, plus a normalizer (`asApiError`)
 * so a thrown firebase/unknown value is funneled to that stable shape.
 */
import type { ReactElement, ReactNode } from "react";
import type { AppErrorCode, ValidationError } from "@levelup/api-contract";

/** The normalized, transport-neutral error shape the query layer renders. */
export interface NormalizedApiError {
  readonly code: AppErrorCode | string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly validationErrors?: readonly ValidationError[];
}

export interface ErrorFallbackProps {
  readonly error: NormalizedApiError;
  readonly reset: () => void;
}

export interface ApiErrorBoundaryProps {
  /** Custom fallback; defaults to a minimal typed-error renderer. */
  readonly fallback?: ErrorFallbackComponent;
  readonly onError?: (error: NormalizedApiError) => void;
  readonly children: ReactNode;
}

/** A fallback component receives the typed error + a reset fn. */
export type ErrorFallbackComponent = (props: ErrorFallbackProps) => ReactElement | null;

export interface UseApiErrorResult {
  /** Toast + (dev) log a single error; returns the normalized error. */
  handleError: (error: unknown, fallbackMessage?: string) => NormalizedApiError;
  /** Pure: normalize any thrown thing to a stable error (no side effects). */
  toApiError: (error: unknown) => NormalizedApiError;
}
