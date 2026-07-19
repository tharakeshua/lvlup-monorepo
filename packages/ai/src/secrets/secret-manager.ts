/**
 * Gemini key resolution via GCP Secret Manager (server-shared.md §4.4,
 * REVIEW §6 AI row). Locked precedence (no user BYOK key): the tenant key
 * `tenant-{tenantId}-gemini` is tried FIRST; when that secret does not exist,
 * resolution falls back to the platform default `levelup-default-gemini`. (User
 * BYOK — the highest-precedence tier — is resolved above this in the gateway via
 * the injected user secret resolver.) Keys are NEVER in the client bundle. An
 * env override (`LEVELUP_AI_KEY` / `GEMINI_API_KEY`) short-circuits Secret
 * Manager for the emulator and local dev.
 *
 * Resolved keys are read from Secret Manager for each LLM request. This keeps
 * rotate/revoke behavior immediately consistent across warm Cloud Functions
 * instances without a cross-instance cache-invalidation channel.
 * `secretNameFor` is the single source of the secret name pattern (mirrors
 * functions-shared `config.ts`).
 */
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { TenantId, KeyProvider } from "@levelup/domain";
import { aiDisabled, providerFailed } from "../errors.js";

/**
 * THE single source of the per-tenant Gemini secret name. The resolver (below)
 * and the writer (`createSecretWriter`) both derive the Secret Manager secret id
 * from this one helper so a written secret is always readable back — the P0 that
 * previously broke onboarding was a writer/resolver name divergence
 * (`{id}-gemini-key` written vs `tenant-{id}-gemini` read). Keep them unified here.
 */
export const secretNameFor = (tenantId: TenantId): string => `tenant-${tenantId}-gemini`;

/** Project-wide Gemini key used by every current LLM operation when provisioned. */
export const PLATFORM_GEMINI_SECRET_NAME = "levelup-default-gemini";

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

function isNotFound(cause: unknown): boolean {
  return (cause as { code?: number } | null)?.code === 5 || /NOT_FOUND/i.test(String(cause));
}

