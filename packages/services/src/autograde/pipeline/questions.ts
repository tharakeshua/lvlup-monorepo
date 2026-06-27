/**
 * Question + question-submission read helpers shared by the pipeline + read
 * services. Questions live in a nested collection under the exam; the testing twin
 * flattens them onto the `exams` repo with a `_kind:'examQuestion'` discriminator,
 * the real admin adapter resolves the nested path. Both expose the same listing.
 */
import type { AuthContext } from "../../shared/context.js";

/** List the extracted questions for an exam (ordered). */
export async function listExamQuestions(
  ctx: AuthContext,
  tenantId: string,
  examId: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.exams.list(tenantId, {
      where: { examId },
      filter: (d) => d["_kind"] === "examQuestion",
      cursor,
      limit: 200,
    });
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  out.sort((a, b) => ((a["order"] as number) ?? 0) - ((b["order"] as number) ?? 0));
  return out;
}

/** List the per-question submissions for a submission. */
export async function listQuestionSubmissions(
  ctx: AuthContext,
  tenantId: string,
  submissionId: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      where: { submissionId },
      filter: (d) => d["_kind"] === "questionSubmission",
      cursor,
      limit: 200,
    });
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}
