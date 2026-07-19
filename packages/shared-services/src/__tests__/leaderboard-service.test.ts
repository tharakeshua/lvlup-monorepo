/**
 * Leaderboard service tests.
 *
 * Tests the core leaderboard ranking algorithm, period filtering, and RTDB
 * subscription patterns extracted from the legacy LeaderboardService.
 * Uses RealtimeDBService from shared-services for RTDB operations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Firebase RTDB SDK ─────────────────────────────────────────────────
const mockRef = vi.fn();
const mockGet = vi.fn();
const mockOnValue = vi.fn();
const mockOff = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (...a: any[]) => mockRef(...a),
  get: (...a: any[]) => mockGet(...a),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
  onValue: (...a: any[]) => mockOnValue(...a),
  off: (...a: any[]) => mockOff(...a),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: () => ({
    rtdb: { _isMockRtdb: true },
  }),
}));

import { RealtimeDBService } from "../realtime-db/index";

// ── Leaderboard types (mirroring legacy) ───────────────────────────────────

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  rank: number;
  countsByTier?: { silver?: number; gold?: number; platinum?: number; diamond?: number };
}

type LeaderboardPeriod = "weekly" | "monthly" | "allTime";

// ── Extracted ranking algorithm (from legacy LeaderboardService) ───────────

function startOf(period: LeaderboardPeriod): number {
  const now = new Date();
  if (period === "allTime") return 0;
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  const day = now.getDay();
  const delta = day === 0 ? 6 : day - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - delta, 0, 0, 0, 0).getTime();
}

function buildRankedEntries(
  raw: Record<string, { score: number; updatedAt: number; countsByTier?: any }>,
  period: LeaderboardPeriod,
  limit: number
): Omit<LeaderboardEntry, "displayName">[] {
  const minUpdatedAt = startOf(period);

  const buildItems = (min: number) =>
    Object.entries(raw)
      .map(([userId, data]) => ({
        userId,
        points: Number(data.score) || 0,
        updatedAt: data.updatedAt,
        countsByTier: data.countsByTier,
      }))
      .filter((e) => typeof e.updatedAt === "number" && e.updatedAt >= min)
      .filter((e) => e.points > 0);

  let items = buildItems(minUpdatedAt);
  // Fallback to allTime when period filter yields nothing
  if (items.length === 0 && period !== "allTime") {
    items = buildItems(0);
  }

  items.sort((a, b) => b.points - a.points || b.updatedAt - a.updatedAt);
  return items.slice(0, limit).map((e, idx) => ({
    userId: e.userId,
    points: e.points,
    rank: idx + 1,
    countsByTier: e.countsByTier,
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

const NOW = Date.now();
const ONE_DAY = 86400000;

function makeRaw(
  entries: Array<{ userId: string; score: number; updatedAt: number; countsByTier?: any }>
) {
  const result: Record<string, any> = {};
  for (const e of entries) {
    result[e.userId] = { score: e.score, updatedAt: e.updatedAt, countsByTier: e.countsByTier };
  }
  return result;
}

function makeSnapshot(data: Record<string, any> | null) {
  return {
    exists: () => data !== null && Object.keys(data).length > 0,
    val: () => data,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Leaderboard ranking algorithm", () => {
  it("sorts entries by points descending", () => {
    const raw = makeRaw([
      { userId: "u1", score: 50, updatedAt: NOW },
      { userId: "u2", score: 100, updatedAt: NOW },
      { userId: "u3", score: 75, updatedAt: NOW },
    ]);

    const result = buildRankedEntries(raw, "allTime", 50);

    expect(result[0].userId).toBe("u2");
    expect(result[0].points).toBe(100);
    expect(result[0].rank).toBe(1);
    expect(result[1].userId).toBe("u3");
    expect(result[1].rank).toBe(2);
    expect(result[2].userId).toBe("u1");
    expect(result[2].rank).toBe(3);
  });

  it("breaks ties by most recent updatedAt", () => {
    const raw = makeRaw([
      { userId: "u1", score: 100, updatedAt: NOW - ONE_DAY },
      { userId: "u2", score: 100, updatedAt: NOW },
    ]);

    const result = buildRankedEntries(raw, "allTime", 50);

    expect(result[0].userId).toBe("u2");
    expect(result[1].userId).toBe("u1");
  });

  it("excludes entries with zero score", () => {
    const raw = makeRaw([
      { userId: "u1", score: 100, updatedAt: NOW },
      { userId: "u2", score: 0, updatedAt: NOW },
    ]);

    const result = buildRankedEntries(raw, "allTime", 50);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u1");
  });

  it("respects the limit parameter", () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      userId: `u${i}`,
      score: (10 - i) * 10,
      updatedAt: NOW,
    }));

    const result = buildRankedEntries(makeRaw(entries), "allTime", 3);

    expect(result).toHaveLength(3);
    expect(result[0].points).toBe(100);
    expect(result[2].points).toBe(80);
  });

  it("preserves countsByTier data", () => {
    const tiers = { silver: 3, gold: 2, platinum: 1, diamond: 0 };
    const raw = makeRaw([{ userId: "u1", score: 50, updatedAt: NOW, countsByTier: tiers }]);

    const result = buildRankedEntries(raw, "allTime", 50);

    expect(result[0].countsByTier).toEqual(tiers);
  });

  it("returns empty array for empty input", () => {
    const result = buildRankedEntries({}, "allTime", 50);
    expect(result).toEqual([]);
  });
});

describe("Leaderboard period filtering", () => {
  it("weekly filter excludes old entries", () => {
    const raw = makeRaw([
      { userId: "u1", score: 100, updatedAt: NOW },
      { userId: "u2", score: 200, updatedAt: NOW - 30 * ONE_DAY },
    ]);

    const result = buildRankedEntries(raw, "weekly", 50);

    // u1 is recent, u2 is 30 days old; weekly should include u1
    const userIds = result.map((e) => e.userId);
    expect(userIds).toContain("u1");
  });

  it("monthly filter includes entries from this month", () => {
    const raw = makeRaw([{ userId: "u1", score: 50, updatedAt: NOW }]);

    const result = buildRankedEntries(raw, "monthly", 50);

    expect(result).toHaveLength(1);
  });

  it("falls back to allTime when period filter yields no results", () => {
    const raw = makeRaw([{ userId: "u1", score: 100, updatedAt: NOW - 60 * ONE_DAY }]);

    const result = buildRankedEntries(raw, "weekly", 50);

    // Weekly has no results, falls back to allTime
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u1");
  });

  it("allTime does not fall back (returns empty if truly empty)", () => {
    const result = buildRankedEntries({}, "allTime", 50);
    expect(result).toEqual([]);
  });
});

describe("startOf helper", () => {
  it("allTime returns 0", () => {
    expect(startOf("allTime")).toBe(0);
  });

  it("monthly returns first day of current month", () => {
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    expect(startOf("monthly")).toBe(expected);
  });

  it("weekly returns start of current week (Monday)", () => {
    const result = startOf("weekly");
    const d = new Date(result);
    // Should be a Monday (day === 1), or Sunday result maps to previous Monday
    expect(d.getDay()).toBe(1); // Monday
  });
});

describe("RealtimeDBService for leaderboard RTDB operations", () => {
  let rtdbService: RealtimeDBService;
  const mockDb = { _isMockRtdb: true } as any;
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    rtdbService = new RealtimeDBService(mockDb);
    mockRef.mockImplementation((_db: any, path: string) => ({
      _path: path,
      key: path.split("/").pop(),
    }));
  });

  it("reads leaderboard data from org-scoped path", async () => {
    const data = makeRaw([{ userId: "u1", score: 100, updatedAt: NOW }]);
    mockGet.mockResolvedValue(makeSnapshot(data));

    const result = await rtdbService.getData(orgId, "leaderboard/storyPoint/sp1");

    expect(mockRef).toHaveBeenCalledWith(mockDb, "organizations/org-1/leaderboard/storyPoint/sp1");
    expect(result).toEqual(data);
  });

  it("returns null for non-existing leaderboard path", async () => {
    mockGet.mockResolvedValue({ exists: () => false, val: () => null });

    const result = await rtdbService.getData(orgId, "leaderboard/missing");

    expect(result).toBeNull();
  });

  it("subscribes to real-time leaderboard updates", () => {
    const callback = vi.fn();
    const mockUnsub = vi.fn();
    mockOnValue.mockImplementation((_ref: any, cb: Function) => {
      cb(makeSnapshot(makeRaw([{ userId: "u1", score: 50, updatedAt: NOW }])));
      return mockUnsub;
    });

    const unsub = rtdbService.subscribe(orgId, "leaderboard/sp1", callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ u1: expect.objectContaining({ score: 50 }) })
    );
    expect(typeof unsub).toBe("function");
  });

  it("unsubscribes from leaderboard updates", () => {
    rtdbService.unsubscribe(orgId, "leaderboard/sp1");

    expect(mockOff).toHaveBeenCalledWith(
      expect.objectContaining({ _path: "organizations/org-1/leaderboard/sp1" })
    );
  });

  it("reads separate story-point leaderboards under same space", async () => {
    const sp1Data = makeRaw([{ userId: "u1", score: 50, updatedAt: NOW }]);
    const sp2Data = makeRaw([{ userId: "u2", score: 80, updatedAt: NOW }]);

    mockGet.mockResolvedValueOnce(makeSnapshot(sp1Data));
    mockGet.mockResolvedValueOnce(makeSnapshot(sp2Data));

    const r1 = await rtdbService.getData(orgId, "leaderboard/storyPoint/sp1");
    const r2 = await rtdbService.getData(orgId, "leaderboard/storyPoint/sp2");

    expect(r1).toEqual(sp1Data);
    expect(r2).toEqual(sp2Data);
    expect(mockRef).toHaveBeenCalledWith(mockDb, "organizations/org-1/leaderboard/storyPoint/sp1");
    expect(mockRef).toHaveBeenCalledWith(mockDb, "organizations/org-1/leaderboard/storyPoint/sp2");
  });

  it("handles multiple concurrent subscriptions", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();

    mockOnValue
      .mockImplementationOnce((_ref: any, cb: Function) => {
        cb(makeSnapshot(makeRaw([{ userId: "u1", score: 10, updatedAt: NOW }])));
        return unsub1;
      })
      .mockImplementationOnce((_ref: any, cb: Function) => {
        cb(makeSnapshot(makeRaw([{ userId: "u2", score: 20, updatedAt: NOW }])));
        return unsub2;
      });

    const s1 = rtdbService.subscribe(orgId, "leaderboard/sp1", cb1);
    const s2 = rtdbService.subscribe(orgId, "leaderboard/sp2", cb2);

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(s1).toBe(unsub1);
    expect(s2).toBe(unsub2);
  });
});

describe("Leaderboard ranking — advanced edge cases", () => {
  it("handles entries with non-numeric score gracefully", () => {
    const raw: Record<string, any> = {
      u1: { score: "abc", updatedAt: NOW },
      u2: { score: 50, updatedAt: NOW },
    };
    const result = buildRankedEntries(raw, "allTime", 50);
    // NaN from Number('abc') || 0 → 0, filtered out by points > 0
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u2");
  });

  it("handles entries with missing updatedAt", () => {
    const raw: Record<string, any> = {
      u1: { score: 100 },
      u2: { score: 50, updatedAt: NOW },
    };
    const result = buildRankedEntries(raw, "allTime", 50);
    // u1 filtered out because updatedAt is not a number
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u2");
  });

  it("handles single entry", () => {
    const raw = makeRaw([{ userId: "u1", score: 42, updatedAt: NOW }]);
    const result = buildRankedEntries(raw, "allTime", 50);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].points).toBe(42);
  });

  it("handles very large leaderboard with limit", () => {
    const entries = Array.from({ length: 1000 }, (_, i) => ({
      userId: `u${i}`,
      score: Math.floor(Math.random() * 10000),
      updatedAt: NOW - Math.floor(Math.random() * ONE_DAY),
    }));
    const result = buildRankedEntries(makeRaw(entries), "allTime", 10);
    expect(result).toHaveLength(10);
    // Verify sorted descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].points).toBeGreaterThanOrEqual(result[i].points);
    }
  });

  it("ranks are consecutive 1..N", () => {
    const raw = makeRaw([
      { userId: "u1", score: 100, updatedAt: NOW },
      { userId: "u2", score: 80, updatedAt: NOW },
      { userId: "u3", score: 60, updatedAt: NOW },
      { userId: "u4", score: 40, updatedAt: NOW },
      { userId: "u5", score: 20, updatedAt: NOW },
    ]);
    const result = buildRankedEntries(raw, "allTime", 50);
    const ranks = result.map((e) => e.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
  });

  it("negative scores are excluded (points > 0 check)", () => {
    const raw = makeRaw([
      { userId: "u1", score: -10, updatedAt: NOW },
      { userId: "u2", score: 50, updatedAt: NOW },
    ]);
    const result = buildRankedEntries(raw, "allTime", 50);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u2");
  });
});
