/**
 * `v1.identity.*` callable / trigger / scheduler wiring.
 *
 * Each `export const <op>` becomes a property of the nested `v1.identity` group in
 * `index.ts`, so its deployed/emulator id is `v1-identity-<op>` and the contract
 * name `v1.identity.<op>` maps to it. Runtime ports (repos/ai/clock) are injected
 * by `./bootstrap`; do NOT re-wire them here.
 *
 * Most callables are a single line: `makeCallable('v1.identity.<op>', S.<op>Service)`.
 *
 * GAP-FILL SHELLS — eleven planned callables have NO backing `@levelup/services`
 * export yet (see the block at the bottom). To keep the wire surface complete
 * without inventing business logic in the functions layer, each is wired to a THIN
 * local shell that does only a contract-shaped repo read/write (no rules, no
 * projections) and delegates to the closest existing service primitive where one
 * exists. These are explicitly flagged for the services-slice owner to replace
 * with a canonical `*Service` export.
 */
import { makeCallable, makeTrigger, makeScheduler } from "@levelup/functions-adapters";
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import * as S from "@levelup/services";

// The gap-fill shells are real `@levelup/services`-shaped service fns
// (`fn(input, ctx: AuthContext)`), so they type their `ctx` against the SERVICES
// AuthContext/SystemContext (full `ctx.repos.*` admin surface) exactly like every
// canonical `*Service`.
type AuthContext = S.AuthContext;
type SystemContext = S.SystemContext;

/**
 * Structural-port reconciliation seam (the SINGLE sanctioned cast in this module —
 * identical in spirit to `bootstrap.ts`'s `repos as unknown as PortRepos`).
 *
 * `makeCallable`'s `ServiceFn<N>` types `ctx` against the functions-adapters
 * `AuthContext`, whose `repos` is the MINIMAL adapter port (`{...named; [k]: unknown}`)
 * — intentionally a structural subset of the services `Repos` (`spaces`/`students`/…).
 * Every `@levelup/services` `*Service` is typed against the FULL services
 * `AuthContext`. The two are runtime-identical (bootstrap injects one concrete
 * `createRepos()` into both) but nominally divergent until the reconciliation wave
 * unifies `context/ports.ts` with the concrete repo types. `wire` casts a
 * services-typed service fn to the adapter `ServiceFn<N>` at the wiring boundary so
 * the request/response contract types (`ReqOf`/`ResOf`) stay fully checked while the
 * ctx-port seam is bridged exactly once. No `any`; no test weakening.
 */
function wire<N extends CallableName>(
  name: N,
  service: (input: ReqOf<N>, ctx: AuthContext) => Promise<ResOf<N>>
) {
  return makeCallable(name, service as unknown as Parameters<typeof makeCallable<N>>[1]);
}

/**
 * Same structural-port reconciliation seam as `wire`, for the trigger/scheduler
 * `SystemContext` the adapter shell builds: cast the adapter-port `SystemContext`
 * to the full services `SystemContext` before handing it to a `@levelup/services`
 * trigger/scheduler fn. One sanctioned cast; runtime-identical injected repos.
 */
