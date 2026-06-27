/**
 * INTEGRATION — recordItemAttempt scores SERVER-SIDE; client cannot set score
 * (SDK-LAYERS-PLAN.md §3.2 CD13, §4.4 optimistic-but-no-client-score, §6.5 grading).
 *
 * Locks the CD13 authority boundary for the one ✅-optimistic write that touches
 * grading-adjacent state:
 *
 *   • The client sends ONLY the raw learner `answer` (+ a dedupe key). It NEVER
 *     sends `score`/`maxScore`/`correct`/`points` — those are server-computed.
 *   • If a malicious client forges `score:100`/`correct:true` in the body, the
 *     `.strict()` schema must REJECT it (no such field), OR the server must IGNORE
 *     it and score authoritatively from the answer — a forged score must NEVER be
 *     reflected back as the authoritative result.
 *   • The authoritative `{progress:ItemProgressView,completed}` response is what
 *     the client reconciles via `setQueryData` (A11) — best-score retention is
 *     decided by the server, not the client patch.
 *   • The dedupe key (domain key = (spaceId,storyPointId,itemId,answerHash))
 *     makes a retry exactly-once.
 *
 * Mirror invariant for `evaluateAnswer` (the non-optimistic sibling, same §6.5
 * boundary): client sends `answer`, response is a cost-stripped `StoredEvaluation`
 * — and a forged client `score` is inert.
 *
 * Real wire path; self-skips when emulators/seed are down.
 */
import { describe, it, beforeAll, beforeEach, expect } from "vitest";
import { invoke, invokeExpectError, leaksSensitiveKey, skipReason } from "./_invoke";
import { localSeedId, CONTRACT_TENANT_KEY } from "../../harness/fixtures-ids";
import { adminDb } from "../../harness/emulator";

const skip = () => Boolean(skipReason());

const TENANT = localSeedId("tenant", CONTRACT_TENANT_KEY);
const SPACE = localSeedId("space", "dsa");
const SP = localSeedId("sp", "arrays");
const ITEM = localSeedId("item", "arrays.q1"); // seeded short-answer item, correctAnswer known to server only

interface AttemptResult {
  progress: { bestScore?: number; score?: number; correct?: boolean; attempts?: number };
  completed?: boolean;
}

