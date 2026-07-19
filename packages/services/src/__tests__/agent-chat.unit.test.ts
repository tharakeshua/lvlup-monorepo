/**
 * Chat-agent question tests (AI-EVALUATION-CORE-PLAN.md Phase 4 / D6):
 *   • buildAgentTurnPrompt — persona precedence (agentInstructions > space agent),
 *     objectives/dimensions/turn-budget/history rendering
 *   • buildAgentTools / parseAgentToolCalls — tool declarations, observation
 *     whitelisting, end_conversation signal
 *   • sendChatMessageService agent flow — observations accumulate on the session
 *     and return to the client; end_conversation finalizes via the Evaluation
 *     Core (unifiedEvaluation), persists progress, and deactivates the session;
 *     a non-agent item stays on the tutor path with REAL item context.
 */
import { describe, it, expect } from "vitest";
import {
  buildAgentTurnPrompt,
  buildAgentTools,
  parseAgentToolCalls,
} from "../evaluation/agent-chat";
import { sendChatMessageService } from "../levelup/chat";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;

// ── prompt/tool unit coverage ─────────────────────────────────────────────────

describe("buildAgentTurnPrompt", () => {
  const base = {
    questionText: "Design a rate limiter.",
    history: [],
    message: "Where do I start?",
    language: "en",
    turnsUsed: 1,
    maxTurns: 8,
  };

  it("question-level agentInstructions beat the space agent persona", () => {
    const p = buildAgentTurnPrompt({
      ...base,
      questionData: { agentInstructions: "You are an SRE interviewer." },
      agent: { systemPrompt: "IGNORED persona" },
    });
    expect(p).toContain("You are an SRE interviewer.");
    expect(p).not.toContain("IGNORED persona");
  });

  it("falls back to the space agent systemPrompt + rules", () => {
    const p = buildAgentTurnPrompt({
      ...base,
      agent: { systemPrompt: "You are Prof. X.", rules: ["Never give the answer"] },
    });
    expect(p).toContain("You are Prof. X.");
    expect(p).toContain("- Never give the answer");
  });

  it("renders objectives, dimensions, turn budget, and history", () => {
    const p = buildAgentTurnPrompt({
      ...base,
      questionData: { objectives: ["identify bottlenecks"] },
      settings: { enabledDimensions: [{ id: "depth", name: "Depth", description: "how deep" }] },
      history: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi there" },
      ],
      turnsUsed: 3,
    });
    expect(p).toContain("- identify bottlenecks");
    expect(p).toContain("depth — Depth: how deep");
    expect(p).toContain("turns used: 3 of 8");
    expect(p).toContain("LEARNER: hello");
    expect(p).toContain("YOU: hi there");
    expect(p).toContain("LEARNER SAYS: Where do I start?");
  });
});

