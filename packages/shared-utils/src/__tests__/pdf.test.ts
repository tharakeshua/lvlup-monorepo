import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock pdfjs-dist
// ---------------------------------------------------------------------------

const mockRenderPromise = { promise: Promise.resolve() };
const mockContext = {
  drawImage: vi.fn(),
  fillRect: vi.fn(),
};
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  toDataURL: vi.fn(() => "data:image/jpeg;base64,mockBase64Data"),
  height: 0,
  width: 0,
};

const mockPage = {
  getViewport: vi.fn(() => ({ width: 612, height: 792 })),
  render: vi.fn(() => mockRenderPromise),
};

const mockPdf = {
  numPages: 2,
  getPage: vi.fn(() => Promise.resolve(mockPage)),
};

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  default: {
    GlobalWorkerOptions: { workerSrc: "" },
    version: "3.0.0",
    getDocument: vi.fn(() => ({
      promise: Promise.resolve(mockPdf),
    })),
  },
  GlobalWorkerOptions: { workerSrc: "" },
  version: "3.0.0",
  getDocument: vi.fn(() => ({
    promise: Promise.resolve(mockPdf),
  })),
}));

// ---------------------------------------------------------------------------
// Mock browser APIs
// ---------------------------------------------------------------------------

// Track MockFileReader instances so tests can trigger onload/onerror
const mockFileReaderInstances: MockFileReader[] = [];

class MockFileReader {
  result: string = "data:application/pdf;base64,mockData";
  onload: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readAsDataURL = vi.fn();
  constructor() {
    mockFileReaderInstances.push(this);
  }
}

vi.stubGlobal("FileReader", MockFileReader);
vi.stubGlobal("document", {
  createElement: vi.fn(() => mockCanvas),
});

// Import after mocks
import { convertPdfToImages, fileToBase64 } from "../pdf";

describe("pdf utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileReaderInstances.length = 0;
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockPdf.numPages = 2;
    mockPdf.getPage.mockResolvedValue(mockPage);
  });

  // ── convertPdfToImages ────────────────────────────────────────────

  describe("convertPdfToImages", () => {
    it("converts PDF pages to base64 images", async () => {
      const file = new File(["pdf-content"], "test.pdf", { type: "application/pdf" });

      const images = await convertPdfToImages(file);

      expect(images).toHaveLength(2);
      expect(images[0]).toBe("data:image/jpeg;base64,mockBase64Data");
      expect(images[1]).toBe("data:image/jpeg;base64,mockBase64Data");
    });

    it("uses 2x scale for viewport", async () => {
      const file = new File(["pdf-content"], "test.pdf", { type: "application/pdf" });

      await convertPdfToImages(file);

      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 2.0 });
    });

    it("handles multiple pages", async () => {
      mockPdf.numPages = 3;
      const file = new File(["pdf-content"], "test.pdf", { type: "application/pdf" });

      const images = await convertPdfToImages(file);

      expect(images).toHaveLength(3);
      expect(mockPdf.getPage).toHaveBeenCalledTimes(3);
      expect(mockPdf.getPage).toHaveBeenCalledWith(1);
      expect(mockPdf.getPage).toHaveBeenCalledWith(2);
      expect(mockPdf.getPage).toHaveBeenCalledWith(3);
    });

    it("skips pages without canvas context", async () => {
      mockPdf.numPages = 2;
      // First page returns null context, second page works fine
      mockCanvas.getContext
        .mockReturnValueOnce(null as unknown as typeof mockContext)
        .mockReturnValueOnce(mockContext);

      const file = new File(["pdf-content"], "test.pdf", { type: "application/pdf" });

      const images = await convertPdfToImages(file);

      // Only the second page should produce an image
      expect(images).toHaveLength(1);
    });
  });

  // ── fileToBase64 ──────────────────────────────────────────────────

  describe("fileToBase64", () => {
    it("converts file to data URL string", async () => {
      const file = new File(["hello"], "test.txt", { type: "text/plain" });

      const promise = fileToBase64(file);

      // Let the promise executor run so onload is assigned
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger onload on the captured instance
      const lastInstance = mockFileReaderInstances[mockFileReaderInstances.length - 1];
      if (lastInstance?.onload) {
        lastInstance.onload();
      }

      const result = await promise;
      expect(result).toBe("data:application/pdf;base64,mockData");
    });

    it("rejects on reader error", async () => {
      const file = new File(["hello"], "test.txt", { type: "text/plain" });

      const promise = fileToBase64(file);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const lastInstance = mockFileReaderInstances[mockFileReaderInstances.length - 1];
      const readError = new Error("Read failed");
      if (lastInstance?.onerror) {
        lastInstance.onerror(readError);
      }

      await expect(promise).rejects.toEqual(readError);
    });
  });
});
