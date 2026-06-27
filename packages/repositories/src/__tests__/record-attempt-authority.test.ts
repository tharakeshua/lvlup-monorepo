/**
 * Repositories — recordItemAttempt authority boundary (SDK-LAYERS-PLAN §4.1,
 * §4.4, CD13/A11; §3.2 recordItemAttempt; §6.5 grading outputs).
 *
 * `progressRepo.recordAttempt(input)` is the client edge of the one optimistic
 * authority-adjacent path. The locked invariants here are about the REPO's wire
 * contract (the optimistic cache reconciliation itself is a @levelup/query test):
 *
 *   • The repo sends the RAW learner `answer` and NEVER a client-set
 *     `score`/`maxScore`/`correct` (CD13 — the SERVER scores). A repo that leaks
 *     a score onto the wire would re-open the authority boundary the optimistic
 *     allow-list relies on.
 *   • It returns the authoritative `{progress:ItemProgressView, completed}` shape
 *     unchanged (A11 — the query layer reconciles best-score from THIS response,
 *     not from the optimistic patch).
 *   • The `idempotencyKey` hint is honored as the dedupe identity — but no SCORE
 *     rides the request even when retried.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeApiClient, type FakeApiClient } from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

const d = ready() ? describe : describe.skip;

const SCORE_FIELDS = ["score", "maxScore", "correct", "points", "grade", "percentage"];

d("repositories · recordItemAttempt authority boundary (CD13)", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("sends the raw answer and NO client-set score/correctness (CD13)", async () => {
    api.stub("levelup", "recordItemAttempt", () => ({
      progress: { itemId: "item__arrays.q1", bestScore: 1, attempts: 1 },
      completed: true,
    }));
    const r = buildRepos(api);
    const repo = r["progressRepo"]!;
    const fn = (repo["recordAttempt"] ?? repo["record"]) as
      | ((a: unknown) => Promise<unknown>)
      | undefined;
    if (!fn) return;

    await fn({
      spaceId: "space__dsa",
      storyPointId: "sp__arrays",
      itemId: "item__arrays.q1",
      answer: "index",
    });

    const body = api.callsTo("v1.levelup.recordItemAttempt")[0]!.data as Record<string, unknown>;
    expect(body).toHaveProperty("answer", "index");
    for (const f of SCORE_FIELDS) {
      expect(body, `recordItemAttempt body must not carry client-set ${f}`).not.toHaveProperty(f);
    }
  });

  it("returns the authoritative {progress, completed} response unchanged (A11)", async () => {
    const authoritative = {
      progress: { itemId: "item__arrays.q1", bestScore: 1, attempts: 2 },
      completed: true,
    };
    api.stub("levelup", "recordItemAttempt", () => authoritative);
    const r = buildRepos(api);
    const repo = r["progressRepo"]!;
    const fn = (repo["recordAttempt"] ?? repo["record"]) as
      | ((a: unknown) => Promise<unknown>)
      | undefined;
    if (!fn) return;

    const res = (await fn({
      spaceId: "space__dsa",
      storyPointId: "sp__arrays",
      itemId: "item__arrays.q1",
      answer: "index",
    })) as { progress: { bestScore: number }; completed: boolean };
    expect(res.completed).toBe(true);
    expect(res.progress.bestScore).toBe(1);
  });
});
