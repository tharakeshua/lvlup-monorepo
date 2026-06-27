import { useStoryPoints as useQueryStoryPoints } from "@levelup/query";
import type { StoryPoint } from "@levelup/shared-types";

/**
 * App-local wrapper over `@levelup/query`'s `useStoryPoints`.
 * Preserves the legacy `(tenantId, spaceId)` signature + `StoryPoint[]` return
 * shape so existing consumers keep working. `tenantId` is now resolved inside
 * the SDK (auth context), so the first arg is accepted but ignored.
 */
export function useStoryPoints(_tenantId: string | null, spaceId: string | null) {
  const result = useQueryStoryPoints<{ items: StoryPoint[] }>(spaceId ?? "", {
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
  return {
    ...result,
    data: (result.data?.items ?? undefined) as StoryPoint[] | undefined,
  };
}
