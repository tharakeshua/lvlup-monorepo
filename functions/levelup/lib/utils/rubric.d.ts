import type { UnifiedItem, UnifiedRubric } from "../types";
/**
 * Resolve rubric using the inheritance chain: item > storyPoint > space > tenant.
 * Full override model — first non-null wins.
 */
export declare function resolveRubric(
  tenantId: string,
  spaceId: string,
  item: UnifiedItem
): Promise<UnifiedRubric | null>;
