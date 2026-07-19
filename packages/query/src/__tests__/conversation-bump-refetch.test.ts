/** RTDB conversation bump remains a debounced callable-refetch signal only. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  CONVERSATION_BUMP_DEBOUNCE_MS,
  createConversationBumpHandler,
} from "../levelup-content/subscriptions.js";
import { conversationKeys } from "../keys/registry.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("createConversationBumpHandler", () => {
  it("debounces multiple RTDB bumps into one session-detail invalidation", () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
    const handler = createConversationBumpHandler("session_1");

    handler.handle({ rev: 1, lastMessageAt: "2026-07-18T00:00:00.000Z" }, qc);
    vi.advanceTimersByTime(100);
    handler.handle({ rev: 2 }, qc);
    vi.advanceTimersByTime(CONVERSATION_BUMP_DEBOUNCE_MS + 1);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: conversationKeys.detail("session_1") });
  });

  it("cancels a pending refetch on unmount cleanup", () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
    const handler = createConversationBumpHandler("session_1");

    handler.handle({ rev: 1 }, qc);
    handler.cancel();
    vi.advanceTimersByTime(CONVERSATION_BUMP_DEBOUNCE_MS + 1);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
