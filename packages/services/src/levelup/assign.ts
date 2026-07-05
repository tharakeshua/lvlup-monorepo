/**
 * `assignContent` (LVL-2) — assign a space or an exam to one or more classes.
 *
 * Canonical effect: the target entity's `classIds` (the ONE assignment field both
 * SpaceSchema and ExamSchema carry) is unioned with the requested classes. The
 * optional window/visibility metadata has NO field on the canonical entities, so
 * it lands in a dedicated tenant-scoped `assignments` collection with the
 * DETERMINISTIC id `{contentType}_{contentId}_{classId}` — re-assigning the same
 * content to the same class overwrites the same row (the contract's
 * `idempotent: true` without an idempotency key). `getAssignmentMatrix` reads
 * `dueAt` from these rows.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";

export function assignmentRowId(contentType: string, contentId: string, classId: string): string {
  return `${contentType}_${contentId}_${classId}`;
}

export async function assignContentService(
  input: ReqOf<"v1.levelup.assignContent">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.assignContent">> {
  const tenantId = requireTenant(ctx);

  const repo = input.contentType === "space" ? ctx.repos.spaces : ctx.repos.exams;
  if (input.contentType === "space") {
    authorize(ctx, "space.write", { spaceId: input.contentId, tenantId });
  } else {
    authorize(ctx, "exam.write", { examId: input.contentId, tenantId });
  }

  const target = await repo.get(tenantId, input.contentId);
  if (!target) fail("NOT_FOUND", `${input.contentType} not found`);

  // Union-merge the canonical classIds field (never drops an existing assignment).
  const existing = Array.isArray(target["classIds"]) ? (target["classIds"] as unknown[]) : [];
  const classIds = [...new Set([...existing.map(String), ...input.classIds])];
  await repo.upsert(tenantId, { id: input.contentId, classIds, updatedBy: ctx.uid }, ctx.now());

  // Per-class assignment metadata rows (window + visibility, deterministic ids).
  const now = ctx.now();
  for (const classId of input.classIds) {
    await xrepos(ctx).assignments.upsert(tenantId, {
      id: assignmentRowId(input.contentType, input.contentId, classId),
      contentType: input.contentType,
      contentId: input.contentId,
      classId,
      startAt: input.window?.startAt ?? null,
      dueAt: input.window?.dueAt ?? null,
      visibility: input.visibility ?? "visible",
      assignedBy: ctx.uid,
      assignedAt: now,
    });
  }

  return { id: input.contentId, created: false } as unknown as ResOf<"v1.levelup.assignContent">;
}
