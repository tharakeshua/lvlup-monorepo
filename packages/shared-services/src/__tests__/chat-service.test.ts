/**
 * Unit tests for AI chat session management via RealtimeDBService.
 *
 * Validates chat session lifecycle: create, send message, get history,
 * delete session, and real-time subscriptions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firebase Realtime Database mocks ────────────────────────────────
const mockRef = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockPush = vi.fn();
const mockOnValue = vi.fn();
const mockOff = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (...args: any[]) => mockRef(...args),
  get: (...args: any[]) => mockGet(...args),
  set: (...args: any[]) => mockSet(...args),
  update: (...args: any[]) => mockUpdate(...args),
  remove: (...args: any[]) => mockRemove(...args),
  push: (...args: any[]) => mockPush(...args),
  onValue: (...args: any[]) => mockOnValue(...args),
  off: (...args: any[]) => mockOff(...args),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: () => ({
    rtdb: { _isDatabase: true },
  }),
}));

import { RealtimeDBService } from "../realtime-db/index";
import type { ChatSession, ChatMessage } from "@auto-levelup/shared-types";

describe("Chat Service — RealtimeDBService for chat sessions", () => {
  let svc: RealtimeDBService;
  const mockDb = { _isDatabase: true } as any;
  const tenantId = "tenant-xyz";

  function makeChatSession(overrides: Partial<ChatSession> = {}): ChatSession {
    return {
      id: "session-1",
      tenantId,
      userId: "user-1",
      spaceId: "space-1",
      storyPointId: "sp-1",
      itemId: "item-1",
      agentId: "agent-1",
      agentName: "Tutor Bot",
      sessionTitle: "Help with fractions",
      previewMessage: "How do I add fractions?",
      messageCount: 1,
      language: "en",
      isActive: true,
      messages: [],
      systemPrompt: "You are a helpful math tutor.",
      createdAt: { seconds: 1700000000, nanoseconds: 0 } as any,
      updatedAt: { seconds: 1700000000, nanoseconds: 0 } as any,
      ...overrides,
    };
  }

  function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      id: "msg-1",
      role: "user",
      text: "How do I add fractions?",
      timestamp: "2025-01-01T00:00:00Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new RealtimeDBService(mockDb);
    mockRef.mockImplementation((_db: any, path: string) => ({
      _path: path,
      key: path.split("/").pop(),
    }));
  });

  // ── Create Session ────────────────────────────────────────────────

  describe("createSession", () => {
    it("creates a chat session at the org-scoped path", async () => {
      mockSet.mockResolvedValue(undefined);
      const session = makeChatSession();

      await svc.setData(tenantId, "chatSessions/session-1", session);

      expect(mockRef).toHaveBeenCalledWith(
        mockDb,
        `organizations/${tenantId}/chatSessions/session-1`
      );
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions/session-1` }),
        session
      );
    });

    it("creates session with initial system message", async () => {
      mockSet.mockResolvedValue(undefined);
      const systemMsg = makeMessage({
        id: "msg-sys",
        role: "system",
        text: "You are a helpful math tutor.",
      });
      const session = makeChatSession({ messages: [systemMsg] });

      await svc.setData(tenantId, "chatSessions/session-1", session);

      const savedData = mockSet.mock.calls[0][1] as ChatSession;
      expect(savedData.messages).toHaveLength(1);
      expect(savedData.messages[0].role).toBe("system");
    });

    it("pushes a new session and returns generated key", async () => {
      const newRef = { _path: "organizations/tenant-xyz/chatSessions/-Nxyz", key: "-Nxyz" };
      mockPush.mockReturnValue(newRef);
      mockSet.mockResolvedValue(undefined);

      const session = makeChatSession({ id: "" });
      const key = await svc.pushData(tenantId, "chatSessions", session);

      expect(key).toBe("-Nxyz");
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions` })
      );
    });
  });

  // ── Send Message ──────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("appends a user message via update", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const updates = {
        "messages/1": makeMessage({ id: "msg-2", text: "What is 1/2 + 1/3?" }),
        messageCount: 2,
        previewMessage: "What is 1/2 + 1/3?",
      };

      await svc.updateData(tenantId, "chatSessions/session-1", updates);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions/session-1` }),
        updates
      );
    });

    it("appends an assistant response via update", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const updates = {
        "messages/2": makeMessage({
          id: "msg-3",
          role: "assistant",
          text: "To add fractions, find a common denominator.",
          tokensUsed: { input: 50, output: 120 },
        }),
        messageCount: 3,
      };

      await svc.updateData(tenantId, "chatSessions/session-1", updates);

      const savedUpdates = mockUpdate.mock.calls[0][1];
      expect(savedUpdates["messages/2"].role).toBe("assistant");
      expect(savedUpdates["messages/2"].tokensUsed).toEqual({ input: 50, output: 120 });
    });
  });

  // ── Get History ───────────────────────────────────────────────────

  describe("getHistory", () => {
    it("retrieves full session data including messages", async () => {
      const session = makeChatSession({
        messages: [
          makeMessage({ id: "msg-1", role: "user", text: "Hello" }),
          makeMessage({ id: "msg-2", role: "assistant", text: "Hi there!" }),
        ],
        messageCount: 2,
      });
      mockGet.mockResolvedValue({ exists: () => true, val: () => session });

      const result = await svc.getData<ChatSession>(tenantId, "chatSessions/session-1");

      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(2);
      expect(result!.messageCount).toBe(2);
    });

    it("returns null for non-existing session", async () => {
      mockGet.mockResolvedValue({ exists: () => false, val: () => null });

      const result = await svc.getData(tenantId, "chatSessions/nonexistent");

      expect(result).toBeNull();
    });

    it("retrieves session metadata without full messages", async () => {
      const metadata = {
        sessionTitle: "Help with fractions",
        previewMessage: "How do I add fractions?",
        messageCount: 5,
        isActive: true,
      };
      mockGet.mockResolvedValue({ exists: () => true, val: () => metadata });

      const result = await svc.getData(tenantId, "chatSessions/session-1/metadata");

      expect(result).toEqual(metadata);
    });
  });

  // ── Delete Session ────────────────────────────────────────────────

  describe("deleteSession", () => {
    it("removes session at org-scoped path", async () => {
      mockRemove.mockResolvedValue(undefined);

      await svc.deleteData(tenantId, "chatSessions/session-1");

      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions/session-1` })
      );
    });

    it("soft-deletes by setting isActive to false", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await svc.updateData(tenantId, "chatSessions/session-1", { isActive: false });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions/session-1` }),
        { isActive: false }
      );
    });

    it("does not throw when deleting non-existing session", async () => {
      mockRemove.mockResolvedValue(undefined);

      await expect(svc.deleteData(tenantId, "chatSessions/nonexistent")).resolves.toBeUndefined();
    });
  });

  // ── Real-time subscription ────────────────────────────────────────

  describe("subscribe to chat updates", () => {
    it("subscribes to session changes and receives data", () => {
      const callback = vi.fn();
      const unsubscribe = vi.fn();
      mockOnValue.mockImplementation((_ref: any, handler: (snap: any) => void) => {
        // Simulate a snapshot event
        handler({ exists: () => true, val: () => makeChatSession({ messageCount: 3 }) });
        return unsubscribe;
      });

      svc.subscribe(tenantId, "chatSessions/session-1", callback);

      expect(mockOnValue).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions/session-1` }),
        expect.any(Function)
      );
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ messageCount: 3 }));
    });

    it("receives null when subscribed session is deleted", () => {
      const callback = vi.fn();
      mockOnValue.mockImplementation((_ref: any, handler: (snap: any) => void) => {
        handler({ exists: () => false, val: () => null });
        return vi.fn();
      });

      svc.subscribe(tenantId, "chatSessions/session-1", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("unsubscribes from session updates", () => {
      svc.unsubscribe(tenantId, "chatSessions/session-1");

      expect(mockOff).toHaveBeenCalledWith(
        expect.objectContaining({ _path: `organizations/${tenantId}/chatSessions/session-1` })
      );
    });
  });

  // ── Multi-tenant isolation ────────────────────────────────────────

  describe("Multi-tenant chat isolation", () => {
    it("tenantA chat path is isolated from tenantB", async () => {
      mockSet.mockResolvedValue(undefined);

      await svc.setData("tenantA", "chatSessions/s1", makeChatSession({ tenantId: "tenantA" }));
      await svc.setData("tenantB", "chatSessions/s1", makeChatSession({ tenantId: "tenantB" }));

      const paths = mockRef.mock.calls.map((c: any[]) => c[1]);
      expect(paths).toContain("organizations/tenantA/chatSessions/s1");
      expect(paths).toContain("organizations/tenantB/chatSessions/s1");
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe("Error handling", () => {
    it("propagates network errors on getData", async () => {
      mockGet.mockRejectedValue(new Error("UNAVAILABLE: network error"));

      await expect(svc.getData(tenantId, "chatSessions/session-1")).rejects.toThrow("UNAVAILABLE");
    });

    it("propagates permission errors on setData", async () => {
      mockSet.mockRejectedValue(new Error("PERMISSION_DENIED: access denied"));

      await expect(
        svc.setData(tenantId, "chatSessions/session-1", makeChatSession())
      ).rejects.toThrow("PERMISSION_DENIED");
    });
  });
});
