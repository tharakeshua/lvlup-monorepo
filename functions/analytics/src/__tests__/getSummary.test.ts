/**
 * Tests for getSummary callable.
 *
 * Covers:
 *  1. Authentication checks
 *  2. Input validation (tenantId, scope)
 *  3. Student scope — returns StudentProgressSummary
 *  4. Student scope — permission checks (students can only view their own)
 *  5. Class scope — returns ClassProgressSummary
 *  6. Class scope — permission checks (students denied, teacher must be assigned)
 *  7. Not-found handling for both scopes
 *  8. Invalid scope value
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFirestore,
  mockDocumentSnapshot,
  mockQuerySnapshot,
} from "../../../test-utils/mock-firestore";

// ── Mock firebase-admin ──────────────────────────────────────────────────

const mockFirestore = createMockFirestore();

vi.mock("firebase-admin", () => ({
  firestore: () => mockFirestore.db,
  initializeApp: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: Function) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("../utils/parse-request", () => ({
  parseRequest: vi.fn((data: any) => data),
}));

vi.mock("../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../contracts/legacy-docs", () => {
  const s = { safeParse: (data: any) => ({ success: true, data }) };
  return {
    StudentProgressSummarySchema: s,
    ClassProgressSummarySchema: s,
  };
});

// ── Import under test (after mocks) ─────────────────────────────────────

import { getSummary } from "../callable/get-summary";

// ── Helpers ──────────────────────────────────────────────────────────────

const TENANT = "tenant-1";

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "user-1" }),
    rawRequest: {} as any,
  };
}

const handler = getSummary as unknown as (req: ReturnType<typeof makeRequest>) => Promise<any>;

// ── Tests ────────────────────────────────────────────────────────────────

describe("getSummary — authentication", () => {
  it("should reject unauthenticated requests", async () => {
    const req = makeRequest({ tenantId: TENANT, scope: "student" }, null);
    await expect(handler(req)).rejects.toThrow("Authentication required");
  });
});

describe("getSummary — input validation", () => {
  beforeEach(() => {
    // Seed a valid membership so auth passes
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "user-1", status: "active", role: "teacher" } },
    ]);
  });

  it("should reject when tenantId is missing", async () => {
    const req = makeRequest({ scope: "student" });
    await expect(handler(req)).rejects.toThrow("tenantId is required");
  });

  it("should reject when scope is missing", async () => {
    const req = makeRequest({ tenantId: TENANT });
    await expect(handler(req)).rejects.toThrow("scope is required");
  });

  it("should reject invalid scope value", async () => {
    const req = makeRequest({ tenantId: TENANT, scope: "invalid" });
    await expect(handler(req)).rejects.toThrow("Invalid scope value");
  });
});

describe("getSummary — tenant membership", () => {
  it("should reject caller who does not belong to tenant", async () => {
    mockFirestore.seedCollection("userMemberships", []);
    const req = makeRequest({ tenantId: TENANT, scope: "student", studentId: "user-1" });
    await expect(handler(req)).rejects.toThrow("You do not belong to this tenant");
  });
});

describe("getSummary — student scope", () => {
  beforeEach(() => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "user-1", status: "active", role: "student" } },
    ]);
  });

  it("should require studentId when scope is student", async () => {
    const req = makeRequest({ tenantId: TENANT, scope: "student" });
    await expect(handler(req)).rejects.toThrow("studentId is required");
  });

  it("should return student progress summary for own data", async () => {
    const summaryData = {
      studentId: "user-1",
      overallScore: 0.78,
      isAtRisk: false,
      autograde: { totalExams: 5, averagePercentage: 80 },
      levelup: { totalSpaces: 3, averageCompletion: 75 },
    };
    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/user-1`, summaryData);

    const req = makeRequest({ tenantId: TENANT, scope: "student", studentId: "user-1" });
    const result = await handler(req);

    expect(result.scope).toBe("student");
    expect(result.studentSummary).toBeDefined();
    expect(result.studentSummary.overallScore).toBe(0.78);
  });

  it("should deny students from viewing another students summary", async () => {
    const req = makeRequest({ tenantId: TENANT, scope: "student", studentId: "other-student" });
    await expect(handler(req)).rejects.toThrow("Students can only access their own summary");
  });

  it("should return not-found when summary does not exist", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/user-1`, undefined as any);
    const req = makeRequest({ tenantId: TENANT, scope: "student", studentId: "user-1" });
    await expect(handler(req)).rejects.toThrow("Student progress summary not found");
  });
});

describe("getSummary — student scope (teacher caller)", () => {
  beforeEach(() => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "teacher-1", status: "active", role: "teacher" } },
    ]);
  });

  it("should allow teachers to view any student summary", async () => {
    const summaryData = {
      studentId: "student-1",
      overallScore: 0.65,
      isAtRisk: true,
    };
    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/student-1`, summaryData);

    const req = makeRequest(
      { tenantId: TENANT, scope: "student", studentId: "student-1" },
      { uid: "teacher-1" }
    );
    const result = await handler(req);

    expect(result.scope).toBe("student");
    expect(result.studentSummary.isAtRisk).toBe(true);
  });
});

describe("getSummary — class scope", () => {
  it("should require classId when scope is class", async () => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "teacher-1", status: "active", role: "teacher" } },
    ]);

    const req = makeRequest({ tenantId: TENANT, scope: "class" }, { uid: "teacher-1" });
    await expect(handler(req)).rejects.toThrow("classId is required");
  });

  it("should deny students from accessing class summaries", async () => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "student-1", status: "active", role: "student" } },
    ]);

    const req = makeRequest(
      { tenantId: TENANT, scope: "class", classId: "class-1" },
      { uid: "student-1" }
    );
    await expect(handler(req)).rejects.toThrow("Students cannot access class summaries");
  });

  it("should deny teacher not assigned to the class", async () => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "teacher-1", status: "active", role: "teacher" } },
    ]);
    mockFirestore.seedDoc(`tenants/${TENANT}/classes/class-1`, {
      name: "Class A",
      teacherIds: ["other-teacher"],
    });

    const req = makeRequest(
      { tenantId: TENANT, scope: "class", classId: "class-1" },
      { uid: "teacher-1" }
    );
    await expect(handler(req)).rejects.toThrow("You are not assigned to this class");
  });

  it("should return class summary for assigned teacher", async () => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "teacher-1", status: "active", role: "teacher" } },
    ]);
    mockFirestore.seedDoc(`tenants/${TENANT}/classes/class-1`, {
      name: "Class A",
      teacherIds: ["teacher-1"],
    });
    const classSummaryData = {
      classId: "class-1",
      className: "Class A",
      autograde: { averageClassScore: 0.72 },
      levelup: { averageClassCompletion: 68 },
      atRiskCount: 2,
    };
    mockFirestore.seedDoc(`tenants/${TENANT}/classProgressSummaries/class-1`, classSummaryData);

    const req = makeRequest(
      { tenantId: TENANT, scope: "class", classId: "class-1" },
      { uid: "teacher-1" }
    );
    const result = await handler(req);

    expect(result.scope).toBe("class");
    expect(result.classSummary).toBeDefined();
    expect(result.classSummary.atRiskCount).toBe(2);
  });

  it("should allow admin to access any class summary", async () => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "admin-1", status: "active", role: "admin" } },
    ]);
    const classSummaryData = {
      classId: "class-1",
      className: "Class A",
    };
    mockFirestore.seedDoc(`tenants/${TENANT}/classProgressSummaries/class-1`, classSummaryData);

    const req = makeRequest(
      { tenantId: TENANT, scope: "class", classId: "class-1" },
      { uid: "admin-1" }
    );
    const result = await handler(req);

    expect(result.scope).toBe("class");
    expect(result.classSummary).toBeDefined();
  });

  it("should return not-found when class summary does not exist", async () => {
    mockFirestore.seedCollection("userMemberships", [
      { id: "m1", data: { uid: "admin-1", status: "active", role: "admin" } },
    ]);
    mockFirestore.seedDoc(`tenants/${TENANT}/classProgressSummaries/class-1`, undefined as any);

    const req = makeRequest(
      { tenantId: TENANT, scope: "class", classId: "class-1" },
      { uid: "admin-1" }
    );
    await expect(handler(req)).rejects.toThrow("Class progress summary not found");
  });
});
