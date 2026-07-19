/** Conversation key and mutation-invalidation contract — no Firebase runtime. */
import { describe, expect, it, vi } from "vitest";
import * as query from "../index.js";
import { conversationKeys } from "../keys/registry.js";
import { invalidateForCallable } from "../invalidation/invalidate.js";

function makeQueryClientSpy() {
  const invalidated: readonly unknown[][] = [];
  return {
    invalidated,
    invalidateQueries: vi.fn(async ({ queryKey }: { queryKey: readonly unknown[] }) => {
      (invalidated as unknown[][]).push(queryKey as unknown[]);
    }),
  };
}

describe("conversationKeys", () => {
  it("uses the exact list/detail/transcript hierarchy with no tenant identifier", () => {
    const filter = {
      mode: "question_help",
      context: {
        kind: "question_help",
        spaceId: "space_1",
        storyPointId: "story_1",
        itemId: "item_1",
      },
    };
    const page = { messageCursor: "older_page", messageLimit: 50 };

    expect(conversationKeys.all).toEqual(["conversations"]);
    expect(conversationKeys.lists()).toEqual(["conversations", "list"]);
    expect(conversationKeys.list(filter)).toEqual(["conversations", "list", filter]);
    expect(conversationKeys.details()).toEqual(["conversations", "detail"]);
    expect(conversationKeys.detail("session_1")).toEqual(["conversations", "detail", "session_1"]);
    expect(conversationKeys.messages("session_1", page)).toEqual([
      "conversations",
      "detail",
      "session_1",
      "messages",
      page,
    ]);

    expect(JSON.stringify(conversationKeys.list(filter))).not.toContain("tenantId");
  });

  it("isolates history by mode and exact context while detail stays session-scoped", () => {
    const tutor = conversationKeys.list({
      mode: "tutor",
      context: { kind: "tutor", scope: "space", spaceId: "space_1" },
    });
    const assessment = conversationKeys.list({
      mode: "agent_assessment",
      context: {
        kind: "agent_assessment",
        spaceId: "space_1",
        storyPointId: "story_1",
        itemId: "item_1",
      },
    });

    expect(tutor).not.toEqual(assessment);
    expect(conversationKeys.detail("session_1")).not.toEqual(conversationKeys.detail("session_2"));
  });
});

describe("conversation mutation invalidation", () => {
  it("exports the exact public hook surface", () => {
    const surface = query as unknown as Record<string, unknown>;
    for (const name of [
      "conversationKeys",
      "useConversations",
      "useConversation",
      "useStartConversation",
      "useSendConversationTurn",
      "useFinishConversation",
      "useAbandonConversation",
      "useConversationBump",
    ]) {
      expect(surface[name], `${name} is public`).toBeDefined();
    }
  });

  it("invalidates only history lists and the affected session for start/send/abandon", async () => {
    for (const [callable, ctx] of [
      ["v1.levelup.startConversation", { data: { session: { id: "session_start" } } }],
      ["v1.levelup.sendConversationTurn", { vars: { sessionId: "session_send" } }],
      ["v1.levelup.abandonConversation", { vars: { sessionId: "session_abandon" } }],
    ] as const) {
      const qc = makeQueryClientSpy();
      await invalidateForCallable(qc, callable, ctx);

      expect(qc.invalidated).toContainEqual(conversationKeys.lists());
      expect(qc.invalidated).toContainEqual(
        conversationKeys.detail(
          callable === "v1.levelup.startConversation"
            ? "session_start"
            : callable === "v1.levelup.sendConversationTurn"
              ? "session_send"
              : "session_abandon"
        )
      );
      expect(qc.invalidated).not.toContainEqual(["conversations"]);
    }
  });

  it("keeps finish's required progress invalidation while narrowing its conversation work", async () => {
    const qc = makeQueryClientSpy();
    await invalidateForCallable(qc, "v1.levelup.finishConversation", {
      vars: { sessionId: "session_finish" },
    });

    expect(qc.invalidated).toContainEqual(["progress"]);
    expect(qc.invalidated).toContainEqual(conversationKeys.lists());
    expect(qc.invalidated).toContainEqual(conversationKeys.detail("session_finish"));
    expect(qc.invalidated).not.toContainEqual(["conversations"]);
  });
});
