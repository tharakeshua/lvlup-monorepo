import {
  FirebaseStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
  StorageReference,
  UploadMetadata,
  UploadResult,
} from "firebase/storage";
import { getFirebaseServices } from "../firebase";

/**
 * Storage Service
 * Provides org-scoped file storage operations
 */
export class StorageService {
  private _storage: FirebaseStorage | null;

  constructor(storage?: FirebaseStorage) {
    this._storage = storage ?? null;
  }

  private get storage(): FirebaseStorage {
    if (!this._storage) {
      this._storage = getFirebaseServices().storage;
    }
    return this._storage;
  }

  /**
   * Get organization-scoped storage path
   */
  getOrgPath(orgId: string, path: string): string {
    return `organizations/${orgId}/${path}`;
  }

  /**
   * Upload a file to org-scoped storage
   */
  async uploadFile(
    orgId: string,
    path: string,
    file: Blob | Uint8Array | ArrayBuffer,
    metadata?: UploadMetadata
  ): Promise<UploadResult> {
    const storageRef = ref(this.storage, this.getOrgPath(orgId, path));
    return uploadBytes(storageRef, file, metadata);
  }

  /**
   * Upload a string (base64, data URL, etc.) to storage
   */
  async uploadString(
    orgId: string,
    path: string,
    data: string,
    format?: "raw" | "base64" | "base64url" | "data_url",
    metadata?: UploadMetadata
  ): Promise<UploadResult> {
    const storageRef = ref(this.storage, this.getOrgPath(orgId, path));
    return uploadString(storageRef, data, format, metadata);
  }

  /**
   * Get download URL for a file
   */
  async getDownloadURL(orgId: string, path: string): Promise<string> {
    const storageRef = ref(this.storage, this.getOrgPath(orgId, path));
    return getDownloadURL(storageRef);
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(orgId: string, path: string): Promise<void> {
    const storageRef = ref(this.storage, this.getOrgPath(orgId, path));
    return deleteObject(storageRef);
  }

  /**
   * List all files in a directory
   */
  async listFiles(orgId: string, path: string): Promise<StorageReference[]> {
    const storageRef = ref(this.storage, this.getOrgPath(orgId, path));
    const result = await listAll(storageRef);
    return result.items;
  }

  /**
   * Get storage reference for advanced usage
   */
  getStorageRef(orgId: string, path: string): StorageReference {
    return ref(this.storage, this.getOrgPath(orgId, path));
  }

  /**
   * Get storage instance for advanced usage
   */
  getStorageInstance(): FirebaseStorage {
    return this.storage;
  }
}

// Export singleton instance
export const storageService = new StorageService();

// Re-export Storage utilities
export { ref as storageRef, type StorageReference, type UploadMetadata, type UploadResult };

// ─────────────────────────────────────────────────────
// Item Media Helpers
// ─────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/", "application/pdf", "audio/"];

function isAllowedType(mimeType: string): boolean {
  return ALLOWED_TYPES.some((prefix) => mimeType.startsWith(prefix));
}

function getAttachmentType(mimeType: string): "image" | "pdf" | "audio" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "audio";
}

export interface UploadItemMediaResult {
  id: string;
  fileName: string;
  url: string;
  type: "image" | "pdf" | "audio";
  size: number;
  mimeType: string;
}

/**
 * Upload a media file for a learning item.
 * Stores at: tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/attachments/{fileId}
 */
export async function uploadItemMedia(
  tenantId: string,
  spaceId: string,
  itemId: string,
  file: File
): Promise<UploadItemMediaResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  if (!isAllowedType(file.type)) {
    throw new Error(
      `File type "${file.type}" is not supported. Allowed: images, PDFs, audio files.`
    );
  }

  const { storage } = getFirebaseServices();
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `tenants/${tenantId}/spaces/${spaceId}/items/${itemId}/attachments/${fileId}_${file.name}`;
  const storageRefObj = ref(storage, storagePath);

  await uploadBytes(storageRefObj, file, { contentType: file.type });
  const url = await getDownloadURL(storageRefObj);

  return {
    id: fileId,
    fileName: file.name,
    url,
    type: getAttachmentType(file.type),
    size: file.size,
    mimeType: file.type,
  };
}

/**
 * Delete a media attachment from storage.
 */
export async function deleteItemMedia(
  tenantId: string,
  spaceId: string,
  itemId: string,
  fileName: string,
  fileId: string
): Promise<void> {
  const { storage } = getFirebaseServices();
  const storagePath = `tenants/${tenantId}/spaces/${spaceId}/items/${itemId}/attachments/${fileId}_${fileName}`;
  const storageRefObj = ref(storage, storagePath);
  await deleteObject(storageRefObj);
}
