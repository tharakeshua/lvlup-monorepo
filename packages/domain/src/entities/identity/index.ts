export * from "./user.js";
export * from "./membership.js";
export * from "./claims.js";
export * from "./tenant.js";
export * from "./profiles.js";
export * from "./class.js";
export * from "./user-provider-key.js";

// DP-2 Part B role registry — the role-keyed SSOT. `TENANT_ROLES`/`TenantRole`/
// `zTenantRole` are re-exported via `enums/tenant.ts` (NOT here) to avoid a
// duplicate barrel export; here we surface only the role-keyed derivations.
export {
  ROLE_DESCRIPTORS,
  ID_ROLES,
  ROLE_RANK,
  isAuthoringRole,
  repoKeyForRole,
  idFieldForRole,
  roleIdFields,
} from "./role-registry.js";
export type { RoleDescriptor, RoleIdField, EntityIds, RoleIdFields } from "./role-registry.js";
