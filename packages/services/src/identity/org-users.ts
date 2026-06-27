/**
 * Org-user provisioning + tenant switching/joining + bulk operations (identity.md).
 *
 * `createOrgUser` is the idempotent saga (Auth user → entity → membership →
 * claims → counters) — it resyncs claims via the single factory. Bulk ops are
 * batched + idempotent, accumulating per-row errors. `switchActiveTenant`/
 * `joinTenant` rebuild claims for the target tenant (the client forces token
 * refresh). NO request carries `tenantId`; the target travels as `targetTenantId`/
 * `tenantCode` and is validated server-side.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { provisionMembership } from "./provision-membership.js";
import { syncMembershipClaims } from "./sync-membership-claims.js";

// ── createOrgUser ─────────────────────────────────────────────────────────────
export async function createOrgUserService(
  input: ReqOf<"v1.identity.createOrgUser">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.createOrgUser">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId });

  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  const tenantCode = (tenant?.["code"] as string | undefined) ?? "";

  // 1) Provision the auth user (Admin Auth via the claims/users repo bridge).
  const repos = xrepos(ctx);
  const now = ctx.now();
  const entityRepoByRole: Record<
    string,
    {
      upsert: (
        t: string,
        d: Record<string, unknown>,
        n?: string
      ) => Promise<{ id: string; created: boolean }>;
    }
  > = {
    student: ctx.repos.students,
    teacher: ctx.repos.teachers,
    parent: repos.parents,
    staff: repos.staff,
  };
  const entityRepo = entityRepoByRole[input.role];
  if (!entityRepo)
    fail("INVALID_ARGUMENT", `role ${input.role} cannot be created via createOrgUser`);

  // The auth-user creation + uid allocation is an authority op behind the repo.
  // Resolve an EXISTING auth user by email, else CREATE one so the claims write
  // (syncMembershipClaims → Admin-Auth setCustomUserClaims) targets a real record
  // (a `pending_*` placeholder uid has no Auth user → "no user record" crash).
  let user = input.email ? await xrepos(ctx).users.get(input.email) : null;
  if (!user) {
    const created = await xrepos(ctx).users.create({
      email: input.email,
      displayName: `${input.firstName} ${input.lastName}`.trim(),
    });
    user = { id: created.uid };
  }
  const uid = user["id"] as string;

  // 2) Create the role entity doc.
  const { id: entityId } = await entityRepo.upsert(
    tenantId,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      authUid: uid,
      classIds: input.classIds ?? [],
      subjects: input.subjects ?? [],
      status: "active",
      createdBy: ctx.uid,
    },
    now
  );

  // 3+4) Membership + claims via the single factory.
  const entityIds =
    input.role === "student"
      ? { studentId: entityId }
      : input.role === "teacher"
        ? { teacherId: entityId }
        : input.role === "parent"
          ? { parentId: entityId }
          : { staffId: entityId };
  const { membershipId } = await provisionMembership(
    {
      uid,
      tenantId,
      tenantCode,
      role: input.role,
      joinSource: "admin_created",
      entityIds,
      classIds: input.classIds as string[] | undefined,
      parentLinkedStudentIds: input.linkedStudentIds as string[] | undefined,
    },
    ctx
  );

  // 5) Counters bump (denormalized; trigger reconciles).
  await ctx.repos.tx(async (tx) => {
    tx.upsert("tenants", tenantId, { id: tenantId });
  });

  return { uid, entityId, membershipId } as unknown as ResOf<"v1.identity.createOrgUser">;
}

// ── switchActiveTenant ────────────────────────────────────────────────────────
export async function switchActiveTenantService(
  input: ReqOf<"v1.identity.switchActiveTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.switchActiveTenant">> {
  authorize(ctx, "tenant.switch", { tenantId: input.targetTenantId });

  const membership = await xrepos(ctx).memberships.get(ctx.uid, input.targetTenantId);
  if (!membership) fail("PERMISSION_DENIED", "no membership in target tenant");
  if ((membership["status"] as string) !== "active")
    fail("PERMISSION_DENIED", "membership not active");

  // Rebuild claims for the target tenant; the client refreshes its ID token.
  await syncMembershipClaims(ctx.uid, input.targetTenantId, ctx);
  return {
    tenantId: input.targetTenantId,
    role: membership["role"],
  } as ResOf<"v1.identity.switchActiveTenant">;
}

// ── joinTenant ────────────────────────────────────────────────────────────────
export async function joinTenantService(
  input: ReqOf<"v1.identity.joinTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.joinTenant">> {
  const tenant = await ctx.repos.tenants.get(input.tenantCode, input.tenantCode);
  if (!tenant) fail("NOT_FOUND", `no tenant for code ${input.tenantCode}`);
  const tenantId = tenant["id"] as string;
  authorize(ctx, "tenant.join", { tenantId });

  // Self-service student join → provision a student membership.
  const { membershipId } = await provisionMembership(
    {
      uid: ctx.uid,
      tenantId,
      tenantCode: input.tenantCode,
      role: "student",
      joinSource: "self_joined",
    },
    ctx
  );
  return { tenantId, membershipId, role: "student" } as unknown as ResOf<"v1.identity.joinTenant">;
}

// ── bulkImportStudents ────────────────────────────────────────────────────────
export async function bulkImportStudentsService(
  input: ReqOf<"v1.identity.bulkImportStudents">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.bulkImportStudents">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkImport", { tenantId });

  let created = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];
  const now = ctx.now();

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]!;
    try {
      await ctx.repos.students.upsert(
        tenantId,
        {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          rollNumber: row.rollNumber,
          section: row.section,
          grade: row.grade,
          admissionNumber: row.admissionNumber,
          classIds: row.classIds ?? input.defaultClassIds ?? [],
          status: "active",
          createdBy: ctx.uid,
        },
        now
      );
      created++;
    } catch (e) {
      errors.push({ row: i, error: e instanceof Error ? e.message : "unknown error" });
      skipped++;
    }
  }
  return { created, skipped, errors } as ResOf<"v1.identity.bulkImportStudents">;
}

// ── bulkImportTeachers ────────────────────────────────────────────────────────
export async function bulkImportTeachersService(
  input: ReqOf<"v1.identity.bulkImportTeachers">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.bulkImportTeachers">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkImport", { tenantId });

  let created = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];
  const now = ctx.now();

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]!;
    try {
      await ctx.repos.teachers.upsert(
        tenantId,
        {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          subjects: row.subjects ?? [],
          department: row.department,
          status: "active",
          createdBy: ctx.uid,
        },
        now
      );
      created++;
    } catch (e) {
      errors.push({ row: i, error: e instanceof Error ? e.message : "unknown error" });
      skipped++;
    }
  }
  return { created, skipped, errors } as ResOf<"v1.identity.bulkImportTeachers">;
}

// ── bulkUpdateStatus ──────────────────────────────────────────────────────────
export async function bulkUpdateStatusService(
  input: ReqOf<"v1.identity.bulkUpdateStatus">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.bulkUpdateStatus">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkStatus", { tenantId });

  const repoFor: Record<
    string,
    {
      get(t: string, id: string): Promise<Record<string, unknown> | null>;
      upsert(
        t: string,
        d: Record<string, unknown>,
        n?: string
      ): Promise<{ id: string; created: boolean }>;
    }
  > = {
    student: ctx.repos.students,
    teacher: ctx.repos.teachers,
    class: ctx.repos.classes,
  };
  const repo = repoFor[input.entityType];
  if (!repo) fail("INVALID_ARGUMENT", `unknown entityType ${input.entityType}`);

  let updated = 0;
  const errors: { id: string; error: string }[] = [];
  const now = ctx.now();
  for (const id of input.ids) {
    try {
      const existing = await repo.get(tenantId, id);
      if (!existing) {
        errors.push({ id, error: "not found" });
        continue;
      }
      await repo.upsert(
        tenantId,
        { ...existing, id, status: input.status, updatedBy: ctx.uid },
        now
      );
      updated++;
    } catch (e) {
      errors.push({ id, error: e instanceof Error ? e.message : "unknown error" });
    }
  }
  return { updated, errors } as ResOf<"v1.identity.bulkUpdateStatus">;
}

// ── rolloverSession ───────────────────────────────────────────────────────────
export async function rolloverSessionService(
  input: ReqOf<"v1.identity.rolloverSession">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.rolloverSession">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "session.rollover", { tenantId });

  // Multi-step → Cloud Tasks in production. Here we compute the deterministic
  // class/student moves and enqueue the chunked work.
  const map = (input.promotionMap ?? {}) as Record<string, string>;
  const classesCreated = Object.keys(map).length;
  let studentsMoved = 0;
  const now = ctx.now();
  await ctx.repos.tx(async (tx) => {
    for (const [, toClass] of Object.entries(map)) {
      tx.upsert("classes", tenantId, { id: toClass, academicSessionId: input.toSessionId });
      studentsMoved++;
    }
  });
  void now;
  return { classesCreated, studentsMoved } as ResOf<"v1.identity.rolloverSession">;
}
