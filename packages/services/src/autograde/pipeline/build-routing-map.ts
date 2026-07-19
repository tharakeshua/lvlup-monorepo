/**
 * `buildRoutingMap` — the deterministic aggregation layer of the Map & Snipe
 * scout (ARCHITECTURE-PLAN.md §3.3, a pure port of the POC
 * `03-ALGORITHM-PHASE1.md` `build_routing_map`). NO LLM, NO ctx: it takes the
 * per-page scout mappings and produces the master routing map plus the edge-case
 * signals (sandwich fill, mixed pages, orphan pages) the review queue needs.
 *
 * Contract with the evaluation session (confirmed 2026-07-18): the aggregation
 * emits `otherQuestionIdsByQuestion` — for each question, the OTHER questions
 * sharing any of its mapped pages — which the caller writes to each qsub's
 * `mapping.otherQuestionIds` for grader context isolation.
 */

/** A single question detected on a page by the scout (`answerMappingPage`). */
export interface FoundContent {
  questionId: string;
  matchType: "explicit_marker" | "semantic_context" | "continuation" | "mixed";
  confidence: number;
  isPartial: boolean;
}

/** The scout's per-page output (POC `PageMapping`). */
export interface PageMapping {
  pageIndex: number;
  foundContent: FoundContent[];
  hasUnknownContent: boolean;
}

export type EdgeCaseType = "sandwich_filled" | "mixed_page" | "orphan_page";

export interface EdgeCase {
  type: EdgeCaseType;
  affectedPages: number[];
  affectedQuestions: string[];
  resolution: string;
  needsReview: boolean;
}

export interface RoutingMap {
  /** questionId → sorted list of page indices routed to it. */
  questionToPages: Record<string, number[]>;
  /** page index → question ids found on it. */
  pageToQuestions: Record<number, string[]>;
  /** questionId → other question ids sharing any of its pages (context isolation). */
  otherQuestionIdsByQuestion: Record<string, string[]>;
  /** page indices that could not be mapped to any question (orphans). */
  unmappedPages: number[];
  edgeCases: EdgeCase[];
  /** mappedPages / totalPages (0..1). */
  aggregateConfidence: number;
}

/** Minimal question shape the aggregation validates ids against. */
export interface RoutingQuestion {
  id: string;
}

/** Confidence floor for a `foundContent` entry to count toward mapping. */
export const MAPPING_CONFIDENCE_FLOOR = 0.5;

/**
 * Aggregate per-page scout mappings into the master routing map.
 *
 * @param pageMappings raw per-page scout output (may be sparse / out of order).
 * @param questions    the exam questions — foundContent ids not in this set are
 *                     dropped as hallucinations (skipped when the list is empty).
 * @param pageCount    total answer-sheet pages; pages with no mapping (e.g. a
 *                     failed scout call) are treated as unmapped orphans.
 */
export function buildRoutingMap(
  pageMappings: readonly PageMapping[],
  questions: readonly RoutingQuestion[],
  pageCount: number
): RoutingMap {
  const validIds = new Set(questions.map((q) => q.id));
  const validate = validIds.size > 0;
  const byPage = new Map<number, PageMapping>();
  for (const m of pageMappings) byPage.set(m.pageIndex, m);

  const questionToPages: Record<string, number[]> = {};
  const pageToQuestions: Record<number, string[]> = {};
  const unmappedPages: number[] = [];
  const edgeCases: EdgeCase[] = [];

  // First pass: direct mapping (confidence-filtered).
  for (let page = 0; page < pageCount; page++) {
    const mapping = byPage.get(page);
    const found = (mapping?.foundContent ?? []).filter(
      (c) => c.confidence >= MAPPING_CONFIDENCE_FLOOR && (!validate || validIds.has(c.questionId))
    );
    // De-dupe repeated question ids on the same page, preserve first-seen order.
    const questionsOnPage: string[] = [];
    for (const c of found) {
      if (!questionsOnPage.includes(c.questionId)) questionsOnPage.push(c.questionId);
    }

    if (questionsOnPage.length === 0) {
      unmappedPages.push(page);
      pageToQuestions[page] = [];
      continue;
    }

    pageToQuestions[page] = questionsOnPage;
    for (const qid of questionsOnPage) {
      (questionToPages[qid] ??= []).push(page);
    }

    // Mixed page: one edge case per page carrying ALL its questions.
    if (questionsOnPage.length > 1) {
      edgeCases.push({
        type: "mixed_page",
        affectedPages: [page],
        affectedQuestions: questionsOnPage,
        resolution: `Page ${page} contains ${questionsOnPage.length} questions (${questionsOnPage.join(", ")})`,
        needsReview: false,
      });
    }
  }

  // Second pass: sandwich rule. An unmapped page whose immediate neighbours map
  // to a common question is assigned to that question.
  for (const page of [...unmappedPages]) {
    const prev = pageToQuestions[page - 1];
    const next = pageToQuestions[page + 1];
    if (!prev?.length || !next?.length) continue;
    const common = prev.find((q) => next.includes(q));
    if (!common) continue;

    pageToQuestions[page] = [common];
    (questionToPages[common] ??= []).push(page);
    unmappedPages.splice(unmappedPages.indexOf(page), 1);
    edgeCases.push({
      type: "sandwich_filled",
      affectedPages: [page],
      affectedQuestions: [common],
      resolution: `Page ${page} sandwiched between ${common} pages ${page - 1} and ${page + 1}`,
      needsReview: false,
    });
  }

  // Third pass: flag remaining orphans for human review.
  for (const page of unmappedPages) {
    edgeCases.push({
      type: "orphan_page",
      affectedPages: [page],
      affectedQuestions: [],
      resolution: `Page ${page} could not be mapped to any question`,
      needsReview: true,
    });
  }

  // Sort each question's page list for stable, ordered grading input.
  for (const qid of Object.keys(questionToPages)) {
    questionToPages[qid]!.sort((a, b) => a - b);
  }

  // Context isolation: for each question, the OTHER questions sharing any of its
  // pages (derived from the FINAL page→questions map, post-sandwich).
  const otherQuestionIdsByQuestion: Record<string, string[]> = {};
  for (const qid of Object.keys(questionToPages)) {
    const others = new Set<string>();
    for (const page of questionToPages[qid]!) {
      for (const other of pageToQuestions[page] ?? []) {
        if (other !== qid) others.add(other);
      }
    }
    otherQuestionIdsByQuestion[qid] = [...others].sort();
  }

  const mappedPages = pageCount - unmappedPages.length;
  const aggregateConfidence = pageCount > 0 ? mappedPages / pageCount : 0;

  return {
    questionToPages,
    pageToQuestions,
    otherQuestionIdsByQuestion,
    unmappedPages,
    edgeCases,
    aggregateConfidence,
  };
}
