import type { TransitionMap } from "./types.js";
import type { TenantStatus } from "../enums/tenant.js";
import type { MembershipStatus } from "../enums/tenant.js";
import type { EntityStatus } from "../enums/tenant.js";
import type { AnnouncementStatus } from "../enums/misc.js";

// identity §"ALLOWED_TRANSITIONS.tenant".
export const TENANT_TRANSITIONS = {
  trial: ["active", "expired", "suspended", "deactivated"],
  active: ["suspended", "deactivated", "expired"],
  suspended: ["active", "deactivated"],
  expired: ["active", "deactivated"],
  deactivated: ["active"],
} as const satisfies TransitionMap<TenantStatus>;

// identity §"ALLOWED_TRANSITIONS.membership".
export const MEMBERSHIP_TRANSITIONS = {
  active: ["inactive", "suspended"],
  inactive: ["active"],
  suspended: ["active", "inactive"],
} as const satisfies TransitionMap<MembershipStatus>;

// identity §"ALLOWED_TRANSITIONS.entityStatus" (student/teacher/parent/staff/scanner/class/session).
export const ENTITY_STATUS_TRANSITIONS = {
  active: ["archived"],
  archived: ["active"],
} as const satisfies TransitionMap<EntityStatus>;

// identity + notification §"ALLOWED_TRANSITIONS.announcement".
export const ANNOUNCEMENT_TRANSITIONS = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: ["draft"],
} as const satisfies TransitionMap<AnnouncementStatus>;
