/**
 * AI-tutor chat round-trip UNIT test (Issue7 — "Ask Tutor" regression guard).
 *
 * Proves the FULL send → read-back path that was previously broken end-to-end:
 *   • sendChatMessageService appends the learner turn + an assistant reply,
 *   • getChatSessionService reads the session back WITH both messages (the callable
 *     that did not exist — the reply had no way to reach the app),
 *   • listChatSessionsService returns the caller's session summary,
 *   • the AI-gateway-unavailable path still yields a valid fallback reply.
 *
 * Uses a hand-rolled in-memory ChatRepo + fake ctx (no emulator, no shared harness)
 * so it exercises the real service logic in isolation.
 */
import { describe, it, expect } from "vitest";
import { CALLABLES } from "@levelup/api-contract";
import {
  sendChatMessageService,
  getChatSessionService,
  listChatSessionsService,
} from "../levelup/chat";
import type { AuthContext } from "../shared/context";

/** The exact response gate makeCallable applies under VALIDATE_RESPONSES. */
function assertResponseValid(name: keyof typeof CALLABLES, res: unknown): void {
  const parsed = (
    CALLABLES[name] as {
      responseSchema: { safeParse(v: unknown): { success: boolean; error?: unknown } };
    }
  ).responseSchema.safeParse(res);
  expect(parsed.success, JSON.stringify(parsed.error, null, 2)).toBe(true);
}

type Doc = Record<string, unknown>;

/** In-memory stand-in for the Admin-SDK chat repo (`makeChatRepo`). */
function makeFakeChatRepo() {
  const sessions = new Map<string, Doc>();
  const messages = new Map<string, Doc[]>();
  let seq = 0;
  const nowIso = () => new Date(1_700_000_000_000 + seq * 1000).toISOString();
  return {
    async getSession(_t: string, id: string): Promise<Doc | null> {
      return sessions.get(id) ?? null;
    },
    async createSession(_t: string, data: Doc): Promise<string> {
      const id = `sess_${++seq}`;
      const ts = nowIso();
      sessions.set(id, { ...data, id, createdAt: ts, updatedAt: ts });
      messages.set(id, []);
      return id;
    },
    async appendMessage(_t: string, sid: string, message: Doc): Promise<string> {
      const id = `msg_${++seq}`;
      const list = messages.get(sid) ?? [];
      list.push({ ...message, id });
      messages.set(sid, list);
      const s = sessions.get(sid);
      if (s) s["updatedAt"] = nowIso();
      return id;
    },
    async listMessages(_t: string, sid: string): Promise<Doc[]> {
      return [...(messages.get(sid) ?? [])].sort((a, b) =>
        String(a["timestamp"]).localeCompare(String(b["timestamp"]))
      );
    },
    async listSessions(_t: string, uid: string, filter: { limit?: number }) {
      const items = [...sessions.values()]
        .filter((s) => s["userId"] === uid)
        .sort((a, b) => String(b["updatedAt"]).localeCompare(String(a["updatedAt"])))
        .slice(0, filter.limit ?? 20);
      return { items, nextCursor: null as string | null };
    },
  };
}

function makeCtx(opts: { aiThrows?: boolean; withBumpSpy?: boolean } = {}): AuthContext & {
  chatBumps: Array<Record<string, unknown>>;
} {
  let tick = 0;
  const ai = {
    async generate() {
      if (opts.aiThrows) throw new Error("gateway down");
      // aiChat is structured:false — makeAiSeam adapter maps data (text) → json (string).
      return {
        json: "What have you tried so far?",
        text: "What have you tried so far?",
        tokensUsed: 42,
        costUsd: 0,
        model: "stub",
      };
    },
  };
  // CHAT-1: optional levelupProjections port spy — captures the RTDB bump calls
  // the write path emits (the seam the sdk-v1 bootstrap wires to Admin-RTDB).
  const chatBumps: Array<Record<string, unknown>> = [];
  const repos: Record<string, unknown> = { chat: makeFakeChatRepo() };
  if (opts.withBumpSpy) {
    repos["levelupProjections"] = {
      async bumpChat(tenantId: string, userId: string, sessionId: string, lastMessageAt: string) {
        chatBumps.push({ tenantId, userId, sessionId, lastMessageAt });
      },
    };
  }
  return {
    uid: "user_learner_1",
    isSuperAdmin: false,
    tenantId: "tenant_test",
    role: "student",
    permissions: {},
    staffPermissions: {},
    classIds: [],
    studentIds: [],
    entityIds: {} as AuthContext["entityIds"],
    now: () => new Date(1_700_000_500_000 + tick++ * 1000).toISOString(),
    repos: repos as unknown as AuthContext["repos"],
    ai: ai as unknown as AuthContext["ai"],
    chatBumps,
  } as AuthContext & { chatBumps: Array<Record<string, unknown>> };
}

