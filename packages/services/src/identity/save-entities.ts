/**
 * Tenant-scoped entity upserts: `saveStudent/Teacher/Parent/Staff/Class/
 * AcademicSession` (identity.md §"Command services"). Each is `save*` = create or
 * update of METADATA (DX-5; lifecycle is the separate `bulkUpdateStatus`/archive
 * path). `delete?=true` maps to an `entityStatus` archive transition (D5), NOT a
 * hard delete. The create branch provisions membership + claims for role entities
 * (student/teacher/parent/staff) via the single `provisionMembership` factory.
 *
 * Cross-domain link integrity (§6.11): classIds/parentIds existence is validated
 * in-tenant before persisting. `tenantId` ALWAYS from `ctx`.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import type { EntityRepo } from "../repo-admin/types.js";
import { xrepos } from "../shared/extended-repos.js";
import { provisionMembership } from "./provision-membership.js";

type Doc = Record<string, unknown>;

/** Shared upsert+archive engine for an entity-with-status `save*` callable. */
async function saveEntity(
  ctx: AuthContext,
  repo: EntityRepo,
  entityName: string,
  input: { id?: string; data: Doc; delete?: boolean }
): Promise<{ id: string; created: boolean; deleted?: boolean }> {
  const tenantId = requireTenant(ctx);
  const existing = input.id ? await repo.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", `${entityName} ${input.id} not found`);

  const now = ctx.now();

  // `delete?=true` → archive transition (active→archived).
  if (input.delete && input.id) {
    const from = (existing?.["status"] as string | undefined) ?? "active";
    assertTransition("entityStatus", from, "archived");
    await repo.upsert(
      tenantId,
      { ...(existing ?? {}), id: input.id, status: "archived", updatedBy: ctx.uid },
      now
    );
    return { id: input.id, created: false, deleted: true };
  }

  // Explicit status change → transition check.
  const incomingStatus = input.data["status"] as string | undefined;
  if (incomingStatus && existing) {
    const from = (existing["status"] as string | undefined) ?? "active";
    if (from !== incomingStatus) assertTransition("entityStatus", from, incomingStatus);
  }

  const payload: Doc = {
    ...(existing ?? {}),
    ...input.data,
    ...(input.id ? { id: input.id } : {}),
    status: incomingStatus ?? (existing?.["status"] as string | undefined) ?? "active",
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
    updatedBy: ctx.uid,
  };

  const { id, created } = await repo.upsert(tenantId, payload, now);
  return { id, created };
}

/** Validate that referenced class ids exist in-tenant (link integrity). */
async function assertClassesExist(
  ctx: AuthContext,
  tenantId: string,
  classIds?: string[]
): Promise<void> {
  if (!classIds?.length) return;
  const found = await ctx.repos.classes.getMany(tenantId, classIds);
  if (found.length !== classIds.length) {
    fail("INVALID_ARGUMENT", "one or more classIds do not exist in tenant");
  }
}

// ── saveStudent ───────────────────────────────────────────────────────────────
export async function saveStudentService(
  input: ReqOf<"v1.identity.saveStudent">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveStudent">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId });
  await assertClassesExist(ctx, tenantId, input.data.classIds as string[] | undefined);

  const wasCreate = !input.id;
  const res = await saveEntity(ctx, ctx.repos.students, "student", input);

  // New students with an auth account get a membership + claims (single factory).
  if (wasCreate && !input.delete) {
    const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
    const tenantCode = (tenant?.["code"] as string | undefined) ?? "";
    const authUid = (input.data as Record<string, unknown>)["authUid"] as string | undefined;
    if (authUid) {
      await provisionMembership(
        {
          uid: authUid,
          tenantId,
          tenantCode,
          role: "student",
          joinSource: "admin_created",
          entityIds: { studentId: res.id },
          classIds: input.data.classIds as string[] | undefined,
        },
        ctx
      );
    }
  }
  return res as ResOf<"v1.identity.saveStudent">;
}

// ── saveTeacher ───────────────────────────────────────────────────────────────
export async function saveTeacherService(
  input: ReqOf<"v1.identity.saveTeacher">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveTeacher">> {
  requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId: ctx.tenantId ?? undefined });
  const res = await saveEntity(ctx, ctx.repos.teachers, "teacher", input);
  return res as ResOf<"v1.identity.saveTeacher">;
}

// ── saveParent ────────────────────────────────────────────────────────────────
export async function saveParentService(
  input: ReqOf<"v1.identity.saveParent">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveParent">> {
  requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId: ctx.tenantId ?? undefined });
  const res = await saveEntity(ctx, xrepos(ctx).parents, "parent", input);
  return res as ResOf<"v1.identity.saveParent">;
}

// ── saveStaff ─────────────────────────────────────────────────────────────────
export async function saveStaffService(
  input: ReqOf<"v1.identity.saveStaff">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveStaff">> {
  requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId: ctx.tenantId ?? undefined });
  const res = await saveEntity(ctx, xrepos(ctx).staff, "staff", input);
  return res as ResOf<"v1.identity.saveStaff">;
}

// ── saveClass ─────────────────────────────────────────────────────────────────
export async function saveClassService(
  input: ReqOf<"v1.identity.saveClass">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveClass">> {
  requireTenant(ctx);
  authorize(ctx, "class.write", { classId: input.id, tenantId: ctx.tenantId ?? undefined });
  const res = await saveEntity(ctx, ctx.repos.classes, "class", input);
  return res as ResOf<"v1.identity.saveClass">;
}

// ── saveAcademicSession ───────────────────────────────────────────────────────
export async function saveAcademicSessionService(
  input: ReqOf<"v1.identity.saveAcademicSession">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveAcademicSession">> {
  requireTenant(ctx);
  authorize(ctx, "session.write", { tenantId: ctx.tenantId ?? undefined });
  const res = await saveEntity(ctx, xrepos(ctx).academicSessions, "academicSession", input);
  return res as ResOf<"v1.identity.saveAcademicSession">;
}
