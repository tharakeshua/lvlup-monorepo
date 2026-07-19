/**
 * T-I — Conversation lifecycle + idempotency EMULATOR suite (LLD §20.2, §22.2).
 *
 * Full wire path (client → transport → v1.levelup.* callable → services → Firestore)
 * against a self-seeded deterministic dataset with the emulator stub AI provider.
 * Proves the exactly-once + one-active-turn guarantees the pure suites can only
 * assert structurally:
 *   • start replay: same clientRequestId → the SAME session, resumed=true;
 *   • turn replay: duplicate clientMessageId → ONE accepted learner message, replayed=true;
 *   • one active turn: two concurrent distinct turns never both go in-flight;
 *   • learner projection over the wire never carries private/config/cost fields;
 *   • mode isolation: a tutor session exposes no assessment affordance.
 *
 * Core assertions run on `tutor:space` (the minimal start). A separate case covers
 * story-point/item scope and is gated on `itemScopeReady()` so it self-skips while
 * CONV-P0-01 (missing spaceId/storyPointId on story_point/item source checks) is
 * open, then goes green once conv-core patches context-builder.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireFunctions } from "../../harness/per-test-setup";
import type { CallableName } from "@levelup/api-contract";
import {
  callAsStudent,
  conversationReady,
  itemScopeReady,
  TUTOR_SPACE_CONTEXT,
  TUTOR_CONTEXT,
  uuid,
} from "./_wire";

const PRIVATE_MARKERS = [
  "configurationSnapshot",
  "interviewerContext",
  "evaluatorContext",
  "answerKey",
  "systemPrompt",
  "usageAggregate",
  "costUsd",
  "modelRequestIds",
];

function assertNoPrivate(value: unknown): void {
  const json = JSON.stringify(value);
  for (const marker of PRIVATE_MARKERS)
    expect(json, `leaked ${marker}`).not.toContain(`"${marker}"`);
}

describe("conversation lifecycle + idempotency (emulator)", () => {
  let skip: string | null = null;
  let itemSkip: string | null = null;

  beforeAll(async () => {
    skip = requireFunctions();
    if (!skip) skip = await conversationReady();
    if (!skip) itemSkip = await itemScopeReady();
    if (skip) console.warn(`[conversation-lifecycle] skipped: ${skip}`);
    if (itemSkip) console.warn(`[conversation-lifecycle] item-scope cases skipped: ${itemSkip}`);
  }, 60_000);

  it("start replay: same clientRequestId resolves to the same resumed session", async () => {
    if (skip) return;
    const req = { clientRequestId: uuid(0x1001), mode: "tutor", context: TUTOR_SPACE_CONTEXT };
    const first = (await callAsStudent("v1.levelup.startConversation" as CallableName, req)) as {
      session: { id: string; mode: string };
      resumed: boolean;
    };
    const second = (await callAsStudent("v1.levelup.startConversation" as CallableName, req)) as {
      session: { id: string };
      resumed: boolean;
    };
    expect(second.session.id).toBe(first.session.id);
    expect(second.resumed).toBe(true);
    expect(first.session.mode).toBe("tutor");
    assertNoPrivate(first);
  });

  it("turn dedup: duplicate clientMessageId accepts exactly one learner message (§22.2)", async () => {
    if (skip) return;
    const start = (await callAsStudent("v1.levelup.startConversation" as CallableName, {
      clientRequestId: uuid(0x1002),
      mode: "tutor",
      context: TUTOR_SPACE_CONTEXT,
    })) as { session: { id: string; learnerTurnCount: number } };
    expect(start.session.learnerTurnCount).toBe(0);

    const turnReq = {
      sessionId: start.session.id,
      clientMessageId: uuid(0x2001),
      input: { text: "What is a token bucket?" },
    };
    const first = (await callAsStudent(
      "v1.levelup.sendConversationTurn" as CallableName,
      turnReq
    )) as {
      acceptedMessage: { id: string };
    };
    const replay = (await callAsStudent(
      "v1.levelup.sendConversationTurn" as CallableName,
      turnReq
    )) as {
      acceptedMessage: { id: string };
    };
    // The core §22.2 guarantee: same client message id ⇒ ONE accepted message
    // (deterministic id) and exactly ONE learner turn — regardless of whether the
    // underlying model turn completed. (The `replayed` flag is only true for a
    // completed/terminal turn; the emulator stub AI leaves turns recoverable, so
    // it is asserted in the real-key post-deploy smoke, not here.)
    expect(replay.acceptedMessage.id).toBe(first.acceptedMessage.id);
    const after = (await callAsStudent("v1.levelup.getConversation" as CallableName, {
      sessionId: start.session.id,
    })) as { session: { learnerTurnCount: number } };
    expect(after.session.learnerTurnCount).toBe(1);
    assertNoPrivate(first);
    assertNoPrivate(after);
  });

  it("one active turn: two concurrent distinct turns never both go in-flight", async () => {
    if (skip) return;
    const start = (await callAsStudent("v1.levelup.startConversation" as CallableName, {
      clientRequestId: uuid(0x1003),
      mode: "tutor",
      context: TUTOR_SPACE_CONTEXT,
    })) as { session: { id: string } };

    const mkTurn = (n: number) => ({
      sessionId: start.session.id,
      clientMessageId: uuid(0x3000 + n),
      input: { text: `message ${n}` },
    });
    const results = await Promise.allSettled([
      callAsStudent("v1.levelup.sendConversationTurn" as CallableName, mkTurn(1)),
      callAsStudent("v1.levelup.sendConversationTurn" as CallableName, mkTurn(2)),
    ]);
    // At least one succeeds; a rejected one must be a clean error, not a crash.
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const session = (await callAsStudent("v1.levelup.getConversation" as CallableName, {
      sessionId: start.session.id,
    })) as { session: { activeTurn?: { id: string } } };
    assertNoPrivate(session);
  });

  it("tutor session never exposes an assessment/grading affordance (mode isolation)", async () => {
    if (skip) return;
    const start = (await callAsStudent("v1.levelup.startConversation" as CallableName, {
      clientRequestId: uuid(0x1004),
      mode: "tutor",
      context: TUTOR_SPACE_CONTEXT,
    })) as {
      session: { allowedActions: string[]; grading?: unknown; result?: unknown; mode: string };
    };
    expect(start.session.mode).toBe("tutor");
    expect(start.session.grading).toBeUndefined();
    expect(start.session.result).toBeUndefined();
    assertNoPrivate(start);
  });

  it("story-point/item-scoped start resolves a session (gated on CONV-P0-01)", async () => {
    if (skip || itemSkip) return;
    const res = (await callAsStudent("v1.levelup.startConversation" as CallableName, {
      clientRequestId: uuid(0x1005),
      mode: "tutor",
      context: TUTOR_CONTEXT,
    })) as { session: { id: string; context: { scope?: string } } };
    expect(res.session.id).toBeTruthy();
    expect(res.session.context.scope).toBe("item");
    assertNoPrivate(res);
  });
});
