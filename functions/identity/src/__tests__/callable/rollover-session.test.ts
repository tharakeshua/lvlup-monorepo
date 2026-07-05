/**
 * Unit tests for rolloverSession callable.
 * Tests auth, admin checks, session creation, class copying,
 * teacher assignment preservation, student promotion, and return statistics.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockWhereGet = vi.fn();
const mockWhere = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn = () => ({
    collection: (path: string) => ({
      doc: (id?: string) => {
        mockCollectionDoc(path, id);
        const docId = id ?? "auto-generated-id";
        return {
          id: docId,
          ref: { id: docId },
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
        };
      },
      where: (...args: unknown[]) => {
        mockWhere(...args);
        return {
          where: (...innerArgs: unknown[]) => {
            mockWhere(...innerArgs);
            return { get: mockWhereGet };
          },
          get: mockWhereGet,
        };
      },
    }),
    doc: (path: string) => {
      mockDocRef(path);
      return {
        id: path.split("/").pop(),
        ref: { id: path.split("/").pop() },
        get: mockDocGet,
        set: mockDocSet,
        update: mockDocUpdate,
      };
    },
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT(${n})`,
  };
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

// ── Mock utils ──────────────────────────────────────────────────────
const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockLogTenantAction = vi.fn();

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  parseRequest: vi.fn((data: any) => data),
  logTenantAction: (...args: unknown[]) => mockLogTenantAction(...args),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

// ── Mock firebase-functions ─────────────────────────────────────────
vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: any) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { rolloverSession } from "../../callable/rollover-session";

const handler = rolloverSession as unknown as (request: any) => Promise<any>;

describe("rolloverSession", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";
  const sourceSessionId = "session-old";

  const validData = {
    tenantId,
    sourceSessionId,
    newSession: {
      name: "2026-2027",
      startDate: "2026-06-01",
      endDate: "2027-05-31",
    },
    copyClasses: false,
    copyTeacherAssignments: false,
    promoteStudents: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockLogTenantAction.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    // Default: source session exists
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    // Default: no current sessions to unset
    mockWhereGet.mockResolvedValue({ docs: [] });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth", async () => {
    await expect(handler({ auth: null, data: validData })).rejects.toThrow("Must be logged in");
  });

  it("rejects when caller is not admin", async () => {
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin")
    );

    await expect(handler({ auth: { uid: "random" }, data: validData })).rejects.toThrow(
      "Must be TenantAdmin or SuperAdmin"
    );
  });

  // ── Source session validation ─────────────────────────────────────

  it("throws not-found when source session does not exist", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await expect(handler({ auth: { uid: callerUid }, data: validData })).rejects.toThrow(
      "Source session not found"
    );
  });

  // ── Session creation ──────────────────────────────────────────────

  it("creates new session with correct data", async () => {
    const result = await handler({
      auth: { uid: callerUid },
      data: validData,
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        name: "2026-2027",
        isCurrent: true,
        status: "active",
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );
    expect(result.newSessionId).toBeDefined();
  });

  it("unsets isCurrent on other sessions", async () => {
    const otherSession = {
      id: "other-session",
      ref: { id: "other-session" },
    };
    mockWhereGet.mockResolvedValue({ docs: [otherSession] });

    await handler({
      auth: { uid: callerUid },
      data: validData,
    });

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      otherSession.ref,
      expect.objectContaining({ isCurrent: false })
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  // ── copyClasses ───────────────────────────────────────────────────

  it("does not copy classes when copyClasses=false", async () => {
    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: false },
    });

    expect(result.classesCreated).toBe(0);
    // Where should only be called for academicSessions (isCurrent query), not classes
    expect(mockWhere).not.toHaveBeenCalledWith("academicSessionId", "==", sourceSessionId);
  });

  it("copies active classes from source session when copyClasses=true", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        section: "A",
        teacherIds: ["teacher-1"],
        status: "active",
      }),
    };
    // First mockWhereGet: isCurrent sessions query
    // Second mockWhereGet: classes query
    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }); // classes

    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: true, copyTeacherAssignments: false },
    });

    expect(result.classesCreated).toBe(1);
    expect(mockDocSet).toHaveBeenCalledTimes(2); // 1 session + 1 class
    // Verify class was created with new session ID and empty teacherIds
    expect(mockDocSet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: "Grade 10-A",
        grade: "10",
        section: "A",
        teacherIds: [],
        studentCount: 0,
        status: "active",
      })
    );
  });

  // ── copyTeacherAssignments ────────────────────────────────────────

  it("preserves teacherIds when copyTeacherAssignments=true", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        section: "A",
        teacherIds: ["teacher-1", "teacher-2"],
        status: "active",
      }),
    };
    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }); // classes

    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: true, copyTeacherAssignments: true },
    });

    expect(result.teacherAssignments).toBe(2);
    expect(mockDocSet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        teacherIds: ["teacher-1", "teacher-2"],
      })
    );
  });

  it("sets teacherIds to empty when copyTeacherAssignments=false", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        teacherIds: ["teacher-1"],
        status: "active",
      }),
    };
    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }); // classes

    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: true, copyTeacherAssignments: false },
    });

    expect(result.teacherAssignments).toBe(0);
    expect(mockDocSet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        teacherIds: [],
      })
    );
  });

  // ── promoteStudents ───────────────────────────────────────────────

  it("promotes students with grade+1 and maps to new classIds when promoteStudents=true", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        section: "A",
        teacherIds: [],
        status: "active",
      }),
    };
    const studentDoc = {
      id: "student-1",
      data: () => ({
        classIds: ["class-old-1"],
        grade: "10",
        status: "active",
      }),
      ref: { update: mockDocUpdate },
    };

    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }) // classes
      .mockResolvedValueOnce({ docs: [studentDoc] }); // students

    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: true, promoteStudents: true },
    });

    expect(result.studentsPromoted).toBe(1);
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        grade: "11",
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );
  });

  it("sets classIds to empty for students without matching class", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        teacherIds: [],
        status: "active",
      }),
    };
    const studentWithNoMatch = {
      id: "student-2",
      data: () => ({
        classIds: ["class-unrelated"],
        grade: "5",
        status: "active",
      }),
      ref: { update: mockDocUpdate },
    };

    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }) // classes
      .mockResolvedValueOnce({ docs: [studentWithNoMatch] }); // students

    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: true, promoteStudents: true },
    });

    expect(result.studentsUnassigned).toBe(1);
    expect(result.studentsPromoted).toBe(0);
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        classIds: [],
      })
    );
  });

  it("does not promote students when promoteStudents=false", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        teacherIds: [],
        status: "active",
      }),
    };
    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }); // classes

    const result = await handler({
      auth: { uid: callerUid },
      data: { ...validData, copyClasses: true, promoteStudents: false },
    });

    expect(result.studentsPromoted).toBe(0);
    expect(result.studentsUnassigned).toBe(0);
  });

  // ── Return value ──────────────────────────────────────────────────

  it("returns correct statistics", async () => {
    const classDoc = {
      id: "class-old-1",
      data: () => ({
        name: "Grade 10-A",
        grade: "10",
        section: "A",
        teacherIds: ["t1"],
        status: "active",
      }),
    };
    const studentDoc = {
      id: "student-1",
      data: () => ({
        classIds: ["class-old-1"],
        grade: "10",
        status: "active",
      }),
      ref: { update: mockDocUpdate },
    };

    mockWhereGet
      .mockResolvedValueOnce({ docs: [] }) // isCurrent sessions
      .mockResolvedValueOnce({ docs: [classDoc] }) // classes
      .mockResolvedValueOnce({ docs: [studentDoc] }); // students

    const result = await handler({
      auth: { uid: callerUid },
      data: {
        ...validData,
        copyClasses: true,
        copyTeacherAssignments: true,
        promoteStudents: true,
      },
    });

    expect(result).toEqual({
      newSessionId: expect.any(String),
      classesCreated: 1,
      teacherAssignments: 1,
      studentsPromoted: 1,
      studentsUnassigned: 0,
    });
  });

  // ── Audit logging ─────────────────────────────────────────────────

  it("logs tenant action after rollover", async () => {
    await handler({
      auth: { uid: callerUid },
      data: validData,
    });

    expect(mockLogTenantAction).toHaveBeenCalledWith(
      tenantId,
      callerUid,
      "rolloverSession",
      expect.objectContaining({
        sourceSessionId,
        newSessionId: expect.any(String),
        classesCreated: 0,
        teacherAssignments: 0,
        studentsPromoted: 0,
        studentsUnassigned: 0,
      })
    );
  });
});
