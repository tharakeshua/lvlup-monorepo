import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSecretName,
  getGeminiApiKey,
  PLATFORM_GEMINI_SECRET_NAME,
  setGeminiApiKey,
  deleteGeminiApiKey,
  _setClientForTesting,
} from "../../ai/secret-manager";

/**
 * Tests for secret-manager — GCP Secret Manager key operations.
 *
 * Uses _setClientForTesting to inject a mock client.
 */

describe("secret-manager", () => {
  const mockClient = {
    accessSecretVersion: vi.fn(),
    createSecret: vi.fn(),
    addSecretVersion: vi.fn(),
    deleteSecret: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _setClientForTesting(mockClient as any);
    // Set env for project ID
    process.env["GCLOUD_PROJECT"] = "test-project";
    delete process.env["LEVELUP_AI_KEY"];
    delete process.env["GEMINI_API_KEY"];
  });

  // ── getSecretName ──────────────────────────────────────────────────
  describe("getSecretName", () => {
    it("returns correct pattern", () => {
      expect(getSecretName("tenant-abc")).toBe("tenant-tenant-abc-gemini");
    });
  });

  // ── getGeminiApiKey ────────────────────────────────────────────────
  describe("getGeminiApiKey", () => {
    it("uses LEVELUP_AI_KEY without reading Secret Manager", async () => {
      process.env["LEVELUP_AI_KEY"] = "platform-env-key";

      await expect(getGeminiApiKey("tenant-1", "test-project")).resolves.toBe("platform-env-key");
      expect(mockClient.accessSecretVersion).not.toHaveBeenCalled();
    });

    it("retrieves key successfully", async () => {
      mockClient.accessSecretVersion.mockResolvedValue([
        { payload: { data: Buffer.from("my-api-key") } },
      ]);

      const key = await getGeminiApiKey("tenant-1", "test-project");
      expect(key).toBe("my-api-key");
      expect(mockClient.accessSecretVersion).toHaveBeenCalledWith({
        name: `projects/test-project/secrets/${PLATFORM_GEMINI_SECRET_NAME}/versions/latest`,
      });
    });

    it("falls back to the tenant key when the platform default is absent", async () => {
      mockClient.accessSecretVersion
        .mockRejectedValueOnce(Object.assign(new Error("NOT_FOUND"), { code: 5 }))
        .mockResolvedValueOnce([{ payload: { data: Buffer.from("tenant-key") } }]);

      await expect(getGeminiApiKey("tenant-1", "test-project")).resolves.toBe("tenant-key");
      expect(mockClient.accessSecretVersion).toHaveBeenLastCalledWith({
        name: "projects/test-project/secrets/tenant-tenant-1-gemini/versions/latest",
      });
    });

    it("throws when no project ID available", async () => {
      delete process.env["GCLOUD_PROJECT"];
      delete process.env["GCP_PROJECT"];

      await expect(getGeminiApiKey("tenant-1")).rejects.toThrow("No GCP project ID");
    });

    it("throws when no payload data", async () => {
      mockClient.accessSecretVersion.mockResolvedValue([{ payload: { data: undefined } }]);

      await expect(getGeminiApiKey("tenant-1", "test-project")).rejects.toThrow("no payload");
    });

    it("handles Uint8Array payload", async () => {
      const encoded = new TextEncoder().encode("uint8-key");
      mockClient.accessSecretVersion.mockResolvedValue([{ payload: { data: encoded } }]);

      const key = await getGeminiApiKey("tenant-1", "test-project");
      expect(key).toBe("uint8-key");
    });

    it("handles string payload", async () => {
      mockClient.accessSecretVersion.mockResolvedValue([{ payload: { data: "string-key" } }]);

      const key = await getGeminiApiKey("tenant-1", "test-project");
      expect(key).toBe("string-key");
    });

    it("trims whitespace from key", async () => {
      mockClient.accessSecretVersion.mockResolvedValue([
        { payload: { data: "  my-key-with-spaces  " } },
      ]);

      const key = await getGeminiApiKey("tenant-1", "test-project");
      expect(key).toBe("my-key-with-spaces");
    });

    it("throws on empty key after trimming", async () => {
      mockClient.accessSecretVersion.mockResolvedValue([{ payload: { data: "   " } }]);

      await expect(getGeminiApiKey("tenant-1", "test-project")).rejects.toThrow("empty");
    });
  });

  // ── setGeminiApiKey ────────────────────────────────────────────────
  describe("setGeminiApiKey", () => {
    it("creates secret and adds version", async () => {
      mockClient.createSecret.mockResolvedValue([{}]);
      mockClient.addSecretVersion.mockResolvedValue([{}]);

      await setGeminiApiKey("tenant-1", "new-key", "test-project");

      expect(mockClient.createSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: "projects/test-project",
          secretId: "tenant-tenant-1-gemini",
        })
      );
      expect(mockClient.addSecretVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: "projects/test-project/secrets/tenant-tenant-1-gemini",
        })
      );
    });

    it("handles ALREADY_EXISTS error (code 6)", async () => {
      const alreadyExistsErr = { code: 6, message: "ALREADY_EXISTS" };
      mockClient.createSecret.mockRejectedValue(alreadyExistsErr);
      mockClient.addSecretVersion.mockResolvedValue([{}]);

      // Should NOT throw — ALREADY_EXISTS is OK
      await expect(setGeminiApiKey("tenant-1", "new-key", "test-project")).resolves.toBeUndefined();
      expect(mockClient.addSecretVersion).toHaveBeenCalled();
    });

    it("throws on other create errors", async () => {
      mockClient.createSecret.mockRejectedValue(new Error("PERMISSION_DENIED"));

      await expect(setGeminiApiKey("tenant-1", "new-key", "test-project")).rejects.toThrow(
        "PERMISSION_DENIED"
      );
    });
  });

  // ── deleteGeminiApiKey ─────────────────────────────────────────────
  describe("deleteGeminiApiKey", () => {
    it("deletes secret successfully", async () => {
      mockClient.deleteSecret.mockResolvedValue([{}]);

      await deleteGeminiApiKey("tenant-1", "test-project");

      expect(mockClient.deleteSecret).toHaveBeenCalledWith({
        name: "projects/test-project/secrets/tenant-tenant-1-gemini",
      });
    });

    it("throws when no project ID available", async () => {
      delete process.env["GCLOUD_PROJECT"];
      delete process.env["GCP_PROJECT"];

      await expect(deleteGeminiApiKey("tenant-1")).rejects.toThrow("No GCP project ID");
    });
  });
});
