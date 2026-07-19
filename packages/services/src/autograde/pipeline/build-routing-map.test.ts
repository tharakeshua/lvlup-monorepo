/**
 * MAPSNIPE-1 — `buildRoutingMap` aggregation unit tests. Fixtures are the POC
 * `03-ALGORITHM-PHASE1.md` walkthrough adapted to this repo's ZERO-BASED page
 * indices: orphan pages whose neighbours map different questions stay orphan; a
 * mixed page rides all its questions + populates otherQuestionIds; a page whose
 * neighbours share a question is sandwich-filled.
 */
import { describe, it, expect } from "vitest";
import { buildRoutingMap, type PageMapping } from "./build-routing-map";

const Q = (id: string) => ({ id });
const found = (
  questionId: string,
  confidence = 0.9,
  matchType: PageMapping["foundContent"][number]["matchType"] = "explicit_marker"
) => ({ questionId, confidence, matchType, isPartial: false });
const page = (pageIndex: number, ...ids: ReturnType<typeof found>[]): PageMapping => ({
  pageIndex,
  foundContent: ids,
  hasUnknownContent: ids.length === 0,
});

describe("buildRoutingMap — POC walkthrough (zero-based)", () => {
  // Pages: 0,1→q1 ; 2 orphan ; 3,4→q2 ; 5→q2+q3 (mixed) ; 6→q3 ; 7 orphan ; 8→q4
  const mappings: PageMapping[] = [
    page(0, found("q1", 0.95)),
    page(1, found("q1", 0.88, "continuation")),
    page(2), // no content → orphan (neighbours q1 / q2 differ)
    page(3, found("q2", 0.92)),
    page(4, found("q2", 0.85, "semantic_context")),
    page(5, found("q2", 0.9, "mixed"), found("q3", 0.9, "mixed")),
    page(6, found("q3", 0.87, "continuation")),
    page(7), // no content → orphan (neighbours q3 / q4 differ)
    page(8, found("q4", 0.96)),
  ];
  const questions = ["q1", "q2", "q3", "q4"].map(Q);
  const r = buildRoutingMap(mappings, questions, 9);

  it("maps questions to their (sorted) pages", () => {
    expect(r.questionToPages).toEqual({
      q1: [0, 1],
      q2: [3, 4, 5],
      q3: [5, 6],
      q4: [8],
    });
  });

  it("leaves pages 2 and 7 orphaned (neighbours map different questions)", () => {
    expect(r.unmappedPages).toEqual([2, 7]);
    const orphans = r.edgeCases.filter((e) => e.type === "orphan_page");
    expect(orphans.map((e) => e.affectedPages[0]).sort((a, b) => a! - b!)).toEqual([2, 7]);
    for (const o of orphans) expect(o.needsReview).toBe(true);
  });

  it("flags page 5 as a mixed page riding both q2 and q3", () => {
    const mixed = r.edgeCases.filter((e) => e.type === "mixed_page");
    expect(mixed).toHaveLength(1);
    expect(mixed[0]!.affectedPages).toEqual([5]);
    expect(mixed[0]!.affectedQuestions.sort()).toEqual(["q2", "q3"]);
    expect(mixed[0]!.needsReview).toBe(false);
  });

  it("populates otherQuestionIds from shared (mixed) pages only", () => {
    expect(r.otherQuestionIdsByQuestion["q2"]).toEqual(["q3"]);
    expect(r.otherQuestionIdsByQuestion["q3"]).toEqual(["q2"]);
    expect(r.otherQuestionIdsByQuestion["q1"]).toEqual([]);
    expect(r.otherQuestionIdsByQuestion["q4"]).toEqual([]);
  });

  it("aggregateConfidence = mappedPages / totalPages", () => {
    expect(r.aggregateConfidence).toBeCloseTo(7 / 9, 5); // 2 of 9 unmapped
  });
});

describe("buildRoutingMap — sandwich rule", () => {
  it("fills an unmapped page whose neighbours share a question", () => {
    const r = buildRoutingMap([page(0, found("q1")), page(1), page(2, found("q1"))], [Q("q1")], 3);
    expect(r.questionToPages["q1"]).toEqual([0, 1, 2]);
    expect(r.unmappedPages).toEqual([]);
    const sandwich = r.edgeCases.filter((e) => e.type === "sandwich_filled");
    expect(sandwich).toHaveLength(1);
    expect(sandwich[0]!.affectedPages).toEqual([1]);
    expect(sandwich[0]!.affectedQuestions).toEqual(["q1"]);
    expect(r.aggregateConfidence).toBe(1);
  });

  it("does NOT fill when neighbours map different questions", () => {
    const r = buildRoutingMap(
      [page(0, found("q1")), page(1), page(2, found("q2"))],
      [Q("q1"), Q("q2")],
      3
    );
    expect(r.unmappedPages).toEqual([1]);
    expect(r.edgeCases.some((e) => e.type === "sandwich_filled")).toBe(false);
  });
});

describe("buildRoutingMap — robustness", () => {
  it("drops foundContent below the 0.5 confidence floor (→ orphan)", () => {
    const r = buildRoutingMap([page(0, found("q1", 0.4))], [Q("q1")], 1);
    expect(r.questionToPages).toEqual({});
    expect(r.unmappedPages).toEqual([0]);
  });

  it("drops hallucinated question ids not in the question list", () => {
    const r = buildRoutingMap([page(0, found("q9"))], [Q("q1")], 1);
    expect(r.questionToPages).toEqual({});
    expect(r.unmappedPages).toEqual([0]);
  });

  it("treats pages with no mapping (failed scout) as orphans", () => {
    // pageCount 3 but only page 0 has a mapping — pages 1,2 are missing entirely.
    const r = buildRoutingMap([page(0, found("q1"))], [Q("q1")], 3);
    expect(r.questionToPages["q1"]).toEqual([0]);
    expect(r.unmappedPages).toEqual([1, 2]);
    expect(r.aggregateConfidence).toBeCloseTo(1 / 3, 5);
  });

  it("a page holding 3 questions gives each the other two", () => {
    const r = buildRoutingMap(
      [page(0, found("q1", 0.9, "mixed"), found("q2", 0.9, "mixed"), found("q3", 0.9, "mixed"))],
      [Q("q1"), Q("q2"), Q("q3")],
      1
    );
    expect(r.otherQuestionIdsByQuestion["q1"]).toEqual(["q2", "q3"]);
    expect(r.otherQuestionIdsByQuestion["q2"]).toEqual(["q1", "q3"]);
    expect(r.otherQuestionIdsByQuestion["q3"]).toEqual(["q1", "q2"]);
  });
});
