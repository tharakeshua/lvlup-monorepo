/**
 * CHAT-1 seam pin: the Admin-RTDB `LevelupProjectionPort.bumpChat` adapter.
 * Verbatim spec (AD-12 addendum):
 *  • bumpChat → `update()` on `chatBump/{t}/{userId}/{sessionId}` with EXACTLY
 *    `{rev: ServerValue.increment(1), lastMessageAt}` — atomic rev, and message
 *    CONTENT never rides RTDB (the bump is a refetch signal, not data).
 *  • BEST-EFFORT: RTDB failures log-and-swallow — the signal is a side-channel
 *    and must never fail the chat write path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const INCREMENT_SENTINEL = { ".sv": { increment: 1 } };
const update = vi.fn(async (_v: unknown) => {});
const set = vi.fn(async (_v: unknown) => {});
const ref = vi.fn((_path: string) => ({ update, set }));

vi.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ ref }),
  ServerValue: { increment: (n: number) => ({ ".sv": { increment: n } }) },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { error: vi.fn() },
}));

import { createRtdbLevelupProjections } from "./levelup-projections-rtdb.js";

beforeEach(() => {
  update.mockClear();
  update.mockResolvedValue(undefined);
  set.mockClear();
  ref.mockClear();
});

describe("bumpChat", () => {
  it("updates the bump node with EXACTLY {rev: increment(1), lastMessageAt}", async () => {
    await createRtdbLevelupProjections().bumpChat("t1", "u1", "sess1", "2026-07-04T00:00:00.000Z");
    expect(ref).toHaveBeenCalledWith("chatBump/t1/u1/sess1");
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]![0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["lastMessageAt", "rev"]);
    expect(payload["rev"]).toEqual(INCREMENT_SENTINEL);
    expect(payload["lastMessageAt"]).toBe("2026-07-04T00:00:00.000Z");
  });

  it("swallows RTDB failures (signal must never fail the chat write path)", async () => {
    update.mockRejectedValueOnce(new Error("rtdb down"));
    await expect(
      createRtdbLevelupProjections().bumpChat("t1", "u1", "sess1", "now")
    ).resolves.toBeUndefined();
  });
});
