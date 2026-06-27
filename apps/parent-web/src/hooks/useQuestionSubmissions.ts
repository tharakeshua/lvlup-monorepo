import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";
import type { QuestionSubmission } from "@levelup/shared-types";

// Migrated to @levelup/query: per-question grading rows come from the autograde
// questionSubmissionRepo.list(submissionId). The (tenantId, submissionId)
// signature is preserved; tenant is derived from SDK context, so tenantId only
// gates + keys the query. Return shape (QuestionSubmission[]) preserved.
export function useQuestionSubmissions(tenantId: string | null, submissionId: string | null) {
  const repos = useRepos();
  return useQuery<QuestionSubmission[]>({
    queryKey: ["tenants", tenantId, "questionSubmissions", submissionId],
    queryFn: async () => {
      if (!tenantId || !submissionId) return [];
      const rows = await repos.questionSubmissionRepo.list(submissionId);
      return rows as unknown as QuestionSubmission[];
    },
    enabled: !!tenantId && !!submissionId,
    staleTime: 5 * 60 * 1000,
  });
}
