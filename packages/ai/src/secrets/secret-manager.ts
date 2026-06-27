/**
 * Per-tenant Gemini key resolution via GCP Secret Manager (server-shared.md §4.4,
 * REVIEW §6 AI row). The key lives at `tenant-{tenantId}-gemini`; it is NEVER in
 * the client bundle. An env override (`LEVELUP_AI_KEY` / `GEMINI_API_KEY`) short-
 * circuits Secret Manager for the emulator and local dev.
 *
 * Resolved keys are cached in-process (per cold start) to avoid a Secret Manager
 * round-trip on every LLM call. `secretNameFor` is the single source of the secret
 * name pattern (mirrors functions-shared `config.ts`).
 */
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { TenantId } from "@levelup/domain";
import { aiDisabled, providerFailed } from "../errors.js";

export const secretNameFor = (tenantId: TenantId): string => `tenant-${tenantId}-gemini`;

export interface SecretResolverOptions {
  /** GCP project id; falls back to GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT env. */
  projectId?: string;
  /** Inject a client for tests; defaults to a real SecretManagerServiceClient. */
  client?: Pick<SecretManagerServiceClient, "accessSecretVersion">;
  /** Read an env override (defaults to process.env). */
  env?: NodeJS.ProcessEnv;
}

export interface SecretResolver {
  /** Resolve the tenant's Gemini key. Throws FEATURE_DISABLED when none exists. */
  getApiKey(tenantId: TenantId): Promise<string>;
  /** Drop a tenant's cached key (call after a key rotation). */
  invalidate(tenantId: TenantId): void;
}

function resolveProjectId(opts: SecretResolverOptions): string | undefined {
  return (
    opts.projectId ??
    opts.env?.GOOGLE_CLOUD_PROJECT ??
    opts.env?.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT
  );
}

export function createSecretResolver(opts: SecretResolverOptions = {}): SecretResolver {
  const env = opts.env ?? process.env;
  const cache = new Map<string, string>();
  // Lazily construct the client only if we actually need Secret Manager.
  let client = opts.client ?? null;
  const getClient = (): Pick<SecretManagerServiceClient, "accessSecretVersion"> => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };

  return {
    async getApiKey(tenantId: TenantId): Promise<string> {
      const cached = cache.get(tenantId);
      if (cached) return cached;

      // Emulator / local-dev override: one platform key for every tenant.
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      if (override) {
        cache.set(tenantId, override);
        return override;
      }

      const projectId = resolveProjectId(opts);
      if (!projectId) {
        throw aiDisabled("No GCP project configured for Secret Manager key resolution", {
          tenantId,
        });
      }

      const name = `projects/${projectId}/secrets/${secretNameFor(tenantId)}/versions/latest`;
      let payload: string | undefined;
      try {
        const [version] = await getClient().accessSecretVersion({ name });
        const data = version.payload?.data;
        payload =
          typeof data === "string" ? data : data ? Buffer.from(data).toString("utf8") : undefined;
      } catch (cause) {
        // NOT_FOUND ⇒ tenant has no AI key ⇒ AI disabled for them.
        throw aiDisabled("No Gemini key provisioned for tenant", {
          tenantId,
          cause: String(cause),
        });
      }

      const key = payload?.trim();
      if (!key) {
        throw providerFailed("Empty Gemini secret payload", { meta: { tenantId } });
      }
      cache.set(tenantId, key);
      return key;
    },

    invalidate(tenantId: TenantId): void {
      cache.delete(tenantId);
    },
  };
}
