/**
 * Identity SHARED reads (services/shared topology) — role-scoped, tenant-resolved.
 * `getMe` assembles the caller's user + memberships + claims + active tenant;
 * the list/get readers are paginated and tenant-scoped. These are client-safe
 * (no ⚷ fields) but still server-resolve `tenantId` from `ctx`.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import {
  StudentSchema,
  TeacherSchema,
  ParentSchema,
  StaffSchema,
  ClassSchema,
  AcademicSessionSchema,
  UnifiedUserSchema,
  UserMembershipSchema,
  TenantSchema,
} from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import type { EntityRepo, ListOptions } from "../repo-admin/types.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

/**
 * Defensive role-entity projection (DRIFT KILLER — same intent as `projectSpace`
 * in levelup/content.ts). The strict domain schemas (`.strict()`) reject any
 * stored/legacy key that isn't canonical (e.g. `archivedAt`, `schedule`,
 * `isAdmin`), and require the nullable audit fields (`lastLogin`) to be present.
 * Synthetic DEMO01 rosters carry such legacy keys; migrated tenant_subhang data is
 * already canonical (and sparse). This whitelists EXACTLY the schema's canonical
 * keys — derived from the Zod shape so it can never drift from the contract —
 * drops null-valued optionals (a callable turns `undefined`→`null` over the wire,
 * which `.optional()` then rejects), and coerces each `nullableRequired` field to
 * `null` when absent so a strict `.nullable()` required field still validates.
 */
