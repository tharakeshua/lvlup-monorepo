/**
 * Image compression utility for LLM processing
 * Compresses images to target size using Canvas API
 */

export interface CompressionOptions {
  maxSizeKB?: number;
  maxWidth?: number;
  maxHeight?: number;
  minQuality?: number;
}

/**
 * Compresses an image file to a target size
 * @param file - The image file to compress
 * @param maxSizeKB - Target maximum size in KB (default: 200)
 * @param maxDimensions - Maximum width/height dimensions
 * @returns Base64 data URL of compressed image
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = 200,
  maxDimensions: { width: number; height: number } = { width: 1920, height: 1920 }
): Promise<string> {
  // Validate input
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  // Load image
  const img = await loadImage(file);

  // Calculate target dimensions
  const { width: targetWidth, height: targetHeight } = calculateDimensions(
    img.width,
    img.height,
    maxDimensions.width,
    maxDimensions.height
  );

  // Try compression with iterative quality reduction
  let quality = 0.9;
  const minQuality = 0.3;
  const qualityStep = 0.1;

  let result: string | null = null;
  let currentWidth = targetWidth;
  let currentHeight = targetHeight;

  // Iterative compression loop
  while (quality >= minQuality) {
    const compressed = compressToCanvas(img, currentWidth, currentHeight, quality);
    const sizeKB = estimateSizeKB(compressed);

    if (sizeKB <= maxSizeKB) {
      result = compressed;
      break;
    }

    quality -= qualityStep;
  }

  // If still too large at minimum quality, try scaling down further
  if (!result) {
    const scaleFactor = 0.8;
    currentWidth = Math.floor(currentWidth * scaleFactor);
    currentHeight = Math.floor(currentHeight * scaleFactor);

    // Ensure minimum dimensions
    if (currentWidth < 100 || currentHeight < 100) {
      throw new Error("Image cannot be compressed to target size while maintaining quality");
    }

    result = compressToCanvas(img, currentWidth, currentHeight, minQuality);
  }

  return result;
}

/**
 * Load image from file
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));

      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate target dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if larger than max dimensions
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }

  return { width, height };
}

/**
 * Compress image using canvas
 */
function compressToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw image to canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Export as JPEG with specified quality
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Estimate size in KB from base64 data URL
 */
function estimateSizeKB(dataUrl: string): number {
  // Remove data URL prefix to get base64 string
  const base64 = dataUrl.split(",")[1] || dataUrl;

  // Base64 encoding: 4 characters per 3 bytes
  // Actual size = (base64_length * 3) / 4
  const bytes = (base64.length * 3) / 4;
  const kb = bytes / 1024;

  return kb;
}

/**
 * Extract base64 string without data URL prefix
 */
export function extractBase64(dataUrl: string): string {
  const parts = dataUrl.split(",");
  return parts.length > 1 ? parts[1]! : dataUrl;
}

/**
 * Batch compress multiple images
 */
export async function compressImages(
  files: File[],
  maxSizeKB: number = 200,
  maxDimensions: { width: number; height: number } = { width: 1920, height: 1920 }
): Promise<Array<{ base64: string; originalName: string; sizeKB: number }>> {
  const results = await Promise.all(
    files.map(async (file) => {
      const dataUrl = await compressImage(file, maxSizeKB, maxDimensions);
      const base64 = extractBase64(dataUrl);
      const sizeKB = Math.round(estimateSizeKB(dataUrl));

      return {
        base64,
        originalName: file.name,
        sizeKB,
      };
    })
  );

  return results;
}
