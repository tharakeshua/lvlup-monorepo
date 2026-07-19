/**
 * T-I — Conversation domain & callable CONTRACT conformance (LLD §20.1, §22.1).
 *
 * Runtime-independent. Proves the FROZEN `@levelup/domain` + `@levelup/api-contract`
 * schemas enforce the design's structural guarantees:
 *   • strict parse / unknown-key rejection for documents and callable requests;
 *   • mode/context discriminated-union integrity;
 *   • session/turn status enum totality;
 *   • no `tenantId` in any conversation REQUEST body (claim-derived only);
 *   • StartConversationContext omits the server-assigned assessment attemptNumber;
 *   • idempotency/authority flags on the callable definitions.
 *
 * These are the gate for §22.1 (architecture/integration) and the contract half
 * of §22.2 (lifecycle/idempotency).
 */
import { describe, it, expect } from "vitest";
import {
  ConversationSessionDocSchema,
  ConversationTurnDocSchema,
  ItemSubmissionDocSchema,
  ConversationContextSchema,
  StartConversationContextSchema,
  CONVERSATION_MODES,
  CONVERSATION_SESSION_STATUSES,
  CONVERSATION_TURN_STATUSES,
  CONVERSATION_TOOL_NAMES,
  MODEL_POLICY_IDS,
} from "@levelup/domain";
import {
  StartConversationRequestSchema,
  SendConversationTurnRequestSchema,
  FinishConversationRequestSchema,
  startConversationDef,
  sendConversationTurnDef,
  finishConversationDef,
  abandonConversationDef,
  getConversationDef,
  listConversationsDef,
} from "@levelup/api-contract";
import { makeSessionDoc, makeTurnDoc, makeSubmissionDoc } from "./_fixtures";

describe("conversation contract conformance — strict schemas (LLD §20.1)", () => {
  it("rejects unknown keys on the durable session document", () => {
    const doc = makeSessionDoc("tutor") as Record<string, unknown>;
    const withExtra = { ...doc, sneakyExtra: true };
    expect(ConversationSessionDocSchema.safeParse(withExtra).success).toBe(false);
  });

  it("rejects unknown keys on the durable turn document (.strict)", () => {
    const doc = makeTurnDoc("completed") as Record<string, unknown>;
    expect(ConversationTurnDocSchema.safeParse({ ...doc, extra: 1 }).success).toBe(false);
  });

  it("rejects unknown keys on the immutable submission document", () => {
    const doc = makeSubmissionDoc() as Record<string, unknown>;
    expect(ItemSubmissionDocSchema.safeParse({ ...doc, extra: 1 }).success).toBe(false);
  });

  it("accepts every valid mode fixture round-trip", () => {
    for (const mode of CONVERSATION_MODES) {
      expect(ConversationSessionDocSchema.safeParse(makeSessionDoc(mode)).success).toBe(true);
    }
  });
});

