/**
 * Tests for generateReport callable.
 *
 * Covers:
 *  1. Authentication checks
 *  2. Input validation (tenantId, type)
 *  3. type: 'exam-result' — individual student report
 *  4. type: 'exam-result' — class summary report
 *  5. type: 'progress' — student progress PDF
 *  6. type: 'class' — class report card PDF
 *  7. Upload to Storage and signed URL generation
 *  8. Not-found and error cases
 *  9. Invalid report type
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFirestore, mockQuerySnapshot } from "../../../test-utils/mock-firestore";

// ── Mock firebase-admin ──────────────────────────────────────────────────

const mockFirestore = createMockFirestore();

const mockFile = {
  save: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn().mockResolvedValue(["https://storage.example.com/report.pdf"]),
};

const mockBucket = {
  file: vi.fn(() => mockFile),
};

vi.mock("firebase-admin", () => ({
  firestore: () => mockFirestore.db,
  storage: () => ({ bucket: () => mockBucket }),
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

// ── Mock PDF helpers (avoid actual PDFKit dependency in tests) ────────────

const mockPdfDoc = {
  fontSize: vi.fn().mockReturnThis(),
  font: vi.fn().mockReturnThis(),
  fillColor: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnThis(),
  moveDown: vi.fn().mockReturnThis(),
  end: vi.fn(),
  on: vi.fn(),
};

vi.mock("../utils/pdf-helpers", () => ({
  createPdfDocument: vi.fn(() => mockPdfDoc),
  addHeader: vi.fn(),
  addSectionTitle: vi.fn(),
  addKeyValue: vi.fn(),
  addSimpleTable: vi.fn(),
  addFooter: vi.fn(),
  drawHorizontalLine: vi.fn(),
  pdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content")),
  getGradeColor: vi.fn(() => "#000"),
  FONTS: { heading: "Helvetica-Bold", body: "Helvetica", mono: "Courier" },
  COLORS: {
    primary: "#1e40af",
    secondary: "#6b7280",
    accent: "#059669",
    danger: "#dc2626",
    warning: "#d97706",
    headerBg: "#1e3a5f",
    lightGray: "#f3f4f6",
    border: "#d1d5db",
    text: "#111827",
    muted: "#6b7280",
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
    ExamSchema: s,
    ExamQuestionSchema: s,
    SubmissionSchema: s,
    StudentProgressSummarySchema: s,
    ClassProgressSummarySchema: s,
  };
});

// ── Import under test (after mocks) ─────────────────────────────────────

import { generateReport } from "../callable/generate-report";

// ── Helpers ──────────────────────────────────────────────────────────────

const TENANT = "tenant-1";

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "user-1" }),
    rawRequest: {} as any,
  };
}

const handler = generateReport as unknown as (req: ReturnType<typeof makeRequest>) => Promise<any>;

// ── Tests ────────────────────────────────────────────────────────────────

describe("generateReport — authentication", () => {
  it("should reject unauthenticated requests", async () => {
    const req = makeRequest({ tenantId: TENANT, type: "progress" }, null);
    await expect(handler(req)).rejects.toThrow("Authentication required");
  });
});

describe("generateReport — input validation", () => {
  it("should reject when tenantId is missing", async () => {
    const req = makeRequest({ type: "progress" });
    await expect(handler(req)).rejects.toThrow("tenantId and type are required");
  });

  it("should reject when type is missing", async () => {
    const req = makeRequest({ tenantId: TENANT });
    await expect(handler(req)).rejects.toThrow("tenantId and type are required");
  });

  it("should reject invalid type value", async () => {
    const req = makeRequest({ tenantId: TENANT, type: "invalid" });
    await expect(handler(req)).rejects.toThrow(
      'type must be "exam-result", "progress", or "class"'
    );
  });
});

describe("generateReport — exam-result (individual)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFile.save.mockResolvedValue(undefined);
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.example.com/result-student-1.pdf"]);
  });

  it("should require examId for exam-result type", async () => {
    const req = makeRequest({ tenantId: TENANT, type: "exam-result" });
    await expect(handler(req)).rejects.toThrow("examId is required");
  });

  it("should return not-found for missing exam", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/exams/exam-1`, undefined as any);
    const req = makeRequest({
      tenantId: TENANT,
      type: "exam-result",
      examId: "exam-1",
      studentId: "student-1",
    });
    await expect(handler(req)).rejects.toThrow("Exam not found");
  });

  it("should generate individual exam report and return URL", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/exams/exam-1`, {
      title: "Math Mid-Term",
      subject: "Mathematics",
      totalMarks: 100,
      duration: 120,
    });
    mockFirestore.seedCollection(`tenants/${TENANT}/exams/exam-1/questions`, [
      { id: "Q1", data: { order: 0, maxMarks: 50 } },
      { id: "Q2", data: { order: 1, maxMarks: 50 } },
    ]);
    mockFirestore.seedCollection(`tenants/${TENANT}/submissions`, [
      {
        id: "sub-1",
        data: {
          examId: "exam-1",
          studentId: "student-1",
          studentName: "Alice",
          rollNumber: "001",
          summary: { totalScore: 85, maxScore: 100, percentage: 85, grade: "A" },
        },
      },
    ]);
    mockFirestore.seedCollection(`tenants/${TENANT}/submissions/sub-1/questionSubmissions`, [
      { id: "Q1", data: { gradingStatus: "graded", evaluation: { totalScore: 45 } } },
      { id: "Q2", data: { gradingStatus: "graded", evaluation: { totalScore: 40 } } },
    ]);

    const req = makeRequest({
      tenantId: TENANT,
      type: "exam-result",
      examId: "exam-1",
      studentId: "student-1",
    });
    const result = await handler(req);

    expect(result.pdfUrl).toBeDefined();
    expect(result.pdfUrl).toContain("storage.example.com");
    expect(mockFile.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ metadata: { contentType: "application/pdf" } })
    );
  });

  it("should return not-found when student has no submission", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/exams/exam-1`, {
      title: "Math Mid-Term",
      subject: "Mathematics",
      totalMarks: 100,
      duration: 120,
    });
    mockFirestore.seedCollection(`tenants/${TENANT}/exams/exam-1/questions`, []);
    mockFirestore.seedCollection(`tenants/${TENANT}/submissions`, []);

    const req = makeRequest({
      tenantId: TENANT,
      type: "exam-result",
      examId: "exam-1",
      studentId: "student-1",
    });
    await expect(handler(req)).rejects.toThrow("Submission not found");
  });
});

describe("generateReport — exam-result (class summary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFile.save.mockResolvedValue(undefined);
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.example.com/class-summary.pdf"]);
  });

  it("should generate class exam summary report when no studentId", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/exams/exam-1`, {
      title: "Math Mid-Term",
      subject: "Mathematics",
      totalMarks: 100,
    });
    mockFirestore.seedCollection(`tenants/${TENANT}/exams/exam-1/questions`, [
      { id: "Q1", data: { order: 0, maxMarks: 100 } },
    ]);
    mockFirestore.seedCollection(`tenants/${TENANT}/submissions`, [
      {
        id: "sub-1",
        data: {
          examId: "exam-1",
          studentId: "s1",
          studentName: "Alice",
          rollNumber: "001",
          summary: { totalScore: 80, maxScore: 100, percentage: 80, grade: "A" },
        },
      },
      {
        id: "sub-2",
        data: {
          examId: "exam-1",
          studentId: "s2",
          studentName: "Bob",
          rollNumber: "002",
          summary: { totalScore: 60, maxScore: 100, percentage: 60, grade: "B" },
        },
      },
    ]);

    const req = makeRequest({ tenantId: TENANT, type: "exam-result", examId: "exam-1" });
    const result = await handler(req);

    expect(result.pdfUrl).toBeDefined();
    expect(mockBucket.file).toHaveBeenCalledWith(expect.stringContaining("class-summary.pdf"));
  });

  it("should return not-found when no submissions exist for class summary", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/exams/exam-1`, {
      title: "Math Mid-Term",
      subject: "Mathematics",
      totalMarks: 100,
    });
    mockFirestore.seedCollection(`tenants/${TENANT}/exams/exam-1/questions`, []);
    mockFirestore.seedCollection(`tenants/${TENANT}/submissions`, []);

    const req = makeRequest({ tenantId: TENANT, type: "exam-result", examId: "exam-1" });
    await expect(handler(req)).rejects.toThrow("No submissions found");
  });
});

describe("generateReport — progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFile.save.mockResolvedValue(undefined);
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.example.com/progress.pdf"]);
  });

  it("should require studentId for progress type", async () => {
    const req = makeRequest({ tenantId: TENANT, type: "progress" });
    await expect(handler(req)).rejects.toThrow("studentId is required");
  });

  it("should return not-found when progress summary missing", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/student-1`, undefined as any);
    const req = makeRequest({ tenantId: TENANT, type: "progress", studentId: "student-1" });
    await expect(handler(req)).rejects.toThrow("Student progress summary not found");
  });

  it("should generate progress PDF and upload to storage", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/student-1`, {
      studentId: "student-1",
      overallScore: 0.78,
      isAtRisk: false,
      atRiskReasons: [],
      strengthAreas: ["Mathematics"],
      weaknessAreas: ["English"],
      autograde: {
        totalExams: 5,
        completedExams: 5,
        averagePercentage: 80,
        totalMarksObtained: 400,
        totalMarksAvailable: 500,
        subjectBreakdown: { Mathematics: { avgScore: 0.85, examCount: 3 } },
        recentExams: [{ examTitle: "Math Test", score: 0.85, percentage: 85 }],
      },
      levelup: {
        totalSpaces: 3,
        completedSpaces: 2,
        averageCompletion: 75,
        totalPointsEarned: 150,
        totalPointsAvailable: 200,
        averageAccuracy: 0.8,
        streakDays: 7,
        subjectBreakdown: {},
      },
    });
    mockFirestore.seedCollection("userMemberships", [
      {
        id: "um1",
        data: {
          tenantId: TENANT,
          uid: "student-1",
          role: "student",
          firstName: "Alice",
          lastName: "Smith",
        },
      },
    ]);

    const req = makeRequest({ tenantId: TENANT, type: "progress", studentId: "student-1" });
    const result = await handler(req);

    expect(result.pdfUrl).toBeDefined();
    expect(mockFile.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ metadata: { contentType: "application/pdf" } })
    );
    expect(mockFile.getSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: "read" }));
  });
});

describe("generateReport — class", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFile.save.mockResolvedValue(undefined);
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.example.com/class-report.pdf"]);
  });

  it("should require classId for class type", async () => {
    const req = makeRequest({ tenantId: TENANT, type: "class" });
    await expect(handler(req)).rejects.toThrow("classId is required");
  });

  it("should generate class report card PDF", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/classProgressSummaries/class-1`, {
      classId: "class-1",
      className: "Class A",
      autograde: { averageClassScore: 0.72, examCompletionRate: 0.9 },
      levelup: { averageClassCompletion: 68, activeStudentRate: 0.8 },
      atRiskCount: 1,
    });
    mockFirestore.seedDoc(`tenants/${TENANT}/classes/class-1`, {
      name: "Class A",
    });
    mockFirestore.seedCollection("userMemberships", [
      {
        id: "um1",
        data: {
          tenantId: TENANT,
          uid: "s1",
          role: "student",
          classIds: ["class-1"],
          firstName: "Alice",
          lastName: "Smith",
        },
      },
    ]);
    // Student progress summaries will be fetched individually — seedDoc for each
    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/s1`, {
      studentId: "s1",
      overallScore: 0.72,
      isAtRisk: false,
      atRiskReasons: [],
      autograde: {
        totalExams: 3,
        averagePercentage: 72,
        totalMarksObtained: 216,
        totalMarksAvailable: 300,
      },
      levelup: {
        totalSpaces: 2,
        completedSpaces: 1,
        averageCompletion: 65,
        totalPointsEarned: 100,
      },
    });

    const req = makeRequest({ tenantId: TENANT, type: "class", classId: "class-1" });
    const result = await handler(req);

    expect(result.pdfUrl).toBeDefined();
    expect(result.pdfUrl).toContain("storage.example.com");
  });

  it("should handle class with no progress summary gracefully", async () => {
    mockFirestore.seedDoc(`tenants/${TENANT}/classProgressSummaries/class-1`, undefined as any);
    mockFirestore.seedDoc(`tenants/${TENANT}/classes/class-1`, { name: "Class B" });
    mockFirestore.seedCollection("userMemberships", []);

    const req = makeRequest({ tenantId: TENANT, type: "class", classId: "class-1" });
    const result = await handler(req);

    // Should still generate PDF even without summary (uses fallback values)
    expect(result.pdfUrl).toBeDefined();
  });
});

describe("generateReport — storage upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload with correct content type", async () => {
    mockFile.save.mockResolvedValue(undefined);
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.example.com/test.pdf"]);

    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/student-1`, {
      studentId: "student-1",
      overallScore: 0.5,
      isAtRisk: false,
      atRiskReasons: [],
      strengthAreas: [],
      weaknessAreas: [],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 0,
        completedSpaces: 0,
        averageCompletion: 0,
        totalPointsEarned: 0,
        totalPointsAvailable: 0,
        averageAccuracy: 0,
        streakDays: 0,
        subjectBreakdown: {},
      },
    });
    mockFirestore.seedCollection("userMemberships", []);

    const req = makeRequest({ tenantId: TENANT, type: "progress", studentId: "student-1" });
    await handler(req);

    expect(mockFile.save).toHaveBeenCalledWith(expect.any(Buffer), {
      metadata: { contentType: "application/pdf" },
    });
  });

  it("should generate signed URL with 1-hour expiry", async () => {
    mockFile.save.mockResolvedValue(undefined);
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.example.com/test.pdf"]);

    mockFirestore.seedDoc(`tenants/${TENANT}/studentProgressSummaries/student-1`, {
      studentId: "student-1",
      overallScore: 0.5,
      isAtRisk: false,
      atRiskReasons: [],
      strengthAreas: [],
      weaknessAreas: [],
      autograde: {
        totalExams: 0,
        completedExams: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      },
      levelup: {
        totalSpaces: 0,
        completedSpaces: 0,
        averageCompletion: 0,
        totalPointsEarned: 0,
        totalPointsAvailable: 0,
        averageAccuracy: 0,
        streakDays: 0,
        subjectBreakdown: {},
      },
    });
    mockFirestore.seedCollection("userMemberships", []);

    const req = makeRequest({ tenantId: TENANT, type: "progress", studentId: "student-1" });
    await handler(req);

    const signedUrlCall = mockFile.getSignedUrl.mock.calls[0][0];
    expect(signedUrlCall.action).toBe("read");
    // Expires should be roughly 1 hour from now
    expect(signedUrlCall.expires).toBeGreaterThan(Date.now());
    expect(signedUrlCall.expires).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000 + 1000);
  });
});
