/**
 * `processAnswerMappingService` — Panopticon scouting v2 (Map & Snipe,
 * ARCHITECTURE-PLAN.md §3.2-3.3). The scout now runs ONE cheap Flash call PER
 * PAGE (each seeing the full question context so semantic matching works), then a
 * deterministic aggregation layer (`build-routing-map`) turns the per-page
 * mappings into the routing map + edge-case signals (sandwich/mixed/orphan). It
 * writes `scoutingResult` on the submission and creates one `QuestionSubmission`
 * per question (status `pending`). Single-writer (only writer of `scoutingResult`).
 *
 * Per-page failure is isolated: a page whose scout call keeps failing degrades to
 * "unmapped" (feeds the orphan flow) — the scout NEVER fails wholesale on one bad
 * page. The mapping INVARIANT (P0-C): `mapping.imageUrls` carries the REAL storage
 * paths of the pages routed to each question. Additive `mapping.otherQuestionIds`
 * (the other questions sharing a page) is the evaluation session's context-
 * isolation input (confirmed seam contract 2026-07-18).
 */
import type { SystemContext } from "../../shared/context.js";
import { requireTenant, fail } from "../../shared/context.js";
import { listExamQuestions } from "./questions.js";
import { projectSubmissionStatus } from "./grading-projection.js";
import { mapWithConcurrency } from "../../shared/concurrency.js";
import { buildRoutingMap, type FoundContent, type PageMapping } from "./build-routing-map.js";

export interface ProcessAnswerMappingInput {
  submissionId: string;
}

/** Concurrency cap for the per-page scout fan-out (ARCHITECTURE-PLAN.md §3.2). */
const SCOUT_PAGE_CONCURRENCY = 4;

const MATCH_TYPES: ReadonlySet<FoundContent["matchType"]> = new Set([
  "explicit_marker",
  "semantic_context",
  "continuation",
  "mixed",
]);

/**
 * The scout's structured-output schema (Gemini subset: type/properties/required/
 * items/enum ONLY — no additionalProperties). This MUST describe the real reply
 * shape: a bare `{ type: "object" }` makes Gemini's constrained JSON decoder emit
 * an empty `{}` for every page (no `foundContent`), so the scout silently maps
 * nothing and every page degrades to an orphan. Mirrors `toPageMapping`'s reader.
 */
const SCOUT_PAGE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    pageIndex: { type: "integer" },
    foundContent: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          matchType: { type: "string", enum: [...MATCH_TYPES] },
          confidence: { type: "number" },
          isPartial: { type: "boolean" },
        },
        required: ["questionId", "matchType", "confidence", "isPartial"],
      },
    },
    hasUnknownContent: { type: "boolean" },
  },
  required: ["pageIndex", "foundContent", "hasUnknownContent"],
} as const;

/** Defensively coerce a scout's raw JSON reply into a PageMapping. */
function toPageMapping(json: unknown, pageIndex: number): PageMapping {
  const obj = (json ?? {}) as Record<string, unknown>;
  const rawFound = Array.isArray(obj["foundContent"]) ? (obj["foundContent"] as unknown[]) : [];
  const foundContent: FoundContent[] = [];
  for (const raw of rawFound) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const questionId = typeof c["questionId"] === "string" ? c["questionId"] : undefined;
    if (!questionId) continue;
    const matchTypeRaw = c["matchType"] as FoundContent["matchType"];
    foundContent.push({
      questionId,
      matchType: MATCH_TYPES.has(matchTypeRaw) ? matchTypeRaw : "semantic_context",
      confidence: typeof c["confidence"] === "number" ? c["confidence"] : 0,
      isPartial: Boolean(c["isPartial"]),
    });
  }
  return { pageIndex, foundContent, hasUnknownContent: Boolean(obj["hasUnknownContent"]) };
}

