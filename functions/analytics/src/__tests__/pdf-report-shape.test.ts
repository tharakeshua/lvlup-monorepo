/**
 * U3.3 accept-gate: the pdfkit report path still renders after the domain
 * migration. Unlike generateReport.test.ts (which mocks pdf-helpers), this
 * drives the REAL pdf-helpers/pdfkit through the same call sequence
 * handleProgressReportPdf uses and shape-checks the produced document.
 */
import { describe, it, expect } from "vitest";
import {
  createPdfDocument,
  addHeader,
  addSectionTitle,
  addKeyValue,
  addSimpleTable,
  addFooter,
  drawHorizontalLine,
  pdfToBuffer,
  getGradeColor,
  FONTS,
  COLORS,
} from "../utils/pdf-helpers";

describe("pdf report rendering (real pdfkit)", () => {
  it("renders a progress-report-shaped document to a valid PDF buffer", async () => {
    const doc = createPdfDocument();

    addHeader(doc, "Student Progress Report", "Alice Example");

    addSectionTitle(doc, "Student Information");
    addKeyValue(doc, "Name", "Alice Example");
    addKeyValue(doc, "Overall Score", "72%");
    addKeyValue(doc, "At Risk", "No");
    doc.moveDown(0.5);

    addSectionTitle(doc, "AutoGrade — Exam Performance");
    addSimpleTable(
      doc,
      ["Subject", "Avg Score", "Exams"],
      [
        ["Math", "70%", 2],
        ["Science", "85%", 1],
      ],
      [200, 147, 148]
    );
    doc.moveDown(0.5);

    drawHorizontalLine(doc);
    doc
      .fontSize(28)
      .font(FONTS.heading)
      .fillColor(getGradeColor(72))
      .text("72%", { align: "center" });
    doc.fontSize(10).font(FONTS.body).fillColor(COLORS.text).text("Grade: B+");

    addFooter(doc, "LevelUp — Progress Report — Alice Example");

    const buffer = await pdfToBuffer(doc);

    // Shape checks: a real, non-trivial, complete PDF document.
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.toString("latin1")).toContain("%%EOF");
  });
});
