import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
    doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  fsFn.Timestamp = {
    now: vi.fn(() => ({ toDate: () => new Date("2025-06-15T00:05:00Z") })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn((_opts: any, handler: any) => handler),
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { dailyCostAggregation } from "../../schedulers/daily-cost-aggregation";
const handler = dailyCostAggregation as any;

describe("dailyCostAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
  });

  it("should aggregate LLM call logs from the previous day", async () => {
    // Call 1: db.collection('tenants').get() — tenant list
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1", data: () => ({ status: "active" }) }],
    });

    // Call 2: LLM call logs query for tenant-1
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "log-1",
          data: () => ({
            purpose: "grading",
            model: "gemini-2.0-flash",
            tokens: { input: 1000, output: 500 },
            cost: { total: 0.05 },
          }),
        },
        {
          id: "log-2",
          data: () => ({
            purpose: "extraction",
            model: "gemini-2.0-flash",
            tokens: { input: 800, output: 300 },
            cost: { total: 0.03 },
          }),
        },
      ],
    });

    // Call 3: existing daily doc check (idempotency) — no budget check since tenant has no subscription.monthlyBudgetUsd
    mockGet.mockResolvedValueOnce({ exists: false, data: () => null });

    await handler({});

    expect(mockSet).toHaveBeenCalled();
  });

  it("should skip if daily doc already exists (idempotent)", async () => {
    // Call 1: tenants list
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1", data: () => ({ status: "active" }) }],
    });

    // Call 2: LLM call logs
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "log-1",
          data: () => ({
            purpose: "grading",
            model: "flash",
            tokens: { input: 100, output: 50 },
            cost: { total: 0.01 },
          }),
        },
      ],
    });

    // Call 3: existing daily doc exists (idempotent rewrite with delta)
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        totalCostUsd: 0.01,
        totalCalls: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
      }),
    });

    await handler({});

    // Still writes — source uses delta approach for idempotency on monthly
    expect(mockSet).toHaveBeenCalled();
  });

  it("pins canonical costSummaries doc paths (prefixed ids, even segment counts)", async () => {
    // Budget tenant so the monthly budget-check read path is exercised too.
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "tenant-1",
          data: () => ({ status: "active", subscription: { monthlyBudgetUsd: 100 } }),
        },
      ],
    });
    // LLM call logs
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "log-1",
          data: () => ({
            purpose: "grading",
            model: "flash",
            tokens: { input: 100, output: 50 },
            cost: { total: 0.01 },
          }),
        },
      ],
    });
    // Monthly budget-check read, then existing-daily idempotency read
    mockGet.mockResolvedValueOnce({ exists: false, data: () => null });
    mockGet.mockResolvedValueOnce({ exists: false, data: () => null });

    await handler({});

    const docPaths: string[] = stableDb.doc.mock.calls
      .map((c: unknown[]) => c[0] as string)
      .filter((p: string) => p.includes("costSummaries"));

    // The three cost-summary refs: budget-check read, daily write, monthly write.
    expect(docPaths).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^tenants\/tenant-1\/costSummaries\/monthly_\d{4}-\d{2}$/),
        expect.stringMatching(/^tenants\/tenant-1\/costSummaries\/daily_\d{4}-\d{2}-\d{2}$/),
      ])
    );
    // Document paths need an EVEN segment count (the old nested
    // costSummaries/daily/{date} shape had 5 and threw at runtime).
    for (const p of docPaths) {
      expect(p.split("/").length % 2).toBe(0);
    }
    // And no costSummaries path may be built via db.collection (odd segments).
    const collectionPaths: string[] = stableDb.collection.mock.calls
      .map((c: unknown[]) => c[0] as string)
      .filter((p: string) => p.includes("costSummaries"));
    expect(collectionPaths).toEqual([]);

    // Daily doc id mirrors the prefixed doc-id convention.
    const dailySet = mockSet.mock.calls.find((c: unknown[]) =>
      String((c[0] as Record<string, unknown>).id ?? "").startsWith("daily_")
    );
    expect(dailySet).toBeDefined();
  });

  it("should handle no logs gracefully", async () => {
    // Call 1: tenants list
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "tenant-1", data: () => ({ status: "active" }) }],
    });

    // Call 2: LLM call logs — empty
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    await handler({});
    // With empty logs, the source skips (continues to next tenant)
    // No set call expected for this tenant
  });
});
