import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockDocRef = vi.fn();
const mockCollectionChain = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: mockGet,
  doc: mockDocRef,
};
const mockCollection = vi.fn(() => mockCollectionChain);

vi.mock("firebase-admin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
      },
    },
  },
  firestore: {
    FieldValue: {
      serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    },
  },
}));

const mockLoggerInfo = vi.fn();
vi.mock("firebase-functions/v2", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}));

import { writeContentVersion } from "../../utils/content-version";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockDb() {
  return { collection: mockCollection } as any;
}

const baseParams = {
  entityType: "item" as const,
  entityId: "item-1",
  changeType: "updated" as const,
  changeSummary: "Updated title",
  changedBy: "user-1",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("writeContentVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing versions (first version)
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    mockDocRef.mockReturnValue({ id: "auto-gen-id", set: mockSet });
  });

  it("creates first version with version=1", async () => {
    await writeContentVersion(makeMockDb(), "tenant-1", "space-1", baseParams);

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }));
  });

  it("increments version from last version", async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ version: 5 }) }],
    });

    await writeContentVersion(makeMockDb(), "tenant-1", "space-1", baseParams);

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ version: 6 }));
  });

  it("writes correct data fields", async () => {
    await writeContentVersion(makeMockDb(), "tenant-1", "space-1", baseParams);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "auto-gen-id",
        version: 1,
        entityType: "item",
        entityId: "item-1",
        changeType: "updated",
        changeSummary: "Updated title",
        changedBy: "user-1",
      })
    );
  });

  it("uses a canonical ISO timestamp for changedAt (B8)", async () => {
    await writeContentVersion(makeMockDb(), "tenant-1", "space-1", baseParams);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        changedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );
  });

  it("returns the generated document id", async () => {
    mockDocRef.mockReturnValue({ id: "my-version-id", set: mockSet });

    const result = await writeContentVersion(makeMockDb(), "tenant-1", "space-1", baseParams);

    expect(result).toBe("my-version-id");
  });

  it("logs info message after writing", async () => {
    await writeContentVersion(makeMockDb(), "tenant-1", "space-1", baseParams);

    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("Wrote version 1"));
  });
});
