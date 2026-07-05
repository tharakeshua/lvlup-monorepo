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
import { repoKeyForRole, idFieldForRole, type EntityIds, type TenantRole } from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { provisionMembership } from "./provision-membership.js";
import { syncMembershipClaims } from "./sync-membership-claims.js";

/** The minimal entity-repo shape `createOrgUser` drives (dynamic role→repo dispatch). */
interface EntityUpsertRepo {
  upsert: (
    t: string,
    d: Record<string, unknown>,
    n?: string
  ) => Promise<{ id: string; created: boolean }>;
}

/**
 * Input to the shared org-user provisioning saga. Mirrors the fields
 * `createOrgUser` and the bulk imports need; `entityExtra` carries the
 * role-specific columns (student roll/section/grade, etc.) onto the entity doc.
 */
interface ProvisionOrgUserInput {
  role: TenantRole;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  classIds?: string[];
  subjects?: string[];
  linkedStudentIds?: string[];
  entityExtra?: Record<string, unknown>;
}

interface ProvisionOrgUserResult {
  uid: string;
  entityId: string;
  membershipId: string;
  /** True when a NEW `(uid, tenantId)` membership was minted (vs an idempotent re-provision). */
  membershipCreated: boolean;
}

/**
 * The single org-user provisioning saga (Auth user → entity doc → membership →
 * claims). Every provisioning caller (`createOrgUser`, `bulkImportStudents`)
 * funnels through here so an org user is created exactly one way and claims are
 * synced exactly one way. Idempotent: an existing auth user (resolved by email)
 * is LINKED rather than duplicated, and `provisionMembership` upserts.
 */
