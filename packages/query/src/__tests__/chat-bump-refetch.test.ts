/**
 * CHAT-1 — bump → debounced getChatSession refetch (AD-12 addendum), UNIT.
 *
 * Pins the `createChatBumpHandler` seam `useChatStream` installs on the
 * `v1.levelup.chatStream` subscription:
 *   • a bump payload debounce-invalidates chatKeys.detail(sessionId) — the
 *     ACTIVE `useChatSession` read then refetches getChatSession (authority
 *     stays with the callable; the bump is only a signal),
 *   • a user+assistant DOUBLE bump inside the window coalesces into ONE
 *     invalidate (the ~250ms trailing debounce),
 *   • the caller's onPayload still receives every raw bump,
 *   • cancel() drops a pending invalidate (unmount cleanup).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createChatBumpHandler, CHAT_BUMP_DEBOUNCE_MS } from "../levelup-content/subscriptions.js";
import { chatKeys } from "../keys/registry.js";

const BUMP = { rev: 1, lastMessageAt: "2026-07-04T00:00:00.000Z" };

afterEach(() => {
  vi.useRealTimers();
});

describe("createChatBumpHandler (CHAT-1)", () => {
  it("invalidates chatKeys.detail(sessionId) after the debounce window", () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
    const h = createChatBumpHandler("sess1");

    h.handle(BUMP, qc);
    expect(invalidate).not.toHaveBeenCalled(); // trailing debounce — not synchronous

    vi.advanceTimersByTime(CHAT_BUMP_DEBOUNCE_MS + 1);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatKeys.detail("sess1") });
  });

  it("coalesces the user+assistant double bump of one turn into ONE refetch", () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
    const h = createChatBumpHandler("sess1");

    h.handle({ ...BUMP, rev: 1 }, qc);
    vi.advanceTimersByTime(100); // second bump lands inside the window
    h.handle({ ...BUMP, rev: 2 }, qc);
    vi.advanceTimersByTime(CHAT_BUMP_DEBOUNCE_MS + 1);

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("forwards every raw bump to the caller onPayload (legacy mappers degrade safely)", () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
    const onPayload = vi.fn();
    const h = createChatBumpHandler("sess1", { onPayload });

    h.handle({ ...BUMP, rev: 1 }, qc);
    h.handle({ ...BUMP, rev: 2 }, qc);
    expect(onPayload).toHaveBeenCalledTimes(2);
    expect(onPayload).toHaveBeenNthCalledWith(2, { ...BUMP, rev: 2 }, qc);
  });

  it("cancel() drops a pending invalidate (unmount cleanup)", () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
    const h = createChatBumpHandler("sess1");

    h.handle(BUMP, qc);
    h.cancel();
    vi.advanceTimersByTime(CHAT_BUMP_DEBOUNCE_MS + 1);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