function projectEntity(
  doc: Doc,
  allowed: readonly string[],
  nullableRequired: readonly string[] = []
): Doc {
  const out: Doc = {};
  for (const k of allowed) {
    const v = doc[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  for (const k of nullableRequired) if (out[k] === undefined) out[k] = null;
  // Canonical `zEntityStatus` is exactly {active, archived}. Synthetic rosters carry
  // legacy lifecycle values ('invited', 'suspended', …); coerce any non-`archived`
  // status to the non-terminal 'active' so the strict enum validates (archived is
  // the only terminal/soft-deleted state the canonical vocabulary models).
  if ("status" in out && out["status"] !== "archived") out["status"] = "active";
  return out;
}

const STUDENT_KEYS = Object.keys(StudentSchema.shape);
const TEACHER_KEYS = Object.keys(TeacherSchema.shape);
const PARENT_KEYS = Object.keys(ParentSchema.shape);
const STAFF_KEYS = Object.keys(StaffSchema.shape);
const CLASS_KEYS = Object.keys(ClassSchema.shape);
const SESSION_KEYS = Object.keys(AcademicSessionSchema.shape);
const USER_KEYS = Object.keys(UnifiedUserSchema.shape);
const MEMBERSHIP_KEYS = Object.keys(UserMembershipSchema.shape);
const TENANT_FULL_KEYS = Object.keys(TenantSchema.shape);

/** Permission keys recognized by the domain `PlatformClaims` (drop legacy/unknown). */
const TEACHER_PERMISSION_KEYS = new Set([
  "canManageSpaces",
  "canManageStudents",
  "canManageClasses",
  "canCreateExams",
  "canGradeExams",
  "canViewAnalytics",
  "canManageContent",
  "canReleaseResults",
]);
const STAFF_PERMISSION_KEYS = new Set([
  "canManageUsers",
  "canManageClasses",
  "canImportData",
  "canExportData",
  "canViewAnalytics",
  "canManageAnnouncements",
]);

function filterPermRecord(v: unknown, allow: Set<string>): Record<string, boolean> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (allow.has(k) && typeof val === "boolean") out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Project a raw custom-claims JWT blob into a strict-domain `PlatformClaims`.
 * The JWT carries harness/runtime keys (`activeTenantId`, `_role`, …) and may carry
 * legacy permission keys; this whitelists exactly the `PlatformClaims` fields and
 * drops unrecognized permission keys so getMe validates against the domain schema.
 */
function projectPlatformClaims(raw: Doc): Doc {
  const out: Doc = {};
  const passThrough = [
    "role",
    "tenantId",
    "tenantCode",
    "teacherId",
    "studentId",
    "parentId",
    "scannerId",
    "staffId",
    "classIds",
    "classIdsOverflow",
    "studentIds",
    "isSuperAdmin",
  ];
  // Skip empty strings too: legacy claim builders write `tenantCode: ""`,
  // which the branded `.optional()` id schemas reject (min-1).
  for (const k of passThrough) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") out[k] = raw[k];
  }
  const perms = filterPermRecord(raw["permissions"], TEACHER_PERMISSION_KEYS);
  if (perms) out["permissions"] = perms;
  const staffPerms = filterPermRecord(raw["staffPermissions"], STAFF_PERMISSION_KEYS);
  if (staffPerms) out["staffPermissions"] = staffPerms;
  return out;
}

/**
 * Project a stored `/users/{uid}` doc into a strict-domain `UnifiedUser`. The repo
 * injects `id: snap.id` (UnifiedUser is keyed by `uid`, not `id`); legacy writers
 * persist optional string fields as `null` (the domain treats them as `.optional()`,
 * i.e. absent) and may omit the `createdBy`/`updatedBy` audit pair. Normalize:
 * drop `id`, drop null-valued optional strings, and default the audit actor to uid.
 */
function projectUnifiedUser(user: Doc, uid: string): Doc {
  // Whitelist to the schema shape (drops the repo-injected `id` and any stray
  // legacy keys) and drop null-valued optionals; legacy saga writers omitted
  // `uid`/`isSuperAdmin`/`status`/`updatedAt`/`lastLogin` — default them so the
  // strict schema validates (E2E-1: getMe drift broke every literal-true app).
  const out: Doc = {};
  for (const k of USER_KEYS) {
    const v = user[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  out["uid"] = out["uid"] ?? uid;
  out["isSuperAdmin"] = out["isSuperAdmin"] ?? false;
  const USER_STATUSES = new Set(["active", "suspended", "deleted"]);
  if (!USER_STATUSES.has(out["status"] as string)) out["status"] = "active";
  out["updatedAt"] = out["updatedAt"] ?? out["createdAt"];
  out["createdBy"] = out["createdBy"] ?? uid;
  out["updatedBy"] = out["updatedBy"] ?? uid;
  if (out["lastLogin"] === undefined) out["lastLogin"] = null;
  return out;
}

/**
 * Project a stored membership doc into a strict-domain `UserMembership`.
 * Legacy writers persist `classIds` (a claims-sync key the schema doesn't
 * model), an EMPTY `tenantCode`, and omit the audit pair + `lastActive`.
 * `tenantCodeByTenant` supplies the authoritative code for empty/missing ones
 * (falls back to the tenantId — same brand rules — so getMe never hard-fails).
 */
/**
 * Canonicalize membership.permissions to domain `TeacherPermissions`:
 * `{ permissions?: Record<key,boolean>, managedClassIds?, managedSpaceIds? }`.
 * Writers historically flattened boolean keys onto the wrapper (and/or nested a
 * second `permissions` bag) — strict UserMembershipSchema rejects the flat
 * siblings, which made getMe fail client-side `validateResponses:true` and
 * surface as Access Denied / "invalid data" after school login.
 */
function projectTeacherPermissions(raw: unknown): Doc | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Doc;
  const nestedSrc =
    r["permissions"] && typeof r["permissions"] === "object" && !Array.isArray(r["permissions"])
      ? (r["permissions"] as Doc)
      : {};
  const bag: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(nestedSrc)) {
    if (TEACHER_PERMISSION_KEYS.has(k) && typeof v === "boolean") bag[k] = v;
  }
  for (const [k, v] of Object.entries(r)) {
    if (k === "permissions" || k === "managedClassIds" || k === "managedSpaceIds") continue;
    if (TEACHER_PERMISSION_KEYS.has(k) && typeof v === "boolean") bag[k] = v;
  }
  const out: Doc = {};
  if (Object.keys(bag).length) out["permissions"] = bag;
  if (Array.isArray(r["managedClassIds"])) out["managedClassIds"] = r["managedClassIds"];
  if (Array.isArray(r["managedSpaceIds"])) out["managedSpaceIds"] = r["managedSpaceIds"];
  return Object.keys(out).length ? out : undefined;
}

function projectMembership(m: Doc, tenantCodeByTenant: Map<string, string>): Doc {
  const out: Doc = {};
  for (const k of MEMBERSHIP_KEYS) {
    const v = m[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  const tenantId = out["tenantId"] as string;
  if (!out["tenantCode"]) {
    out["tenantCode"] = tenantCodeByTenant.get(tenantId) || tenantId;
  }
  out["createdBy"] = out["createdBy"] ?? out["uid"];
  out["updatedBy"] = out["updatedBy"] ?? out["createdBy"];
  out["updatedAt"] = out["updatedAt"] ?? out["createdAt"];
  if (out["lastActive"] === undefined) out["lastActive"] = null;
  if (out["permissions"] !== undefined) {
    const cleaned = projectTeacherPermissions(out["permissions"]);
    if (cleaned) out["permissions"] = cleaned;
    else delete out["permissions"];
  }
  return out;
}

/**
 * Project a stored tenant doc into the strict full `Tenant`. Legacy docs carry
 * top-level `geminiKeyRef`/`tenantId` (the domain nests the ref in `settings`)
 * and omit the required `features`/`settings`/`stats` embeds (all-default
 * shapes) + the audit/`trialEndsAt` fields.
 */
function projectTenantFull(t: Doc): Doc {
  const out: Doc = {};
  for (const k of TENANT_FULL_KEYS) {
    const v = t[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  out["features"] = out["features"] ?? {};
  const settings = (out["settings"] as Doc | undefined) ?? {};
  if (t["geminiKeyRef"] && !settings["geminiKeyRef"]) {
    settings["geminiKeyRef"] = t["geminiKeyRef"];
  }
  out["settings"] = settings;
  out["stats"] = out["stats"] ?? {};
  const subscription = (out["subscription"] as Doc | undefined) ?? { plan: "free" };
  if (subscription["renewsAt"] === undefined) subscription["renewsAt"] = null;
  out["subscription"] = subscription;
  if (out["trialEndsAt"] === undefined) out["trialEndsAt"] = null;
  const owner = out["ownerUid"];
  out["createdBy"] = out["createdBy"] ?? owner;
  out["updatedBy"] = out["updatedBy"] ?? out["createdBy"];
  out["updatedAt"] = out["updatedAt"] ?? out["createdAt"];
  return out;
}

/** Shared paginated-list reader over a tenant-scoped entity collection. */
async function listEntity(
  ctx: AuthContext,
  repo: EntityRepo,
  page: { cursor?: string; limit?: number },
  where?: Record<string, unknown>
): Promise<{ items: Doc[]; nextCursor: string | null }> {
  const tenantId = requireTenant(ctx);
  const opts: ListOptions = { cursor: page.cursor, limit: page.limit ?? 20, where };
  const res = await repo.list(tenantId, opts);
  return { items: res.items, nextCursor: res.nextCursor };
}

// ── getMe ─────────────────────────────────────────────────────────────────────
export async function getMeService(
  _input: ReqOf<"v1.identity.getMe">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getMe">> {
  void _input;
  const user = await xrepos(ctx).users.get(ctx.uid);
  if (!user) fail("NOT_FOUND", "user not found");
  const memberships = await xrepos(ctx).memberships.listForUser(ctx.uid);
  const rawClaims = (await ctx.repos.claims.get(ctx.uid)) ?? {};
  const activeTenant = ctx.tenantId
    ? await ctx.repos.tenants.get(ctx.tenantId, ctx.tenantId)
    : undefined;

  // Authoritative tenantCode per membership tenant (legacy rows store "").
  // Bounded: one read per DISTINCT code-less membership tenant; the active
  // tenant is reused from the fetch above.
  const tenantCodeByTenant = new Map<string, string>();
  if (activeTenant?.["tenantCode"] && ctx.tenantId) {
    tenantCodeByTenant.set(ctx.tenantId, activeTenant["tenantCode"] as string);
  }
  const codeless = [
    ...new Set(
      memberships
        .filter((m) => !m["tenantCode"] && !tenantCodeByTenant.has(m["tenantId"] as string))
        .map((m) => m["tenantId"] as string)
    ),
  ];
  await Promise.all(
    codeless.map(async (tid) => {
      const t = await ctx.repos.tenants.get(tid, tid).catch(() => null);
      if (t?.["tenantCode"]) tenantCodeByTenant.set(tid, t["tenantCode"] as string);
    })
  );

  const claims = projectPlatformClaims(rawClaims);
  if (!claims["tenantCode"] && ctx.tenantId && tenantCodeByTenant.has(ctx.tenantId)) {
    claims["tenantCode"] = tenantCodeByTenant.get(ctx.tenantId);
  }

  return {
    user: projectUnifiedUser(user, ctx.uid),
    memberships: memberships.map((m) => projectMembership(m, tenantCodeByTenant)),
    claims,
    activeTenant: activeTenant ? projectTenantFull(activeTenant) : undefined,
  } as unknown as ResOf<"v1.identity.getMe">;
}

// ── list/get students ─────────────────────────────────────────────────────────
export async function listStudentsService(
  input: ReqOf<"v1.identity.listStudents">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listStudents">> {
  authorize(ctx, "roster.read", { tenantId: ctx.tenantId ?? undefined });
  const where: Record<string, unknown> = {};
  const classId = (input as { classId?: string }).classId;
  if (classId) where["classIds"] = classId;
  const res = await listEntity(ctx, ctx.repos.students, input, where);
  res.items = res.items.map((d) => projectEntity(d, STUDENT_KEYS));
  return res as unknown as ResOf<"v1.identity.listStudents">;
}

export async function getStudentService(
  input: ReqOf<"v1.identity.getStudent">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getStudent">> {
  const tenantId = requireTenant(ctx);
  const student = await ctx.repos.students.get(tenantId, (input as { id: string }).id);
  if (!student) fail("NOT_FOUND", "student not found");
  return student as unknown as ResOf<"v1.identity.getStudent">;
}

// ── list/get teachers ─────────────────────────────────────────────────────────
export async function listTeachersService(
  input: ReqOf<"v1.identity.listTeachers">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listTeachers">> {
  const res = await listEntity(ctx, ctx.repos.teachers, input);
  res.items = res.items.map((d) => projectEntity(d, TEACHER_KEYS, ["lastLogin"]));
  return res as unknown as ResOf<"v1.identity.listTeachers">;
}

export async function getTeacherService(
  input: ReqOf<"v1.identity.getTeacher">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getTeacher">> {
  const tenantId = requireTenant(ctx);
  const teacher = await ctx.repos.teachers.get(tenantId, (input as { id: string }).id);
  if (!teacher) fail("NOT_FOUND", "teacher not found");
  return teacher as unknown as ResOf<"v1.identity.getTeacher">;
}

// ── list parents / staff / classes / sessions ─────────────────────────────────
export async function listParentsService(
  input: ReqOf<"v1.identity.listParents">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listParents">> {
  const res = await listEntity(ctx, xrepos(ctx).parents, input);
  res.items = res.items.map((d) => projectEntity(d, PARENT_KEYS, ["lastLogin"]));
  return res as unknown as ResOf<"v1.identity.listParents">;
}

export async function listStaffService(
  input: ReqOf<"v1.identity.listStaff">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listStaff">> {
  const res = await listEntity(ctx, xrepos(ctx).staff, input);
  res.items = res.items.map((d) => projectEntity(d, STAFF_KEYS));
  return res as unknown as ResOf<"v1.identity.listStaff">;
}

export async function listClassesService(
  input: ReqOf<"v1.identity.listClasses">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listClasses">> {
  const tenantId = requireTenant(ctx);
  // Teachers are claim-scoped to managed classIds — returning the full tenant
  // roster made the dashboard fan out summary.getClass for every class and
  // 403 on ones the teacher doesn't own. Admins/staff/super-admin keep the
  // full paginated list.
  const teacherScoped = ctx.role === "teacher" && !ctx.isSuperAdmin && Array.isArray(ctx.classIds);

  if (teacherScoped) {
    const ids = ctx.classIds.map(String).filter(Boolean);
    if (ids.length === 0) {
      return { items: [], nextCursor: null } as unknown as ResOf<"v1.identity.listClasses">;
    }
    const found = await ctx.repos.classes.getMany(tenantId, ids);
    const items = found.map((d) => projectEntity(d, CLASS_KEYS));
    // Claim sets are small (overflow capped); return as a single page.
    return { items, nextCursor: null } as unknown as ResOf<"v1.identity.listClasses">;
  }

  const res = await listEntity(ctx, ctx.repos.classes, input);
  // ClassSchema (list view) deliberately omits `schedule` (it lives on the detail
  // view / save payload) — the whitelist drops it plus any legacy `archivedAt`.
  res.items = res.items.map((d) => projectEntity(d, CLASS_KEYS));
  return res as unknown as ResOf<"v1.identity.listClasses">;
}

export async function getClassService(
  input: ReqOf<"v1.identity.getClass">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getClass">> {
  const tenantId = requireTenant(ctx);
  const classId = (input as { id: string }).id;
  // Align with listClasses + analytics.getSummary(class): teachers may only
  // read classes in their claim-scoped classIds (admins/staff keep tenant-wide).
  if (
    ctx.role === "teacher" &&
    !ctx.isSuperAdmin &&
    !ctx.classIds.map(String).includes(String(classId))
  ) {
    fail("PERMISSION_DENIED", `class ${classId} is not assigned to this teacher`);
  }
  const klass = await ctx.repos.classes.get(tenantId, classId);
  if (!klass) fail("NOT_FOUND", "class not found");
  // getClass returns counts + first roster page (the rest pages via listStudents).
  const roster = await ctx.repos.students.list(tenantId, {
    where: { classIds: classId },
    limit: 20,
  });
  return {
    ...klass,
    roster: roster.items,
    rosterNextCursor: roster.nextCursor,
  } as unknown as ResOf<"v1.identity.getClass">;
}

export async function listAcademicSessionsService(
  input: ReqOf<"v1.identity.listAcademicSessions">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listAcademicSessions">> {
  const res = await listEntity(ctx, xrepos(ctx).academicSessions, input);
  res.items = res.items.map((d) => {
    const s = projectEntity(d, SESSION_KEYS);
    if (typeof s["isCurrent"] !== "boolean") s["isCurrent"] = false; // required, non-nullable
    return s;
  });
  return res as unknown as ResOf<"v1.identity.listAcademicSessions">;
}
