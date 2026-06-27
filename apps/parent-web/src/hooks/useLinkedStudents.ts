import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";
import type { UserMembership } from "@levelup/shared-types";

// Migrated to @levelup/query: linked children come from the analytics parentRepo
// (server reads the parentLinkedStudentIds claim — D10 — and collapses the
// per-child fan-out). The (tenantId, parentId) signature is preserved for the
// consumers; tenant/parent are derived from the SDK context server-side, so the
// params are only used to gate the query + key it.
export function useLinkedStudents(tenantId: string | null, parentId: string | null) {
  const repos = useRepos();
  return useQuery<UserMembership[]>({
    queryKey: ["tenants", tenantId, "linkedStudents", parentId],
    queryFn: async () => {
      if (!tenantId || !parentId) return [];
      const page = await repos.parentRepo.listChildren();
      // Map each ChildSummaryRow back to the membership shape the consumers read
      // (uid, id, status, studentId). uid === the canonical studentId so it lines
      // up with summary.studentId in the consumer pages.
      return page.items.map((row) => ({
        id: row.studentId,
        uid: row.studentId,
        studentId: row.studentId,
        tenantId,
        tenantCode: "",
        role: "student",
        status: "active",
        joinSource: "migration",
        createdAt: null,
        updatedAt: null,
      })) as unknown as UserMembership[];
    },
    enabled: !!tenantId && !!parentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLinkedStudentIds(tenantId: string | null, parentId: string | null) {
  const { data, ...rest } = useLinkedStudents(tenantId, parentId);
  return {
    ...rest,
    data: data?.map((s) => s.uid),
  };
}