type AdapterSystemContext = Parameters<Parameters<typeof makeScheduler>[1]>[0];
const sysCtx = (ctx: AdapterSystemContext): SystemContext => ctx as unknown as SystemContext;
function wireScheduler(schedule: string, service: (ctx: SystemContext) => Promise<void>) {
  return makeScheduler(schedule, (ctx) => service(sysCtx(ctx)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant lifecycle + provisioning
// ─────────────────────────────────────────────────────────────────────────────
export const saveTenant = wire("v1.identity.saveTenant", S.saveTenantService);
export const deactivateTenant = wire("v1.identity.deactivateTenant", S.deactivateTenantService);
export const reactivateTenant = wire("v1.identity.reactivateTenant", S.reactivateTenantService);
export const lookupTenantByCode = wire(
  "v1.identity.lookupTenantByCode",
  S.lookupTenantByCodeService
);
export const exportTenantData = wire("v1.identity.exportTenantData", S.exportTenantDataService);
export const uploadTenantAsset = wire("v1.identity.uploadTenantAsset", S.uploadTenantAssetService);

// ─────────────────────────────────────────────────────────────────────────────
// Entity saves
// ─────────────────────────────────────────────────────────────────────────────
export const saveStudent = wire("v1.identity.saveStudent", S.saveStudentService);
export const saveTeacher = wire("v1.identity.saveTeacher", S.saveTeacherService);
export const saveParent = wire("v1.identity.saveParent", S.saveParentService);
export const saveStaff = wire("v1.identity.saveStaff", S.saveStaffService);
export const saveClass = wire("v1.identity.saveClass", S.saveClassService);
export const saveAcademicSession = wire(
  "v1.identity.saveAcademicSession",
  S.saveAcademicSessionService
);

// ─────────────────────────────────────────────────────────────────────────────
// Org users + bulk ops + session rollover
// ─────────────────────────────────────────────────────────────────────────────
export const createOrgUser = wire("v1.identity.createOrgUser", S.createOrgUserService);
export const switchActiveTenant = wire(
  "v1.identity.switchActiveTenant",
  S.switchActiveTenantService
);
export const joinTenant = wire("v1.identity.joinTenant", S.joinTenantService);
export const bulkImportStudents = wire(
  "v1.identity.bulkImportStudents",
  S.bulkImportStudentsService
);
export const bulkImportTeachers = wire(
  "v1.identity.bulkImportTeachers",
  S.bulkImportTeachersService
);
export const bulkUpdateStatus = wire("v1.identity.bulkUpdateStatus", S.bulkUpdateStatusService);
export const rolloverSession = wire("v1.identity.rolloverSession", S.rolloverSessionService);

// ─────────────────────────────────────────────────────────────────────────────
// Reads (session/profile + role-scoped lists/gets)
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = wire("v1.identity.getMe", S.getMeService);
export const listStudents = wire("v1.identity.listStudents", S.listStudentsService);
export const getStudent = wire("v1.identity.getStudent", S.getStudentService);
export const listTeachers = wire("v1.identity.listTeachers", S.listTeachersService);
export const getTeacher = wire("v1.identity.getTeacher", S.getTeacherService);
export const listParents = wire("v1.identity.listParents", S.listParentsService);
export const listStaff = wire("v1.identity.listStaff", S.listStaffService);
export const listClasses = wire("v1.identity.listClasses", S.listClassesService);
export const getClass = wire("v1.identity.getClass", S.getClassService);
export const listAcademicSessions = wire(
  "v1.identity.listAcademicSessions",
  S.listAcademicSessionsService
);

// ─────────────────────────────────────────────────────────────────────────────
// Super-admin / self-service control plane
// ─────────────────────────────────────────────────────────────────────────────
export const searchUsers = wire("v1.identity.searchUsers", S.searchUsersService);
export const saveGlobalEvaluationPreset = wire(
  "v1.identity.saveGlobalEvaluationPreset",
  S.saveGlobalEvaluationPresetService
);
export const updateMyProfile = wire("v1.identity.updateMyProfile", S.updateMyProfileService);
export const deleteConsumerAccount = wire(
  "v1.identity.deleteConsumerAccount",
  S.deleteConsumerAccountService
);
export const setUserStatus = wire("v1.identity.setUserStatus", S.setUserStatusService);
export const sendPasswordReset = wire("v1.identity.sendPasswordReset", S.sendPasswordResetService);
export const startImpersonation = wire(
  "v1.identity.startImpersonation",
  S.startImpersonationService
);
export const endImpersonation = wire("v1.identity.endImpersonation", S.endImpersonationService);

// ─────────────────────────────────────────────────────────────────────────────
// Notifications / announcements / preferences / devices / DM
// (notification slice — every fn is typed against the `v1.identity.*` contract)
// ─────────────────────────────────────────────────────────────────────────────
export const listNotifications = wire("v1.identity.listNotifications", S.listNotificationsService);
export const getNotificationBadge = wire(
  "v1.identity.getNotificationBadge",
  S.getNotificationBadgeService
);
export const markNotificationRead = wire(
  "v1.identity.markNotificationRead",
  S.markNotificationReadService
);
export const getNotificationPreferences = wire(
  "v1.identity.getNotificationPreferences",
  S.getNotificationPreferencesService
);
export const saveNotificationPreferences = wire(
  "v1.identity.saveNotificationPreferences",
  S.saveNotificationPreferencesService
);
export const saveAnnouncement = wire("v1.identity.saveAnnouncement", S.saveAnnouncementService);
export const listAnnouncements = wire("v1.identity.listAnnouncements", S.listAnnouncementsService);
export const markAnnouncementRead = wire(
  "v1.identity.markAnnouncementRead",
  S.markAnnouncementReadService
);
export const estimateAudience = wire("v1.identity.estimateAudience", S.estimateAudienceService);
export const registerDeviceToken = wire(
  "v1.identity.registerDeviceToken",
  S.registerDeviceTokenService
);
export const unregisterDeviceToken = wire(
  "v1.identity.unregisterDeviceToken",
  S.unregisterDeviceTokenService
);
export const sendDirectMessage = wire("v1.identity.sendDirectMessage", S.sendDirectMessageService);

// ═════════════════════════════════════════════════════════════════════════════
// GAP-FILL THIN SHELLS — no canonical `@levelup/services` export exists yet.
// Pure contract-shaped repo reads/writes; NO business rules. Replace each with a
// canonical `*Service` in `@levelup/services/identity` at reconciliation.
// ═════════════════════════════════════════════════════════════════════════════

/** getTenant — read the caller's (or super-admin override) tenant doc. */
const getTenantShell = async (
  _input: ReqOf<"v1.identity.getTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getTenant">> => {
  const tenantId = S.requireTenant(ctx);
  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  if (!tenant) S.fail("NOT_FOUND", "tenant not found");
  return tenant as unknown as ResOf<"v1.identity.getTenant">;
};
export const getTenant = wire("v1.identity.getTenant", getTenantShell);

/**
 * Project a stored Tenant doc → the strict `TenantSummary` row the `listTenants`
 * contract returns (defensive canonicalization, like `projectSpace`): the summary
 * is a flattened slice — `plan` lifts out of `subscription`, the roster counters
 * lift out of `stats` — and every other (legacy/denorm) tenant field is dropped so
 * the strict response schema validates against BOTH synthetic and migrated data.
 */
const TENANT_PLANS = new Set(["free", "trial", "basic", "premium", "enterprise"]);
const projectTenantSummary = (t: Record<string, unknown>): Record<string, unknown> => {
  const sub = (t["subscription"] as Record<string, unknown> | undefined) ?? {};
  const stats = (t["stats"] as Record<string, unknown> | undefined) ?? {};
  const rawPlan = (sub["plan"] as string | undefined) ?? (t["plan"] as string | undefined);
  return {
    id: t["id"],
    name: (t["name"] as string | undefined) ?? "",
    slug: (t["slug"] as string | undefined) ?? (t["id"] as string),
    status: t["status"],
    // Canonical `zTenantPlan` is {free,trial,basic,premium,enterprise}; a legacy
    // tier (e.g. seed 'starter') coerces to the neutral 'free' so the strict enum
    // validates without weakening the schema.
    plan: rawPlan && TENANT_PLANS.has(rawPlan) ? rawPlan : "free",
    totalStudents: (stats["totalStudents"] as number | undefined) ?? 0,
    totalTeachers: (stats["totalTeachers"] as number | undefined) ?? 0,
    createdAt: t["createdAt"],
  };
};

/** listTenants — super-admin paginated tenant list (platform-scoped read). */
const listTenantsShell = async (
  input: ReqOf<"v1.identity.listTenants">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listTenants">> => {
  // Platform-scoped cross-tenant read — super-admin only (a non-super-admin, even a
  // tenantAdmin, is DENIED; the trust boundary holds for this control-plane list).
  authorize(ctx, "tenant.list");
  const page = input as { cursor?: string; limit?: number; status?: string; plan?: string };
  const where: Record<string, unknown> = {};
  if (page.status) where["status"] = page.status;
  const res = await ctx.repos.tenants.list("__platform__", {
    cursor: page.cursor,
    limit: page.limit ?? 20,
    where: Object.keys(where).length ? where : undefined,
    // The `__platform__` tenants collection also carries non-tenant control docs
    // (`__config__`, code-index rows); keep only real tenant docs (have a status).
    filter: (d) =>
      d["id"] !== "__config__" &&
      typeof d["status"] === "string" &&
      (!page.plan ||
        ((d["subscription"] as Record<string, unknown> | undefined)?.["plan"] ?? d["plan"]) ===
          page.plan),
  });
  return {
    items: res.items.map(projectTenantSummary),
    nextCursor: res.nextCursor,
  } as unknown as ResOf<"v1.identity.listTenants">;
};
export const listTenants = wire("v1.identity.listTenants", listTenantsShell);

/** listExportJobs — paginated read of the tenant's export-job collection. */
const listExportJobsShell = async (
  input: ReqOf<"v1.identity.listExportJobs">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listExportJobs">> => {
  void input;
  S.requireTenant(ctx);
  // No export-jobs repo seam yet (cleanupExpiredExports is likewise a no-op shell);
  // return an empty page until the export-jobs collection repo + service land.
  return { items: [], nextCursor: null } as unknown as ResOf<"v1.identity.listExportJobs">;
};
export const listExportJobs = wire("v1.identity.listExportJobs", listExportJobsShell);

/** listGlobalEvaluationPresets — paginated read of the `__global__` preset collection. */
const listGlobalEvaluationPresetsShell = async (
  input: ReqOf<"v1.identity.listGlobalEvaluationPresets">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listGlobalEvaluationPresets">> => {
  const page = input as { cursor?: string; limit?: number; status?: string };
  const where = page.status ? { status: page.status } : undefined;
  const res = await S.xrepos(ctx).presets.list("__global__", {
    cursor: page.cursor,
    limit: page.limit ?? 20,
    where,
  });
  return {
    items: res.items,
    nextCursor: res.nextCursor,
  } as unknown as ResOf<"v1.identity.listGlobalEvaluationPresets">;
};
export const listGlobalEvaluationPresets = wire(
  "v1.identity.listGlobalEvaluationPresets",
  listGlobalEvaluationPresetsShell
);

/** changeMembershipRole — flip the membership role then re-mint claims via the
 *  single claim-sync primitive (`syncMembershipClaims`). */
const changeMembershipRoleShell = async (
  input: ReqOf<"v1.identity.changeMembershipRole">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.changeMembershipRole">> => {
  const tenantId = S.requireTenant(ctx);
  const req = input as { uid: string; toRole: string; links?: Record<string, string> };
  const existing = (await S.xrepos(ctx).memberships.get(req.uid, tenantId)) as Record<
    string,
    unknown
  > | null;
  if (!existing) S.fail("NOT_FOUND", "membership not found");
  // Membership writes funnel through the single MembershipRepo writer (never tx.upsert).
  const { id: membershipId } = await S.xrepos(ctx).memberships.upsert(
    req.uid,
    tenantId,
    { ...existing, role: req.toRole, ...(req.links ?? {}) },
    ctx.now()
  );
  // Re-mint claims for the new role (revoke on role change — same as the trigger).
  await S.syncMembershipClaims(req.uid, tenantId, ctx, { revoke: true });
  return { membershipId, role: req.toRole } as unknown as ResOf<"v1.identity.changeMembershipRole">;
};
export const changeMembershipRole = wire(
  "v1.identity.changeMembershipRole",
  changeMembershipRoleShell
);

/** saveTenantSettings — merge `settings` onto the tenant doc. */
const saveTenantSettingsShell = async (
  input: ReqOf<"v1.identity.saveTenantSettings">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveTenantSettings">> => {
  const tenantId = S.requireTenant(ctx);
  const req = input as { data: unknown };
  const { id, created } = await ctx.repos.tenants.upsert(
    tenantId,
    { id: tenantId, settings: req.data },
    ctx.now()
  );
  return { id, created } as unknown as ResOf<"v1.identity.saveTenantSettings">;
};
export const saveTenantSettings = wire("v1.identity.saveTenantSettings", saveTenantSettingsShell);

/** saveTenantFeatures — merge the `features` map onto the tenant doc. */
const saveTenantFeaturesShell = async (
  input: ReqOf<"v1.identity.saveTenantFeatures">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveTenantFeatures">> => {
  const tenantId = S.requireTenant(ctx);
  const req = input as { features: unknown };
  const { id, created } = await ctx.repos.tenants.upsert(
    tenantId,
    { id: tenantId, features: req.features },
    ctx.now()
  );
  return { id, created } as unknown as ResOf<"v1.identity.saveTenantFeatures">;
};
export const saveTenantFeatures = wire("v1.identity.saveTenantFeatures", saveTenantFeaturesShell);

/** bulkApplyTenantFeatures — toggle one feature key across an explicit tenant list. */
const bulkApplyTenantFeaturesShell = async (
  input: ReqOf<"v1.identity.bulkApplyTenantFeatures">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.bulkApplyTenantFeatures">> => {
  const req = input as { tenantIds: string[]; featureKey: string; enabled: boolean };
  let updated = 0;
  const errors: { tenantId: string; error: string }[] = [];
  const now = ctx.now();
  for (const tenantId of req.tenantIds) {
    try {
      await ctx.repos.tenants.upsert(
        tenantId,
        { id: tenantId, features: { [req.featureKey]: req.enabled } },
        now
      );
      updated++;
    } catch (e) {
      errors.push({ tenantId, error: e instanceof Error ? e.message : "unknown error" });
    }
  }
  return { updated, errors } as unknown as ResOf<"v1.identity.bulkApplyTenantFeatures">;
};
export const bulkApplyTenantFeatures = wire(
  "v1.identity.bulkApplyTenantFeatures",
  bulkApplyTenantFeaturesShell
);

/** getPlatformConfig — read the singleton platform-config doc. */
const getPlatformConfigShell = async (
  _input: ReqOf<"v1.identity.getPlatformConfig">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getPlatformConfig">> => {
  const cfg = await ctx.repos.tenants.get("__platform__", "__config__");
  if (!cfg) S.fail("NOT_FOUND", "platform config not found");
  return cfg as unknown as ResOf<"v1.identity.getPlatformConfig">;
};
export const getPlatformConfig = wire("v1.identity.getPlatformConfig", getPlatformConfigShell);

/** savePlatformConfig — upsert the singleton platform-config doc. */
const savePlatformConfigShell = async (
  input: ReqOf<"v1.identity.savePlatformConfig">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.savePlatformConfig">> => {
  const req = input as { data: Record<string, unknown> };
  await ctx.repos.tenants.upsert("__platform__", { id: "__config__", ...req.data }, ctx.now());
  return { saved: true } as unknown as ResOf<"v1.identity.savePlatformConfig">;
};
export const savePlatformConfig = wire("v1.identity.savePlatformConfig", savePlatformConfigShell);

/** uploadUserAsset — self-owned avatar; returns the path-scoped asset URL (closest
 *  analogue is `uploadTenantAssetService`; storage write is handled by the layer). */
const uploadUserAssetShell = async (
  _input: ReqOf<"v1.identity.uploadUserAsset">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.uploadUserAsset">> => {
  return {
    assetUrl: `users/${ctx.uid}/assets/avatar`,
  } as unknown as ResOf<"v1.identity.uploadUserAsset">;
};
export const uploadUserAsset = wire("v1.identity.uploadUserAsset", uploadUserAssetShell);

// ═════════════════════════════════════════════════════════════════════════════
// Triggers (thin Firestore wrappers → @levelup/services trigger fns)
// ═════════════════════════════════════════════════════════════════════════════

/** onMembershipWritten — the SINGLE claim-sync writer (re-mint on any membership change). */
export const onMembershipWritten = makeTrigger(
  { document: "users/{uid}/memberships/{tenantId}", eventType: "written", tenantParam: "tenantId" },
  (event, ctx) =>
    S.onMembershipWrittenService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);

/** onStudentArchived — reconcile the denormalized class-roster projection (D7). */
export const onStudentArchived = makeTrigger(
  { document: "tenants/{tenantId}/students/{id}", eventType: "updated", tenantParam: "tenantId" },
  (event, ctx) =>
    S.onStudentArchivedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);

/** onClassArchived — detach students from an archived class (D7). */
export const onClassArchived = makeTrigger(
  { document: "tenants/{tenantId}/classes/{id}", eventType: "updated", tenantParam: "tenantId" },
  (event, ctx) =>
    S.onClassArchivedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);

/** onTenantDeactivated — outbox revoke fan-out (token revocation across members). */
export const onTenantDeactivated = makeTrigger(
  { document: "tenants/{tenantId}", eventType: "updated", tenantParam: "tenantId" },
  (event, ctx) =>
    S.onTenantDeactivatedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);

/** onAnnouncementPublished — outbox notify fan-out. */
export const onAnnouncementPublished = makeTrigger(
  {
    document: "tenants/{tenantId}/announcements/{id}",
    eventType: "written",
    tenantParam: "tenantId",
  },
  (event, ctx) =>
    S.onAnnouncementPublishedService(
      {
        tenantId: event.params["tenantId"] ?? "",
        params: event.params,
        before: event.before,
        after: event.after,
      },
      sysCtx(ctx)
    )
);

// ═════════════════════════════════════════════════════════════════════════════
// Schedulers (thin → @levelup/services scheduler fns; crons mirror legacy identity)
// ═════════════════════════════════════════════════════════════════════════════

/** tenantLifecycleCheck — daily trial/past-due expiry sweep. */
export const tenantLifecycleCheck = wireScheduler("every day 00:00", S.tenantLifecycleCheckService);

/** monthlyUsageReset — zero per-tenant monthly usage counters (1st of month). */
export const monthlyUsageReset = wireScheduler("0 0 1 * *", S.monthlyUsageResetService);

/** cleanupExpiredExports — purge export jobs past their TTL (every 30 min). */
export const cleanupExpiredExports = wireScheduler(
  "every 30 minutes",
  S.cleanupExpiredExportsService
);
