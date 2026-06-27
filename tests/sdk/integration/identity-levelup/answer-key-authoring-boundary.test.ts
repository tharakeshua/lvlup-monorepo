/**
 * INTEGRATION — answer-key authoring boundary
 * (SDK-LAYERS-PLAN.md §6.4 AnswerKeys deny-all, §6.7 guidance strip, §5.2 services;
 *  access §1.4 item.readForEdit/rubric.guidance.read authoring-only gate).
 *
 * Locks the most leak-prone ⚷ boundary in the platform:
 *
 *   1. `saveItem` STRIPS answer-key fields (correctAnswer/acceptableAnswers/
 *      evaluationGuidance/modelAnswer) into the server-only deny-all subcollection
 *      — they are NOT echoed back in the save response, and are NOT visible in any
 *      learner-facing read.
 *   2. `getItemForEdit` RE-MERGES the answer key — but ONLY for an authoring role
 *      (teacher/tenantAdmin/staff-content). A student/parent caller is DENIED
 *      (`item.readForEdit` is authoring-only) — the answer key never reaches a
 *      non-authoring read.
 *   3. The learner read path (`listItems`/`getSpace`) NEVER carries answer-key or
 *      guidance fields, regardless of caller.
 *   4. Even the rubric/agent guidance (`evaluatorGuidance`/`promptGuidance`/
 *      `systemPrompt`) is stripped for non-authoring roles (§6.7 leak gate).
 *
 * The "cache never leaks" half: the editor answer-key is delivered ONLY through
 * `getItemForEdit` (the client marks that key non-persisted, gcTime:0). This test
 * proves the SERVER half — the key is unreachable except via the gated authoring
 * callable — which is the load-bearing guarantee the client cache contract rests on.
 *
 * Real wire path; self-skips when emulators/seed are down.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { invoke, invokeExpectError, isDenied, leaksSensitiveKey, skipReason } from "./_invoke";
import { localSeedId } from "../../harness/fixtures-ids";

const skip = () => Boolean(skipReason());

const SPACE = localSeedId("space", "dsa");
const SP = localSeedId("sp", "arrays");
const ITEM = localSeedId("item", "arrays.q1");

describe.skipIf(skip())("answer-key authoring boundary (emulator, wire path)", () => {
  beforeAll(() => {
    /* story-point-with-item seeded; item answer key lives in the deny-all subcollection */
  });

  it("saveItem STRIPS the answer key from its response (key goes server-only)", async () => {
    const res = await invoke(
      "v1.levelup.saveItem",
      {
        spaceId: SPACE,
        storyPointId: SP,
        // Schema-valid two-level payload: top-level item `type` + nested
        // `questionData` discriminant. The answer-bearing field (`modelAnswer`)
        // rides inside the payload exactly as an author would send it; the server
        // strips it into the ⚷ deny-all AnswerKey subcollection and must NOT echo it.
        data: {
          type: "question",
          title: "Define a stack.",
          payload: {
            type: "question",
            questionData: {
              questionType: "text",
              modelAnswer: "A LIFO (last-in-first-out) structure.",
            },
          },
        },
      },
      "teacher"
    );
    const leaked = leaksSensitiveKey(res);
    expect(
      leaked,
      `saveItem echoed a ⚷ answer-key field (${leaked}) — must be stripped`
    ).toBeNull();
  });

  it("getItemForEdit RE-MERGES the answer key for an AUTHORING role (teacher)", async () => {
    const res = await invoke(
      "v1.levelup.getItemForEdit",
      { spaceId: SPACE, storyPointId: SP, itemId: ITEM },
      "teacher"
    );
    // For the authoring path the key IS present (this is the one sanctioned read).
    const json = JSON.stringify(res);
    expect(
      /correctAnswer|acceptableAnswers|answerKey/.test(json),
      "authoring read must re-merge the answer key"
    ).toBe(true);
  });

  it("getItemForEdit is DENIED for a STUDENT (item.readForEdit is authoring-only)", async () => {
    const out = await invokeExpectError(
      "v1.levelup.getItemForEdit",
      { spaceId: SPACE, storyPointId: SP, itemId: ITEM },
      "student"
    );
    expect(out.ok, "a student must NOT be able to read the editor answer key").toBe(false);
    if (!out.ok)
      expect(isDenied(out.error), `code=${out.error.code ?? out.error.httpsCode}`).toBe(true);
  });

  it("getItemForEdit is DENIED for a PARENT", async () => {
    const out = await invokeExpectError(
      "v1.levelup.getItemForEdit",
      { spaceId: SPACE, storyPointId: SP, itemId: ITEM },
      "parent"
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(isDenied(out.error)).toBe(true);
  });

  it("the learner list read (listItems) NEVER carries an answer-key field", async () => {
    const res = await invoke(
      "v1.levelup.listItems",
      { spaceId: SPACE, storyPointId: SP, limit: 50 },
      "student"
    );
    const leaked = leaksSensitiveKey(res);
    expect(leaked, `listItems leaked a ⚷ field (${leaked}) to a student`).toBeNull();
  });

  it("the answer key never leaks via getSpace / spaceDetail for a learner", async () => {
    const res = await invoke("v1.levelup.getSpace", { spaceId: SPACE }, "student");
    const leaked = leaksSensitiveKey(res);
    expect(leaked, `getSpace leaked a ⚷ field (${leaked}) to a student`).toBeNull();
  });

  it("even an authenticated TEACHER list read strips the answer key (only getItemForEdit re-merges)", async () => {
    // The leak gate is the CALLABLE, not the role: a teacher's *list* read is still
    // answer-stripped — the key is delivered ONLY through getItemForEdit.
    const res = await invoke(
      "v1.levelup.listItems",
      { spaceId: SPACE, storyPointId: SP, limit: 50 },
      "teacher"
    );
    const leaked = leaksSensitiveKey(res);
    expect(
      leaked,
      `listItems leaked a ⚷ field (${leaked}) even to a teacher — only getItemForEdit may re-merge`
    ).toBeNull();
  });
});
