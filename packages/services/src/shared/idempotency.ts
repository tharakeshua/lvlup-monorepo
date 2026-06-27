/**
 * Service-side idempotency helper (server-shared.md §2.7 / §5.4). For services
 * whose def is `idempotent`, the onCall adapter normally dedupes via
 * `ctx.repos.idempotency`. This helper lets a service that owns a DOMAIN dedupe key
 * (e.g. `uploadAnswerSheets` on `(uid, examId, studentId)`) run its body at most
 * once and return the cached result on retry.
 */
import type { AuthContext } from "./context.js";

/**
 * Run `body` under the `(uid, key)` idempotency lease. If a committed result
 * exists, returns it without re-running. Otherwise runs `body`, commits, returns.
 */
export async function withIdempotency<T>(
  ctx: AuthContext,
  tenantId: string,
  key: string,
  body: () => Promise<T>
): Promise<T> {
  const begin = await ctx.repos.idempotency.begin(tenantId, ctx.uid, key);
  if (begin.status === "committed") {
    return begin.result as T;
  }
  const result = await body();
  await ctx.repos.idempotency.commit(tenantId, ctx.uid, key, result);
  return result;
}
