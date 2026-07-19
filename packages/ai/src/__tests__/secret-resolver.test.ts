import { describe, expect, it, vi } from "vitest";
import {
  createSecretResolver,
  PLATFORM_GEMINI_SECRET_NAME,
  secretNameFor,
} from "../secrets/secret-manager.js";
import type { TenantId } from "@levelup/domain";

const TENANT_ID = "tenant-smoke" as TenantId;
const PROJECT_ID = "project-smoke";

function notFound(): Error & { code: number } {
  return Object.assign(new Error("5 NOT_FOUND"), { code: 5 });
}

describe("createSecretResolver key precedence", () => {
  it("uses LEVELUP_AI_KEY as the explicit all-tenant override", async () => {
    const accessSecretVersion = vi.fn();
    const resolver = createSecretResolver({
      projectId: PROJECT_ID,
      env: { LEVELUP_AI_KEY: "platform-env-key" } as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });

    await expect(resolver.getApiKey(TENANT_ID)).resolves.toBe("platform-env-key");
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });

  it("uses the tenant Secret Manager key before the platform default", async () => {
    const accessSecretVersion = vi.fn(async ({ name }: { name: string }) => {
      expect(name).toContain(`/secrets/${secretNameFor(TENANT_ID)}/`);
      return [{ payload: { data: Buffer.from("tenant-secret-key") } }];
    });
    const resolver = createSecretResolver({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });

    await expect(resolver.getApiKey(TENANT_ID)).resolves.toBe("tenant-secret-key");
    expect(accessSecretVersion).toHaveBeenCalledOnce();
  });

  it("falls back to the platform default only when the tenant secret is absent", async () => {
    const accessSecretVersion = vi.fn(async ({ name }: { name: string }) => {
      if (name.includes(`/secrets/${secretNameFor(TENANT_ID)}/`)) throw notFound();
      expect(name).toContain(`/secrets/${PLATFORM_GEMINI_SECRET_NAME}/`);
      return [{ payload: { data: Buffer.from("platform-secret-key") } }];
    });
    const resolver = createSecretResolver({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });

    await expect(resolver.getApiKey(TENANT_ID)).resolves.toBe("platform-secret-key");
    expect(accessSecretVersion).toHaveBeenCalledTimes(2);
  });

  it("does not hide permission failures by pretending the key is absent", async () => {
    const permissionDenied = Object.assign(new Error("7 PERMISSION_DENIED"), { code: 7 });
    const accessSecretVersion = vi.fn(async () => {
      throw permissionDenied;
    });
    const resolver = createSecretResolver({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });

    // The tenant key is now tried first, so a permission failure surfaces there.
    await expect(resolver.getApiKey(TENANT_ID)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Failed to access the tenant Gemini key",
    });
    expect(accessSecretVersion).toHaveBeenCalledOnce();
  });
});
