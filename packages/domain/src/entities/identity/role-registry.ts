/**
 * `ROLE_DESCRIPTORS` — THE single source of truth for "what is a tenant role"
 * (DP-2 Part B / SDK-RR-T2 §B). One entry per role carries its `rank`, `idField`,
 * branded `idBrand`, `repoKey`, `scope`, and the `provisionable`/`authoring` flags.
 * Everything keyed by role — the `TENANT_ROLES` enum, `ROLE_RANK`, `isAuthoringRole`,
 * the `EntityIds` shape, the `repoKeyForRole`/`idFieldForRole` lookups, and the
 * per-role id Zod fields on claims/membership/links — DERIVES from this one list.
 * Adding a role is one descriptor append + one branded-id line + N intentional
 * `ACCESS_RULES` lines (which STAY manual — a security decision).
 *
 * NOTE (cycle avoidance): the descriptor intentionally does NOT carry the role's
 * `profileSchema`. The profile schemas live in `./profiles.ts`, which imports
 * `enums/tenant.ts` — and `enums/tenant.ts` now DERIVES `TENANT_ROLES` from this
 * registry. Importing the profiles here would form profiles → enums/tenant →
 * role-registry → profiles. None of DP-2's derivations need `profileSchema`, so it
 * stays in `profiles.ts`; wire it into the descriptor only when the save-callable
 * factory (Tier 4, role-addition) is built. This registry imports ONLY the branded
 * id primitives (a leaf), so it is cycle-free.
 */
import { z } from "zod";
import {
  zStudentId,
  zTeacherId,
  zParentId,
  zStaffId,
  zScannerId,
} from "../../primitives/branded-id.zod.js";

export interface RoleDescriptor {
  /** The role literal (the discriminant). */
  role: string;
  /** Ordinal authority rank (`isStaffOrAbove`/`isTeacherOrAbove` compare on this). */
  rank: number;
  /** Claims/membership/EntityIds/links id-field key, e.g. `"studentId"` (`""` if none). */
  idField: string;
  /** The branded Zod id schema for `idField` (drives the per-role schema fields). */
  idBrand: z.ZodTypeAny;
  /** `ctx.repos[repoKey]` for provisioning, e.g. `"students"` (`""` if not provisionable). */
  repoKey: string;
  /** Platform-scoped (`superAdmin`) vs tenant-scoped. */
  scope: "platform" | "tenant";
  /** Can `createOrgUser` make one? */
  provisionable: boolean;
  /** Authoring role — the rubric-guidance / item-for-edit gate (`isAuthoringRole`). */
  authoring: boolean;
  /** Which granular permission space the role uses (B-IDN-13), if any. */
  permissionSet?: "teacher" | "staff";
}

/**
 * The 7 roles. Ordered to match the historical `TENANT_ROLES` tuple exactly so the
 * derived enum is byte-identical; `rank` is independent of array order.
 */
export const ROLE_DESCRIPTORS = [
  {
    role: "superAdmin",
    rank: 6,
    idField: "",
    idBrand: z.never(),
    repoKey: "",
    scope: "platform",
    provisionable: false,
    authoring: false,
  },
  {
    role: "tenantAdmin",
    rank: 5,
    idField: "",
    idBrand: z.never(),
    repoKey: "",
    scope: "tenant",
    provisionable: false,
    authoring: true,
  },
  {
    role: "teacher",
    rank: 3,
    idField: "teacherId",
    idBrand: zTeacherId,
    repoKey: "teachers",
    scope: "tenant",
    provisionable: true,
    authoring: true,
    permissionSet: "teacher",
  },
  {
    role: "student",
    rank: 0,
    idField: "studentId",
    idBrand: zStudentId,
    repoKey: "students",
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  {
    role: "parent",
    rank: 1,
    idField: "parentId",
    idBrand: zParentId,
    repoKey: "parents",
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  {
    role: "scanner",
    rank: 2,
    idField: "scannerId",
    idBrand: zScannerId,
    repoKey: "scanners",
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  {
    role: "staff",
    rank: 4,
    idField: "staffId",
    idBrand: zStaffId,
    repoKey: "staff",
    scope: "tenant",
    provisionable: true,
    authoring: true,
    permissionSet: "staff",
  },
] as const satisfies readonly RoleDescriptor[];

/** The role literal union — the registry IS the SSOT. */
export type TenantRole = (typeof ROLE_DESCRIPTORS)[number]["role"];

/** Provisionable (id-carrying) descriptors — drive every per-role id structure. */
export const ID_ROLES = ROLE_DESCRIPTORS.filter((d) => d.idField !== "") as readonly Extract<
  (typeof ROLE_DESCRIPTORS)[number],
  { idField: Exclude<(typeof ROLE_DESCRIPTORS)[number]["idField"], ""> }
>[];

/** The id-field keys (`"teacherId" | "studentId" | …`) — drives `EntityIds`/`roleIdFields`. */
export type RoleIdField = (typeof ID_ROLES)[number]["idField"];

// ---------------------------------------------------------------------------
// DERIVATIONS — everything below regenerates from the one list above.
// ---------------------------------------------------------------------------

/** All role keys, in registry order (== the historical `TENANT_ROLES` tuple). */
export const TENANT_ROLES = ROLE_DESCRIPTORS.map((d) => d.role) as [TenantRole, ...TenantRole[]];

/** Zod enum over the role keys. */
export const zTenantRole = z.enum(TENANT_ROLES);

/** role → ordinal rank (the `isStaffOrAbove`/`isTeacherOrAbove` comparison axis). */
export const ROLE_RANK = Object.fromEntries(
  ROLE_DESCRIPTORS.map((d) => [d.role, d.rank])
) as Record<TenantRole, number>;

/** Authoring roles — the rubric-guidance / item-for-edit gate. Registry-driven. */
export const isAuthoringRole = (role: TenantRole | null): boolean =>
  !!role && (ROLE_DESCRIPTORS.find((d) => d.role === role)?.authoring ?? false);

/** role → provisioning repo key (`ctx.repos[repoKey]`). Collapses `entityRepoByRole`. */
export const repoKeyForRole = (role: TenantRole): string | undefined =>
  ROLE_DESCRIPTORS.find((d) => d.role === role)?.repoKey || undefined;

/** role → claims/membership id-field key. Collapses the `org-users` ternary chain. */
export const idFieldForRole = (role: TenantRole): RoleIdField | undefined => {
  const f = ROLE_DESCRIPTORS.find((d) => d.role === role)?.idField;
  return f ? (f as RoleIdField) : undefined;
};

/** Entity-id bag derived from claims — `{ teacherId?, studentId?, … }`. */
export type EntityIds = Partial<Record<RoleIdField, string>>;

/**
 * The per-role id Zod fields shared by `PlatformClaimsSchema` / `UserMembershipSchema`
 * / `ChangeMembershipRoleRequest.links` — derived from `ID_ROLES` so a new role's id
 * field appears in all three at once (auto-fixing B-IDN-23, where `scanner` was
 * orphaned). `Object.fromEntries` loses the per-field brand at the type level, so the
 * value is cast to the precise branded-field shape — the single sanctioned brand-cast
 * residual (DP-2 §C). Runtime is fully correct (each value is `zXId.optional()`).
 */
export type RoleIdFields = {
  [D in (typeof ID_ROLES)[number] as D["idField"]]: z.ZodOptional<D["idBrand"]>;
};
export const roleIdFields = Object.fromEntries(
  ID_ROLES.map((d) => [d.idField, d.idBrand.optional()])
) as RoleIdFields;
