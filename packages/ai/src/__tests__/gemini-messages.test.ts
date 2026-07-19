import { describe, expect, it } from "vitest";
import { toGeminiContents } from "../provider/gemini.js";

describe("Gemini typed message conversion", () => {
  it("converts role-preserving text/tool history and retains call correlation in function responses", () => {
    const contents = toGeminiContents({
      messages: [
        {
          role: "developer",
          parts: [{ type: "text", text: "persona config" }],
        },
        {
          role: "user",
          parts: [
            { type: "text", text: "learner question" },
            { type: "image", image: { base64: "typed-image", mimeType: "image/png" } },
          ],
        },
        {
          role: "assistant",
          parts: [
            { type: "text", text: "I will check the visible context." },
            {
              type: "tool_call",
              callId: "call-1",
              name: "retrieve_scope_context",
              args: { scope: "item" },
            },
          ],
        },
        {
          role: "tool",
          parts: [
            {
              type: "tool_result",
              callId: "call-1",
              name: "retrieve_scope_context",
              result: { title: "Fractions" },
            },
          ],
        },
      ],
      images: [{ base64: "legacy-image", mimeType: "image/jpeg" }],
    });

    expect(contents).toEqual([
      {
        role: "user",
        parts: [
          { text: "Developer configuration (subordinate to platform policy):\npersona config" },
        ],
      },
      {
        role: "user",
        parts: [
          { text: "learner question" },
          { inlineData: { data: "typed-image", mimeType: "image/png" } },
          { inlineData: { data: "legacy-image", mimeType: "image/jpeg" } },
        ],
      },
      {
        role: "model",
        parts: [
          { text: "I will check the visible context." },
          { functionCall: { name: "retrieve_scope_context", args: { scope: "item" } } },
        ],
      },
      {
        role: "function",
        parts: [
          {
            functionResponse: {
              name: "retrieve_scope_context",
              response: { callId: "call-1", result: { title: "Fractions" } },
            },
          },
        ],
      },
    ]);
  });
});
