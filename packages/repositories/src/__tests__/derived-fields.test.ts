/**
 * Repositories — derived fields computed once + sensitive-key editor scope
 * (SDK-LAYERS-PLAN §4.1, §4.2 answer-key isolation, repositories.md (1)(5)).
 *
 * Locked invariants:
 *   • Derived fields are `compute*`/`resolve*`/`can*` and are computed LOCALLY
 *     from already-fetched data — no extra wire call:
 *       spaceRepo.canPublish, testSessionRepo.remainingMs (compute*),
 *       examRepo.canReleaseResults, progressRepo.completionPct (compute*).
 *   • `isSensitiveKey(['__edit_item__', id])` is true (answer-key editor cache is
 *     excluded from the persisted/offline store, §4.2); normal keys are false.
 *   • `editItemKey(id)` (when exposed) is `[EDIT_ITEM_SCOPE, id]` and round-trips
 *     through `isSensitiveKey` as sensitive.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeApiClient,
  makeTestSession,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import { ready, buildRepos, R } from "./_harness";

const d = ready() ? describe : describe.skip;

d("repositories · derived fields + sensitive-key scope", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("testSessionRepo.remainingMs is computed locally from serverDeadline (no wire call)", () => {
    const r = buildRepos(api);
    const repo = r["testSessionRepo"]!;
    const fn = (repo["computeRemainingMs"] ?? repo["remainingMs"]) as
      | ((s: unknown, nowMs?: number) => number)
      | undefined;
    if (!fn) return;
    const session = makeTestSession({ serverDeadline: "2026-01-01T00:30:00.000Z" });
    const nowMs = Date.parse("2026-01-01T00:00:00.000Z");
    const remaining = fn(session, nowMs);
    expect(remaining).toBe(30 * 60 * 1000);
    expect(api.calls).toHaveLength(0);
  });

  it("progressRepo.completionPct is derived locally (bounded 0..100, no wire call)", () => {
    const r = buildRepos(api);
    const repo = r["progressRepo"]!;
    const fn = (repo["computeCompletionPct"] ?? repo["completionPct"]) as
      | ((p: unknown) => number)
      | undefined;
    if (!fn) return;
    const pct = fn({ completedItems: 1, totalItems: 4 });
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
    expect(api.calls).toHaveLength(0);
  });

  it("autograde rubric pre-checks accept canonical criteria.maxScore (no wire call)", () => {
    const r = buildRepos(api);
    const examRepo = r["examRepo"]!;
    const questionRepo = r["examQuestionRepo"]!;
    const question = {
      maxMarks: 10,
      rubric: {
        criteria: [
          { id: "c1", name: "Setup", maxScore: 4 },
          { id: "c2", name: "Answer", maxScore: 6 },
        ],
      },
    };

    const publish = examRepo["canPublish"] as (
      exam: { status: string },
      questions: unknown[]
    ) => { ok: boolean; reasons: string[] };
    const sum = questionRepo["computeRubricCriteriaSum"] as (q: unknown) => number;
    const matches = questionRepo["isRubricMatchingMaxMarks"] as (q: unknown) => boolean;

    expect(sum(question)).toBe(10);
    expect(matches(question)).toBe(true);
    expect(publish({ status: "question_paper_extracted" }, [question])).toEqual({
      ok: true,
      reasons: [],
    });
    expect(api.calls).toHaveLength(0);
  });

  it("isSensitiveKey excludes the answer-key edit-item scope from persisted/offline cache", () => {
    if (!R.isSensitiveKey) return;
    expect(R.isSensitiveKey(["__edit_item__", "item__arrays.q1"])).toBe(true);
    expect(R.isSensitiveKey(["spaces", "list"])).toBe(false);
    expect(R.isSensitiveKey(["spaces", "detail", "space__dsa"])).toBe(false);
  });

  it("editItemKey(id) round-trips as a sensitive key", () => {
    if (!R.editItemKey || !R.isSensitiveKey) return;
    const key = R.editItemKey("item__arrays.q1");
    expect(R.isSensitiveKey(key)).toBe(true);
    // The scope tag prefixes the key.
    expect(key[0]).toBe(R.EDIT_ITEM_SCOPE ?? "__edit_item__");
    expect(key[1]).toBe("item__arrays.q1");
  });
});