export function createSecretResolver(opts: SecretResolverOptions = {}): SecretResolver {
  const env = opts.env ?? process.env;
  // Lazily construct the client only if we actually need Secret Manager.
  let client = opts.client ?? null;
  const getClient = (): Pick<SecretManagerServiceClient, "accessSecretVersion"> => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };

  return {
    async getApiKey(tenantId: TenantId): Promise<string> {
      // Emulator / local-dev override: one platform key for every tenant.
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      if (override) return override;

      const projectId = resolveProjectId(opts);
      if (!projectId) {
        throw aiDisabled("No GCP project configured for Secret Manager key resolution", {
          tenantId,
        });
      }

      const readSecret = async (secretName: string): Promise<string> => {
        const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
        const [version] = await getClient().accessSecretVersion({ name });
        const data = version.payload?.data;
        const payload =
          typeof data === "string" ? data : data ? Buffer.from(data).toString("utf8") : undefined;
        const key = payload?.trim();
        if (!key) {
          throw providerFailed("Empty Gemini secret payload", {
            meta: { tenantId, secretName },
          });
        }
        return key;
      };

      // Locked precedence (no user BYOK key): TENANT key first, then the platform
      // default. A tenant's own `tenant-{id}-gemini` overrides the shared
      // `levelup-default-gemini`; the platform key is the fallback when a tenant
      // has none. (BYOK — the user key — is resolved above this in the gateway.)
      let key: string;
      try {
        key = await readSecret(secretNameFor(tenantId));
      } catch (tenantCause) {
        if (!isNotFound(tenantCause)) {
          throw providerFailed("Failed to access the tenant Gemini key", {
            meta: { tenantId, secretName: secretNameFor(tenantId), cause: String(tenantCause) },
          });
        }
        try {
          key = await readSecret(PLATFORM_GEMINI_SECRET_NAME);
        } catch (platformCause) {
          if (!isNotFound(platformCause)) {
            throw providerFailed("Failed to access the platform Gemini key", {
              meta: {
                tenantId,
                secretName: PLATFORM_GEMINI_SECRET_NAME,
                cause: String(platformCause),
              },
            });
          }
          throw aiDisabled("No tenant or platform Gemini key is provisioned", {
            tenantId,
            cause: String(platformCause),
          });
        }
      }
      return key;
    },

    // Retained for API compatibility; reads are intentionally uncached.
    invalidate(_tenantId: TenantId): void {},
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

// ===========================================================================
// Per-user BYOK keys (user → tenant → platform precedence). A user's own key is
// user-global (follows them across tenants), so the Secret Manager secret name is
// keyed by (userId, provider). The DB stores only this opaque ref + a masked hint.
// These helpers are STANDALONE — they never touch the tenant/platform resolver
// (`createSecretResolver`) or its tests. The gateway resolves credentials in the
// order user → tenant → platform; a user's own key failing is FAIL-CLOSED (the
// gateway surfaces the error rather than silently spending tenant/platform budget).
// ===========================================================================

/** SSOT for the per-user secret name. Mirrors `secretNameFor` for tenants. */
export const userSecretNameFor = (userId: string, provider: KeyProvider | string): string =>
  `user-${userId}-${provider}`;

export interface NamedSecretWriter {
  /** Create-or-rotate an explicitly-named secret; returns the new version number. */
  writeSecret(secretName: string, value: string): Promise<number>;
  /** Revoke an explicitly-named secret container (idempotent). */
  deleteSecret(secretName: string): Promise<void>;
}

/**
 * Write to an explicitly-named secret (e.g. the platform default
 * `levelup-default-gemini`). Additive to the tenant/user writers — used by
 * super-admin platform-key management. No-ops in emulator/local-dev (env override
 * or no project), returning version 0 so callers' bookkeeping stays coherent.
 */
export function createNamedSecretWriter(opts: UserSecretWriterOptions = {}): NamedSecretWriter {
  const env = opts.env ?? process.env;
  let client = opts.client ?? null;
  const getClient = (): UserWriterClient => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };
  return {
    async writeSecret(secretName: string, value: string): Promise<number> {
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      const projectId = resolveProjectId(opts);
      if (override || !projectId) return 0;
      const parent = `projects/${projectId}`;
      try {
        await getClient().createSecret({
          parent,
          secretId: secretName,
          secret: { replication: { automatic: {} } },
        });
      } catch (cause) {
        if (!isAlreadyExists(cause)) {
          throw providerFailed("Failed to create platform secret", {
            meta: { secretName, cause: String(cause) },
          });
        }
      }
      try {
        const [version] = await getClient().addSecretVersion({
          parent: `${parent}/secrets/${secretName}`,
          payload: { data: Buffer.from(value, "utf8") },
        });
        return versionNumberFromName(version?.name);
      } catch (cause) {
        throw providerFailed("Failed to write platform secret version", {
          meta: { secretName, cause: String(cause) },
        });
      }
    },

    async deleteSecret(secretName: string): Promise<void> {
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      const projectId = resolveProjectId(opts);
      if (override || !projectId) return;
      try {
        await getClient().deleteSecret({
          name: `projects/${projectId}/secrets/${secretName}`,
        });
      } catch (cause) {
        if (!isNotFound(cause)) {
          throw providerFailed("Failed to delete named secret", {
            meta: { secretName, cause: String(cause) },
          });
        }
      }
    },
  };
}

export interface UserSecretResolver {
  /** Read a user's BYOK key by its opaque ref. Fail-closed: throws on any miss. */
  getKeyByRef(secretRef: string): Promise<string>;
  /** Drop a cached user key (call after rotation/revocation). */
  invalidate(secretRef: string): void;
}

export function createUserSecretResolver(opts: SecretResolverOptions = {}): UserSecretResolver {
  const env = opts.env ?? process.env;
  let client = opts.client ?? null;
  const getClient = (): Pick<SecretManagerServiceClient, "accessSecretVersion"> => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };

  return {
    async getKeyByRef(secretRef: string): Promise<string> {
      // Emulator / local-dev: a platform env key stands in for every secret so a
      // BYOK user's calls do not break with no Secret Manager to read from.
      const override = env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY;
      if (override) return override;

      const projectId = resolveProjectId(opts);
      if (!projectId) {
        throw aiDisabled("No GCP project configured for user BYOK key resolution", { secretRef });
      }
      const name = `projects/${projectId}/secrets/${secretRef}/versions/latest`;
      let payload: string | undefined;
      try {
        const [version] = await getClient().accessSecretVersion({ name });
        const data = version.payload?.data;
        payload =
          typeof data === "string" ? data : data ? Buffer.from(data).toString("utf8") : undefined;
      } catch (cause) {
        // Fail-closed: a user who opted into BYOK never silently falls back.
        throw providerFailed("Failed to access the user BYOK key", {
          retryable: false,
          meta: { secretRef, cause: String(cause) },
        });
      }
      const key = payload?.trim();
      if (!key) {
        throw providerFailed("Empty user BYOK secret payload", { meta: { secretRef } });
      }
      return key;
    },

    // Retained for API compatibility; reads are intentionally uncached.
    invalidate(_secretRef: string): void {},
  };
}

