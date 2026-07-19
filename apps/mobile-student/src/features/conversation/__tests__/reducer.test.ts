import { describe, expect, it } from "vitest";

import {
  conversationReducer,
  initialConversationMachineState,
  mergeConversationMessages,
} from "../reducer";
import type {
  ConversationMessageView,
  ConversationPage,
  ConversationSessionView,
  SendConversationResponse,
} from "../types";

const SESSION: ConversationSessionView = {
  id: "c_demo",
  mode: "tutor",
  context: { kind: "tutor", scope: "space", spaceId: "space_1" },
  contextBaseKey: "tutor:space:space_1",
  contextKey: "tutor:space:space_1",
  status: "active",
  allowedActions: ["send", "finish", "abandon"],
};

function learnerMessage(
  id: string,
  clientMessageId: string,
  text = "Same words"
): ConversationMessageView {
  return {
    id,
    sequence: 1,
    role: "learner",
    origin: "turn",
    content: [{ type: "text", text }],
    clientMessageId,
    deliveryStatus: "complete",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("conversation reducer", () => {
  it("never deduplicates different UUIDs merely because their text matches", () => {
    const local: ConversationMessageView = {
      ...learnerMessage("optimistic:uuid-b", "uuid-b"),
      id: "optimistic:uuid-b",
      localStatus: "sending",
    };
    const merged = mergeConversationMessages([local], [learnerMessage("cm_a", "uuid-a")]);

    expect(merged.map((message) => message.clientMessageId)).toEqual(["uuid-a", "uuid-b"]);
  });

  it("keeps the same client UUID and draft after transport failure", () => {
    const requested = conversationReducer(
      { ...initialConversationMachineState, session: SESSION, draft: "Explain my reasoning" },
      {
        type: "SEND_REQUESTED",
        clientMessageId: "018f4c9d-5c43-7b8d-8fd2-1a2b3c4d5e6f",
        input: {
          text: "Explain my reasoning",
          questionHelpDraft: { revision: 4, answer: { selected: "option-b" } },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
      }
    );
    const failed = conversationReducer(requested, {
      type: "SEND_FAILED",
      error: { code: "UNAVAILABLE", safeMessage: "No connection", retryable: true },
      offline: true,
    });

    expect(failed.uiState).toBe("send_failed");
    expect(failed.pendingClientMessageId).toBe("018f4c9d-5c43-7b8d-8fd2-1a2b3c4d5e6f");
    expect(failed.pendingInput).toEqual({
      text: "Explain my reasoning",
      questionHelpDraft: { revision: 4, answer: { selected: "option-b" } },
    });
    expect(failed.draft).toBe("Explain my reasoning");
    expect(failed.messages[0]?.localStatus).toBe("failed");
  });

  it("replaces the optimistic message when the matching UUID is acknowledged", () => {
    const clientMessageId = "018f4c9d-5c43-7b8d-8fd2-1a2b3c4d5e6f";
    const requested = conversationReducer(
      { ...initialConversationMachineState, session: SESSION, draft: "Hello" },
      {
        type: "SEND_REQUESTED",
        clientMessageId,
        input: { text: "Hello" },
        createdAt: "2026-01-01T00:00:00.000Z",
      }
    );
    const response: SendConversationResponse = {
      session: SESSION,
      acceptedMessage: learnerMessage("cm_server", clientMessageId, "Hello"),
      assistantMessages: [],
      turn: {
        id: "ct_server",
        clientMessageId,
        status: "completed",
        assistantMessageIds: [],
      },
      replayed: false,
    };

    const next = conversationReducer(requested, { type: "SEND_SUCCEEDED", result: response });
    expect(next.pendingClientMessageId).toBeUndefined();
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.id).toBe("cm_server");
    expect(next.messages[0]?.localStatus).toBeUndefined();
  });

  it("clears the persisted retry envelope after authoritative reconciliation", () => {
    const clientMessageId = "018f4c9d-5c43-7b8d-8fd2-1a2b3c4d5e6f";
    const requested = conversationReducer(
      { ...initialConversationMachineState, session: SESSION, draft: "Hello" },
      {
        type: "SEND_REQUESTED",
        clientMessageId,
        input: { text: "Hello" },
        createdAt: "2026-01-01T00:00:00.000Z",
      }
    );

    const next = conversationReducer(requested, {
      type: "SYNCED",
      page: { session: SESSION, messages: [learnerMessage("cm_server", clientMessageId, "Hello")] },
    });

    expect(next.pendingClientMessageId).toBeUndefined();
    expect(next.pendingInput).toBeUndefined();
  });

  it("uses the authoritative turn error when a resumed turn is recoverable", () => {
    const clientMessageId = "018f4c9d-5c43-7b8d-8fd2-1a2b3c4d5e6f";
    const requested = conversationReducer(
      { ...initialConversationMachineState, session: SESSION, draft: "Hello" },
      {
        type: "SEND_REQUESTED",
        clientMessageId,
        input: { text: "Hello" },
        createdAt: "2026-01-01T00:00:00.000Z",
      }
    );
    const page: ConversationPage = {
      session: {
        ...SESSION,
        activeTurn: { id: "ct_server", status: "failed_recoverable", clientMessageId },
        allowedActions: ["retry_turn", "abandon"],
      },
      messages: [learnerMessage("cm_server", clientMessageId, "Hello")],
      activeTurn: {
        id: "ct_server",
        clientMessageId,
        status: "failed_recoverable",
        assistantMessageIds: [],
        error: {
          code: "MODEL_UNAVAILABLE",
          safeMessage: "The tutor could not finish that reply. Please retry it.",
          retryable: true,
        },
      },
    };

    const next = conversationReducer(requested, { type: "SYNCED", page });
    expect(next.uiState).toBe("send_failed");
    expect(next.pendingClientMessageId).toBe(clientMessageId);
    expect(next.error?.code).toBe("MODEL_UNAVAILABLE");
    expect(next.pendingInput).toEqual({ text: "Hello" });
  });

  it("clears local draft and retry state when the server closes a conversation", () => {
    const requested = conversationReducer(
      { ...initialConversationMachineState, session: SESSION, draft: "One last thought" },
      {
        type: "SEND_REQUESTED",
        clientMessageId: "018f4c9d-5c43-7b8d-8fd2-1a2b3c4d5e6f",
        input: { text: "One last thought" },
        createdAt: "2026-01-01T00:00:00.000Z",
      }
    );

    const next = conversationReducer(requested, {
      type: "SYNCED",
      page: { session: { ...SESSION, status: "completed" }, messages: [] },
    });

    expect(next.uiState).toBe("completed");
    expect(next.draft).toBe("");
    expect(next.pendingClientMessageId).toBeUndefined();
    expect(next.pendingInput).toBeUndefined();
  });
});
