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

const MIN_IMAGE_SIZE_BYTES = 10_000; // 10KB minimum
const MAX_IMAGE_SIZE_BYTES = 20_000_000; // 20MB maximum
// Images below this threshold are likely too low resolution for reliable OCR
const LOW_RES_THRESHOLD_BYTES = 50_000; // ~50KB
// Images below this threshold are likely blank or nearly empty
const POSSIBLY_BLANK_THRESHOLD_BYTES = 15_000; // ~15KB
// Images in this range may have very low contrast / illegible writing
const LOW_CONTRAST_THRESHOLD_BYTES = 30_000; // ~30KB
const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/**
 * Estimate image resolution quality from file size.
 * This is a rough heuristic — not pixel-level analysis.
 */
function estimateResolution(
  sizeBytes: number,
  mimeType: string
): "low" | "medium" | "high" | "unknown" {
  if (mimeType === "application/pdf") return "unknown";
  if (sizeBytes < LOW_RES_THRESHOLD_BYTES) return "low";
  if (sizeBytes < 500_000) return "medium"; // < 500KB
  return "high";
}

/**
 * Assess image quality from metadata before sending to Gemini.
 * This is a lightweight check based on available metadata (no pixel analysis).
 */
export function assessImageQuality(
  images: Array<{ base64: string; mimeType: string }>
): ExtractionQualityReport {
  const imageReports: ImageQualityReport[] = [];
  const overallWarnings: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const sizeBytes = Math.ceil((img.base64.length * 3) / 4); // Approximate decoded size
    const warnings: ImageQualityWarning[] = [];

    // Check MIME type
    if (!SUPPORTED_MIME_TYPES.has(img.mimeType)) {
      warnings.push({
        code: "UNSUPPORTED_FORMAT",
        message: `Image ${i + 1} has unsupported format: ${img.mimeType}`,
        severity: "warning",
      });
    }

    // Check for blank/empty answer sheets
    if (sizeBytes < POSSIBLY_BLANK_THRESHOLD_BYTES && img.mimeType !== "application/pdf") {
      warnings.push({
        code: "POSSIBLY_BLANK",
        message: `Image ${i + 1} appears to be blank or nearly empty (${Math.round(sizeBytes / 1024)}KB). Student may not have answered this question.`,
        severity: "warning",
      });
    } else if (
      sizeBytes < LOW_CONTRAST_THRESHOLD_BYTES &&
      sizeBytes >= POSSIBLY_BLANK_THRESHOLD_BYTES &&
      img.mimeType !== "application/pdf"
    ) {
      warnings.push({
        code: "LOW_CONTRAST",
        message: `Image ${i + 1} has very low content (${Math.round(sizeBytes / 1024)}KB). Writing may be illegible or very faint.`,
        severity: "warning",
      });
    }

    // Check file size
    if (sizeBytes < MIN_IMAGE_SIZE_BYTES) {
      warnings.push({
        code: "TOO_SMALL",
        message: `Image ${i + 1} is very small (${Math.round(sizeBytes / 1024)}KB). May be low resolution or blank.`,
        severity: "warning",
      });
    }

    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      warnings.push({
        code: "TOO_LARGE",
        message: `Image ${i + 1} is very large (${Math.round(sizeBytes / 1_000_000)}MB). Processing may be slow.`,
        severity: "info",
      });
    }

    // Check estimated resolution
    const estimatedResolution = estimateResolution(sizeBytes, img.mimeType);
    if (estimatedResolution === "low") {
      warnings.push({
        code: "LOW_RESOLUTION",
        message: `Image ${i + 1} may be low resolution (${Math.round(sizeBytes / 1024)}KB). OCR accuracy may be reduced.`,
        severity: "warning",
      });
    }

    const hasErrors = warnings.some((w) => w.severity === "error");

    imageReports.push({
      imageIndex: i,
      mimeType: img.mimeType,
      sizeBytes,
      estimatedResolution,
      warnings,
      isAcceptable: !hasErrors,
    });
  }

  const overallAcceptable = imageReports.every((r) => r.isAcceptable);
  const acceptableCount = imageReports.filter((r) => r.isAcceptable).length;

  // Aggregate warnings for teacher review
  for (const report of imageReports) {
    for (const w of report.warnings) {
      if (w.severity !== "info") {
        overallWarnings.push(w.message);
      }
    }
  }

  return {
    imageReports,
    overallAcceptable,
    warnings: overallWarnings,
    totalImages: images.length,
    acceptableCount,
  };
}
