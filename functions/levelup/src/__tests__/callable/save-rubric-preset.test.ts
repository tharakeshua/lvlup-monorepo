import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockDelete = vi.fn().mockResolvedValue({});
const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  id: "rubric-1",
};

const stableDb: any = {
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => ({ doc: vi.fn(() => mockDocRef) })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../utils/auth", () => ({
  assertAuth: vi.fn().mockReturnValue("user-1"),
  assertTeacherOrAdmin: vi.fn().mockResolvedValue({ role: "teacher" }),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

import { saveRubricPreset } from "../../callable/save-rubric-preset";
const handler = saveRubricPreset as any;

function makeRequest(data: Record<string, unknown>) {
  return { data, auth: { uid: "user-1" }, rawRequest: {} as any };
}

describe("saveRubricPreset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Wire shape: payload fields ride under the `data` envelope, and rubric
  // fragments must satisfy the legacy UnifiedRubric wire schema.
  it("should create a new rubric preset", async () => {
    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        data: {
          name: "Standard Rubric",
          rubric: {
            scoringMode: "criteria_based",
            criteria: [{ id: "c1", name: "Accuracy", maxPoints: 50 }],
          },
        },
      })
    );

    expect(result).toBeDefined();
    expect(mockSet).toHaveBeenCalled();
  });

  it("should throw when creating without name", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", data: { rubric: { scoringMode: "holistic" } } }))
    ).rejects.toThrow();
  });

  it("should update an existing rubric preset", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Old Name", isDefault: false }),
    });

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        id: "rubric-1",
        data: { name: "Updated Rubric" },
      })
    );

    expect(result).toBeDefined();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("should not allow deletion of default presets", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Default", isDefault: true }),
    });

    await expect(
      handler(makeRequest({ tenantId: "tenant-1", id: "rubric-1", data: { deleted: true } }))
    ).rejects.toThrow();
  });

  it("should delete non-default presets", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Custom", isDefault: false }),
    });

    const result = await handler(
      makeRequest({ tenantId: "tenant-1", id: "rubric-1", data: { deleted: true } })
    );

    expect(result).toBeDefined();
  });
});
