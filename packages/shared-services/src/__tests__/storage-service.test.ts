import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase/storage
const mockRef = vi.fn();
const mockUploadBytes = vi.fn();
const mockUploadString = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockDeleteObject = vi.fn();
const mockListAll = vi.fn();

vi.mock("firebase/storage", () => ({
  ref: (...args: any[]) => mockRef(...args),
  uploadBytes: (...args: any[]) => mockUploadBytes(...args),
  uploadString: (...args: any[]) => mockUploadString(...args),
  getDownloadURL: (...args: any[]) => mockGetDownloadURL(...args),
  deleteObject: (...args: any[]) => mockDeleteObject(...args),
  listAll: (...args: any[]) => mockListAll(...args),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: () => ({
    storage: { app: {}, _isFirebaseStorage: true },
  }),
}));

import { StorageService } from "../storage/index";

describe("StorageService", () => {
  let service: StorageService;
  const mockStorage = { app: {}, _isFirebaseStorage: true } as any;
  const orgId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorageService(mockStorage);
    // Default: mockRef returns a fake StorageReference-like object
    mockRef.mockImplementation((_storage: any, path: string) => ({
      fullPath: path,
      name: path.split("/").pop(),
    }));
  });

  describe("getOrgPath", () => {
    it("prefixes path with organizations/{orgId}/", () => {
      expect(service.getOrgPath(orgId, "images/photo.png")).toBe(
        "organizations/org-123/images/photo.png"
      );
    });
  });

  describe("uploadFile", () => {
    it("uploads a blob and returns the upload result", async () => {
      const fakeResult = { ref: { fullPath: "organizations/org-123/file.txt" }, metadata: {} };
      mockUploadBytes.mockResolvedValue(fakeResult);

      const blob = new Blob(["hello"]);
      const result = await service.uploadFile(orgId, "file.txt", blob);

      expect(mockRef).toHaveBeenCalledWith(mockStorage, "organizations/org-123/file.txt");
      expect(mockUploadBytes).toHaveBeenCalledWith(
        expect.objectContaining({ fullPath: "organizations/org-123/file.txt" }),
        blob,
        undefined
      );
      expect(result).toBe(fakeResult);
    });

    it("passes metadata with content type when provided", async () => {
      const fakeResult = { ref: {}, metadata: { contentType: "image/png" } };
      mockUploadBytes.mockResolvedValue(fakeResult);

      const data = new Uint8Array([1, 2, 3]);
      const metadata = { contentType: "image/png" };
      await service.uploadFile(orgId, "img.png", data, metadata);

      expect(mockUploadBytes).toHaveBeenCalledWith(expect.anything(), data, metadata);
    });
  });

  describe("uploadString", () => {
    it("uploads a base64 string", async () => {
      const fakeResult = { ref: {}, metadata: {} };
      mockUploadString.mockResolvedValue(fakeResult);

      const result = await service.uploadString(orgId, "doc.txt", "aGVsbG8=", "base64");

      expect(mockUploadString).toHaveBeenCalledWith(
        expect.objectContaining({ fullPath: "organizations/org-123/doc.txt" }),
        "aGVsbG8=",
        "base64",
        undefined
      );
      expect(result).toBe(fakeResult);
    });

    it("uploads a data URL string with metadata", async () => {
      const fakeResult = { ref: {}, metadata: {} };
      mockUploadString.mockResolvedValue(fakeResult);

      const dataUrl = "data:text/plain;base64,aGVsbG8=";
      const metadata = { contentType: "text/plain" };
      await service.uploadString(orgId, "doc.txt", dataUrl, "data_url", metadata);

      expect(mockUploadString).toHaveBeenCalledWith(
        expect.anything(),
        dataUrl,
        "data_url",
        metadata
      );
    });
  });

  describe("getDownloadURL", () => {
    it("returns download URL for an existing file", async () => {
      mockGetDownloadURL.mockResolvedValue("https://storage.example.com/file.txt?token=abc");

      const url = await service.getDownloadURL(orgId, "file.txt");

      expect(mockRef).toHaveBeenCalledWith(mockStorage, "organizations/org-123/file.txt");
      expect(url).toBe("https://storage.example.com/file.txt?token=abc");
    });

    it("throws when file does not exist", async () => {
      mockGetDownloadURL.mockRejectedValue(new Error("storage/object-not-found"));

      await expect(service.getDownloadURL(orgId, "missing.txt")).rejects.toThrow(
        "storage/object-not-found"
      );
    });
  });

  describe("deleteFile", () => {
    it("deletes a file from storage", async () => {
      mockDeleteObject.mockResolvedValue(undefined);

      await service.deleteFile(orgId, "file.txt");

      expect(mockRef).toHaveBeenCalledWith(mockStorage, "organizations/org-123/file.txt");
      expect(mockDeleteObject).toHaveBeenCalledWith(
        expect.objectContaining({ fullPath: "organizations/org-123/file.txt" })
      );
    });

    it("throws when deleting a non-existing file", async () => {
      mockDeleteObject.mockRejectedValue(new Error("storage/object-not-found"));

      await expect(service.deleteFile(orgId, "missing.txt")).rejects.toThrow(
        "storage/object-not-found"
      );
    });
  });

  describe("listFiles", () => {
    it("returns array of file references", async () => {
      const items = [
        { fullPath: "organizations/org-123/docs/a.txt", name: "a.txt" },
        { fullPath: "organizations/org-123/docs/b.txt", name: "b.txt" },
      ];
      mockListAll.mockResolvedValue({ items, prefixes: [] });

      const result = await service.listFiles(orgId, "docs");

      expect(mockRef).toHaveBeenCalledWith(mockStorage, "organizations/org-123/docs");
      expect(result).toEqual(items);
    });

    it("returns empty array for an empty directory", async () => {
      mockListAll.mockResolvedValue({ items: [], prefixes: [] });

      const result = await service.listFiles(orgId, "empty-dir");

      expect(result).toEqual([]);
    });
  });

  describe("getStorageRef", () => {
    it("returns a valid storage reference with org-scoped path", () => {
      const refResult = service.getStorageRef(orgId, "uploads/file.pdf");

      expect(mockRef).toHaveBeenCalledWith(mockStorage, "organizations/org-123/uploads/file.pdf");
      expect(refResult).toEqual(
        expect.objectContaining({ fullPath: "organizations/org-123/uploads/file.pdf" })
      );
    });
  });

  describe("lazy storage initialization", () => {
    it("resolves storage from getFirebaseServices when not injected", () => {
      const lazyService = new StorageService();
      // Trigger the lazy getter by calling a method
      lazyService.getStorageRef("org-1", "test.txt");

      // mockRef is called, meaning storage was resolved from the mock
      expect(mockRef).toHaveBeenCalled();
    });
  });
});