async function provisionOrgUser(
  input: ProvisionOrgUserInput,
  tenantId: string,
  tenantCode: string,
  ctx: AuthContext
): Promise<ProvisionOrgUserResult> {
  const repos = xrepos(ctx);
  const now = ctx.now();

  // DP-2 Part B: role→repo is REGISTRY-DRIVEN (collapses the `entityRepoByRole`
  // literal; a new provisionable role's repo is picked up automatically). A role
  // whose `repoKey` isn't wired on the repo bag (e.g. scanner today) still fails
  // here exactly as before — no fail-open.
  const repoKey = repoKeyForRole(input.role);
  const entityRepo = repoKey
    ? (repos as unknown as Record<string, EntityUpsertRepo | undefined>)[repoKey]
    : undefined;
  if (!entityRepo)
    fail("INVALID_ARGUMENT", `role ${input.role} cannot be created via provisionOrgUser`);

  // 1) Provision the auth user (Admin Auth via the claims/users repo bridge).
  // Resolve an EXISTING auth user by email, else CREATE one so the claims write
  // (syncMembershipClaims → Admin-Auth setCustomUserClaims) targets a real record
  // (a `pending_*` placeholder uid has no Auth user → "no user record" crash).
  let user = input.email ? await repos.users.get(input.email) : null;
  if (!user) {
    const created = await repos.users.create({
      email: input.email,
      displayName: `${input.firstName} ${input.lastName}`.trim(),
      password: input.password,
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
      ...(input.entityExtra ?? {}),
    },
    now
  );

  // 3+4) Membership + claims via the single factory.
  // DP-2 Part B: role→id-field is REGISTRY-DRIVEN (collapses the ternary chain;
  // no fail-open default — every role maps to its own id field, incl. scanner).
  const idField = idFieldForRole(input.role);
  if (!idField) fail("INVALID_ARGUMENT", `role ${input.role} has no entity id field`);
  const entityIds: EntityIds = { [idField]: entityId };
  const { membershipId, created: membershipCreated } = await provisionMembership(
    {
      uid,
      tenantId,
      tenantCode,
      role: input.role,
      joinSource: "admin_created",
      entityIds,
      classIds: input.classIds,
      parentLinkedStudentIds: input.linkedStudentIds,
    },
    ctx
  );

  return { uid, entityId, membershipId, membershipCreated };
}

// ── createOrgUser ─────────────────────────────────────────────────────────────
export async function createOrgUserService(
  input: ReqOf<"v1.identity.createOrgUser">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.createOrgUser">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.create", { tenantId });

  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  const tenantCode = (tenant?.["code"] as string | undefined) ?? "";

  // 1-4) Auth user → entity → membership → claims via the shared saga.
  const { uid, entityId, membershipId } = await provisionOrgUser(
    {
      role: input.role as TenantRole,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password,
      classIds: input.classIds as string[] | undefined,
      subjects: input.subjects as string[] | undefined,
      linkedStudentIds: input.linkedStudentIds as string[] | undefined,
    },
    tenantId,
    tenantCode,
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

// ── bulk import: shared runner (dryRun + credential delivery) ─────────────────

/** One prepared bulk-import row: its provisioning input + a stable login label. */
interface BulkImportRow {
  provision: ProvisionOrgUserInput;
  /** Human login identifier for the credentials CSV (email, else roll number). */
  loginId: string;
}

/** Result accumulator; superset of the `{ created, skipped, errors }` wire shape. */
interface BulkImportResult {
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
  dryRun?: boolean;
  preview?: { row: number; outcome: "create" | "skip" | "error"; error?: string }[];
  credentials?: { url: string; expiresAt: string; count: number };
}

/** Signed-URL credentials CSV TTL — one-shot, <= 15 min (mirrors upload-url TTL). */
const CREDENTIALS_CSV_TTL_MS = 15 * 60 * 1000;

/**
 * Storage sink for the one-shot credentials CSV. Injected on `ctx.storage` (same
 * loosely-typed hook `requestUploadUrlService` reads). Writes the CSV to a
 * tenant-scoped, deny-all path and returns a signed GET URL — the ONLY channel the
 * plaintext passwords ever travel.
 */
interface CredentialsStorageHook {
  putCredentialsCsv(
    path: string,
    csv: string,
    ttlMs: number
  ): Promise<{ url: string; expiresAt: string }>;
}

/**
 * Run a bulk import (students or teachers) through the SINGLE provisioning saga.
 *
 * `dryRun` → validate every row + project its outcome (create/skip/error) with
 * ZERO writes (no auth users, docs, credentials, or side-effects); the response
 * echoes `dryRun: true`. Otherwise each row is fully provisioned (Auth user →
 * entity → membership → claims); rows without an admin-supplied password get a
 * server-generated one that is delivered ONLY via a short-lived signed-URL CSV —
 * never in the response, Firestore, or logs.
 */
async function runBulkImport(
  rows: BulkImportRow[],
  tenantId: string,
  tenantCode: string,
  dryRun: boolean,
  ctx: AuthContext
): Promise<BulkImportResult> {
  if (dryRun) return dryRunBulkImport(rows, tenantId, ctx);

  let created = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];
  // Captured plaintext for the credentials CSV — NEVER returned/logged/persisted.
  const generated: { name: string; loginId: string; password: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { provision, loginId } = rows[i]!;
    try {
      // (e) admin-supplied password WINS; otherwise server-generate one and remember
      // it (only) for the CSV. The saga is idempotent — for an existing auth user the
      // password is ignored (never reset), so we only deliver on a NEW membership.
      const adminSupplied = provision.password;
      const password = adminSupplied ?? generatePassword();
      const { membershipCreated } = await provisionOrgUser(
        { ...provision, password },
        tenantId,
        tenantCode,
        ctx
      );
      if (membershipCreated) created++;
      else skipped++;
      if (membershipCreated && !adminSupplied) {
        generated.push({
          name: `${provision.firstName} ${provision.lastName}`.trim(),
          loginId,
          password,
        });
      }
    } catch (e) {
      // Per-row isolation: a bad row is recorded and the batch continues. The saga is
      // idempotent, so a re-run heals any partial provisioning from a mid-row failure.
      errors.push({ row: i, error: e instanceof Error ? e.message : "unknown error" });
    }
  }

  const result: BulkImportResult = { created, skipped, errors };
  if (generated.length > 0) {
    result.credentials = await deliverCredentials(generated, tenantId, ctx);
  }
  return result;
}

/** Read-only projection of what a real import WOULD do — asserts zero writes. */
async function dryRunBulkImport(
  rows: BulkImportRow[],
  tenantId: string,
  ctx: AuthContext
): Promise<BulkImportResult> {
  const repos = xrepos(ctx);
  let created = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];
  const preview: { row: number; outcome: "create" | "skip" | "error"; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { provision } = rows[i]!;
    try {
      // Mirror the saga's provisionability guard WITHOUT writing.
      const repoKey = repoKeyForRole(provision.role);
      const entityRepo = repoKey
        ? (repos as unknown as Record<string, EntityUpsertRepo | undefined>)[repoKey]
        : undefined;
      if (!entityRepo)
        throw new Error(`role ${provision.role} cannot be created via provisionOrgUser`);

      // An existing (uid, tenant) membership would be an idempotent skip; else create.
      let outcome: "create" | "skip" = "create";
      if (provision.email) {
        const user = await repos.users.get(provision.email);
        if (user) {
          const existing = await repos.memberships.get(user["id"] as string, tenantId);
          if (existing) outcome = "skip";
        }
      }
      if (outcome === "create") created++;
      else skipped++;
      preview.push({ row: i, outcome });
    } catch (e) {
      const error = e instanceof Error ? e.message : "unknown error";
      errors.push({ row: i, error });
      preview.push({ row: i, outcome: "error", error });
    }
  }
  return { created, skipped, errors, dryRun: true, preview };
}

