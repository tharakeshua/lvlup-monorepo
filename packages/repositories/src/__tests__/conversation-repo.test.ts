/** Conversation repository wire-shape tests — no Firebase/Firestore client path. */
import { beforeEach, describe, expect, it } from "vitest";
import { createFakeApiClient, type FakeApiClient } from "../../../../tests/sdk/fakes";
import { buildRepos, ready } from "./_harness";

const d = ready() ? describe : describe.skip;

const startInput = {
  clientRequestId: "00000000-0000-4000-8000-000000000001",
  mode: "tutor",
  context: { kind: "tutor", scope: "space", spaceId: "space_1" },
};
const sessionId = "conversation_1";

d("conversationRepo", () => {
  let api: FakeApiClient;

  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("uses only the six versioned callables and preserves their safe response envelopes", async () => {
    const responses = {
      start: { session: { id: sessionId }, messages: [], resumed: false },
      send: {
        session: { id: sessionId },
        acceptedMessage: { id: "message_1" },
        assistantMessages: [],
        turn: { id: "turn_1" },
        replayed: false,
      },
      finish: {
        session: { id: sessionId },
        result: { status: "grading_pending", retryAfterMs: 1000 },
        replayed: false,
      },
      get: { session: { id: sessionId }, messages: [], nextMessageCursor: null },
      list: { items: [{ id: sessionId }], nextCursor: null },
      abandon: { session: { id: sessionId }, replayed: false },
    };
    api.stub("levelup", "startConversation", () => responses.start);
    api.stub("levelup", "sendConversationTurn", () => responses.send);
    api.stub("levelup", "finishConversation", () => responses.finish);
    api.stub("levelup", "getConversation", () => responses.get);
    api.stub("levelup", "listConversations", () => responses.list);
    api.stub("levelup", "abandonConversation", () => responses.abandon);

    const repo = buildRepos(api)["conversationRepo"]!;
    const sendInput = {
      sessionId,
      clientMessageId: "00000000-0000-4000-8000-000000000002",
      input: { text: "Help me understand this." },
    };
    const finishInput = {
      sessionId,
      clientRequestId: "00000000-0000-4000-8000-000000000003",
      reason: "learner_requested",
    };
    const getInput = { sessionId, messageLimit: 25 };
    const listInput = { mode: "tutor", limit: 10 };
    const abandonInput = {
      sessionId,
      clientRequestId: "00000000-0000-4000-8000-000000000004",
    };

    await expect(repo["start"]!(startInput)).resolves.toBe(responses.start);
    await expect(repo["send"]!(sendInput)).resolves.toBe(responses.send);
    await expect(repo["finish"]!(finishInput)).resolves.toBe(responses.finish);
    await expect(repo["get"]!(getInput)).resolves.toBe(responses.get);
    await expect(repo["list"]!(listInput)).resolves.toBe(responses.list);
    await expect(repo["abandon"]!(abandonInput)).resolves.toBe(responses.abandon);

    expect(api.callsTo("v1.levelup.startConversation")[0]!.data).toEqual(startInput);
    expect(api.callsTo("v1.levelup.sendConversationTurn")[0]!.data).toEqual(sendInput);
    expect(api.callsTo("v1.levelup.finishConversation")[0]!.data).toEqual(finishInput);
    expect(api.callsTo("v1.levelup.getConversation")[0]!.data).toEqual(getInput);
    expect(api.callsTo("v1.levelup.listConversations")[0]!.data).toEqual(listInput);
    expect(api.callsTo("v1.levelup.abandonConversation")[0]!.data).toEqual(abandonInput);
  });

  it("lists with an empty, strict-callable request when no filter is supplied", async () => {
    api.stub("levelup", "listConversations", () => ({ items: [], nextCursor: null }));

    await buildRepos(api)["conversationRepo"]!["list"]!();

    expect(api.callsTo("v1.levelup.listConversations")[0]!.data).toEqual({});
  });
});
