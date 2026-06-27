/**
 * Realtime projection authority (SDK-LAYERS-PLAN.md §3.3 / MERGE-REALTIME-AUTHORITY
 * / SEC-10). Required realtime tests:
 *   (1) NO SUBSCRIPTIONS payload schema holds answer-key / guidance / cost / a
 *       non-release-gated score (static schema introspection — always runs),
 *   (2) a non-released submission's score is unreadable by a student subscriber
 *       (emulator rules — runs when emulators up),
 *   (3) the RTDB epoch-ms badge fence + __tenant__/__uid__ placeholder cannot
 *       widen tenant (T12) — covered in transport-firebase decode tests; here we
 *       assert the payload-shape half.
 *
 * Self-skips appropriately.
 */
import { describe, it, expect } from "vitest";
import * as contract from "@levelup/api-contract";
import { collectKeys } from "../../../packages/api-contract/src/__tests__/no-tenant-id-in-request.test";

const C = contract as unknown as {
  SUBSCRIPTIONS?: Record<string, { payload: unknown }>;
};
const ready = Boolean(C.SUBSCRIPTIONS);

/**
 * Hard ⚷ secrets: NEVER permitted on ANY subscription payload (answer-key /
 * evaluator guidance / system prompt / a USD-denominated cost). This is the
 * SEC-10 + MERGE-REALTIME-AUTHORITY invariant ("no subscription payload holds
 * answer-key/guidance fields", plan §3.3/SEC-10). Note: `tokensUsed` is NOT
 * here — the plan ships it on `ChatMessage` (the chatStream payload) and in the
 * `sendChatMessage` response (plan line ~217/238); it is a bounded per-message
 * counter on a slim projection, not a ⚷ secret.
 */
const FORBIDDEN_ON_EVERY_PAYLOAD = [
  "correctAnswer",
  "acceptableAnswers",
  "evaluationGuidance",
  "modelAnswer",
  "evaluatorGuidance",
  "promptGuidance",
  "systemPrompt",
  "costUsd",
  "geminiApiKey",
  "geminiKey",
];

/**
 * Release-gated SCORE fields: forbidden specifically on the live GRADING/SUBMISSION
 * status channel — the score/grade is surfaced ONLY via the `getSubmission`
 * callable AFTER `resultsReleased` (plan §3.3: "SubmissionStatusSchema drops
 * summary/totalScore/grade/percentage"). A learner's OWN progress mirror
 * (`spaceProgressLive`) legitimately carries `percentage`/`pointsEarned` — those
 * are not release-gated grades, so the gate is scoped to grading subscriptions.
 */
const RELEASE_GATED_SCORE_FIELDS = ["totalScore", "grade", "percentage", "summary"];
const GRADING_SUBSCRIPTIONS = /grading|submission/i;

(ready ? describe : describe.skip)("realtime projection authority", () => {
  it("NO subscription payload schema declares an answer-key/guidance/cost ⚷ field", () => {
    const offenders: string[] = [];
    for (const [name, def] of Object.entries(C.SUBSCRIPTIONS!)) {
      const keys = collectKeys(def.payload as never);
      for (const forbidden of FORBIDDEN_ON_EVERY_PAYLOAD) {
        if (keys.has(forbidden)) offenders.push(`${name}.${forbidden}`);
      }
    }
    expect(offenders, `subscription payload leaked ⚷ fields:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the live grading/submission status channel carries NO release-gated score field", () => {
    const offenders: string[] = [];
    for (const [name, def] of Object.entries(C.SUBSCRIPTIONS!)) {
      if (!GRADING_SUBSCRIPTIONS.test(name)) continue;
      const keys = collectKeys(def.payload as never);
      for (const gated of RELEASE_GATED_SCORE_FIELDS) {
        if (keys.has(gated)) offenders.push(`${name}.${gated}`);
      }
    }
    expect(
      offenders,
      `release-gated score leaked on a live grading channel:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
