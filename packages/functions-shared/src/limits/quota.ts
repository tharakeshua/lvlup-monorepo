/**
 * Resource quota gate (server-shared.md §2.6). Reads usage/limits via
 * `ctx.repos.tenants.get(...)` — NOT direct Firestore. Throws QUOTA_EXCEEDED.
 * Consolidates the live `identity/utils/quota.ts`.
 */
import type { AuthContext } from "../context/auth-context.js";
import { fail } from "../request/fail.js";

export type QuotaResource = "student" | "teacher" | "space" | "exam";

const USAGE_KEY: Record<QuotaResource, string> = {
  student: "studentCount",
  teacher: "teacherCount",
  space: "spaceCount",
  exam: "examCount",
};
const LIMIT_KEY: Record<QuotaResource, string> = {
  student: "maxStudents",
  teacher: "maxTeachers",
  space: "maxSpaces",
  exam: "maxExams",
};

export async function assertQuota(
  ctx: AuthContext,
  resource: QuotaResource,
  batchSize = 1
): Promise<void> {
  if (ctx.uid === "<system>") return;
  if (!ctx.tenantId) return; // no tenant → nothing to meter
  const tenant = await ctx.repos.tenants.get(ctx.tenantId);
  if (!tenant) return;
  const limit = tenant.limits?.[LIMIT_KEY[resource]];
  if (limit == null) return; // unlimited / unset
  const current = tenant.usage?.[USAGE_KEY[resource]] ?? 0;
  if (current + batchSize > limit) {
    fail("QUOTA_EXCEEDED", `${resource} quota exceeded (${current}/${limit})`, {
      meta: { resource, current, limit, batchSize },
    });
  }
}
