import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase/firestore
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock("firebase/firestore", () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

// Mock the firebase services module
vi.mock("../../firebase", () => ({
  getFirebaseServices: vi.fn(() => ({
    db: { type: "mock-firestore-db" },
  })),
}));

// Import after mocks
import { getUserMemberships, getMembership } from "../../auth/membership-service";

describe("membership-service", () => {
  const fakeDb = { type: "mock-firestore-db" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getUserMemberships ──────────────────────────────────────────────

  describe("getUserMemberships", () => {
    it("returns active memberships for a user", async () => {
      const fakeMemberships = [
        { uid: "user-1", tenantId: "tenant-a", role: "student", status: "active" },
        { uid: "user-1", tenantId: "tenant-b", role: "teacher", status: "active" },
      ];
      const fakeCollectionRef = { path: "userMemberships" };
      const fakeWhereUid = { type: "where", field: "uid" };
      const fakeWhereStatus = { type: "where", field: "status" };
      const fakeQuery = { _type: "query" };
      const fakeSnapshot = {
        docs: fakeMemberships.map((m) => ({ data: () => m })),
      };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockWhere.mockReturnValueOnce(fakeWhereUid).mockReturnValueOnce(fakeWhereStatus);
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeSnapshot);

      const result = await getUserMemberships("user-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(fakeMemberships[0]);
      expect(result[1]).toEqual(fakeMemberships[1]);
      // Prefers v2_ (lvlup-ff6fa default / explicit prefix) then may fall through.
      expect(mockCollection).toHaveBeenCalled();
      const colArgs = mockCollection.mock.calls.map((c) => c[1]);
      expect(colArgs.some((n) => String(n).endsWith("userMemberships"))).toBe(true);
      expect(mockWhere).toHaveBeenCalledWith("uid", "==", "user-1");
      expect(mockWhere).toHaveBeenCalledWith("status", "==", "active");
    });

    it("returns empty array when no memberships match", async () => {
      const fakeCollectionRef = {};
      const fakeQuery = {};
      const fakeSnapshot = { docs: [] };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockWhere.mockReturnValue({});
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeSnapshot);

      const result = await getUserMemberships("nonexistent-user");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("queries with both uid and active status constraints", async () => {
      mockCollection.mockReturnValue({});
      mockWhere.mockReturnValueOnce("uid-constraint").mockReturnValueOnce("status-constraint");
      mockQuery.mockReturnValue({});
      mockGetDocs.mockResolvedValue({ docs: [] });

      await getUserMemberships("user-42");

      expect(mockQuery).toHaveBeenCalledWith({}, "uid-constraint", "status-constraint");
    });
  });

  // ── getMembership ───────────────────────────────────────────────────

  describe("getMembership", () => {
    it("returns membership data when document exists", async () => {
      const membershipData = {
        uid: "user-1",
        tenantId: "tenant-a",
        role: "student",
        status: "active",
      };
      const fakeDocRef = { id: "user-1_tenant-a" };
      const fakeSnapshot = {
        exists: () => true,
        data: () => membershipData,
      };

      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      const result = await getMembership("user-1", "tenant-a");

      expect(result).toMatchObject(membershipData);
      expect(mockDoc).toHaveBeenCalled();
      const docArgs = mockDoc.mock.calls.map((c) => [c[1], c[2]]);
      expect(
        docArgs.some(
          ([col, id]) => String(col).endsWith("userMemberships") && id === "user-1_tenant-a"
        )
      ).toBe(true);
    });

    it("returns null when document does not exist", async () => {
      const fakeDocRef = { id: "user-1_nonexistent" };
      const fakeSnapshot = {
        exists: () => false,
        data: () => undefined,
      };

      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      const result = await getMembership("user-1", "nonexistent");

      expect(result).toBeNull();
    });

    it("uses composite key format {uid}_{tenantId}", async () => {
      const fakeDocRef = {};
      const fakeSnapshot = { exists: () => false, data: () => undefined };

      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      await getMembership("abc-123", "tenant-xyz");

      expect(mockDoc).toHaveBeenCalled();
      const docArgs = mockDoc.mock.calls.map((c) => [c[1], c[2]]);
      expect(
        docArgs.some(
          ([col, id]) => String(col).endsWith("userMemberships") && id === "abc-123_tenant-xyz"
        )
      ).toBe(true);
    });
  });
});
