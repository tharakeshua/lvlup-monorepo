import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";

// Migrated to @levelup/query: resolve each tenant name via the identity
// tenantRepo.get(id) read. Signature + Record<tenantId,name> shape preserved.
export function useTenantNames(tenantIds: string[]) {
  const repos = useRepos();
  return useQuery<Record<string, string>>({
    queryKey: ["tenantNames", tenantIds],
    queryFn: async () => {
      if (!tenantIds.length) return {};
      const names: Record<string, string> = {};
      await Promise.all(
        tenantIds.map(async (id) => {
          try {
            const tenant = await repos.tenantRepo.get(id);
            const name = (tenant as { name?: string } | null)?.name;
            if (name) names[id] = name;
          } catch {
            // Fallback handled by caller
          }
        })
      );
      return names;
    },
    enabled: tenantIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
