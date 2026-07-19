/**
 * Unit tests for organization CRUD operations via FirestoreService.
 *
 * Validates org-scoped operations for classes, students, teachers, parents,
 * and academic sessions using the FirestoreService layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firebase Firestore mocks ────────────────────────────────────────
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
  Timestamp: { fromDate: (d: Date) => mockTimestampFromDate(d) },
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: vi.fn(() => ({ db: { type: "mock-db" } })),
}));

import { FirestoreService } from "../firestore/index";

describe("Org Service — FirestoreService CRUD for org entities", () => {
  let svc: FirestoreService;
  const db = { type: "test-db" } as any;
  const tenantId = "tenant-abc";

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FirestoreService(db);
    mockDoc.mockReturnValue({ _ref: true });
    mockCollection.mockReturnValue({ _col: true });
  });

  // ── Classes ───────────────────────────────────────────────────────

  describe("Class CRUD", () => {
    const classData = {
      name: "Grade 10-A",
      grade: "10",
      section: "A",
      academicSessionId: "session-2025",
      teacherIds: ["t1", "t2"],
      status: "active" as const,
    };

    it("creates a class at the org-scoped path", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await svc.setDoc(tenantId, "classes", "class-1", classData);

      expect(mockDoc).toHaveBeenCalledWith(db, `organizations/${tenantId}/classes`, "class-1");
      expect(mockSetDoc).toHaveBeenCalledWith({ _ref: true }, classData, { merge: false });
    });

    it("reads a class by id", async () => {
      const snap = { exists: () => true, data: () => classData, id: "class-1" };
      mockGetDoc.mockResolvedValue(snap);

      const result = await svc.getDoc(tenantId, "classes", "class-1");
      expect(result.data()).toEqual(classData);
    });

    it("updates class fields without overwriting entire doc", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const updates = { name: "Grade 10-B", section: "B" };

      await svc.updateDoc(tenantId, "classes", "class-1", updates);

      expect(mockUpdateDoc).toHaveBeenCalledWith({ _ref: true }, updates);
    });

    it("soft-deletes a class by setting status to deleted", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await svc.updateDoc(tenantId, "classes", "class-1", { status: "deleted" });

      expect(mockUpdateDoc).toHaveBeenCalledWith({ _ref: true }, { status: "deleted" });
    });

    it("lists all active classes with where constraint", async () => {
      const whereConstraint = { _type: "where" };
      mockWhere.mockReturnValue(whereConstraint);
      const fakeQuery = { _query: true };
      mockQuery.mockReturnValue(fakeQuery);
      const fakeSnapshot = {
        docs: [
          { id: "c1", data: () => ({ ...classData, name: "Class A" }) },
          { id: "c2", data: () => ({ ...classData, name: "Class B" }) },
        ],
        size: 2,
        empty: false,
      };
      mockGetDocs.mockResolvedValue(fakeSnapshot);

      const constraint = mockWhere("status", "==", "active");
      const result = await svc.getAllDocs(tenantId, "classes", [constraint]);

      expect(result.docs).toHaveLength(2);
      expect(mockCollection).toHaveBeenCalledWith(db, `organizations/${tenantId}/classes`);
    });
  });

  // ── Students ──────────────────────────────────────────────────────

  describe("Student CRUD", () => {
    const studentData = {
      uid: "user-s1",
      rollNumber: "101",
      section: "A",
      classIds: ["class-1"],
      grade: "10",
      status: "active" as const,
      firstName: "Alice",
      lastName: "Smith",
    };

    it("creates a student document", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await svc.setDoc(tenantId, "students", "student-1", studentData);

      expect(mockDoc).toHaveBeenCalledWith(db, `organizations/${tenantId}/students`, "student-1");
      expect(mockSetDoc).toHaveBeenCalledWith({ _ref: true }, studentData, { merge: false });
    });

    it("assigns student to additional classes via merge update", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const mergeData = { classIds: ["class-1", "class-2"] };

      await svc.setDoc(tenantId, "students", "student-1", mergeData, true);

      expect(mockSetDoc).toHaveBeenCalledWith({ _ref: true }, mergeData, { merge: true });
    });

    it("queries students by classId", async () => {
      const whereConstraint = { _type: "where" };
      mockWhere.mockReturnValue(whereConstraint);
      const fakeQuery = {};
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue({
        docs: [{ id: "s1", data: () => studentData }],
        size: 1,
        empty: false,
      });

      const constraint = mockWhere("classIds", "array-contains", "class-1");
      const result = await svc.getAllDocs(tenantId, "students", [constraint]);

      expect(result.docs).toHaveLength(1);
    });

    it("archives a student", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await svc.updateDoc(tenantId, "students", "student-1", { status: "archived" });

      expect(mockUpdateDoc).toHaveBeenCalledWith({ _ref: true }, { status: "archived" });
    });
  });

  // ── Teachers ──────────────────────────────────────────────────────

  describe("Teacher CRUD", () => {
    const teacherData = {
      uid: "user-t1",
      subjects: ["Math", "Science"],
      designation: "Senior Teacher",
      classIds: ["class-1"],
      permissions: { canCreateExams: true, canEditRubrics: true },
      status: "active" as const,
    };

    it("creates a teacher document", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await svc.setDoc(tenantId, "teachers", "teacher-1", teacherData);

      expect(mockDoc).toHaveBeenCalledWith(db, `organizations/${tenantId}/teachers`, "teacher-1");
    });

    it("updates teacher permissions", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const permUpdates = {
        "permissions.canCreateSpaces": true,
        "permissions.managedClassIds": ["class-1", "class-2"],
      };

      await svc.updateDoc(tenantId, "teachers", "teacher-1", permUpdates);

      expect(mockUpdateDoc).toHaveBeenCalledWith({ _ref: true }, permUpdates);
    });

    it("assigns teacher to classes via update", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await svc.updateDoc(tenantId, "teachers", "teacher-1", { classIds: ["class-1", "class-3"] });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { _ref: true },
        { classIds: ["class-1", "class-3"] }
      );
    });
  });

  // ── Parents ───────────────────────────────────────────────────────

  describe("Parent CRUD", () => {
    const parentData = {
      uid: "user-p1",
      childStudentIds: ["student-1"],
      status: "active" as const,
      firstName: "Bob",
      lastName: "Smith",
    };

    it("creates a parent document", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await svc.setDoc(tenantId, "parents", "parent-1", parentData);

      expect(mockDoc).toHaveBeenCalledWith(db, `organizations/${tenantId}/parents`, "parent-1");
    });

    it("links parent to additional students", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await svc.updateDoc(tenantId, "parents", "parent-1", {
        childStudentIds: ["student-1", "student-2"],
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { _ref: true },
        { childStudentIds: ["student-1", "student-2"] }
      );
    });
  });

  // ── Academic Sessions ─────────────────────────────────────────────

  describe("Academic Session CRUD", () => {
    const sessionData = {
      name: "2025-2026",
      startDate: "2025-06-01",
      endDate: "2026-05-31",
      isCurrent: true,
      status: "active" as const,
    };

    it("creates an academic session", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await svc.setDoc(tenantId, "academicSessions", "session-1", sessionData);

      expect(mockDoc).toHaveBeenCalledWith(
        db,
        `organizations/${tenantId}/academicSessions`,
        "session-1"
      );
    });

    it("queries the current academic session", async () => {
      const whereConstraint = { _type: "where" };
      mockWhere.mockReturnValue(whereConstraint);
      const fakeQuery = {};
      mockQuery.mockReturnValue(fakeQuery);
      mockGetDocs.mockResolvedValue({
        docs: [{ id: "session-1", data: () => sessionData }],
        size: 1,
        empty: false,
      });

      const constraint = mockWhere("isCurrent", "==", true);
      const result = await svc.getAllDocs(tenantId, "academicSessions", [constraint]);

      expect(result.docs).toHaveLength(1);
      expect(result.docs[0].data().isCurrent).toBe(true);
    });

    it("archives an academic session", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await svc.updateDoc(tenantId, "academicSessions", "session-1", {
        status: "archived",
        isCurrent: false,
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { _ref: true },
        { status: "archived", isCurrent: false }
      );
    });
  });

  // ── Multi-tenant isolation ────────────────────────────────────────

  describe("Multi-tenant isolation", () => {
    it("tenantA data path is isolated from tenantB", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await svc.setDoc("tenantA", "classes", "c1", { name: "A-class" });
      await svc.setDoc("tenantB", "classes", "c1", { name: "B-class" });

      expect(mockDoc).toHaveBeenCalledWith(db, "organizations/tenantA/classes", "c1");
      expect(mockDoc).toHaveBeenCalledWith(db, "organizations/tenantB/classes", "c1");
      // Two separate calls with different paths
      expect(mockDoc).toHaveBeenCalledTimes(2);
    });

    it("getAllDocs uses collection scoped to the correct tenant", async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0, empty: true });

      await svc.getAllDocs("tenantA", "students");

      expect(mockCollection).toHaveBeenCalledWith(db, "organizations/tenantA/students");
    });
  });

  // ── Batch operations ──────────────────────────────────────────────

  describe("Batch operations for org entities", () => {
    it("batch creates class + students atomically", async () => {
      const fakeBatch = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(fakeBatch);

      const batch = svc.batch();
      const classRef = { _ref: "class" };
      const studentRef = { _ref: "student" };
      mockDoc.mockReturnValueOnce(classRef).mockReturnValueOnce(studentRef);

      batch.set(classRef as any, { name: "Grade 10-A", status: "active" });
      batch.set(studentRef as any, { firstName: "Alice", classIds: ["class-1"] });
      await batch.commit();

      expect(fakeBatch.set).toHaveBeenCalledTimes(2);
      expect(fakeBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe("Error handling", () => {
    it("propagates permission-denied error from Firestore", async () => {
      mockGetDoc.mockRejectedValue(new Error("PERMISSION_DENIED: Missing permissions"));

      await expect(svc.getDoc(tenantId, "classes", "class-1")).rejects.toThrow("PERMISSION_DENIED");
    });

    it("updateDoc on non-existing entity throws NOT_FOUND", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("NOT_FOUND: No document to update"));

      await expect(
        svc.updateDoc(tenantId, "students", "nonexistent", { name: "x" })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("deleteDoc on non-existing entity does not throw", async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await expect(svc.deleteDoc(tenantId, "teachers", "nonexistent")).resolves.toBeUndefined();
    });
  });
});
