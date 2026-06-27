import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";

// Migrated to @levelup/query: child display names come from the analytics
// parentRepo's listChildren rows (already name-resolved server-side), keyed by
// the canonical studentId (== the uid the consumers pass in). Signature + the
// Record<uid,string> return shape are preserved.
export function useStudentNames(tenantId: string | null, studentIds: string[]) {
  const repos = useRepos();
  return useQuery<Record<string, string>>({
    queryKey: ["tenants", tenantId, "studentNames", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return {};
      const page = await repos.parentRepo.listChildren();
      const byId: Record<string, string> = {};
      for (const row of page.items) {
        byId[row.studentId] = row.name;
      }
      // Only surface the requested ids (parity with the old per-uid lookup).
      const names: Record<string, string> = {};
      for (const uid of studentIds) {
        if (byId[uid]) names[uid] = byId[uid];
      }
      return names;
    },
    enabled: studentIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
