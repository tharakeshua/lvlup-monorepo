import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";
import type { SpaceProgress } from "@levelup/shared-types";

// Migrated to @levelup/query.
//
// PARITY GAP (flagged to Frontend-Lead): the SDK exposes NO "list every
// spaceProgress doc for a set of users" read — progressRepo only offers
// getSpace(spaceId, userId). So we best-effort enumerate the tenant's content
// spaces (spaceRepo) and probe progressRepo.getSpace(spaceId, uid) per
// (space × child), collecting the non-null hits. This is a heavier read pattern
// than the old single `where('userId','in',batch)` query and is bounded by the
// content-space count. Signature + SpaceProgress[] return shape preserved.
export function useChildProgress(tenantId: string | null, studentIds: string[] | undefined) {
  const repos = useRepos();
  return useQuery<SpaceProgress[]>({
    queryKey: ["tenants", tenantId, "childProgress", studentIds],
    queryFn: async () => {
      if (!tenantId || !studentIds?.length) return [];

      // 1. Enumerate the tenant's content spaces (drain all pages).
      const spaceIds: string[] = [];
      let bag = await repos.spaceRepo.paginate();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        for (const sp of bag.items as Array<{ id?: string }>) {
          if (sp?.id) spaceIds.push(sp.id);
        }
        if (!bag.fetchNextPage) break;
        bag = await bag.fetchNextPage();
      }

      // 2. Probe per (space × child); collect the non-null progress docs.
      const all: SpaceProgress[] = [];
      await Promise.all(
        studentIds.flatMap((uid) =>
          spaceIds.map(async (spaceId) => {
            try {
              const p = await repos.progressRepo.getSpace(spaceId as never, uid as never);
              if (p) all.push(p as unknown as SpaceProgress);
            } catch {
              // Ignore per-probe errors
            }
          })
        )
      );
      return all;
    },
    enabled: !!tenantId && !!studentIds?.length,
    staleTime: 60 * 1000,
  });
}
