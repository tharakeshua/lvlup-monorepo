import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockDocRef = vi.fn();

const stableDb: any = {
  doc: mockDocRef,
  batch: vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
};

mockDocRef.mockImplementation((path: string) => ({ path }));

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    arrayRemove: vi.fn((...args: any[]) => ({ _type: "arrayRemove", values: args })),
    increment: vi.fn((n: number) => ({ _type: "increment", value: n })),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

// Source imports FieldValue from the `firebase-admin/firestore` submodule, so it
// must be mocked here (the `firebase-admin` default-export mock above is unused).
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayRemove: vi.fn((...args: any[]) => ({ _type: "arrayRemove", values: args })),
    increment: vi.fn((n: number) => ({ _type: "increment", value: n })),
  },
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { onStudentArchived } from "../../triggers/on-student-deleted";
import { logger } from "firebase-functions/v2";

const handler = onStudentArchived as any;

// B8: writes now emit canonical ISO strings, not a serverTimestamp sentinel.
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

function makeEvent(
  beforeData: Record<string, unknown> | undefined,
  afterData: Record<string, unknown> | undefined,
  params: Record<string, string> = { tenantId: "tenant-1", studentId: "student-1" }
) {
  return {
    data:
      beforeData && afterData
        ? {
            before: { data: () => beforeData },
            after: { data: () => afterData },
          }
        : undefined,
    params,
  };
}

describe("onStudentArchived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocRef.mockImplementation((path: string) => ({ path }));
  });

  it("should no-op when event data is missing", async () => {
    const event = { data: undefined, params: { tenantId: "tenant-1", studentId: "student-1" } };
    await handler(event);
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should no-op when before data is undefined", async () => {
    const event = {
      data: {
        before: { data: () => undefined },
        after: { data: () => ({ status: "archived" }) },
      },
      params: { tenantId: "tenant-1", studentId: "student-1" },
    };
    await handler(event);
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should no-op when before status was already archived", async () => {
    await handler(
      makeEvent(
        { status: "archived", parentIds: ["p1"], classIds: ["c1"] },
        { status: "archived", parentIds: ["p1"], classIds: ["c1"] }
      )
    );
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should no-op when after status is not archived", async () => {
    await handler(
      makeEvent(
        { status: "active", parentIds: ["p1"], classIds: ["c1"] },
        { status: "active", parentIds: ["p1"], classIds: ["c1"] }
      )
    );
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should remove studentId from parent childStudentIds", async () => {
    await handler(
      makeEvent(
        { status: "active", parentIds: ["p1", "p2"], classIds: [] },
        { status: "archived", parentIds: ["p1", "p2"], classIds: [] }
      )
    );

    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/parents/p1");
    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/parents/p2");
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "tenants/tenant-1/parents/p1" }),
      expect.objectContaining({
        childStudentIds: expect.objectContaining({ _type: "arrayRemove", values: ["student-1"] }),
        updatedAt: ISO,
      })
    );
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("should remove studentId from class studentIds and decrement studentCount", async () => {
    await handler(
      makeEvent(
        { status: "active", parentIds: [], classIds: ["c1", "c2"] },
        { status: "archived", parentIds: [], classIds: ["c1", "c2"] }
      )
    );

    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/classes/c1");
    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/classes/c2");
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "tenants/tenant-1/classes/c1" }),
      expect.objectContaining({
        studentIds: expect.objectContaining({ _type: "arrayRemove", values: ["student-1"] }),
        studentCount: expect.objectContaining({ _type: "increment", value: -1 }),
        updatedAt: ISO,
      })
    );
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("should handle empty parentIds and classIds", async () => {
    await handler(
      makeEvent(
        { status: "active", parentIds: [], classIds: [] },
        { status: "archived", parentIds: [], classIds: [] }
      )
    );

    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("0 parents, 0 classes"));
  });

  it("should batch operations in chunks of 450", async () => {
    const parentIds = Array.from({ length: 250 }, (_, i) => `p-${i}`);
    const classIds = Array.from({ length: 250 }, (_, i) => `c-${i}`);

    await handler(
      makeEvent(
        { status: "active", parentIds, classIds },
        { status: "archived", parentIds, classIds }
      )
    );

    // Total ops = 500 => two batches: 450 + 50
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(500);
  });

  it("should catch and log errors", async () => {
    const error = new Error("Firestore write failed");
    stableDb.batch.mockImplementationOnce(() => {
      throw error;
    });

    await handler(
      makeEvent(
        { status: "active", parentIds: ["p1"], classIds: [] },
        { status: "archived", parentIds: ["p1"], classIds: [] }
      )
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to clean up archived student references",
      error
    );
  });
});
