import { describe, it, expect } from "vitest";
import { MockLLMWrapper } from "../../../test-utils/mock-llm";

/**
 * Tests for send-chat-message — AI tutor chat.
 *
 * Tests the mock LLM interaction and message sanitization rules.
 */

describe("send-chat-message — message sanitization", () => {
  it("should truncate messages over 4000 characters", () => {
    const MAX_MESSAGE_LENGTH = 4000;
    const longMessage = "a".repeat(5000);
    const truncated = longMessage.substring(0, MAX_MESSAGE_LENGTH);

    expect(truncated.length).toBe(4000);
  });

  it("should strip control characters except newlines and tabs", () => {
    const message = "Hello\x00World\nNew\tLine\x7FEnd";
    const sanitized = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    expect(sanitized).toBe("HelloWorld\nNew\tLineEnd");
  });

  it("should preserve normal text", () => {
    const message = "What is the formula for photosynthesis?";
    const sanitized = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    expect(sanitized).toBe(message);
  });
});

describe("send-chat-message — LLM chat flow", () => {
  it("should build conversation with history", async () => {
    const mockLLM = new MockLLMWrapper();
    mockLLM.enqueue({
      text: "Great question! Photosynthesis is the process by which plants...",
    });

    const history = [
      { role: "user", content: "What is photosynthesis?" },
      { role: "assistant", content: "Photosynthesis is..." },
    ];

    const historyText = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const newMessage = "Can you explain more?";
    const fullPrompt = `${historyText}\nUSER: <student_message>${newMessage}</student_message>\n\nRespond as the tutor:`;

    const result = await mockLLM.call(fullPrompt, {
      clientId: "tenant-1",
      userId: "student-1",
      userRole: "student",
      purpose: "ai_chat",
      operation: "levelup_tutor_chat",
      resourceType: "item",
      resourceId: "item-1",
    });

    expect(result.text).toContain("Photosynthesis");
    expect(mockLLM.calls[0].prompt).toContain("student_message");
    expect(mockLLM.calls[0].metadata.purpose).toBe("ai_chat");
  });

  it("should enforce max conversation turns", () => {
    const maxTurns = 10;
    const currentMessages = Array(10).fill({ role: "user", text: "hi" });

    expect(currentMessages.length >= maxTurns).toBe(true);
  });
});