const baseInput = {
  spaceId: "space_1",
  storyPointId: "sp_1",
  itemId: "item_1",
  text: "I'm stuck on this problem.",
};

describe("AI tutor chat round-trip (Issue7)", () => {
  it("send → creates a session and returns a real assistant reply", async () => {
    const ctx = makeCtx();
    const res = (await sendChatMessageService(baseInput as never, ctx)) as {
      sessionId: string;
      message: { role: string; text: string };
    };
    expect(res.sessionId).toBeTruthy();
    expect(res.message.role).toBe("assistant");
    expect(res.message.text).toBe("What have you tried so far?");
    assertResponseValid("v1.levelup.sendChatMessage", res);
  });

  it("getChatSession reads the session back WITH both messages (the missing path)", async () => {
    const ctx = makeCtx();
    const sent = (await sendChatMessageService(baseInput as never, ctx)) as { sessionId: string };

    const got = (await getChatSessionService({ sessionId: sent.sessionId } as never, ctx)) as {
      session: { id: string; messages: Array<{ role: string; text: string }>; userId: string };
    };

    expect(got.session.id).toBe(sent.sessionId);
    expect(got.session.messages).toHaveLength(2);
    expect(got.session.messages[0]).toMatchObject({ role: "user", text: baseInput.text });
    expect(got.session.messages[1]).toMatchObject({
      role: "assistant",
      text: "What have you tried so far?",
    });
    // systemPrompt (⚷) is never projected into the view.
    expect(got.session).not.toHaveProperty("systemPrompt");
    assertResponseValid("v1.levelup.getChatSession", got);
  });

  it("listChatSessions returns the caller's session summary", async () => {
    const ctx = makeCtx();
    await sendChatMessageService(baseInput as never, ctx);

    const list = (await listChatSessionsService({} as never, ctx)) as {
      items: Array<{ itemId: string; previewMessage: string }>;
      nextCursor: string | null;
    };
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ itemId: "item_1" });
    assertResponseValid("v1.levelup.listChatSessions", list);
  });

  it("still returns a valid fallback reply when the AI gateway is unavailable", async () => {
    const ctx = makeCtx({ aiThrows: true });
    const res = (await sendChatMessageService(baseInput as never, ctx)) as {
      message: { role: string; text: string };
    };
    expect(res.message.role).toBe("assistant");
    expect(res.message.text.length).toBeGreaterThan(0);
  });
});

describe("AI gateway call contract (promptKey regression)", () => {
  it("uses promptKey 'aiChat' (not 'tutorChat') with the correct required variables", async () => {
    const captured: unknown[] = [];
    const ctx = {
      ...makeCtx(),
      ai: {
        async generate(req: unknown) {
          captured.push(req);
          return {
            json: "Good question!",
            text: "Good question!",
            tokensUsed: 15,
            costUsd: 0,
            model: "stub",
          };
        },
      } as unknown as AuthContext["ai"],
    };
    await sendChatMessageService(baseInput as never, ctx);
    expect(captured).toHaveLength(1);
    const req = captured[0] as Record<string, unknown>;
    expect(req["promptKey"]).toBe("aiChat");
    expect(req["promptKey"]).not.toBe("tutorChat");
    const vars = req["variables"] as Record<string, unknown>;
    expect(vars["message"]).toBe(baseInput.text);
    expect(typeof vars["itemContext"]).toBe("string");
    expect(typeof vars["language"]).toBe("string");
  });
});

describe("CHAT-1 chatBump signal (AD-12 addendum)", () => {
  it("send bumps the RTDB node once per append (user + assistant) with the MINIMAL triple", async () => {
    const ctx = makeCtx({ withBumpSpy: true });
    const res = (await sendChatMessageService(baseInput as never, ctx)) as { sessionId: string };

    expect(ctx.chatBumps).toHaveLength(2);
    for (const bump of ctx.chatBumps) {
      // Minimal signal ONLY — never message text/role/mediaUrls (content stays
      // in Firestore, served by getChatSession).
      expect(Object.keys(bump).sort()).toEqual([
        "lastMessageAt",
        "sessionId",
        "tenantId",
        "userId",
      ]);
      expect(bump).toMatchObject({
        tenantId: "tenant_test",
        userId: "user_learner_1",
        sessionId: res.sessionId,
      });
      expect(typeof bump["lastMessageAt"]).toBe("string");
      expect(JSON.stringify(bump)).not.toContain(baseInput.text);
    }
  });

  it("send succeeds untouched when the projection port is not wired (graceful no-op)", async () => {
    const ctx = makeCtx(); // no levelupProjections on repos
    const res = (await sendChatMessageService(baseInput as never, ctx)) as {
      message: { role: string };
    };
    expect(res.message.role).toBe("assistant");
    expect(ctx.chatBumps).toHaveLength(0);
  });
});
