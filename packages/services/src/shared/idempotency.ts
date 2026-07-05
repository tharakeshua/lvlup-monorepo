/**
 * Service-side idempotency helper (server-shared.md §2.7 / §5.4). For services
 * whose def is `idempotent`, the onCall adapter normally dedupes via
 * `ctx.repos.idempotency`. This helper lets a service that owns a DOMAIN dedupe key
 * (e.g. `uploadAnswerSheets` on `(uid, examId, studentId)`) run its body at most
 * once and return the cached result on retry.
 */
import type { AuthContext } from "./context.js";
import { fail } from "./context.js";

/**
 * Run `body` under the `(uid, key)` idempotency lease. If a committed result
 * exists, returns it without re-running. Otherwise runs `body`, commits, returns.
 *
 * An unexpired in-flight lease (`IDEMPOTENCY_CONFLICT` from the repo) surfaces as
 * a typed FAILED_PRECONDITION with a retry-after hint — never a raw INTERNAL. If
 * `body` throws, the lease is released (best-effort) so an immediate retry can
 * run instead of being locked out until lease expiry.
 */
export async function withIdempotency<T>(
  ctx: AuthContext,
  tenantId: string,
  key: string,
  body: () => Promise<T>
): Promise<T> {
  let begin;
  try {
    begin = await ctx.repos.idempotency.begin(tenantId, ctx.uid, key);
  } catch (err) {
    if ((err as { code?: string })?.code === "IDEMPOTENCY_CONFLICT") {
      fail(
        "FAILED_PRECONDITION",
        "an identical request is already in flight — retry in a few seconds",
        { idempotencyKey: key, retryable: true, retryAfterMs: 5_000 }
      );
    }
    throw err;
  }
  if (begin.status === "committed") {
    return begin.result as T;
  }
  try {
    const result = await body();
    await ctx.repos.idempotency.commit(tenantId, ctx.uid, key, result);
    return result;
  } catch (err) {
    // Optional on the seam (the in-memory twin omits it); never mask the body error.
    await (
      ctx.repos.idempotency as { release?: (t: string, u: string, k: string) => Promise<void> }
    )
      .release?.(tenantId, ctx.uid, key)
      ?.catch(() => undefined);
    throw err;
  }
}
