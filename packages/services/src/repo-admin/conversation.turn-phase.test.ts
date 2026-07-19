/**
 * CONV-P0 regression: the bounded tool loop drives SAME-PHASE re-marks —
 * `model_running` is re-marked after each generate to attach its modelRequestId,
 * and `tool_running` is re-marked once per executed tool to persist each
 * deterministic invocation (LLD §9.4/§10.2). The original phase guard only
 * allowed strict forward moves (claimed→model_running, model_running→tool_running,
 * tool_running→model_running) and rejected those self-transitions with
 * INVALID_TRANSITION — latent until a parseable model actually emitted a tool
 * call. This drives a fresh tutor session through the full first turn:
 * claim → model_running → (re-mark model_running) → tool_running →
 * (persist a record_evidence invocation) → model_running → commit, and asserts
 * it completes.
 */
import { describe, expect, it } from "vitest";
import { createInMemoryRepos } from "./testing/index.js";
import type {
  ClaimConversationTurnInput,
  CommitConversationTurnInput,
  MarkTurnPhaseInput,
  StartConversationTxInput,
} from "./types.js";

const NOW = "2026-07-19T00:00:00.000Z";
const later = (ms: number): string => new Date(Date.parse(NOW) + ms).toISOString();

const startInput = {
  tenantId: "t1",
  ownerUid: "u1",
  sessionId: "sess1",
  clientRequestId: "cr1",
  mode: "tutor",
  startContext: { kind: "tutor", scope: "space", spaceId: "sp1" },
  contextBaseKey: "tutor:space:sp1",
  sessionBase: {
    title: "Tutoring",
    locale: "en",
    publicConfig: {},
    configurationSnapshot: {
      prompt: { key: "conversationTutor", version: "conversationTutor:1" },
      fingerprint: "fp1",
      toolset: { id: "tutor", version: "tutor:1", toolNames: ["record_evidence"] },
      runtimeModelPolicyId: "conversation.fast",
    },
  },
  sourceVersionChecks: [],
  now: NOW,
} as unknown as StartConversationTxInput;

const claimInput = {
  tenantId: "t1",
  ownerUid: "u1",
  sessionId: "sess1",
  turnId: "turn1",
  clientMessageId: "cm1",
  requestInputHash: "h1",
  learnerMessage: {
    id: "lm1",
    content: [{ type: "text", text: "explain binary search" }],
    createdAt: NOW,
  },
  lease: { token: "lease1", ownerRequestId: "req1", expiresAt: later(60_000) },
  now: NOW,
} as unknown as ClaimConversationTurnInput;

const phase = (status: "model_running" | "tool_running", extra: Record<string, unknown> = {}) =>
  ({
    tenantId: "t1",
    sessionId: "sess1",
    turnId: "turn1",
    leaseToken: "lease1",
    status,
    now: NOW,
    ...extra,
  }) as unknown as MarkTurnPhaseInput;

describe("markTurnPhase — bounded tool-loop transitions (CONV-P0)", () => {
  it("accepts the full first-turn tool loop: claim → model_running(x2) → tool_running(x2) → model_running → commit", async () => {
    const repos = createInMemoryRepos({ now: () => NOW });
    await repos.conversations.start(startInput);
    const claim = await repos.conversations.claimTurn(claimInput);
    expect(claim.turn.status).toBe("claimed");

    // claimed → model_running (enter the model step)
    await expect(repos.conversations.markTurnPhase(phase("model_running"))).resolves.toMatchObject({
      status: "model_running",
    });
    // model_running → model_running: re-mark after generate to attach the request id
    // (the first self-transition that used to throw INVALID_TRANSITION).
    await expect(
      repos.conversations.markTurnPhase(phase("model_running", { modelRequestId: "mr-1" }))
    ).resolves.toMatchObject({ status: "model_running" });
    // model_running → tool_running (the model returned a record_evidence tool call)
    await expect(repos.conversations.markTurnPhase(phase("tool_running"))).resolves.toMatchObject({
      status: "tool_running",
    });
    // tool_running → tool_running: persist the executed invocation
    // (the second self-transition that used to throw INVALID_TRANSITION).
    const afterInvocation = await repos.conversations.markTurnPhase(
      phase("tool_running", {
        toolInvocation: { id: "record_evidence:0:0", name: "record_evidence", status: "succeeded" },
      })
    );
    expect(afterInvocation.toolInvocations.some((i) => i.id === "record_evidence:0:0")).toBe(true);
    // tool_running → model_running (continue to the next bounded model step)
    await expect(repos.conversations.markTurnPhase(phase("model_running"))).resolves.toMatchObject({
      status: "model_running",
    });

    const commit = await repos.conversations.commitTurn({
      tenantId: "t1",
      sessionId: "sess1",
      turnId: "turn1",
      leaseToken: "lease1",
      configurationFingerprint: "fp1",
      assistantMessages: [
        {
          id: "am1",
          content: [{ type: "text", text: "Binary search halves the range each step." }],
          createdAt: NOW,
          completedAt: NOW,
        },
      ],
      evidence: [],
      modelRequestIds: ["mr-1"],
      usageAggregate: { inputTokens: 10, outputTokens: 8, cachedInputTokens: 0, costUsd: 0 },
      now: NOW,
    } as unknown as CommitConversationTurnInput);

    expect(commit.turn.status).toBe("completed");
    expect(commit.session.status).toBe("active");
    expect(commit.assistantMessages).toHaveLength(1);
  });

  it("still rejects a phase mark whose lease token no longer owns the turn", async () => {
    const repos = createInMemoryRepos({ now: () => NOW });
    await repos.conversations.start(startInput);
    await repos.conversations.claimTurn(claimInput);
    await repos.conversations.markTurnPhase(phase("model_running"));
    await expect(
      repos.conversations.markTurnPhase(phase("tool_running", { leaseToken: "stale" }))
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