export interface UserSecretWriteResult {
  secretRef: string;
  /** The Secret Manager version number just written (1 for a fresh secret). */
  version: number;
}

type UserWriterClient = Pick<
  SecretManagerServiceClient,
  | "createSecret"
  | "addSecretVersion"
  | "listSecretVersions"
  | "disableSecretVersion"
  | "enableSecretVersion"
  | "deleteSecret"
>;

export interface UserSecretWriterOptions {
  projectId?: string;
  client?: UserWriterClient;
  env?: NodeJS.ProcessEnv;
}

export interface UserSecretWriter {
  /** Create-or-rotate the user's key; returns the ref + the new version number. */
  writeSecret(
    userId: string,
    provider: KeyProvider | string,
    value: string
  ): Promise<UserSecretWriteResult>;
  /** Rotation grace: disable every version below `keepVersion` (best-effort). */
  disablePriorVersions(secretRef: string, keepVersion: number): Promise<void>;
  /** Rollback: re-enable a previously disabled version. */
  enableVersion(secretRef: string, version: number): Promise<void>;
  /** Revocation: delete the whole secret container (idempotent). */
  deleteSecret(secretRef: string): Promise<void>;
}

/** Parse the trailing version number from a Secret Manager version resource name. */
function versionNumberFromName(name: string | null | undefined): number {
  const m = /\/versions\/(\d+)$/.exec(name ?? "");
  return m ? Number(m[1]) : 1;
}

export function createUserSecretWriter(opts: UserSecretWriterOptions = {}): UserSecretWriter {
  const env = opts.env ?? process.env;
  let client = opts.client ?? null;
  const getClient = (): UserWriterClient => {
    if (!client) client = new SecretManagerServiceClient();
    return client;
  };
  const noSecretManager = (): boolean =>
    Boolean(env.LEVELUP_AI_KEY ?? env.GEMINI_API_KEY) || !resolveProjectId(opts);

  return {
    async writeSecret(userId, provider, value): Promise<UserSecretWriteResult> {
      const secretRef = userSecretNameFor(userId, provider);
      // Emulator / local-dev: no per-user Secret Manager write (an env key stands
      // in on read). Return the ref so callers' bookkeeping stays coherent.
      if (noSecretManager()) return { secretRef, version: 1 };

      const projectId = resolveProjectId(opts)!;
      const parent = `projects/${projectId}`;
      try {
        await getClient().createSecret({
          parent,
          secretId: secretRef,
          secret: { replication: { automatic: {} } },
        });
      } catch (cause) {
        if (!isAlreadyExists(cause)) {
          throw providerFailed("Failed to create user BYOK secret", {
            meta: { secretRef, cause: String(cause) },
          });
        }
      }
      try {
        const [version] = await getClient().addSecretVersion({
          parent: `${parent}/secrets/${secretRef}`,
          payload: { data: Buffer.from(value, "utf8") },
        });
        return { secretRef, version: versionNumberFromName(version?.name) };
      } catch (cause) {
        throw providerFailed("Failed to write user BYOK secret version", {
          meta: { secretRef, cause: String(cause) },
        });
      }
    },

    async disablePriorVersions(secretRef, keepVersion): Promise<void> {
      if (noSecretManager()) return;
      const projectId = resolveProjectId(opts)!;
      const parent = `projects/${projectId}/secrets/${secretRef}`;
      const [versions] = await getClient().listSecretVersions({ parent });
      for (const v of versions ?? []) {
        const n = versionNumberFromName(v?.name);
        // Only touch still-enabled versions strictly below the one we keep.
        if (n < keepVersion && v?.state === "ENABLED" && v?.name) {
          try {
            await getClient().disableSecretVersion({ name: v.name });
          } catch {
            // Grace-window disable is best-effort; the resolver reads versions/latest.
          }
        }
      }
    },

    async enableVersion(secretRef, version): Promise<void> {
      if (noSecretManager()) return;
      const projectId = resolveProjectId(opts)!;
      const name = `projects/${projectId}/secrets/${secretRef}/versions/${version}`;
      await getClient().enableSecretVersion({ name });
    },

    async deleteSecret(secretRef): Promise<void> {
      if (noSecretManager()) return;
      const projectId = resolveProjectId(opts)!;
      const name = `projects/${projectId}/secrets/${secretRef}`;
      try {
        await getClient().deleteSecret({ name });
      } catch (cause) {
        if (!isNotFound(cause)) {
          throw providerFailed("Failed to delete user BYOK secret", {
            meta: { secretRef, cause: String(cause) },
          });
        }
      }
    },
  };
}
