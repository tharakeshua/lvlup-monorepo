import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";
import type { Space } from "@levelup/shared-types";

// Migrated to @levelup/query: resolve space titles via the levelup-content
// spaceRepo.getMany batched read (N+1 collapse — one wire call carrying every
// id). Signature + Record<spaceId,title> shape preserved.
export function useSpaceNames(tenantId: string | null, spaceIds: string[]) {
  const repos = useRepos();
  return useQuery<Record<string, string>>({
    queryKey: ["tenants", tenantId, "spaceNames", spaceIds],
    queryFn: async () => {
      if (!tenantId || !spaceIds.length) return {};
      const names: Record<string, string> = {};
      try {
        const spaces = (await repos.spaceRepo.getMany(spaceIds)) as Array<
          Pick<Space, "id" | "title">
        >;
        for (const s of spaces) {
          if (s?.id) names[s.id] = s.title;
        }
      } catch {
        // Ignore batch errors (parity: caller falls back to a sliced id label)
      }
      return names;
    },
    enabled: !!tenantId && spaceIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
