import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Firebase modules
// ---------------------------------------------------------------------------
const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: () => ({
    functions: { app: {}, region: "us-central1" },
  }),
}));

import { httpsCallable } from "firebase/functions";
import {
  callGetSummary,
  callGenerateReport,
  callGenerateExamResultPdf,
  callGenerateProgressReportPdf,
  callGenerateClassReportPdf,
} from "../reports/pdf-callables";

describe("pdf-callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("callGetSummary", () => {
    it("calls getSummary callable and returns data", async () => {
      mockCallable.mockResolvedValue({ data: { total: 50, average: 78 } });
      const result = await callGetSummary({ tenantId: "t1" } as any);
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "getSummary");
      expect(result).toEqual({ total: 50, average: 78 });
    });
  });

  describe("callGenerateReport", () => {
    it("calls generateReport callable and returns data", async () => {
      mockCallable.mockResolvedValue({ data: { reportUrl: "https://example.com/report.pdf" } });
      const result = await callGenerateReport({ tenantId: "t1", type: "class" } as any);
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "generateReport");
      expect(result).toEqual({ reportUrl: "https://example.com/report.pdf" });
    });
  });

  describe("callGenerateExamResultPdf", () => {
    it("calls generateExamResultPdf callable", async () => {
      const pdfResponse = { downloadUrl: "https://storage/exam.pdf", fileName: "exam.pdf" };
      mockCallable.mockResolvedValue({ data: pdfResponse });

      const result = await callGenerateExamResultPdf({ tenantId: "t1", examId: "e1" });
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "generateExamResultPdf");
      expect(result.downloadUrl).toBe("https://storage/exam.pdf");
      expect(result.fileName).toBe("exam.pdf");
    });
  });

  describe("callGenerateProgressReportPdf", () => {
    it("calls generateProgressReportPdf callable", async () => {
      const pdfResponse = { downloadUrl: "https://storage/progress.pdf", fileName: "progress.pdf" };
      mockCallable.mockResolvedValue({ data: pdfResponse });

      const result = await callGenerateProgressReportPdf({ tenantId: "t1", studentId: "s1" });
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "generateProgressReportPdf");
      expect(result.downloadUrl).toBe("https://storage/progress.pdf");
    });
  });

  describe("callGenerateClassReportPdf", () => {
    it("calls generateClassReportPdf callable", async () => {
      const pdfResponse = { downloadUrl: "https://storage/class.pdf", fileName: "class.pdf" };
      mockCallable.mockResolvedValue({ data: pdfResponse });

      const result = await callGenerateClassReportPdf({ tenantId: "t1", classId: "c1" });
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "generateClassReportPdf");
      expect(result.downloadUrl).toBe("https://storage/class.pdf");
    });

    it("propagates errors from the callable", async () => {
      mockCallable.mockRejectedValue(new Error("Internal error"));
      await expect(callGenerateClassReportPdf({ tenantId: "t1", classId: "c1" })).rejects.toThrow(
        "Internal error"
      );
    });
  });
});
