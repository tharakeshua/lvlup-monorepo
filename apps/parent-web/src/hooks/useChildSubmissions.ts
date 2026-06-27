import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@levelup/query";
import type { Submission, Exam } from "@levelup/shared-types";

// Migrated to @levelup/query.
//
// PARITY GAP (flagged to Frontend-Lead): the autograde submissionRepo.list
// REQUIRES an examId — there is NO studentId-only "submissions across all exams"
// read like the old `where('studentId','in',batch)` query. So we best-effort
// enumerate the tenant's exams (examRepo, which also yields title/subject for
// enrichment) and, per exam, list released submissions and keep the ones for the
// linked children. Heavier read pattern (bounded by exam count) but functionally
// equivalent. Signature + (Submission & {examTitle?;examSubject?})[] shape preserved.
export function useChildSubmissions(tenantId: string | null, studentIds: string[] | undefined) {
  const repos = useRepos();
  return useQuery<(Submission & { examTitle?: string; examSubject?: string })[]>({
    queryKey: ["tenants", tenantId, "childSubmissions", studentIds],
    queryFn: async () => {
      if (!tenantId || !studentIds?.length) return [];
      const idSet = new Set(studentIds);

      // 1. Enumerate all exams (drain pages) + build the title/subject cache.
      const examCache: Record<string, { title: string; subject: string }> = {};
      const examIds: string[] = [];
      let examBag = await repos.examRepo.paginate();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        for (const raw of examBag.items as unknown as Exam[]) {
          if (!raw?.id) continue;
          examCache[raw.id] = { title: raw.title, subject: raw.subject };
          examIds.push(raw.id);
        }
        if (!examBag.fetchNextPage) break;
        examBag = await examBag.fetchNextPage();
      }

      // 2. Per exam, list released submissions and keep the linked children's.
      const all: Submission[] = [];
      await Promise.all(
        examIds.map(async (examId) => {
          try {
            let bag = await repos.submissionRepo.paginate({
              examId: examId as never,
              resultsReleasedOnly: true,
            });
            // eslint-disable-next-line no-constant-condition
            while (true) {
              for (const s of bag.items as unknown as Submission[]) {
                if (idSet.has(s.studentId)) all.push(s);
              }
              if (!bag.fetchNextPage) break;
              bag = await bag.fetchNextPage();
            }
          } catch {
            // Ignore per-exam errors
          }
        })
      );

      // 3. Sort newest-first (parity with the old orderBy('createdAt','desc')).
      all.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

      return all.map((sub) => ({
        ...sub,
        examTitle: examCache[sub.examId]?.title,
        examSubject: examCache[sub.examId]?.subject,
      }));
    },
    enabled: !!tenantId && !!studentIds?.length,
    staleTime: 60 * 1000,
  });
}
