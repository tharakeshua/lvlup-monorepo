import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
  WriteBatch,
  Timestamp as TimestampType,
} from "firebase/firestore";

// Mock firebase/firestore
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockWriteBatch = vi.fn();
const mockServerTimestamp = vi.fn();
const mockTimestampFromDate = vi.fn();

vi.mock("firebase/firestore", () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  serverTimestamp: () => mockServerTimestamp(),
  Timestamp: {
    fromDate: (date: Date) => mockTimestampFromDate(date),
  },
}));

// Mock the firebase services module
vi.mock("../firebase", () => ({
  getFirebaseServices: vi.fn(() => ({
    db: { type: "mock-firestore-db" },
  })),
}));

// Import after mocks
import { FirestoreService } from "../firestore/index";

describe("FirestoreService", () => {
  let service: FirestoreService;
  const fakeDb = { type: "injected-firestore-db" } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FirestoreService(fakeDb);
  });

  // ── Org-scoped path construction ──────────────────────────────────

  describe("getOrgPath", () => {
    it("constructs correct org-scoped path", () => {
      const path = service.getOrgPath("org-123", "users");
      expect(path).toBe("organizations/org-123/users");
    });

    it("multi-tenant isolation: orgA path does not overlap with orgB", () => {
      const pathA = service.getOrgPath("orgA", "items");
      const pathB = service.getOrgPath("orgB", "items");
      expect(pathA).toBe("organizations/orgA/items");
      expect(pathB).toBe("organizations/orgB/items");
      expect(pathA).not.toBe(pathB);
    });

    it("verifies organizations/{orgId}/ prefix", () => {
      const path = service.getOrgPath("tenant-x", "records");
      expect(path).toMatch(/^organizations\/tenant-x\//);
    });
  });

  // ── getDoc ────────────────────────────────────────────────────────

  describe("getDoc", () => {
    it("returns document data for valid orgId and docId", async () => {
      const fakeDocRef = { id: "doc1", path: "organizations/org1/users/doc1" };
      const fakeSnapshot = { exists: () => true, data: () => ({ name: "Alice" }), id: "doc1" };
      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      const result = await service.getDoc("org1", "users", "doc1");

      expect(result).toBe(fakeSnapshot);
      expect(result.exists()).toBe(true);
      expect(result.data()).toEqual({ name: "Alice" });
    });

    it("returns snapshot where exists() is false for non-existing document", async () => {
      const fakeDocRef = { id: "missing" };
      const fakeSnapshot = { exists: () => false, data: () => undefined, id: "missing" };
      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      const result = await service.getDoc("org1", "users", "missing");

      expect(result.exists()).toBe(false);
      expect(result.data()).toBeUndefined();
    });

    it("constructs correct org-scoped path via doc()", async () => {
      const fakeDocRef = {};
      const fakeSnapshot = { exists: () => true, data: () => ({}) };
      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      await service.getDoc("org-42", "tasks", "task-7");

      expect(mockDoc).toHaveBeenCalledWith(fakeDb, "organizations/org-42/tasks", "task-7");
    });
  });

  // ── getAllDocs ─────────────────────────────────────────────────────

  describe("getAllDocs", () => {
    it("returns array of documents", async () => {
      const fakeDocs = [
        { id: "a", data: () => ({ name: "A" }) },
        { id: "b", data: () => ({ name: "B" }) },
      ];
      const fakeQuerySnapshot = { docs: fakeDocs, size: 2, empty: false };
      const fakeCollectionRef = { path: "organizations/org1/items" };
      mockCollection.mockReturnValue(fakeCollectionRef);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      const result = await service.getAllDocs("org1", "items");

      expect(result.docs).toHaveLength(2);
      expect(result.docs[0].data()).toEqual({ name: "A" });
    });

    it("returns empty snapshot for empty collection", async () => {
      const fakeQuerySnapshot = { docs: [], size: 0, empty: true };
      const fakeCollectionRef = {};
      mockCollection.mockReturnValue(fakeCollectionRef);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      const result = await service.getAllDocs("org1", "empty-collection");

      expect(result.docs).toHaveLength(0);
      expect(result.empty).toBe(true);
    });

    it("passes where constraints to query", async () => {
      const fakeCollectionRef = {};
      const fakeWhereConstraint = { type: "where", field: "status", op: "==", value: "active" };
      const fakeQuery = { _type: "query" };
      const fakeQuerySnapshot = { docs: [], size: 0, empty: true };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockWhere.mockReturnValue(fakeWhereConstraint);
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      const whereConstraint = mockWhere("status", "==", "active");
      await service.getAllDocs("org1", "items", [whereConstraint]);

      expect(mockQuery).toHaveBeenCalledWith(fakeCollectionRef, fakeWhereConstraint);
    });

    it("passes orderBy constraint to query", async () => {
      const fakeCollectionRef = {};
      const fakeOrderByConstraint = { type: "orderBy", field: "createdAt" };
      const fakeQuery = {};
      const fakeQuerySnapshot = { docs: [], size: 0, empty: true };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockOrderBy.mockReturnValue(fakeOrderByConstraint);
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      const constraint = mockOrderBy("createdAt", "desc");
      await service.getAllDocs("org1", "items", [constraint]);

      expect(mockQuery).toHaveBeenCalledWith(fakeCollectionRef, fakeOrderByConstraint);
    });

    it("passes limit constraint to query", async () => {
      const fakeCollectionRef = {};
      const fakeLimitConstraint = { type: "limit", value: 5 };
      const fakeQuery = {};
      const fakeQuerySnapshot = {
        docs: Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, data: () => ({}) })),
        size: 5,
        empty: false,
      };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockLimit.mockReturnValue(fakeLimitConstraint);
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      const constraint = mockLimit(5);
      await service.getAllDocs("org1", "items", [constraint]);

      expect(mockQuery).toHaveBeenCalledWith(fakeCollectionRef, fakeLimitConstraint);
      expect(fakeQuerySnapshot.size).toBe(5);
    });

    it("calls getDocs directly without query when no constraints are given", async () => {
      const fakeCollectionRef = { _type: "collectionRef" };
      const fakeQuerySnapshot = { docs: [], size: 0, empty: true };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      await service.getAllDocs("org1", "items");

      // Should pass collectionRef directly, not a query-wrapped ref
      expect(mockGetDocs).toHaveBeenCalledWith(fakeCollectionRef);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("passes multiple where clauses to query", async () => {
      const fakeCollectionRef = {};
      const whereA = { type: "where", field: "status", op: "==", value: "active" };
      const whereB = { type: "where", field: "role", op: "==", value: "admin" };
      const fakeQuery = {};
      const fakeQuerySnapshot = { docs: [], size: 0, empty: true };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      await service.getAllDocs("org1", "items", [whereA, whereB]);

      expect(mockQuery).toHaveBeenCalledWith(fakeCollectionRef, whereA, whereB);
    });

    it("passes startAfter cursor for pagination", async () => {
      const fakeCollectionRef = {};
      const startAfterConstraint = { type: "startAfter" };
      const fakeQuery = {};
      const fakeQuerySnapshot = { docs: [], size: 0, empty: true };

      mockCollection.mockReturnValue(fakeCollectionRef);
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue(fakeQuerySnapshot);

      await service.getAllDocs("org1", "items", [startAfterConstraint]);

      expect(mockQuery).toHaveBeenCalledWith(fakeCollectionRef, startAfterConstraint);
    });
  });

  // ── setDoc ────────────────────────────────────────────────────────

  describe("setDoc", () => {
    it("creates new document at org-scoped path", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockSetDoc.mockResolvedValue(undefined);

      const data = { name: "New Item", value: 42 };
      await service.setDoc("org1", "items", "item-1", data);

      expect(mockDoc).toHaveBeenCalledWith(fakeDb, "organizations/org1/items", "item-1");
      expect(mockSetDoc).toHaveBeenCalledWith(fakeDocRef, data, { merge: false });
    });

    it("passes merge: true when merge option is set", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockSetDoc.mockResolvedValue(undefined);

      const data = { name: "Updated" };
      await service.setDoc("org1", "items", "item-1", data, true);

      expect(mockSetDoc).toHaveBeenCalledWith(fakeDocRef, data, { merge: true });
    });

    it("overwrites existing document when merge is false (default)", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockSetDoc.mockResolvedValue(undefined);

      const data = { completely: "new data" };
      await service.setDoc("org1", "items", "item-1", data);

      expect(mockSetDoc).toHaveBeenCalledWith(fakeDocRef, data, { merge: false });
    });
  });

  // ── updateDoc ─────────────────────────────────────────────────────

  describe("updateDoc", () => {
    it("updates specific fields in a document", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockUpdateDoc.mockResolvedValue(undefined);

      const updates = { name: "Updated Name" };
      await service.updateDoc("org1", "items", "item-1", updates);

      expect(mockDoc).toHaveBeenCalledWith(fakeDb, "organizations/org1/items", "item-1");
      expect(mockUpdateDoc).toHaveBeenCalledWith(fakeDocRef, updates);
    });

    it("throws when updating non-existing document", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockUpdateDoc.mockRejectedValue(new Error("NOT_FOUND: No document to update"));

      await expect(
        service.updateDoc("org1", "items", "nonexistent", { foo: "bar" })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("supports nested field updates", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockUpdateDoc.mockResolvedValue(undefined);

      const updates = { "address.city": "New York", "address.zip": "10001" };
      await service.updateDoc("org1", "users", "user-1", updates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(fakeDocRef, updates);
    });
  });

  // ── deleteDoc ─────────────────────────────────────────────────────

  describe("deleteDoc", () => {
    it("removes document at org-scoped path", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockDeleteDoc.mockResolvedValue(undefined);

      await service.deleteDoc("org1", "items", "item-1");

      expect(mockDoc).toHaveBeenCalledWith(fakeDb, "organizations/org1/items", "item-1");
      expect(mockDeleteDoc).toHaveBeenCalledWith(fakeDocRef);
    });

    it("does not throw when deleting non-existing document", async () => {
      const fakeDocRef = {};
      mockDoc.mockReturnValue(fakeDocRef);
      mockDeleteDoc.mockResolvedValue(undefined);

      await expect(service.deleteDoc("org1", "items", "nonexistent")).resolves.toBeUndefined();
    });
  });

  // ── batch ─────────────────────────────────────────────────────────

  describe("batch", () => {
    it("creates a WriteBatch instance", () => {
      const fakeBatch = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(fakeBatch);

      const batch = service.batch();

      expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
      expect(batch).toBe(fakeBatch);
    });

    it("supports commit with multiple operations", async () => {
      const fakeBatch = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(fakeBatch);

      const batch = service.batch();
      batch.set({} as any, { name: "new" });
      batch.update({} as any, { name: "updated" });
      batch.delete({} as any);
      await batch.commit();

      expect(fakeBatch.set).toHaveBeenCalledTimes(1);
      expect(fakeBatch.update).toHaveBeenCalledTimes(1);
      expect(fakeBatch.delete).toHaveBeenCalledTimes(1);
      expect(fakeBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ── getServerTimestamp ────────────────────────────────────────────

  describe("getServerTimestamp", () => {
    it("returns Firestore server timestamp sentinel", () => {
      const sentinel = { _type: "serverTimestamp" };
      mockServerTimestamp.mockReturnValue(sentinel);

      const result = service.getServerTimestamp();

      expect(result).toBe(sentinel);
      expect(mockServerTimestamp).toHaveBeenCalled();
    });
  });

  // ── createTimestamp ───────────────────────────────────────────────

  describe("createTimestamp", () => {
    it("converts Date to Firestore Timestamp", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const fakeTimestamp = { seconds: 1750075200, nanoseconds: 0 };
      mockTimestampFromDate.mockReturnValue(fakeTimestamp);

      const result = service.createTimestamp(date);

      expect(mockTimestampFromDate).toHaveBeenCalledWith(date);
      expect(result).toBe(fakeTimestamp);
    });
  });

  // ── Constructor / lazy db initialization ──────────────────────────

  describe("constructor", () => {
    it("uses injected db when provided", async () => {
      const fakeDocRef = {};
      const fakeSnapshot = { exists: () => true, data: () => ({}) };
      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      await service.getDoc("org1", "col", "doc1");

      // Should use the injected db, not call getFirebaseServices
      expect(mockDoc).toHaveBeenCalledWith(fakeDb, expect.any(String), "doc1");
    });

    it("falls back to getFirebaseServices when no db is injected", async () => {
      const lazyService = new FirestoreService();
      const fakeDocRef = {};
      const fakeSnapshot = { exists: () => true, data: () => ({}) };
      mockDoc.mockReturnValue(fakeDocRef);
      mockGetDoc.mockResolvedValue(fakeSnapshot);

      await lazyService.getDoc("org1", "col", "doc1");

      // Should use the db from getFirebaseServices mock ({ type: 'mock-firestore-db' })
      expect(mockDoc).toHaveBeenCalledWith(
        { type: "mock-firestore-db" },
        expect.any(String),
        "doc1"
      );
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe("error handling", () => {
    it("propagates network errors from getDoc", async () => {
      mockDoc.mockReturnValue({});
      mockGetDoc.mockRejectedValue(new Error("UNAVAILABLE: network error"));

      await expect(service.getDoc("org1", "items", "item-1")).rejects.toThrow(
        "UNAVAILABLE: network error"
      );
    });

    it("propagates network errors from getAllDocs", async () => {
      mockCollection.mockReturnValue({});
      mockGetDocs.mockRejectedValue(new Error("UNAVAILABLE: network error"));

      await expect(service.getAllDocs("org1", "items")).rejects.toThrow(
        "UNAVAILABLE: network error"
      );
    });

    it("propagates network errors from setDoc", async () => {
      mockDoc.mockReturnValue({});
      mockSetDoc.mockRejectedValue(new Error("UNAVAILABLE: network error"));

      await expect(service.setDoc("org1", "items", "item-1", { data: true })).rejects.toThrow(
        "UNAVAILABLE: network error"
      );
    });
  });
});
