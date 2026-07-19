import { describe, expect, it } from "vitest";
import { CALLABLES } from "../registry.js";
import {
  FinishConversationResponseSchema,
  SaveAgentRequestSchema,
  SaveAgentResponseSchema,
  SendConversationTurnRequestSchema,
  StartConversationRequestSchema,
} from "../callables/levelup/index.js";

const UUID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "c_session_1";

describe("conversation callable contracts", () => {
  it("registers all six stable names with the declared authority/rate policies", () => {
    expect(CALLABLES["v1.levelup.startConversation"]).toMatchObject({
      rateTier: "write",
      idempotent: true,
      idempotencyKey: "transport",
      invalidates: ["conversations"],
    });
    expect(CALLABLES["v1.levelup.sendConversationTurn"]).toMatchObject({
      rateTier: "ai",
      idempotent: true,
      idempotencyKey: "transport",
    });
    expect(CALLABLES["v1.levelup.finishConversation"]).toMatchObject({
      rateTier: "ai",
      authoritySensitive: true,
      invalidates: ["conversations", "progress"],
    });
    expect(CALLABLES["v1.levelup.getConversation"].rateTier).toBe("read");
    expect(CALLABLES["v1.levelup.listConversations"].rateTier).toBe("read");
    expect(CALLABLES["v1.levelup.abandonConversation"]).toMatchObject({
      rateTier: "write",
      authoritySensitive: true,
      idempotent: true,
    });
  });

  it("rejects redirected contexts, audio media, and body tenant IDs", () => {
    expect(
      StartConversationRequestSchema.safeParse({
        clientRequestId: UUID,
        mode: "tutor",
        context: {
          kind: "question_help",
          spaceId: "space_1",
          storyPointId: "sp_1",
          itemId: "item_1",
        },
      }).success
    ).toBe(false);
    expect(
      StartConversationRequestSchema.safeParse({
        clientRequestId: UUID,
        mode: "tutor",
        context: { kind: "tutor", scope: "space", spaceId: "space_1" },
        tenantId: "tenant_must_be_claim_derived",
      }).success
    ).toBe(false);
    expect(
      SendConversationTurnRequestSchema.safeParse({
        sessionId: SESSION_ID,
        clientMessageId: UUID,
        input: {
          text: "Can you help me reason about this?",
          media: [{ mediaKind: "audio", storagePath: "x", mimeType: "audio/mpeg" }],
        },
      }).success
    ).toBe(false);
  });

  it("keeps assessment attempt numbering server-owned at conversation start", () => {
    const request = {
      clientRequestId: UUID,
      mode: "agent_assessment" as const,
      context: {
        kind: "agent_assessment" as const,
        spaceId: "space_1",
        storyPointId: "sp_1",
        itemId: "item_1",
      },
    };
    expect(StartConversationRequestSchema.safeParse(request).success).toBe(true);
    expect(
      StartConversationRequestSchema.safeParse({
        ...request,
        context: { ...request.context, attemptNumber: 1 },
      }).success
    ).toBe(false);
  });

  it("keeps finish results discriminated and server-authoritative", () => {
    expect(
      FinishConversationResponseSchema.safeParse({
        session: {},
        result: { status: "grading_pending", retryAfterMs: 1000 },
        replayed: false,
      }).success
    ).toBe(false);
    expect(
      FinishConversationResponseSchema.safeParse({
        session: {},
        result: { status: "grading_pending" },
        replayed: false,
      }).success
    ).toBe(false);
  });

  it("enforces versioned agent create/update CAS and rejects provider model names", () => {
    const data = {
      type: "interviewer",
      name: "Socratic interviewer",
      isActive: true,
      modelPolicyId: "conversation.quality",
      openingMessage: "What would you examine first?",
      evaluationObjectives: ["Probe the learner's reasoning."],
    };
    expect(SaveAgentRequestSchema.safeParse({ spaceId: "space_1", data }).success).toBe(true);
    expect(
      SaveAgentRequestSchema.safeParse({
        spaceId: "space_1",
        data: { ...data, isActive: false, deleted: true },
      }).success
    ).toBe(false);
    expect(
      SaveAgentRequestSchema.safeParse({ id: "agent_1", spaceId: "space_1", data }).success
    ).toBe(false);
    expect(
      SaveAgentRequestSchema.safeParse({
        id: "agent_1",
        expectedVersion: 2,
        spaceId: "space_1",
        data: { ...data, modelOverride: "provider-model-name" },
      }).success
    ).toBe(false);
    expect(
      SaveAgentRequestSchema.safeParse({
        id: "agent_1",
        expectedVersion: 2,
        spaceId: "space_1",
        data: { ...data, isActive: false, deleted: true },
      }).success
    ).toBe(true);
    expect(
      SaveAgentResponseSchema.safeParse({
        id: "agent_1",
        created: false,
        semanticChanged: true,
        version: 3,
        deleted: true,
      }).success
    ).toBe(true);
  });
});
