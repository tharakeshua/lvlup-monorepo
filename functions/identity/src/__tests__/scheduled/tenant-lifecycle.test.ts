import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockCollectionAdd = vi.fn().mockResolvedValue({ id: "log-id" });
const mockCollectionGet = vi.fn();
const mockCollectionWhere = vi.fn();

// Stable "now" for deterministic time comparisons
const NOW = new Date("2026-03-01T00:00:00Z");

const stableDb: any = {
  collection: vi.fn((path: string) => ({
    where: mockCollectionWhere,
    get: mockCollectionGet,
    add: mockCollectionAdd,
  })),
};

mockCollectionWhere.mockReturnValue({
  where: mockCollectionWhere,
  get: mockCollectionGet,
});

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  fsFn.Timestamp = {
    now: () => ({ toDate: () => new Date("2026-03-01T00:00:00Z") }),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { tenantLifecycleCheck } from "../../scheduled/tenant-lifecycle";
import { logger } from "firebase-functions/v2";

const handler = tenantLifecycleCheck as any;

// B8: writes now emit canonical ISO strings, not a serverTimestamp sentinel.
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

/**
 * A faithful Firestore Timestamp mock (carries seconds/nanoseconds like the real
 * admin SDK) — the B8 read path collapses it through domain `toTimestamp()`,
 * which matches on the structural shape, NOT a `.toDate()` duck-type.
 */
function fsTs(date: Date) {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1e6,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

function makeTrialDoc(id: string, expiresAt: Date | null, opts: Record<string, unknown> = {}) {
  return {
    id,
    ref: { update: mockDocUpdate },
    data: () => ({
      status: "trial",
      subscription: expiresAt ? { expiresAt: fsTs(expiresAt) } : undefined,
      ...opts,
    }),
  };
}

function makeExpiredDoc(
  id: string,
  expiresAt: Date,
  updatedAt: Date | null,
  opts: Record<string, unknown> = {}
) {
  return {
    id,
    ref: { update: mockDocUpdate },
    data: () => ({
      status: "expired",
      name: opts.name ?? `Tenant ${id}`,
      subscription: { expiresAt: fsTs(expiresAt) },
      updatedAt: updatedAt ? fsTs(updatedAt) : undefined,
      ...opts,
    }),
  };
}

describe("tenantLifecycleCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Source now reads wall-clock via Date.now(); freeze it for deterministic math.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockCollectionWhere.mockReturnValue({
      where: mockCollectionWhere,
      get: mockCollectionGet,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should expire a trial tenant past expiresAt", async () => {
    const pastDate = new Date("2026-02-15T00:00:00Z");
    const trialDoc = makeTrialDoc("t1", pastDate);

    // Step 1: trial tenants query
    mockCollectionGet.mockResolvedValueOnce({ docs: [trialDoc] });
    // Step 2: expired tenants query
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: "expired",
      updatedAt: ISO,
    });
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trial_expired",
        tenantId: "t1",
        actorId: "system",
      })
    );
  });

  it("should skip a trial tenant before expiresAt", async () => {
    const futureDate = new Date("2026-04-01T00:00:00Z");
    const trialDoc = makeTrialDoc("t1", futureDate);

    mockCollectionGet.mockResolvedValueOnce({ docs: [trialDoc] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    expect(mockDocUpdate).not.toHaveBeenCalled();
    expect(mockCollectionAdd).not.toHaveBeenCalled();
  });

  it("should skip a trial tenant without expiresAt", async () => {
    const trialDoc = makeTrialDoc("t1", null);

    mockCollectionGet.mockResolvedValueOnce({ docs: [trialDoc] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    expect(mockDocUpdate).not.toHaveBeenCalled();
    expect(mockCollectionAdd).not.toHaveBeenCalled();
  });

  it("should write audit log on trial expiry", async () => {
    const pastDate = new Date("2026-02-20T00:00:00Z");
    const trialDoc = makeTrialDoc("t1", pastDate);

    mockCollectionGet.mockResolvedValueOnce({ docs: [trialDoc] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    // Verify audit log written to the correct collection
    expect(stableDb.collection).toHaveBeenCalledWith("tenants/t1/auditLog");
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trial_expired",
        tenantId: "t1",
        actorId: "system",
        details: expect.objectContaining({
          previousStatus: "trial",
        }),
        createdAt: ISO,
      })
    );
  });

  it("should flag long-expired tenant with no recent activity for review", async () => {
    // Expired 60 days ago, no recent activity
    const expiredDate = new Date("2025-12-30T00:00:00Z");
    const expiredDoc = makeExpiredDoc("t2", expiredDate, null, { name: "Old School" });

    mockCollectionGet.mockResolvedValueOnce({ docs: [] }); // No trials
    mockCollectionGet.mockResolvedValueOnce({ docs: [expiredDoc] });

    await handler();

    expect(stableDb.collection).toHaveBeenCalledWith("platformActivityLog");
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant_review_needed",
        actorId: "system",
        tenantId: "t2",
        metadata: expect.objectContaining({
          tenantName: "Old School",
          status: "expired",
        }),
        createdAt: ISO,
      })
    );
  });

  it("should skip expired tenant with recent activity", async () => {
    // Expired 60 days ago but has recent activity (updated 10 days ago)
    const expiredDate = new Date("2025-12-30T00:00:00Z");
    const recentUpdate = new Date("2026-02-20T00:00:00Z");
    const expiredDoc = makeExpiredDoc("t2", expiredDate, recentUpdate);

    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [expiredDoc] });

    await handler();

    // Should not flag for review — recent activity within 30 days
    expect(mockCollectionAdd).not.toHaveBeenCalled();
  });

  it("should skip expired tenant not yet 30 days expired", async () => {
    // Expired only 10 days ago
    const recentExpiry = new Date("2026-02-20T00:00:00Z");
    const expiredDoc = makeExpiredDoc("t2", recentExpiry, null);

    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [expiredDoc] });

    await handler();

    expect(mockCollectionAdd).not.toHaveBeenCalled();
  });

  it("should handle multiple tenants in both steps", async () => {
    const pastDate1 = new Date("2026-02-10T00:00:00Z");
    const pastDate2 = new Date("2026-02-12T00:00:00Z");
    const trialDoc1 = makeTrialDoc("t1", pastDate1);
    const trialDoc2 = makeTrialDoc("t2", pastDate2);

    const longExpired = new Date("2025-12-01T00:00:00Z");
    const expDoc1 = makeExpiredDoc("t3", longExpired, null);
    const expDoc2 = makeExpiredDoc("t4", longExpired, null);

    mockCollectionGet.mockResolvedValueOnce({ docs: [trialDoc1, trialDoc2] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [expDoc1, expDoc2] });

    await handler();

    // 2 trial expirations (update + audit log each)
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
    // 2 audit logs + 2 platform activity logs = 4 collection adds
    expect(mockCollectionAdd).toHaveBeenCalledTimes(4);
    expect(logger.info).toHaveBeenCalledWith(
      "Tenant lifecycle check: 2 trials expired, 2 flagged for review"
    );
  });

  it("should handle empty results in both steps", async () => {
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    expect(mockDocUpdate).not.toHaveBeenCalled();
    expect(mockCollectionAdd).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Tenant lifecycle check: 0 trials expired, 0 flagged for review"
    );
  });

  it("should log summary with correct counts", async () => {
    const pastDate = new Date("2026-02-01T00:00:00Z");
    const trialDoc = makeTrialDoc("t1", pastDate);

    mockCollectionGet.mockResolvedValueOnce({ docs: [trialDoc] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    expect(logger.info).toHaveBeenCalledWith(
      "Tenant lifecycle check: 1 trials expired, 0 flagged for review"
    );
  });

  it("B8 round-trip: handles Firestore-Timestamp and ISO-string expiresAt identically", async () => {
    const pastDate = new Date("2026-02-15T00:00:00Z");

    // Same instant, two at-rest encodings: a Firestore Timestamp object (pre-B8
    // doc) and a canonical ISO string (post-B8 doc). Both must expire.
    const tsDoc = {
      id: "ts-tenant",
      ref: { update: mockDocUpdate },
      data: () => ({ status: "trial", subscription: { expiresAt: fsTs(pastDate) } }),
    };
    const isoDoc = {
      id: "iso-tenant",
      ref: { update: mockDocUpdate },
      data: () => ({ status: "trial", subscription: { expiresAt: pastDate.toISOString() } }),
    };

    mockCollectionGet.mockResolvedValueOnce({ docs: [tsDoc, isoDoc] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    await handler();

    // Both shapes expired -> two status updates, two audit-log writes.
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
    expect(mockDocUpdate).toHaveBeenCalledWith({ status: "expired", updatedAt: ISO });
    expect(mockCollectionAdd).toHaveBeenCalledTimes(2);
    // The passed-through expiresAt is canonicalized to an ISO string at rest.
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trial_expired",
        details: expect.objectContaining({ expiresAt: pastDate.toISOString() }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Tenant lifecycle check: 2 trials expired, 0 flagged for review"
    );
  });
});