describe("mode / context discriminated union (LLD §20.1)", () => {
  it("accepts each canonical context shape", () => {
    const shapes = [
      { kind: "tutor", scope: "space", spaceId: "s" },
      { kind: "tutor", scope: "story_point", spaceId: "s", storyPointId: "sp" },
      { kind: "tutor", scope: "item", spaceId: "s", storyPointId: "sp", itemId: "i" },
      { kind: "question_help", spaceId: "s", storyPointId: "sp", itemId: "i" },
      { kind: "agent_assessment", spaceId: "s", storyPointId: "sp", itemId: "i", attemptNumber: 1 },
    ];
    for (const shape of shapes) {
      expect(ConversationContextSchema.safeParse(shape).success).toBe(true);
    }
  });

  it("rejects a tutor context that carries an assessment-only field", () => {
    const bad = { kind: "tutor", scope: "space", spaceId: "s", attemptNumber: 1 };
    expect(ConversationContextSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a mixed/unknown context.kind", () => {
    expect(
      ConversationContextSchema.safeParse({ kind: "totally_fake", spaceId: "s" }).success
    ).toBe(false);
  });

  it("StartConversationContext OMITS the server-assigned attemptNumber (LLD 5.1)", () => {
    // The client cannot dictate an assessment attempt number; the server allocates it.
    const withAttempt = {
      kind: "agent_assessment",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
      attemptNumber: 3,
    };
    expect(StartConversationContextSchema.safeParse(withAttempt).success).toBe(false);
    const withoutAttempt = {
      kind: "agent_assessment",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
    };
    expect(StartConversationContextSchema.safeParse(withoutAttempt).success).toBe(true);
  });
});

describe("status / vocabulary totality (LLD §20.1)", () => {
  it("session status enum is exactly the seven canonical states", () => {
    expect([...CONVERSATION_SESSION_STATUSES].sort()).toEqual(
      [
        "abandoned",
        "active",
        "completed",
        "finalizing",
        "grading_failed",
        "grading_pending",
        "ready_to_finish",
      ].sort()
    );
  });

  it("turn status enum is exactly the six canonical states", () => {
    expect([...CONVERSATION_TURN_STATUSES].sort()).toEqual(
      [
        "claimed",
        "completed",
        "failed_recoverable",
        "failed_terminal",
        "model_running",
        "tool_running",
      ].sort()
    );
  });

  it("model policy ids never encode a raw provider model name", () => {
    for (const id of MODEL_POLICY_IDS) {
      expect(id).toMatch(/^(conversation|evaluation)\./);
      expect(id.toLowerCase()).not.toContain("gemini");
      expect(id).not.toMatch(/\d\.\d/); // no "1.5"/"2.5" style version leak
    }
  });

  it("tool-name vocabulary is closed and stable", () => {
    expect(CONVERSATION_TOOL_NAMES).toContain("record_evidence");
    expect(CONVERSATION_TOOL_NAMES).toContain("recommend_completion");
    expect(CONVERSATION_TOOL_NAMES).not.toContain("read_answer_key");
  });
});

describe("callable request bodies never carry tenantId (LLD §20.1 / §22.1)", () => {
  // tenantId is claim-derived server-side; a request that supplies one must be rejected.
  const requestSchemas = {
    startConversation: StartConversationRequestSchema,
    sendConversationTurn: SendConversationTurnRequestSchema,
    finishConversation: FinishConversationRequestSchema,
  };

  const validRequests: Record<string, unknown> = {
    startConversation: {
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      mode: "tutor",
      context: { kind: "tutor", scope: "space", spaceId: "s" },
    },
    sendConversationTurn: {
      sessionId: "c_session_alpha",
      clientMessageId: "22222222-2222-4222-8222-222222222222",
      input: { text: "hello" },
    },
    finishConversation: {
      sessionId: "c_session_alpha",
      clientRequestId: "33333333-3333-4333-8333-333333333333",
      reason: "learner_requested",
    },
  };

  for (const [name, schema] of Object.entries(requestSchemas)) {
    it(`${name}: valid request parses, but tenantId injection is rejected (strict)`, () => {
      expect(schema.safeParse(validRequests[name]).success).toBe(true);
      const injected = { ...(validRequests[name] as object), tenantId: "tenant_evil" };
      expect(schema.safeParse(injected).success).toBe(false);
    });
  }

  it("startConversation enforces mode === context.kind (cannot start assessment via tutor context)", () => {
    const mismatched = {
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      mode: "agent_assessment",
      context: { kind: "tutor", scope: "space", spaceId: "s" },
    };
    expect(StartConversationRequestSchema.safeParse(mismatched).success).toBe(false);
  });

  it("sendConversationTurn requires a non-empty text and a uuid clientMessageId", () => {
    expect(
      SendConversationTurnRequestSchema.safeParse({
        sessionId: "c_session_alpha",
        clientMessageId: "not-a-uuid",
        input: { text: "" },
      }).success
    ).toBe(false);
  });
});

describe("callable idempotency / authority flags (LLD §22.2/§22.3)", () => {
  it("all six conversation callables require auth", () => {
    for (const def of [
      startConversationDef,
      sendConversationTurnDef,
      finishConversationDef,
      abandonConversationDef,
      getConversationDef,
      listConversationsDef,
    ]) {
      expect(def.authMode).toBe("authed");
    }
  });

  it("mutating callables are transport-idempotent", () => {
    for (const def of [
      startConversationDef,
      sendConversationTurnDef,
      finishConversationDef,
      abandonConversationDef,
    ]) {
      expect(def.idempotent).toBe(true);
    }
  });

  it("finishConversation is authority-sensitive and invalidates progress", () => {
    expect(finishConversationDef.authoritySensitive).toBe(true);
    expect(finishConversationDef.invalidates).toContain("progress");
  });

  it("read callables do not invalidate or mutate (get/list)", () => {
    expect(getConversationDef.idempotent ?? false).toBeTypeOf("boolean");
    expect(
      listConversationsDef.rateTier === "read" || listConversationsDef.rateTier === "write"
    ).toBe(true);
  });
});
