/**
 * PDF generation helper utilities using PDFKit.
 * Provides reusable primitives for building structured PDF reports.
 */
export declare const COLORS: {
  readonly primary: "#1e40af";
  readonly secondary: "#6b7280";
  readonly accent: "#059669";
  readonly danger: "#dc2626";
  readonly warning: "#d97706";
  readonly headerBg: "#1e3a5f";
  readonly lightGray: "#f3f4f6";
  readonly border: "#d1d5db";
  readonly text: "#111827";
  readonly muted: "#6b7280";
};
export declare const FONTS: {
  readonly heading: "Helvetica-Bold";
  readonly body: "Helvetica";
  readonly mono: "Courier";
};
export declare function createPdfDocument(): PDFKit.PDFDocument;
export declare function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void;
export declare function addSectionTitle(doc: PDFKit.PDFDocument, title: string): void;
export declare function addKeyValue(
  doc: PDFKit.PDFDocument,
  key: string,
  value: string | number
): void;
export declare function drawHorizontalLine(doc: PDFKit.PDFDocument): void;
export declare function addSimpleTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: (string | number)[][],
  colWidths?: number[]
): void;
export declare function addFooter(doc: PDFKit.PDFDocument, text: string): void;
export declare function getGradeColor(percentage: number): string;
/**
 * Collect PDF document output into a Buffer.
 */
export declare function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer>;
