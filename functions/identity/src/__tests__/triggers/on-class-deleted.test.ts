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

// doc() returns a ref-like object with a predictable path
mockDocRef.mockImplementation((path: string) => ({ path }));

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    arrayRemove: vi.fn((...args: any[]) => ({ _type: "arrayRemove", values: args })),
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
  },
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { onClassArchived } from "../../triggers/on-class-deleted";
import { logger } from "firebase-functions/v2";

const handler = onClassArchived as any;

// B8: writes now emit canonical ISO strings, not a serverTimestamp sentinel.
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

function makeEvent(
  beforeData: Record<string, unknown> | undefined,
  afterData: Record<string, unknown> | undefined,
  params: Record<string, string> = { tenantId: "tenant-1", classId: "class-1" }
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

describe("onClassArchived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocRef.mockImplementation((path: string) => ({ path }));
  });

  it("should no-op when event data is missing", async () => {
    const event = { data: undefined, params: { tenantId: "tenant-1", classId: "class-1" } };
    await handler(event);
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should no-op when before data is undefined", async () => {
    const event = {
      data: {
        before: { data: () => undefined },
        after: { data: () => ({ status: "archived" }) },
      },
      params: { tenantId: "tenant-1", classId: "class-1" },
    };
    await handler(event);
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should no-op when before status was already archived", async () => {
    await handler(
      makeEvent(
        { status: "archived", studentIds: ["s1"], teacherIds: ["t1"] },
        { status: "archived", studentIds: ["s1"], teacherIds: ["t1"] }
      )
    );
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should no-op when after status is not archived", async () => {
    await handler(
      makeEvent(
        { status: "active", studentIds: ["s1"], teacherIds: ["t1"] },
        { status: "active", studentIds: ["s1"], teacherIds: ["t1"] }
      )
    );
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("should remove classId from student documents", async () => {
    await handler(
      makeEvent(
        { status: "active", studentIds: ["s1", "s2"], teacherIds: [] },
        { status: "archived", studentIds: ["s1", "s2"], teacherIds: [] }
      )
    );

    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/students/s1");
    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/students/s2");
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "tenants/tenant-1/students/s1" }),
      expect.objectContaining({
        classIds: expect.objectContaining({ _type: "arrayRemove", values: ["class-1"] }),
        updatedAt: ISO,
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("should remove classId from teacher documents", async () => {
    await handler(
      makeEvent(
        { status: "active", studentIds: [], teacherIds: ["t1", "t2"] },
        { status: "archived", studentIds: [], teacherIds: ["t1", "t2"] }
      )
    );

    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/teachers/t1");
    expect(mockDocRef).toHaveBeenCalledWith("tenants/tenant-1/teachers/t2");
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "tenants/tenant-1/teachers/t1" }),
      expect.objectContaining({
        classIds: expect.objectContaining({ _type: "arrayRemove", values: ["class-1"] }),
        updatedAt: ISO,
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("should handle empty studentIds and teacherIds", async () => {
    await handler(
      makeEvent(
        { status: "active", studentIds: [], teacherIds: [] },
        { status: "archived", studentIds: [], teacherIds: [] }
      )
    );

    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("0 students, 0 teachers"));
  });

  it("should batch refs in chunks of 450", async () => {
    const studentIds = Array.from({ length: 300 }, (_, i) => `s-${i}`);
    const teacherIds = Array.from({ length: 200 }, (_, i) => `t-${i}`);

    await handler(
      makeEvent(
        { status: "active", studentIds, teacherIds },
        { status: "archived", studentIds, teacherIds }
      )
    );

    // Total refs = 500 => two batches: 450 + 50
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
        { status: "active", studentIds: ["s1"], teacherIds: [] },
        { status: "archived", studentIds: ["s1"], teacherIds: [] }
      )
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to clean up archived class references",
      error
    );
  });
});
