"use strict";
/**
 * PDF generation helper utilities using PDFKit.
 * Provides reusable primitives for building structured PDF reports.
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.FONTS = exports.COLORS = void 0;
exports.createPdfDocument = createPdfDocument;
exports.addHeader = addHeader;
exports.addSectionTitle = addSectionTitle;
exports.addKeyValue = addKeyValue;
exports.drawHorizontalLine = drawHorizontalLine;
exports.addSimpleTable = addSimpleTable;
exports.addFooter = addFooter;
exports.getGradeColor = getGradeColor;
exports.pdfToBuffer = pdfToBuffer;
const pdfkit_1 = __importDefault(require("pdfkit"));
// ── Colors & Constants ─────────────────────────────────────────────────────
exports.COLORS = {
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
};
exports.FONTS = {
  heading: "Helvetica-Bold",
  body: "Helvetica",
  mono: "Courier",
};
// ── Helper Functions ───────────────────────────────────────────────────────
function createPdfDocument() {
  return new pdfkit_1.default({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
    info: {
      Producer: "LevelUp Platform",
      Creator: "LevelUp AutoGrade",
    },
  });
}
function addHeader(doc, title, subtitle) {
  doc
    .fontSize(20)
    .font(exports.FONTS.heading)
    .fillColor(exports.COLORS.primary)
    .text(title, { align: "center" });
  if (subtitle) {
    doc
      .fontSize(10)
      .font(exports.FONTS.body)
      .fillColor(exports.COLORS.muted)
      .text(subtitle, { align: "center" });
  }
  doc.moveDown(0.5);
  drawHorizontalLine(doc);
  doc.moveDown(0.5);
}
function addSectionTitle(doc, title) {
  doc.fontSize(14).font(exports.FONTS.heading).fillColor(exports.COLORS.primary).text(title);
  doc.moveDown(0.3);
}
function addKeyValue(doc, key, value) {
  const y = doc.y;
  doc
    .fontSize(10)
    .font(exports.FONTS.heading)
    .fillColor(exports.COLORS.muted)
    .text(`${key}:`, 50, y, { continued: true })
    .font(exports.FONTS.body)
    .fillColor(exports.COLORS.text)
    .text(` ${value}`);
}
function drawHorizontalLine(doc) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .strokeColor(exports.COLORS.border)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .stroke();
}
function addSimpleTable(doc, headers, rows, colWidths) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = headers.length;
  const widths = colWidths || headers.map(() => pageWidth / cols);
  const startX = doc.page.margins.left;
  const rowHeight = 22;
  // Header row
  let x = startX;
  const headerY = doc.y;
  doc.rect(startX, headerY, pageWidth, rowHeight).fill(exports.COLORS.headerBg);
  headers.forEach((h, i) => {
    doc
      .fontSize(9)
      .font(exports.FONTS.heading)
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
      doc.rect(startX, currentY, pageWidth, rowHeight).fill(exports.COLORS.lightGray);
    }
    x = startX;
    row.forEach((cell, i) => {
      doc
        .fontSize(9)
        .font(exports.FONTS.body)
        .fillColor(exports.COLORS.text)
        .text(String(cell), x + 4, currentY + 6, {
          width: widths[i] - 8,
          align: "left",
        });
      x += widths[i];
    });
    doc.y = currentY + rowHeight;
  });
}
function addFooter(doc, text) {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font(exports.FONTS.body)
      .fillColor(exports.COLORS.muted)
      .text(`${text} | Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 35, {
        align: "center",
        width: doc.page.width - 100,
      });
  }
}
function getGradeColor(percentage) {
  if (percentage >= 80) return exports.COLORS.accent;
  if (percentage >= 60) return exports.COLORS.primary;
  if (percentage >= 40) return exports.COLORS.warning;
  return exports.COLORS.danger;
}
/**
 * Collect PDF document output into a Buffer.
 */
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
//# sourceMappingURL=pdf-helpers.js.map
