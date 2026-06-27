import { zEnum } from "./enum.js";

// Reconciled to identity.md (richer than domain-core §7.2 placeholder).
export const TENANT_STATUSES = ["active", "suspended", "trial", "expired", "deactivated"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];
export const zTenantStatus = zEnum(TENANT_STATUSES);

export const TENANT_PLANS = ["free", "trial", "basic", "premium", "enterprise"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];
export const zTenantPlan = zEnum(TENANT_PLANS);

export const TENANT_ROLES = [
  "superAdmin",
  "tenantAdmin",
  "teacher",
  "student",
  "parent",
  "scanner",
  "staff",
] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
export const zTenantRole = zEnum(TENANT_ROLES);

export const MEMBERSHIP_STATUSES = ["active", "inactive", "suspended"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export const zMembershipStatus = zEnum(MEMBERSHIP_STATUSES);

export const JOIN_SOURCES = [
  "admin_created",
  "bulk_import",
  "invite_code",
  "self_register",
  "migration",
  "tenant_code",
] as const;
export type JoinSource = (typeof JOIN_SOURCES)[number];
export const zJoinSource = zEnum(JOIN_SOURCES);

export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const zUserStatus = zEnum(USER_STATUSES);

// student/teacher/parent/staff/scanner/class/session lifecycle.
export const ENTITY_STATUSES = ["active", "archived"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];
export const zEntityStatus = zEnum(ENTITY_STATUSES);

export const CONSUMER_PLANS = ["free", "pro", "premium"] as const;
export type ConsumerPlan = (typeof CONSUMER_PLANS)[number];
export const zConsumerPlan = zEnum(CONSUMER_PLANS);
