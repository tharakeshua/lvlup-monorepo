/**
 * FIX-1 addendum — `withIdempotency` surfaces an in-flight lease conflict as a
 * TYPED `FAILED_PRECONDITION` ServiceError with a retry-after hint, instead of
 * letting the repo's raw `IDEMPOTENCY_CONFLICT` Error bubble to the wire as an
 * opaque INTERNAL.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { withIdempotency } from "../shared/idempotency";
import { ServiceError } from "../shared/context";

describe("withIdempotency — conflict surfacing", () => {
  it("maps IDEMPOTENCY_CONFLICT → FAILED_PRECONDITION with retryAfterMs meta", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    // Take the lease (in_flight) so the next begin() conflicts.
    await ctx.repos.idempotency.begin(tenantId, ctx.uid, "k1");

    const err = await withIdempotency(ctx, tenantId, "k1", async () => "never").catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).code).toBe("FAILED_PRECONDITION");
    expect((err as ServiceError).meta).toMatchObject({
      idempotencyKey: "k1",
      retryable: true,
      retryAfterMs: 5_000,
    });
  });

  it("returns the committed result without re-running the body", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    let runs = 0;
    const body = async () => {
      runs += 1;
      return "value";
    };
    expect(await withIdempotency(ctx, tenantId, "k2", body)).toBe("value");
    expect(await withIdempotency(ctx, tenantId, "k2", body)).toBe("value");
    expect(runs).toBe(1);
  });
});
