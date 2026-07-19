/**
 * Tests for enforceRateLimit — Firestore-backed sliding window rate limiter.
 *
 * Covers:
 *  1. Creates new rate limit doc for first request
 *  2. Allows requests within limit
 *  3. Throws resource-exhausted when limit exceeded
 *  4. Filters expired timestamps (outside 1-minute window)
 *  5. Updates timestamps array on each request
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──────────────────────────────────────────────────────────

let storedDoc: Record<string, any> | null = null;

const mockGet = vi.fn().mockImplementation(() => ({
  data: () => storedDoc,
}));
const mockSet = vi.fn().mockImplementation((_ref: any, data: any) => {
  storedDoc = data;
});
const mockUpdate = vi.fn().mockImplementation((_ref: any, data: any) => {
  storedDoc = { ...storedDoc, ...data };
});

const mockDocRef = { id: "user1_generate_report" };

const mockRunTransaction = vi.fn().mockImplementation(async (cb: Function) => {
  const tx = {
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
  };
  return cb(tx);
});

const mockDoc = vi.fn(() => mockDocRef);

vi.mock("firebase-admin", () => {
  const fsFn: any = () => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  });
  fsFn.FieldValue = { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") };
  return {
    default: { firestore: fsFn },
    firestore: fsFn,
  };
});

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") },
}));

vi.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// ── Import under test (after mocks) ─────────────────────────────────────
// Import from the source TS file directly to ensure our firebase-admin mock applies.
// The re-export through @levelup/functions-shared resolves to compiled CJS which
// bypasses vitest's module mocking.
import { enforceRateLimit } from "../../../shared/src/rate-limit";

// ── Tests ────────────────────────────────────────────────────────────────

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedDoc = null;
  });

  it("creates a new rate limit doc for first request", async () => {
    // No existing doc
    storedDoc = null;

    await enforceRateLimit("tenant-1", "user-1", "generate_report", 5);

    expect(mockDoc).toHaveBeenCalledWith("tenants/tenant-1/rateLimits/user-1_generate_report");
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);

    const setArgs = mockSet.mock.calls[0];
    const data = setArgs[1];
    expect(data.userId).toBe("user-1");
    expect(data.actionType).toBe("generate_report");
    expect(data.timestamps).toHaveLength(1);
    expect(data.updatedAt).toBe("SERVER_TIMESTAMP");
  });

  it("allows requests within the rate limit", async () => {
    const now = Date.now();
    storedDoc = {
      userId: "user-1",
      actionType: "generate_report",
      timestamps: [now - 10000, now - 5000], // 2 requests in window
    };

    // max 5 per minute — 2 existing + 1 new = 3, under limit
    await expect(
      enforceRateLimit("tenant-1", "user-1", "generate_report", 5)
    ).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][1];
    expect(updateData.timestamps).toHaveLength(3);
  });

  it("throws resource-exhausted when rate limit is exceeded", async () => {
    const now = Date.now();
    storedDoc = {
      userId: "user-1",
      actionType: "generate_report",
      timestamps: [now - 40000, now - 30000, now - 20000, now - 10000, now - 5000], // 5 requests within the last minute
    };

    await expect(enforceRateLimit("tenant-1", "user-1", "generate_report", 5)).rejects.toThrow(
      "Rate limit exceeded"
    );

    try {
      await enforceRateLimit("tenant-1", "user-1", "generate_report", 5);
    } catch (err: any) {
      expect(err.code).toBe("resource-exhausted");
      expect(err.message).toContain("max 5");
      expect(err.message).toContain("generate_report");
    }
  });

  it("filters out expired timestamps outside the 1-minute window", async () => {
    const now = Date.now();
    storedDoc = {
      userId: "user-1",
      actionType: "generate_report",
      timestamps: [
        now - 120000, // 2 minutes ago — expired
        now - 90000, // 1.5 minutes ago — expired
        now - 30000, // 30 seconds ago — valid
      ],
    };

    // Only 1 valid timestamp + 1 new = 2, under limit of 5
    await expect(
      enforceRateLimit("tenant-1", "user-1", "generate_report", 5)
    ).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][1];
    // Should have filtered to 1 valid + 1 new = 2
    expect(updateData.timestamps).toHaveLength(2);
  });

  it("updates the timestamps array on each allowed request", async () => {
    const now = Date.now();
    const existingTimestamp = now - 15000;
    storedDoc = {
      userId: "user-1",
      actionType: "generate_report",
      timestamps: [existingTimestamp],
    };

    await enforceRateLimit("tenant-1", "user-1", "generate_report", 10);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][1];
    expect(updateData.timestamps).toContain(existingTimestamp);
    expect(updateData.timestamps).toHaveLength(2);
    // The new timestamp should be roughly now
    const newTimestamp = updateData.timestamps.find((t: number) => t !== existingTimestamp);
    expect(newTimestamp).toBeGreaterThanOrEqual(now - 100);
    expect(updateData.updatedAt).toBe("SERVER_TIMESTAMP");
  });

  it("constructs the correct Firestore path from tenantId, userId, and actionType", async () => {
    storedDoc = null;

    await enforceRateLimit("my-tenant", "my-user", "some_action", 3);

    expect(mockDoc).toHaveBeenCalledWith("tenants/my-tenant/rateLimits/my-user_some_action");
  });

  it("handles maxPerMinute of 1 (allows first, blocks second)", async () => {
    const now = Date.now();

    // First request — no existing doc
    storedDoc = null;
    await expect(enforceRateLimit("tenant-1", "user-1", "action", 1)).resolves.toBeUndefined();

    // Second request — 1 timestamp exists within window
    storedDoc = {
      userId: "user-1",
      actionType: "action",
      timestamps: [now - 1000],
    };
    await expect(enforceRateLimit("tenant-1", "user-1", "action", 1)).rejects.toThrow(
      "Rate limit exceeded"
    );
  });
});
