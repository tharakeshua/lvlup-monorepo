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

/**
 * THE single source of the per-tenant Gemini secret name. The resolver (below)
 * and the writer (`createSecretWriter`) both derive the Secret Manager secret id
 * from this one helper so a written secret is always readable back — the P0 that
 * previously broke onboarding was a writer/resolver name divergence
 * (`{id}-gemini-key` written vs `tenant-{id}-gemini` read). Keep them unified here.
 */
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

function resolveProjectId(opts: {
  projectId?: string;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  return (
    opts.projectId ??
    opts.env?.GOOGLE_CLOUD_PROJECT ??
    opts.env?.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT
  );
}

/** gRPC ALREADY_EXISTS (code 6) — the secret container was created by a prior write. */
function isAlreadyExists(cause: unknown): boolean {
  return (cause as { code?: number } | null)?.code === 6 || /ALREADY_EXISTS/i.test(String(cause));
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

export interface SecretWriterOptions {
  /** GCP project id; falls back to GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT env. */
  projectId?: string;
  /** Inject a client for tests; defaults to a real SecretManagerServiceClient. */
  client?: Pick<SecretManagerServiceClient, "createSecret" | "addSecretVersion">;
  /** Read an env override (defaults to process.env). */
  env?: NodeJS.ProcessEnv;
}

export interface SecretWriter {
  /**
   * Create-or-rotate the tenant's Gemini key in Secret Manager and return the
   * secret name (`secretNameFor(tenantId)`) that the resolver reads back. Adding a
   * new version on an existing secret is a rotation — the resolver reads
   * `versions/latest`.
   */
  writeSecret(tenantId: TenantId, value: string): Promise<string>;
}

/**
 * Server-side counterpart of `createSecretResolver`: actually persists the tenant
 * key VALUE into GCP Secret Manager (the ref-doc-only repo used to record a
 * pointer but never write the secret — the P0). Uses Admin credentials in the
 * Cloud Functions runtime. In the emulator / local dev — where a platform-wide
 * env key (`LEVELUP_AI_KEY` / `GEMINI_API_KEY`) short-circuits the resolver, or no
 * project is configured — there is no Secret Manager to write to, so it no-ops and
 * just returns the ref name so callers' ref bookkeeping stays coherent.
 */
export function createSecretWriter(opts: SecretWriterOptions = {}): SecretWriter {
  const env = opts.env ?? process.env;
  let client = opts.client ?? null;
  const getClient = (): Pick<SecretManagerServiceClient, "createSecret" | "addSecretVersion"> => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };

  return {
    async writeSecret(tenantId: TenantId, value: string): Promise<string> {
      const secretRef = secretNameFor(tenantId);

      // Emulator / local-dev: an env override serves every tenant, so there is no
      // per-tenant secret to write. No project ⇒ no Secret Manager. Either way the
      // resolver will never hit SM for this tenant; return the ref name unchanged.
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      const projectId = resolveProjectId(opts);
      if (override || !projectId) return secretRef;

      const parent = `projects/${projectId}`;
      // Ensure the secret container exists (idempotent — a rotation re-runs this).
      try {
        await getClient().createSecret({
          parent,
          secretId: secretRef,
          secret: { replication: { automatic: {} } },
        });
      } catch (cause) {
        if (!isAlreadyExists(cause)) {
          throw providerFailed("Failed to create tenant Gemini secret", {
            meta: { tenantId, cause: String(cause) },
          });
        }
      }
      // Write the key value as a new version; the resolver reads versions/latest.
      try {
        await getClient().addSecretVersion({
          parent: `${parent}/secrets/${secretRef}`,
          payload: { data: Buffer.from(value, "utf8") },
        });
      } catch (cause) {
        throw providerFailed("Failed to write tenant Gemini secret version", {
          meta: { tenantId, cause: String(cause) },
        });
      }
      return secretRef;
    },
  };
}
