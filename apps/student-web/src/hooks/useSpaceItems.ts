import { useItems } from "@levelup/query";
import type { UnifiedItem } from "@levelup/shared-types";

/**
 * App-local wrappers over `@levelup/query`'s `useItems` (answer-stripped list).
 * Preserve the legacy signatures + `UnifiedItem[]` return shape so existing
 * consumers keep working. `tenantId` is now resolved inside the SDK (auth
 * context), so the first arg is accepted but ignored.
 */
export function useStoryPointItems(
  _tenantId: string | null,
  spaceId: string | null,
  storyPointId: string | null
) {
  const result = useItems<{ items: UnifiedItem[] }>(spaceId ?? "", storyPointId ?? "", undefined, {
    enabled: !!spaceId && !!storyPointId,
    staleTime: 5 * 60 * 1000,
  });
  return {
    ...result,
    data: (result.data?.items ?? undefined) as UnifiedItem[] | undefined,
  };
}

export function useSectionItems(
  _tenantId: string | null,
  spaceId: string | null,
  storyPointId: string | null,
  sectionId: string | null
) {
  const result = useItems<{ items: UnifiedItem[] }>(
    spaceId ?? "",
    storyPointId ?? "",
    sectionId ? { sectionId } : {},
    {
      enabled: !!spaceId && !!storyPointId && !!sectionId,
      staleTime: 5 * 60 * 1000,
    }
  );
  return {
    ...result,
    data: (result.data?.items ?? undefined) as UnifiedItem[] | undefined,
  };
}
