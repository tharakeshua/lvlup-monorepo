/**
 * Error policy + ApiErrorBoundary — UNIT (no emulator; jsdom for the boundary).
 *
 * Locks query-infra.md §7.3 (shouldThrowOnError / defaultRetry) + §9.6:
 *   • PERMISSION_DENIED / NOT_FOUND / TENANT_SUSPENDED / FEATURE_DISABLED → throw
 *     to the boundary (render an error UI, not an empty state),
 *   • a background refetch with existing data does NOT throw to the boundary,
 *   • defaultRetry: retryable===false ⇒ never retry; transient ⇒ up to 2,
 *   • the boundary renders a typed-ApiError fallback (not empty state).
 *
 * Self-skips until `@levelup/query` exports the policy fns / boundary.
 */
import { describe, it, expect } from "vitest";
import * as query from "../index";

const Q = query as unknown as {
  shouldThrowOnError?: (error: unknown, query?: { state?: { data?: unknown } }) => boolean;
  defaultRetry?: (failureCount: number, error: unknown) => boolean;
  ApiErrorBoundary?: unknown;
};

const apiErr = (code: string, retryable?: boolean) => ({ code, message: code, retryable });
const queryWithData = (data: unknown) => ({ state: { data } });

(Q.shouldThrowOnError ? describe : describe.skip)("shouldThrowOnError (§7.3)", () => {
  it.each(["PERMISSION_DENIED", "NOT_FOUND", "TENANT_SUSPENDED", "FEATURE_DISABLED"])(
    "%s throws to the boundary",
    (code) => {
      expect(Q.shouldThrowOnError!(apiErr(code), queryWithData(undefined))).toBe(true);
    }
  );

  it("a transient error on a query WITH existing data does NOT throw (no blank screen)", () => {
    // not one of the always-throw codes, and data is present → keep the screen
    expect(Q.shouldThrowOnError!(apiErr("INTERNAL_ERROR"), queryWithData([{ id: 1 }]))).toBe(false);
  });

  it("a transient error on a query with NO data throws (nothing to show otherwise)", () => {
    expect(Q.shouldThrowOnError!(apiErr("INTERNAL_ERROR"), queryWithData(undefined))).toBe(true);
  });

  it("PERMISSION_DENIED throws EVEN when stale data exists (auth must surface)", () => {
    expect(Q.shouldThrowOnError!(apiErr("PERMISSION_DENIED"), queryWithData([{ id: 1 }]))).toBe(
      true
    );
  });
});

(Q.defaultRetry ? describe : describe.skip)("defaultRetry (§7.3)", () => {
  it("never retries when retryable === false (4xx / ⚷)", () => {
    expect(Q.defaultRetry!(0, apiErr("VALIDATION_ERROR", false))).toBe(false);
    expect(Q.defaultRetry!(1, apiErr("PERMISSION_DENIED", false))).toBe(false);
  });

  it("retries transient errors up to 2 times then stops", () => {
    expect(Q.defaultRetry!(0, apiErr("INTERNAL_ERROR"))).toBe(true);
    expect(Q.defaultRetry!(1, apiErr("INTERNAL_ERROR"))).toBe(true);
    expect(Q.defaultRetry!(2, apiErr("INTERNAL_ERROR"))).toBe(false);
  });

  it("IDEMPOTENCY_CONFLICT (retryable) retries (transient in-flight lease)", () => {
    expect(Q.defaultRetry!(0, apiErr("IDEMPOTENCY_CONFLICT", true))).toBe(true);
  });
});

(Q.ApiErrorBoundary ? describe : describe.skip)(
  "ApiErrorBoundary renders a typed fallback (§9.6)",
  () => {
    it("a thrown PERMISSION_DENIED renders the fallback (not an empty state)", async () => {
      let RTL: typeof import("@testing-library/react");
      let React: typeof import("react");
      let RQ: typeof import("@tanstack/react-query");
      try {
        RTL = await import("@testing-library/react");
        React = await import("react");
        RQ = await import("@tanstack/react-query");
      } catch {
        return;
      }
      const Boom = () => {
        throw { code: "PERMISSION_DENIED", message: "denied" };
      };
      const Fallback = ({ error }: { error: { code: string } }) =>
        React.createElement("div", { "data-testid": "fallback" }, error.code);
      const qc = new RQ.QueryClient();
      const ui = React.createElement(
        RQ.QueryClientProvider,
        { client: qc },
        React.createElement(
          Q.ApiErrorBoundary as never,
          { fallback: Fallback } as never,
          React.createElement(Boom)
        )
      );
      const { queryByTestId } = RTL.render(ui);
      expect(queryByTestId("fallback")?.textContent).toBe("PERMISSION_DENIED");
    });
  }
);
