import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@google/generative-ai", () => {
  const MockGoogleGenerativeAI = vi.fn(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel;
  });
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

vi.mock("../ai/llm-logger", () => ({
  logLLMCall: vi.fn().mockResolvedValue("log-id-123"),
}));

import { LLMWrapper, type LLMCallMetadata } from "../ai/llm-wrapper";
import { logLLMCall } from "../ai/llm-logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseMetadata: LLMCallMetadata = {
  clientId: "tenant-1",
  userId: "user-1",
  userRole: "teacher",
  purpose: "answer_grading",
  operation: "relmsEvaluation",
  resourceType: "questionSubmission",
  resourceId: "qs-1",
};

function mockSuccessResponse(text: string, inputTokens = 100, outputTokens = 50) {
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => text,
      usageMetadata: {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
      },
    },
  });
}

describe("LLMWrapper", () => {
  let wrapper: LLMWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = new LLMWrapper({
      provider: "gemini",
      apiKey: "test-key",
      enableLogging: false,
      maxRetries: 2,
      retryBaseDelayMs: 10, // fast retries for tests
    });
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe("constructor", () => {
    it("throws for unsupported provider", () => {
      expect(() => new LLMWrapper({ provider: "openai" as any, apiKey: "k" })).toThrow(
        "Unsupported provider"
      );
    });

    it("creates instance with gemini provider", () => {
      expect(wrapper).toBeInstanceOf(LLMWrapper);
    });
  });

  // ---------------------------------------------------------------------------
  // call — success path
  // ---------------------------------------------------------------------------
  describe("call — success", () => {
    it("returns text response with token usage and cost", async () => {
      mockSuccessResponse("Hello world", 500, 200);

      const result = await wrapper.call("Test prompt", baseMetadata);

      expect(result.text).toBe("Hello world");
      expect(result.tokens.input).toBe(500);
      expect(result.tokens.output).toBe(200);
      expect(result.tokens.total).toBe(700);
      expect(result.cost.currency).toBe("USD");
      expect(result.model).toBe("gemini-2.5-flash");
      expect(result.parsed).toBeNull();
    });

    it("passes system prompt and generation config to model", async () => {
      mockSuccessResponse("response");

      await wrapper.call(
        "prompt",
        { ...baseMetadata, temperature: 0.1, maxTokens: 1024 },
        {
          systemPrompt: "You are a grader.",
        }
      );

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-2.5-flash",
          systemInstruction: "You are a grader.",
          generationConfig: expect.objectContaining({
            temperature: 0.1,
            maxOutputTokens: 1024,
          }),
        })
      );
    });

    it("parses JSON response when responseMimeType is application/json", async () => {
      mockSuccessResponse('{"score": 8}', 100, 50);

      const result = await wrapper.call<{ score: number }>("grade this", baseMetadata, {
        responseMimeType: "application/json",
      });

      expect(result.parsed).toEqual({ score: 8 });
    });

    it("sets parsed to null when JSON parsing fails", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockSuccessResponse("not json", 100, 50);

      const result = await wrapper.call("prompt", baseMetadata, {
        responseMimeType: "application/json",
      });

      expect(result.parsed).toBeNull();
      expect(result.text).toBe("not json");
      consoleSpy.mockRestore();
    });

    it("includes images in the request", async () => {
      mockSuccessResponse("analyzed");

      await wrapper.call("analyze", baseMetadata, {
        images: [{ base64: "abc123", mimeType: "image/png" }],
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  inlineData: { data: "abc123", mimeType: "image/png" },
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it("uses model override from metadata", async () => {
      mockSuccessResponse("response");

      await wrapper.call("prompt", { ...baseMetadata, model: "gemini-2.5-pro" });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-pro" })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // call — logging
  // ---------------------------------------------------------------------------
  describe("call — logging", () => {
    it("logs successful call when logging is enabled", async () => {
      const loggingWrapper = new LLMWrapper({
        provider: "gemini",
        apiKey: "test-key",
        enableLogging: true,
        maxRetries: 0,
        retryBaseDelayMs: 10,
      });

      mockSuccessResponse("ok");

      const result = await loggingWrapper.call("prompt", baseMetadata);

      expect(logLLMCall).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          success: true,
          model: "gemini-2.5-flash",
        })
      );
      expect(result.logId).toBe("log-id-123");
    });

    it("does not log when logging is disabled", async () => {
      mockSuccessResponse("ok");
      await wrapper.call("prompt", baseMetadata);
      expect(logLLMCall).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // call — retry logic
  // ---------------------------------------------------------------------------
  describe("call — retry", () => {
    it("retries on 429 error and succeeds", async () => {
      const err429 = new Error("429 Too Many Requests");
      mockGenerateContent.mockRejectedValueOnce(err429).mockResolvedValueOnce({
        response: {
          text: () => "retried ok",
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        },
      });

      const result = await wrapper.call("prompt", baseMetadata);
      expect(result.text).toBe("retried ok");
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries", async () => {
      const err503 = new Error("503 Service Unavailable");
      mockGenerateContent.mockRejectedValue(err503);

      await expect(wrapper.call("prompt", baseMetadata)).rejects.toThrow("503");
      // initial + 2 retries = 3
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it("does not retry non-retryable errors", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Invalid API key"));

      await expect(wrapper.call("prompt", baseMetadata)).rejects.toThrow("Invalid API key");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });
});