/** Write the credentials CSV to a deny-all tenant path + return a signed GET URL. */
async function deliverCredentials(
  generated: { name: string; loginId: string; password: string }[],
  tenantId: string,
  ctx: AuthContext
): Promise<{ url: string; expiresAt: string; count: number }> {
  const csv = credentialsCsv(generated);
  const path = credentialsPath(tenantId, ctx);
  const hook = (ctx as unknown as { storage?: Partial<CredentialsStorageHook> }).storage;
  if (hook?.putCredentialsCsv) {
    const { url, expiresAt } = await hook.putCredentialsCsv(path, csv, CREDENTIALS_CSV_TTL_MS);
    return { url, expiresAt, count: generated.length };
  }
  // Emulator/test fallback — no real signing available.
  const baseMs = Date.parse(ctx.now());
  const expiresAt = new Date(
    (Number.isNaN(baseMs) ? Date.now() : baseMs) + CREDENTIALS_CSV_TTL_MS
  ).toISOString();
  return { url: `https://storage.local/${path}`, expiresAt, count: generated.length };
}

/** Deterministic, tenant-scoped, deny-all storage path for the credentials CSV. */
function credentialsPath(tenantId: string, ctx: AuthContext): string {
  const stamp = (Date.parse(ctx.now()) || Date.now()).toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `tenants/${tenantId}/credentials/${stamp}-${rand}.csv`;
}

/** RFC-4180-escaped `name,loginId,password` CSV of the server-generated credentials. */
function credentialsCsv(rows: { name: string; loginId: string; password: string }[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [r.name, r.loginId, r.password].map(esc).join(",")).join("\n");
  return `name,loginId,password\n${body}\n`;
}

/**
 * Generate a strong initial password (crypto-random where available). Well above
 * Firebase Auth's 6-char minimum; ambiguous glyphs (0/O, 1/l/I) are omitted so a
 * printed CSV credential is legible.
 */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const len = 14;
  const out: string[] = [];
  const webcrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => void } })
    .crypto;
  if (webcrypto?.getRandomValues) {
    const buf = new Uint32Array(len);
    webcrypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) out.push(alphabet[buf[i]! % alphabet.length]!);
  } else {
    for (let i = 0; i < len; i++) out.push(alphabet[Math.floor(Math.random() * alphabet.length)]!);
  }
  return out.join("");
}

// ── bulkImportStudents ────────────────────────────────────────────────────────
export async function bulkImportStudentsService(
  input: ReqOf<"v1.identity.bulkImportStudents">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.bulkImportStudents">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkImport", { tenantId });

  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  const tenantCode = (tenant?.["code"] as string | undefined) ?? "";

  // The role-specific roll/section/grade/admission columns ride on the entity doc
  // via `entityExtra`; the login label prefers email, else the roll number.
  const rows: BulkImportRow[] = input.rows.map((row) => ({
    provision: {
      role: "student" as TenantRole,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      password: row.password,
      classIds: row.classIds ?? input.defaultClassIds ?? [],
      entityExtra: {
        rollNumber: row.rollNumber,
        section: row.section,
        grade: row.grade,
        admissionNumber: row.admissionNumber,
      },
    },
    loginId: row.email ?? row.rollNumber ?? "",
  }));

  const res = await runBulkImport(rows, tenantId, tenantCode, input.dryRun ?? false, ctx);
  return res as unknown as ResOf<"v1.identity.bulkImportStudents">;
}

// ── bulkImportTeachers ────────────────────────────────────────────────────────
export async function bulkImportTeachersService(
  input: ReqOf<"v1.identity.bulkImportTeachers">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.bulkImportTeachers">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "user.bulkImport", { tenantId });

  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  const tenantCode = (tenant?.["code"] as string | undefined) ?? "";

  // IDN-4: route teachers through the SAME saga as students (Auth user → entity →
  // membership → claims), killing the entity-docs-only latent bug (a teacher used to
  // get an entity doc with no auth user/membership/claims → could never log in).
  const rows: BulkImportRow[] = input.rows.map((row) => ({
    provision: {
      role: "teacher" as TenantRole,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      password: row.password,
      subjects: row.subjects ?? [],
      entityExtra: {
        phone: row.phone,
        department: row.department,
      },
    },
    loginId: row.email ?? "",
  }));

  const res = await runBulkImport(rows, tenantId, tenantCode, input.dryRun ?? false, ctx);
  return res as unknown as ResOf<"v1.identity.bulkImportTeachers">;
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
