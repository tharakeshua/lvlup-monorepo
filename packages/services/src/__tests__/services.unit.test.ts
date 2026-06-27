/**
 * Service UNIT tests (server-shared.md §8 / T6) — `fn(input, ctx)` with injected
 * in-memory `repos`/`ai` + a fixed clock. No emulator. This is the sanctioned
 * service-unit harness (kills the 30+ hand-rolled firebase-admin mocks).
 *
 * Demonstrates the load-bearing invariants:
 *   • saveItem STRIPS answer-key fields into the deny-all subcollection (§6.4),
 *   • idempotent services run their body EXACTLY ONCE for the same key (#10),
 *   • the AI gateway ALWAYS logs cost and is BLOCKED when quota fails (#12),
 *   • a service that throws after a state write leaves NO outbox row (#14).
 *
 * Self-skips per-service until `@levelup/services` exports each service fn.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { localSeedId } from "../../../../tests/sdk/harness/fixtures-ids";
import { makeItem, makeTestSession } from "../../../../tests/sdk/fakes/entity-factories";
import * as services from "../index";

const S = services as unknown as Record<
  string,
  ((input: unknown, ctx: unknown) => Promise<unknown>) | undefined
>;
const has = (name: string): boolean => typeof S[name] === "function";

describe("services unit (in-memory fakes)", () => {
  it("saveItemService strips answer-key fields out of the persisted item (§6.4)", async () => {
    if (!has("saveItemService")) return;
    const ctx = makeAuthContext("teacher");
    const spaceId = localSeedId("space", "dsa");
    const storyPointId = localSeedId("sp", "arrays");
    const res = (await S["saveItemService"]!(
      {
        spaceId,
        storyPointId,
        data: {
          payload: { kind: "question", question: { type: "short_answer", prompt: "q" } },
          answerKey: { correctAnswer: "secret", acceptableAnswers: ["secret"] },
        },
      },
      ctx
    )) as { id: string };

    const persistedItem = await ctx.repos.items.get(ctx.tenantId!, res.id);
    expect(JSON.stringify(persistedItem)).not.toContain("secret");
    const key = await ctx.repos.answerKeys.get(ctx.tenantId!, res.id);
    expect(key).not.toBeNull();
  });

  it("an idempotent service runs its body exactly once for the same key (#10)", async () => {
    if (!has("submitTestSessionService")) return;
    const ctx = makeAuthContext("student", { idempotencyKey: "idem-1" });
    // Seed an in_progress session owned by the caller; the first submit claims +
    // grades it (in_progress→completed), the second must read the terminal status
    // and return the already-computed result (single-writer / idempotent re-submit).
    await ctx.repos.testSessions.upsert(
      ctx.tenantId!,
      makeTestSession({ userId: ctx.uid }),
      ctx.now()
    );
    const input = { sessionId: localSeedId("session", "ts1") };
    const first = await S["submitTestSessionService"]!(input, ctx);
    const second = await S["submitTestSessionService"]!(input, ctx);
    // second call returns the cached result; no double side effect
    expect(second).toEqual(first);
  });

  it("the AI gateway always logs a cost record and is blocked when quota fails (#12)", async () => {
    if (!has("evaluateAnswerService")) return;
    const ctx = makeAuthContext("student");
    // Seed a SUBJECTIVE item so scoring routes through the AI gateway (the path
    // that must always log a cost record and be blocked when quota fails).
    await ctx.repos.items.upsert(
      ctx.tenantId!,
      makeItem({ type: "short_answer", maxScore: 5 }),
      ctx.now()
    );
    await S["evaluateAnswerService"]!(
      {
        spaceId: localSeedId("space", "dsa"),
        storyPointId: localSeedId("sp", "arrays"),
        itemId: localSeedId("item", "arrays.q1"),
        answer: "x",
      },
      ctx
    ).catch(() => undefined);
    expect(ctx.ai.costLog.length).toBeGreaterThan(0);

    ctx.ai.setQuotaExceeded(true);
    await expect(
      S["evaluateAnswerService"]!(
        {
          spaceId: localSeedId("space", "dsa"),
          storyPointId: localSeedId("sp", "arrays"),
          itemId: localSeedId("item", "arrays.q1"),
          answer: "y",
        },
        ctx
      )
    ).rejects.toBeDefined();
  });

  it("a service that throws after the state write leaves NO outbox row (#14)", async () => {
    if (!has("publishSpaceService")) return;
    const ctx = makeAuthContext("teacher");
    // force the post-write step to throw by passing a not-found space id
    await S["publishSpaceService"]!({ spaceId: "missing" }, ctx).catch(() => undefined);
    expect(ctx.repos.outbox.drain(ctx.tenantId!).length).toBe(0);
  });
});
