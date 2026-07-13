import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockDelete = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockBatch = { delete: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue({}) };

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, update: mockUpdate, delete: mockDelete })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
    doc: vi.fn(() => ({ get: mockGet, delete: mockDelete })),
  })),
  batch: vi.fn(() => mockBatch),
};

const mockRtdbRef = { remove: vi.fn().mockResolvedValue({}) };

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  return {
    default: {
      firestore: fsFn,
      database: () => ({ ref: () => mockRtdbRef }),
      initializeApp: vi.fn(),
    },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentDeleted: vi.fn((_opts: any, handler: any) => handler),
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/firestore", () => ({
  deleteCollection: vi.fn(),
  deleteDocs: vi.fn(),
}));

import { onSpaceDeleted } from "../../triggers/on-space-deleted";
const handler = onSpaceDeleted as any;

describe("onSpaceDeleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should cascade delete all related data when space is deleted", async () => {
    const event = {
      params: { tenantId: "tenant-1", spaceId: "space-1" },
      data: {
        data: () => ({ title: "Deleted Space", tenantId: "tenant-1" }),
      },
    };

    // Story points query
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "sp-1", ref: { path: "tenants/tenant-1/spaces/space-1/storyPoints/sp-1" } }],
    });

    // Items query
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Agents query
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Test sessions query
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Space progress query
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Chat sessions query
    mockGet.mockResolvedValueOnce({ docs: [] });

    await handler(event);

    // Should attempt batch delete/update operations
    expect(stableDb.batch).toHaveBeenCalled();
  });

  it("should update tenant stats", async () => {
    const event = {
      params: { tenantId: "tenant-1", spaceId: "space-1" },
      data: {
        data: () => ({ title: "Deleted Space", tenantId: "tenant-1" }),
      },
    };

    // All subcollection queries return empty
    mockGet.mockResolvedValue({ docs: [] });

    await handler(event);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
