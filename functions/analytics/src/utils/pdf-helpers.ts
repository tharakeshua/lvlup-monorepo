/**
 * PDF generation helper utilities using PDFKit.
 * Provides reusable primitives for building structured PDF reports.
 */

import PDFDocument from "pdfkit";

// ── Colors & Constants ─────────────────────────────────────────────────────

export const COLORS = {
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
} as const;

export const FONTS = {
  heading: "Helvetica-Bold",
  body: "Helvetica",
  mono: "Courier",
} as const;

// ── Helper Functions ───────────────────────────────────────────────────────

export function createPdfDocument(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
    info: {
      Producer: "LevelUp Platform",
      Creator: "LevelUp AutoGrade",
    },
  });
}

export function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  doc.fontSize(20).font(FONTS.heading).fillColor(COLORS.primary).text(title, { align: "center" });

  if (subtitle) {
    doc.fontSize(10).font(FONTS.body).fillColor(COLORS.muted).text(subtitle, { align: "center" });
  }

  doc.moveDown(0.5);
  drawHorizontalLine(doc);
  doc.moveDown(0.5);
}

export function addSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.fontSize(14).font(FONTS.heading).fillColor(COLORS.primary).text(title);
  doc.moveDown(0.3);
}

export function addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string | number): void {
  const y = doc.y;
  doc
    .fontSize(10)
    .font(FONTS.heading)
    .fillColor(COLORS.muted)
    .text(`${key}:`, 50, y, { continued: true })
    .font(FONTS.body)
    .fillColor(COLORS.text)
    .text(` ${value}`);
}

export function drawHorizontalLine(doc: PDFKit.PDFDocument): void {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .stroke();
}

export function addSimpleTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: (string | number)[][],
  colWidths?: number[]
): void {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = headers.length;
  const widths = colWidths || headers.map(() => pageWidth / cols);
  const startX = doc.page.margins.left;
  const rowHeight = 22;

  // Header row
  let x = startX;
  const headerY = doc.y;
  doc.rect(startX, headerY, pageWidth, rowHeight).fill(COLORS.headerBg);

  headers.forEach((h, i) => {
    doc
      .fontSize(9)
      .font(FONTS.heading)
      .fillColor("#ffffff")
      .text(h, x + 4, headerY + 6, { width: widths[i] - 8, align: "left" });
    x += widths[i];
  });

  doc.y = headerY + rowHeight;

  // Data rows
  rows.forEach((row, rowIndex) => {
    const rowY = doc.y;

    // Check page break
    if (rowY + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }

    const currentY = doc.y;
    if (rowIndex % 2 === 0) {
      doc.rect(startX, currentY, pageWidth, rowHeight).fill(COLORS.lightGray);
    }

    x = startX;
    row.forEach((cell, i) => {
      doc
        .fontSize(9)
        .font(FONTS.body)
        .fillColor(COLORS.text)
        .text(String(cell), x + 4, currentY + 6, {
          width: widths[i] - 8,
          align: "left",
        });
      x += widths[i];
    });

    doc.y = currentY + rowHeight;
  });
}

export function addFooter(doc: PDFKit.PDFDocument, text: string): void {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font(FONTS.body)
      .fillColor(COLORS.muted)
      .text(`${text} | Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 35, {
        align: "center",
        width: doc.page.width - 100,
      });
  }
}

export function getGradeColor(percentage: number): string {
  if (percentage >= 80) return COLORS.accent;
  if (percentage >= 60) return COLORS.primary;
  if (percentage >= 40) return COLORS.warning;
  return COLORS.danger;
}

/**
 * Collect PDF document output into a Buffer.
 */
export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