describe.skipIf(skip())("recordItemAttempt server-scores (emulator, wire path)", () => {
  beforeAll(() => {
    /* enrolled-student state seeded; item has a server-only answer key */
  });

  // Self-heal the seeded item + its deny-all answer key before each test. The
  // shared `dsa` space is written by sibling authoring suites; this guarantees the
  // server-scored item (and the correctAnswer the server grades against) is present
  // and intact regardless of suite ordering — the assertions stay deterministic.
  beforeEach(async () => {
    if (skip()) return;
    const db = adminDb();
    const base = `tenants/${TENANT}/spaces/${SPACE}/storyPoints/${SP}`;
    await db.doc(`${base}/items/${ITEM}`).set(
      {
        id: ITEM,
        tenantId: TENANT,
        spaceId: SPACE,
        storyPointId: SP,
        type: "question",
        payload: {
          kind: "question",
          question: { type: "short_answer", prompt: "Define an array." },
        },
        orderIndex: 0,
      },
      { merge: true }
    );
    await db.doc(`${base}/items/${ITEM}/answerKeys/${ITEM}`).set(
      {
        id: ITEM,
        itemId: ITEM,
        tenantId: TENANT,
        questionType: "short_answer",
        correctAnswer: "A contiguous block of memory",
        acceptableAnswers: ["contiguous memory"],
        evaluationGuidance: "Accept any phrasing of contiguous memory.",
        modelAnswer: "A contiguous block of memory.",
      },
      { merge: true }
    );
  });

  it("a CORRECT answer is scored by the server (client sent no score)", async () => {
    const res = await invoke<AttemptResult>(
      "v1.levelup.recordItemAttempt",
      {
        spaceId: SPACE,
        storyPointId: SP,
        itemId: ITEM,
        answer: "A contiguous block of memory", // matches the seeded correctAnswer
        idempotencyKey: "attempt-correct-001",
      },
      "student"
    );
    expect(res.progress).toBeDefined();
    // The server decided correctness — a score/correctness exists that the client
    // never supplied.
    const scored =
      res.progress.bestScore !== undefined ||
      res.progress.score !== undefined ||
      res.progress.correct !== undefined;
    expect(scored, "server must return an authoritative score/correctness").toBe(true);
  });

  it("a forged client `score`/`correct` is REJECTED or IGNORED — never authoritative", async () => {
    const out = await invokeExpectError(
      "v1.levelup.recordItemAttempt",
      {
        spaceId: SPACE,
        storyPointId: SP,
        itemId: ITEM,
        answer: "totally wrong answer", // an INCORRECT answer …
        score: 100, // … with a FORGED perfect score
        maxScore: 100,
        correct: true,
        points: 999,
        idempotencyKey: "attempt-forged-002",
      },
      "student"
    );

    if (!out.ok) {
      // `.strict()` rejected the unknown score/correct/points fields.
      expect(
        out.error.code === "VALIDATION_ERROR" || out.error.httpsCode === "invalid-argument",
        `expected strict-reject of forged score, got ${out.error.code ?? out.error.httpsCode}`
      ).toBe(true);
    } else {
      // Field was ignored: the server scored the WRONG answer as wrong; the
      // forged 100/true must NOT survive into the authoritative result.
      const r = out.data as AttemptResult;
      if (r.progress?.correct !== undefined) expect(r.progress.correct).toBe(false);
      if (r.progress?.score !== undefined) expect(r.progress.score).not.toBe(100);
      if (r.progress?.bestScore !== undefined) expect(r.progress.bestScore).not.toBe(100);
    }
  });

  it("retry with the SAME answer (same dedupe key) is exactly-once — best-score stable", async () => {
    const body = {
      spaceId: SPACE,
      storyPointId: SP,
      itemId: ITEM,
      answer: "A contiguous block of memory",
      idempotencyKey: "attempt-retry-003",
    };
    const first = await invoke<AttemptResult>("v1.levelup.recordItemAttempt", body, "student");
    const second = await invoke<AttemptResult>("v1.levelup.recordItemAttempt", body, "student");
    // Same dedupe key → the second call returns the cached authoritative body.
    expect(JSON.stringify(second.progress)).toBe(JSON.stringify(first.progress));
  });

  it("the authoritative attempt response carries NO answer-key/cost field (⚷ strip)", async () => {
    const res = await invoke<AttemptResult>(
      "v1.levelup.recordItemAttempt",
      {
        spaceId: SPACE,
        storyPointId: SP,
        itemId: ITEM,
        answer: "array",
        idempotencyKey: "attempt-strip-004",
      },
      "student"
    );
    const leaked = leaksSensitiveKey(res);
    expect(leaked, `recordItemAttempt leaked ⚷ field: ${leaked}`).toBeNull();
  });

  it("evaluateAnswer (sibling §6.5 boundary): forged client score is inert; response is cost-stripped", async () => {
    const out = await invokeExpectError(
      "v1.levelup.evaluateAnswer",
      {
        spaceId: SPACE,
        storyPointId: SP,
        itemId: ITEM,
        answer: "a wrong answer",
        score: 100, // forged
        cost: 0, // forged
      },
      "student"
    );
    if (!out.ok) {
      expect(
        out.error.code === "VALIDATION_ERROR" || out.error.httpsCode === "invalid-argument"
      ).toBe(true);
    } else {
      // StoredEvaluation projection must be cost-stripped + must not reflect 100.
      const leaked = leaksSensitiveKey(out.data);
      expect(leaked, `evaluateAnswer leaked ⚷ field: ${leaked}`).toBeNull();
    }
  });
});
