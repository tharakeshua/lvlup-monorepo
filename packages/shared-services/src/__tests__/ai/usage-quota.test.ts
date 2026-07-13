import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock firebase-admin
// ---------------------------------------------------------------------------
const mockDocGet = vi.fn();
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockCollectionGet = vi.fn();
const mockWhere = vi.fn().mockReturnThis();

const mockDoc = vi.fn(() => ({
  get: mockDocGet,
  set: mockDocSet,
}));

const mockCollection = vi.fn(() => ({
  where: mockWhere,
  get: mockCollectionGet,
}));

// Capture the chain: collection().where().where().get()
mockWhere.mockReturnValue({
  where: mockWhere,
  get: mockCollectionGet,
});

vi.mock("firebase-admin", () => ({
  default: {
    firestore: Object.assign(
      vi.fn(() => ({
        doc: mockDoc,
        collection: mockCollection,
      })),
      {
        FieldValue: {
          increment: vi.fn((n: number) => ({ _increment: n })),
          serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
        },
      }
    ),
  },
  firestore: Object.assign(
    vi.fn(() => ({
      doc: mockDoc,
      collection: mockCollection,
    })),
    {
      FieldValue: {
        increment: vi.fn((n: number) => ({ _increment: n })),
        serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
      },
    }
  ),
}));

import { checkUsageQuota, incrementDailyCostSummary } from "../../ai/usage-quota";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupTenantDoc(data: Record<string, unknown> | undefined) {
  mockDocGet.mockResolvedValue({
    exists: data !== undefined,
    data: () => data,
  });
}

function setupCostSummaries(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  mockCollectionGet.mockResolvedValue({
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("usage-quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no quota config, no summaries
    setupTenantDoc({});
    setupCostSummaries([]);
  });

  // ── checkUsageQuota ────────────────────────────────────────────────
  describe("checkUsageQuota", () => {
    it("allows when budget is unlimited (0)", async () => {
      setupTenantDoc({ settings: { usageQuota: { monthlyBudgetUsd: 0, dailyCallLimit: 0 } } });
      setupCostSummaries([]);

      const result = await checkUsageQuota("tenant-1");

      expect(result.allowed).toBe(true);
      expect(result.warningMessage).toBeUndefined();
    });

    it("allows when under budget", async () => {
      setupTenantDoc({
        settings: {
          usageQuota: { monthlyBudgetUsd: 100, dailyCallLimit: 0, warningThresholdPercent: 80 },
        },
      });
      setupCostSummaries([{ id: "2026-03-01", data: { totalCostUsd: 50, totalCalls: 100 } }]);

      const result = await checkUsageQuota("tenant-1");

      expect(result.allowed).toBe(true);
    });

    it("blocks at 100% budget", async () => {
      setupTenantDoc({
        settings: {
          usageQuota: { monthlyBudgetUsd: 100, dailyCallLimit: 0, warningThresholdPercent: 80 },
        },
      });
      setupCostSummaries([{ id: "2026-03-01", data: { totalCostUsd: 100, totalCalls: 500 } }]);

      const result = await checkUsageQuota("tenant-1");

      expect(result.allowed).toBe(false);
      expect(result.warningMessage).toContain("quota reached");
    });

    it("warns at 80% budget", async () => {
      setupTenantDoc({
        settings: {
          usageQuota: { monthlyBudgetUsd: 100, dailyCallLimit: 0, warningThresholdPercent: 80 },
        },
      });
      setupCostSummaries([{ id: "2026-03-01", data: { totalCostUsd: 85, totalCalls: 200 } }]);

      const result = await checkUsageQuota("tenant-1");

      expect(result.allowed).toBe(true);
      expect(result.warningMessage).toContain("85%");
    });

    it("blocks at daily call limit", async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      setupTenantDoc({
        settings: {
          usageQuota: { monthlyBudgetUsd: 0, dailyCallLimit: 100, warningThresholdPercent: 80 },
        },
      });
      setupCostSummaries([{ id: today, data: { totalCostUsd: 5, totalCalls: 100 } }]);

      const result = await checkUsageQuota("tenant-1");

      expect(result.allowed).toBe(false);
      expect(result.warningMessage).toContain("Daily AI call limit");
    });

    it("handles missing tenant doc gracefully", async () => {
      setupTenantDoc(undefined);
      setupCostSummaries([]);

      // Should use defaults and not throw
      const result = await checkUsageQuota("tenant-missing");

      expect(result.allowed).toBe(true);
    });

    it("handles no cost summaries", async () => {
      setupTenantDoc({
        settings: {
          usageQuota: { monthlyBudgetUsd: 100, dailyCallLimit: 0, warningThresholdPercent: 80 },
        },
      });
      setupCostSummaries([]);

      const result = await checkUsageQuota("tenant-1");

      expect(result.allowed).toBe(true);
      expect(result.currentSpendUsd).toBe(0);
      expect(result.currentCalls).toBe(0);
    });
  });

  // ── incrementDailyCostSummary ──────────────────────────────────────
  describe("incrementDailyCostSummary", () => {
    it("writes to correct doc path", async () => {
      await incrementDailyCostSummary("tenant-1", 0.05, 100, 50, "grading", "gemini-2.5-flash");

      expect(mockDoc).toHaveBeenCalledWith(
        expect.stringMatching(/^tenants\/tenant-1\/costSummaries\/\d{4}-\d{2}-\d{2}$/)
      );
    });

    it("uses increment for atomic updates", async () => {
      await incrementDailyCostSummary("tenant-1", 0.05, 100, 50, "grading");

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCalls: expect.objectContaining({ _increment: 1 }),
          totalCostUsd: expect.objectContaining({ _increment: 0.05 }),
          totalInputTokens: expect.objectContaining({ _increment: 100 }),
          totalOutputTokens: expect.objectContaining({ _increment: 50 }),
        }),
        { merge: true }
      );
    });

    it("sanitizes model name (replaces dots and slashes)", async () => {
      await incrementDailyCostSummary("tenant-1", 0.05, 100, 50, "grading", "gemini/2.5-flash");

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          "byModel.gemini_2_5-flash.calls": expect.objectContaining({ _increment: 1 }),
        }),
        expect.any(Object)
      );
    });

    it("sets merge: true", async () => {
      await incrementDailyCostSummary("tenant-1", 0.05, 100, 50, "grading");

      expect(mockDocSet).toHaveBeenCalledWith(expect.any(Object), { merge: true });
    });
  });
});
