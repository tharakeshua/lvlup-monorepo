/**
 * `buildAuthContext` — claims → AuthContext (server-shared.md §2.2).
 *
 * The trust boundary:
 *  1. no auth → UNAUTHENTICATED (public callables build an anonymous ctx instead).
 *  2. `tenantId` = claim's active tenant, UNLESS isSuperAdmin && tenantOverride.
 *     Every non-super-admin caller's tenantId is the claim — full stop.
 *  3. overflow fallback: classIdsOverflow → read managed class ids from membership.
 *  4. injected clock + repos + ai so services never import them.
 */
import type { AuthInfo } from "./callable-auth.js";
import type { AuthContext } from "./auth-context.js";
import type { Repos, AiGateway } from "./ports.js";
import { fail } from "../request/fail.js";
import type {
  UserId,
  TenantId,
  ClassId,
  StudentId,
  TeacherId,
  ParentId,
  StaffId,
  ScannerId,
  Timestamp,
  TenantRole,
  TeacherPermissionKey,
  StaffPermissionKey,
  PlatformClaims,
} from "@levelup/domain";

export interface BuildCtxOptions {
  /** Honored ONLY if isSuperAdmin (audited by the onCall adapter). */
  tenantOverride?: string;
  idempotencyKey?: string;
  /** Public callables (lookupTenantByCode) build an anonymous ctx. */
  anonymous?: boolean;
  repos: Repos;
  ai: AiGateway;
  /** Default () => new Date().toISOString() — overridable in tests. */
  clock?: () => Timestamp;
}

const PUBLIC_UID = "<public>";

type RawClaims = PlatformClaims & Record<string, unknown>;

export async function buildAuthContext(
  auth: AuthInfo | undefined,
  opts: BuildCtxOptions
): Promise<AuthContext> {
  const clock = opts.clock ?? (() => new Date().toISOString() as Timestamp);

  // (1) anonymous / public path
  if (opts.anonymous) {
    return anonymousContext(opts, clock);
  }
  if (!auth || !auth.uid) {
    return fail("UNAUTHENTICATED", "authentication required");
  }

  const uid = auth.uid as UserId;
  const token = (auth.token ?? {}) as RawClaims;

  // (2) isSuperAdmin is a CLAIM (REVIEW §8: no /users get).
  const isSuperAdmin = token.isSuperAdmin === true;

  // (3) tenantId from claim; super-admin tenantOverride is the ONLY off-claim source.
  // The canonical claim key is `tenantId` (domain `PlatformClaims`), but accept the
  // `activeTenantId` alias some claim minters emit so the active tenant is never
  // silently dropped to null (which would surface as a spurious TENANT_REQUIRED).
  const claimTenant =
    (token.tenantId as TenantId | undefined) ??
    (token.activeTenantId as TenantId | undefined) ??
    null;
  let tenantId: TenantId | null = claimTenant;
  let usedTenantOverride = false;
  if (isSuperAdmin && opts.tenantOverride) {
    tenantId = opts.tenantOverride as TenantId;
    usedTenantOverride = true;
  }

  // (4) overflow fallback for classIds (MAX_CLAIM_CLASS_IDS).
  let classIds: ClassId[];
  if (token.classIdsOverflow === true) {
    const managed = await opts.repos.memberships.getManagedClassIds(uid, tenantId);
    classIds = managed as ClassId[];
  } else {
    classIds = ((token.classIds as ClassId[] | undefined) ?? []) as ClassId[];
  }

  const studentIds = ((token.studentIds as StudentId[] | undefined) ?? []) as StudentId[];

  return {
    uid,
    isSuperAdmin,
    tenantId,
    role: (token.role as TenantRole | undefined) ?? null,
    permissions:
      (token.permissions as Partial<Record<TeacherPermissionKey, boolean>> | undefined) ?? null,
    staffPermissions:
      (token.staffPermissions as Partial<Record<StaffPermissionKey, boolean>> | undefined) ?? null,
    classIds,
    studentIds,
    entityIds: {
      teacherId: token.teacherId as TeacherId | undefined,
      studentId: token.studentId as StudentId | undefined,
      parentId: token.parentId as ParentId | undefined,
      staffId: token.staffId as StaffId | undefined,
      scannerId: token.scannerId as ScannerId | undefined,
    },
    idempotencyKey: opts.idempotencyKey,
    impersonating: token.impersonating === true,
    usedTenantOverride,
    now: clock,
    repos: opts.repos,
    ai: opts.ai,
  };
}

function anonymousContext(opts: BuildCtxOptions, clock: () => Timestamp): AuthContext {
  return {
    uid: PUBLIC_UID,
    isSuperAdmin: false,
    tenantId: null,
    role: null,
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    idempotencyKey: opts.idempotencyKey,
    now: clock,
    repos: opts.repos,
    ai: opts.ai,
  };
}