export async function processAnswerMappingService(
  input: ProcessAnswerMappingInput,
  ctx: SystemContext
): Promise<void> {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);

  const examId = sub["examId"] as string;
  const causation = (sub["llmCausation"] as Record<string, string | undefined> | undefined) ?? {};
  const studentId = sub["studentId"] as string;
  const student = await ctx.repos.students.get(tenantId, studentId);
  const subjectUserId = causation["subjectUserId"] ?? (student?.["authUid"] as string | undefined);
  const questions = await listExamQuestions(ctx, tenantId, examId);
  const pages =
    ((sub["answerSheets"] as Record<string, unknown> | undefined)?.["images"] as
      | string[]
      | undefined) ?? [];
  // Scouting without pages would leave every question unmapped and grading blind
  // (P0-C) — fail loudly; the pipeline reducer DLQs scouting failures.
  if (pages.length === 0) {
    fail("FAILED_PRECONDITION", "cannot scout: submission has no answer-sheet images");
  }

  // FULL question context per page — semantic matching needs the question TEXT,
  // not just ids (the P0-class quality gap of the old monolithic scout).
  const questionsContext = questions.map((q) => ({
    id: q["id"] as string,
    order: q["order"] as number,
    text: q["text"] as string,
    maxMarks: q["maxMarks"] as number,
    questionType: q["questionType"] as string | undefined,
  }));

  const callContext = {
    tenantId,
    uid: ctx.uid,
    role: ctx.role ?? "system",
    resourceType: "submission",
    resourceId: input.submissionId,
    now: ctx.now,
    examId,
    submissionId: input.submissionId,
    usage: {
      actorUserId: ctx.uid,
      actorRole: ctx.role ?? "system",
      ...(causation["initiatedByUserId"]
        ? { initiatedByUserId: causation["initiatedByUserId"] }
        : {}),
      ...(causation["initiatorRole"] ? { initiatorRole: causation["initiatorRole"] } : {}),
      ...(subjectUserId ? { subjectUserId, billingUserId: subjectUserId } : {}),
      related: { examId, submissionId: input.submissionId },
    },
  };

  // Per-page fan-out (ARCHITECTURE-PLAN.md §3.2): one Flash call per page, capped
  // concurrency, each page retried ONCE. A still-failing page degrades to an
  // empty mapping (→ orphan flow) so one bad page never fails the whole scout.
  const pageMappings = await mapWithConcurrency(pages, SCOUT_PAGE_CONCURRENCY, async (path, i) => {
    const attempt = async (): Promise<PageMapping> => {
      const ai = await ctx.ai.generate(
        {
          promptKey: "answerMappingPage",
          operation: "answer.mapping",
          variables: {
            questionsContext,
            pageIndex: i,
            pageCount: pages.length,
          },
          // Storage PATH — the ai gateway downloads + inlines the bytes (P0-B seam).
          images: [{ storagePath: path }],
          responseSchema: SCOUT_PAGE_RESPONSE_SCHEMA,
        },
        callContext
      );
      return toPageMapping(ai.json, i);
    };
    try {
      return await attempt();
    } catch {
      try {
        return await attempt();
      } catch {
        // Give up on this page — it becomes an unmapped orphan.
        return { pageIndex: i, foundContent: [], hasUnknownContent: true };
      }
    }
  });

  // Deterministic aggregation (no LLM): routing map + sandwich/mixed/orphan.
  const routing = buildRoutingMap(pageMappings, questionsContext, pages.length);

  // Back-compat scoutingResult views: routingMap = questionToPages; per-question
  // confidence = the best confidence the scout gave that question on any page.
  const confidence: Record<string, number> = {};
  for (const m of pageMappings) {
    for (const c of m.foundContent) {
      confidence[c.questionId] = Math.max(confidence[c.questionId] ?? 0, c.confidence);
    }
  }
  const now = ctx.now();

  // Write scoutingResult on the submission (single-writer). Existing fields
  // (routingMap/confidence/completedAt) are preserved; the new fields are
  // server-only detail (never ride the slim RTDB ticker).
  await ctx.repos.submissions.upsert(
    tenantId,
    {
      id: input.submissionId,
      scoutingResult: {
        routingMap: routing.questionToPages,
        confidence,
        pageMappings,
        unmappedPages: routing.unmappedPages,
        edgeCases: routing.edgeCases,
        aggregateConfidence: routing.aggregateConfidence,
        completedAt: now,
      },
      // Surface a review flag when orphan pages exist (§3.3 review queue input).
      needsScoutReview: routing.unmappedPages.length > 0,
      summary: {
        ...(sub["summary"] as Record<string, unknown>),
        totalQuestions: questions.length,
      },
    },
    now
  );

  // Create one QuestionSubmission per question (status pending). The mapping
  // invariant (P0-C): `imageUrls` carries the REAL storage paths of the pages the
  // scout routed to this question — RELMS grades exactly these pages.
  for (const q of questions) {
    const qid = q["id"] as string;
    // Aggregation already validated/sorted indices to [0, pageCount).
    const pageIndices = routing.questionToPages[qid] ?? [];
    const imageUrls = pageIndices.map((i) => pages[i] as string);
    // Additive context-isolation input for the evaluator (confirmed seam).
    const otherQuestionIds = routing.otherQuestionIdsByQuestion[qid] ?? [];
    await ctx.repos.submissions.upsert(
      tenantId,
      {
        // Deterministic id — a re-scout (scouting_failed → scouting) UPSERTS the
        // same QuestionSubmission docs instead of duplicating them (P2-H class).
        id: `${input.submissionId}_${qid}`,
        submissionId: input.submissionId,
        questionId: qid,
        examId,
        mapping: { pageIndices, imageUrls, otherQuestionIds, scoutedAt: now },
        gradingStatus: "pending",
        gradingRetryCount: 0,
        _kind: "questionSubmission",
      },
      now
    );
  }

  // AG-5: seed the live ticker with the scouting baseline — status `scouting`, the
  // now-known question total, zero graded. Slim counts only (no answer-key / score).
  await projectSubmissionStatus(ctx, tenantId, {
    submissionId: input.submissionId,
    examId,
    studentId: sub["studentId"] as string,
    pipelineStatus: "scouting",
    gradingProgress: { graded: 0, total: questions.length },
  });
}
