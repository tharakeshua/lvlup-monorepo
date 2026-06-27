import { zEnum } from "./enum.js";

export const SPACE_STATUSES = ["draft", "published", "archived"] as const;
export type SpaceStatus = (typeof SPACE_STATUSES)[number];
export const zSpaceStatus = zEnum(SPACE_STATUSES);

export const SPACE_TYPES = ["learning", "practice", "assessment", "resource", "hybrid"] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];
export const zSpaceType = zEnum(SPACE_TYPES);

export const SPACE_ACCESS_TYPES = ["class_assigned", "tenant_wide", "public_store"] as const;
export type SpaceAccessType = (typeof SPACE_ACCESS_TYPES)[number];
export const zSpaceAccessType = zEnum(SPACE_ACCESS_TYPES);
