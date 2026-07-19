/**
 * Image quality pre-check utility for OCR extraction.
 *
 * Analyzes image metadata to detect potential quality issues
 * before sending to Gemini for question extraction.
 */
export type ImageFormat = "printed" | "handwritten" | "mixed" | "unknown";
export type QualitySeverity = "info" | "warning" | "error";
export interface ImageQualityWarning {
  code: string;
  message: string;
  severity: QualitySeverity;
}
export interface ImageQualityReport {
  imageIndex: number;
  mimeType: string;
  sizeBytes: number;
  estimatedResolution: "low" | "medium" | "high" | "unknown";
  warnings: ImageQualityWarning[];
  isAcceptable: boolean;
}
export interface ExtractionQualityReport {
  imageReports: ImageQualityReport[];
  overallAcceptable: boolean;
  warnings: string[];
  totalImages: number;
  acceptableCount: number;
}
/**
 * Assess image quality from metadata before sending to Gemini.
 * This is a lightweight check based on available metadata (no pixel analysis).
 */
export declare function assessImageQuality(
  images: Array<{
    base64: string;
    mimeType: string;
  }>
): ExtractionQualityReport;