describe("agent tools", () => {
  it("declares record_observation (dimension enum) + end_conversation", () => {
    const tools = buildAgentTools(["depth", "clarity"]);
    expect(tools.map((t) => t.name)).toEqual(["record_observation", "end_conversation"]);
    const params = tools[0]!.parameters as Doc;
    const dim = (params["properties"] as Doc)["dimensionId"] as Doc;
    expect(dim["enum"]).toEqual(["depth", "clarity"]);
  });

  it("parseAgentToolCalls whitelists dimensions and detects end", () => {
    const parsed = parseAgentToolCalls(
      [
        {
          name: "record_observation",
          args: { dimensionId: "depth", evidence: "good", provisionalScore: 7 },
        },
        { name: "record_observation", args: { dimensionId: "invented", evidence: "dropped" } },
        { name: "record_observation", args: { dimensionId: "depth", evidence: "" } },
        { name: "end_conversation", args: { reason: "objectives covered" } },
        { name: "unknown_tool", args: {} },
      ],
      ["depth", "clarity"],
      "2026-01-01T00:00:00.000Z"
    );
    expect(parsed.observations).toEqual([
      {
        dimensionId: "depth",
        evidence: "good",
        provisionalScore: 7,
        at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(parsed.ended).toBe(true);
    expect(parsed.endReason).toBe("objectives covered");
  });
});

// ── service flow (in-memory repos + scripted fake gateway) ────────────────────

function makeFakeChatRepo() {
  const sessions = new Map<string, Doc>();
  const messages = new Map<string, Doc[]>();
  let seq = 0;
  return {
    sessions,
    async getSession(_t: string, id: string): Promise<Doc | null> {
      return sessions.get(id) ?? null;
    },
    async createSession(_t: string, data: Doc): Promise<string> {
      const id = `sess_${++seq}`;
      sessions.set(id, { ...data, id });
      messages.set(id, []);
      return id;
    },
    async updateSession(_t: string, id: string, patch: Doc): Promise<void> {
      sessions.set(id, { ...(sessions.get(id) ?? {}), ...patch });
    },
    async appendMessage(_t: string, sid: string, message: Doc): Promise<string> {
      const id = `msg_${++seq}`;
      (messages.get(sid) ?? messages.set(sid, []).get(sid)!).push({ ...message, id });
      return id;
    },
    async listMessages(_t: string, sid: string): Promise<Doc[]> {
      return [...(messages.get(sid) ?? [])];
    },
    async listSessions() {
      return { items: [...sessions.values()], nextCursor: null as string | null };
    },
  };
}

const AGENT_ITEM: Doc = {
  id: "item_agent",
  type: "question",
  maxScore: 10,
  payload: {
    type: "question",
    questionData: {
      questionType: "chat_agent_question",
      prompt: "Debate the tradeoffs of caching.",
      agentInstructions: "You are a socratic debate partner.",
      maxTurns: 5,
      objectives: ["name a tradeoff"],
    },
  },
};

const SETTINGS_DOC: Doc = {
  id: "evalset_1",
  isDefault: true,
  enabledDimensions: [{ id: "reasoning", name: "Reasoning", priority: "HIGH" }],
};

interface ScriptedTurn {
  json?: unknown;
  text?: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
}

function makeCtx(opts: { item?: Doc | null; turns: ScriptedTurn[] }) {
  let tick = 0;
  const calls: Doc[] = [];
  const progressWrites: Doc[] = [];
  const chat = makeFakeChatRepo();
  const script = [...opts.turns];
  const repos: Record<string, unknown> = {
    chat,
    items: {
      async get() {
        return opts.item ?? null;
      },
    },
    spaces: {
      async get() {
        return { id: "space_1", evaluationSettingsId: "evalset_1" };
      },
    },
    evaluationSettings: {
      async get(_t: string, id: string) {
        return id === "evalset_1" ? SETTINGS_DOC : null;
      },
      async list() {
        return { items: [SETTINGS_DOC], nextCursor: null };
      },
    },
    agents: {
      async get() {
        return null;
      },
    },
    tenants: {
      async get() {
        return null;
      },
    },
    // progress-updater seam: capture writes instead of a real tx.
    progress: {
      async update(_t: string, update: Doc) {
        progressWrites.push(update);
        return { completed: true, storyPoints: {} };
      },
    },
  };
  const ai = {
    calls,
    async generate(req: Doc) {
      calls.push(req);
      const turn = script.shift() ?? { text: "fallback reply" };
      return {
        json: turn.json ?? turn.text ?? "",
        text: turn.text ?? "",
        ...(turn.toolCalls ? { toolCalls: turn.toolCalls } : {}),
        tokensUsed: 10,
        costUsd: 0,
        model: "stub",
      };
    },
  };
  const ctx = {
    uid: "user_1",
    isSuperAdmin: false,
    tenantId: "tenant_t",
    role: "student",
    permissions: {},
    staffPermissions: {},
    classIds: [],
    studentIds: [],
    entityIds: {} as AuthContext["entityIds"],
    now: () => new Date(1_700_000_000_000 + tick++ * 1000).toISOString(),
    repos: repos as unknown as AuthContext["repos"],
    ai: ai as unknown as AuthContext["ai"],
  } as AuthContext;
  return { ctx, calls, progressWrites, chat };
}

const INPUT = {
  spaceId: "space_1",
  storyPointId: "sp_1",
  itemId: "item_agent",
  text: "Caching trades freshness for speed.",
};

describe("sendChatMessage — chat-agent question flow", () => {
  // Legacy chat is deliberately tutor-only: agent assessments must go through the
  // durable v1.levelup.startConversation / sendConversationTurn runtime.
  it("rejects chat-agent items without a model call or session write", async () => {
    const { ctx, calls, chat } = makeCtx({ item: AGENT_ITEM, turns: [{ text: "unused" }] });
    await expect(sendChatMessageService(INPUT as never, ctx)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("conversation session callables"),
    });
    expect(calls.length).toBe(0);
    expect(chat.sessions.size).toBe(0);
  });

  it("rejects chat-agent items even when resuming an existing session", async () => {
    const { ctx, chat } = makeCtx({ item: AGENT_ITEM, turns: [{ text: "unused" }] });
    const sid = await chat.createSession("tenant_t", { userId: "user_1", isActive: true });
    await expect(
      sendChatMessageService({ ...INPUT, sessionId: sid } as never, ctx)
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("a further message to an ended tutor session is rejected", async () => {
    const { ctx, chat } = makeCtx({
      item: {
        id: "item_txt",
        type: "question",
        content: "Explain closures.",
        payload: { type: "question", questionData: { questionType: "paragraph" } },
      },
      turns: [{ text: "x" }],
    });
    const sid = await chat.createSession("tenant_t", {
      userId: "user_1",
      isActive: false,
    });
    await expect(
      sendChatMessageService({ ...INPUT, itemId: "item_txt", sessionId: sid } as never, ctx)
    ).rejects.toMatchObject({ code: "FAILED_PRECONDITION" });
  });

  it("non-agent items stay on the tutor path with REAL item context + history", async () => {
    const { ctx, calls } = makeCtx({
      item: {
        id: "item_txt",
        type: "question",
        content: "Explain closures.",
        payload: { type: "question", questionData: { questionType: "paragraph" } },
      },
      turns: [{ text: "A closure captures its scope." }],
    });
    const res = (await sendChatMessageService(INPUT as never, ctx)) as Doc;
    expect(calls[0]!["promptKey"]).toBe("aiChat");
    expect((calls[0]!["variables"] as Doc)["itemContext"]).toContain("Explain closures.");
    expect(res["observations"]).toBeUndefined();
    expect(res["conversationEnded"]).toBeUndefined();
  });
});
