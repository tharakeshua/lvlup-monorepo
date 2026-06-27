/**
 * `ApiErrorBoundary` (query-infra.md §7.1).
 *
 * Combines TanStack's `QueryErrorResetBoundary` with a class boundary so a thrown
 * query/mutation error renders an explicit, TYPED error UI (not an empty state —
 * the parent-web fix, spec §5.2). The thrown value is normalized through
 * `asApiError`, so the fallback always receives a stable
 * `{ code, message, retryable, validationErrors }`.
 */
import { Component } from "react";
import type { ErrorInfo, ReactElement, ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { asApiError } from "./normalize.js";
import type { ApiErrorBoundaryProps, ErrorFallbackComponent, NormalizedApiError } from "./types.js";

interface ClassProps {
  fallback: ErrorFallbackComponent;
  onReset: () => void;
  onError?: (error: NormalizedApiError) => void;
  children: ReactNode;
}

interface ClassState {
  error: NormalizedApiError | null;
}

class ErrorBoundaryClass extends Component<ClassProps, ClassState> {
  override state: ClassState = { error: null };

  static getDerivedStateFromError(error: unknown): ClassState {
    return { error: asApiError(error) };
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError?.(asApiError(error));
  }

  private reset = (): void => {
    this.props.onReset();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      const Fallback = this.props.fallback;
      return <Fallback error={error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

/** Minimal default fallback: renders the typed code (apps override via `fallback`). */
const DefaultApiErrorFallback: ErrorFallbackComponent = ({ error, reset }) => (
  <div role="alert" data-api-error-code={error.code}>
    <p>{error.message}</p>
    {error.retryable !== false ? (
      <button type="button" onClick={reset}>
        Try again
      </button>
    ) : null}
  </div>
);

export function ApiErrorBoundary(props: ApiErrorBoundaryProps): ReactElement {
  const Fallback = props.fallback ?? DefaultApiErrorFallback;
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundaryClass fallback={Fallback} onReset={reset} onError={props.onError}>
          {props.children}
        </ErrorBoundaryClass>
      )}
    </QueryErrorResetBoundary>
  );
}
