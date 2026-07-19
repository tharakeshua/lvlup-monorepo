/**
 * API key management services (identity) — per-user BYOK, tenant-owned keys, and
 * platform fallback keys.
 *
 * Invariants:
 *  - The plaintext key arrives on the request, is validated with the provider,
 *    written to Secret Manager, and NEVER persisted to Firestore. Only an opaque
 *    Secret Manager ref + a masked hint + status/version metadata are stored.
 *  - Resolution precedence is `user BYOK → tenant → platform`; a user's own key is
 *    fail-closed at call time (the gateway never silently falls back). BYOK calls
 *    bypass tenant/platform quota (owner decision 2026-07-18).
 *  - Authority: `userKey.manage` (self), `tenantKey.manage` (tenantAdmin),
 *    `platformKey.manage` (super-admin). Every mutation is audit-logged.
 *
 * `tenantOverride` (super-admin cross-tenant) is already applied to `ctx.tenantId`
 * by the adapter, so services read `requireTenant(ctx)` and never trust the body.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import {
  createUserSecretWriter,
  createNamedSecretWriter,
  validateProviderKey,
  secretNameFor,
  userSecretNameFor,
  PLATFORM_GEMINI_SECRET_NAME,
  type UserSecretWriter,
  type NamedSecretWriter,
  type UserKeyLookup,
} from "@levelup/ai";
import { maskKey, userProviderKeyId, asTimestamp, type TenantId } from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos, type UserProviderKeyRepo } from "../shared/extended-repos.js";

// Default writers (env/project-driven); overridable for unit tests. In the
// emulator / no-project runtime they no-op the Secret Manager write.
let userSecretWriter: UserSecretWriter = createUserSecretWriter();
let namedSecretWriter: NamedSecretWriter = createNamedSecretWriter();

/** Test seam — inject stub Secret Manager writers. */
export function _setKeyWritersForTesting(w: {
  user?: UserSecretWriter;
  named?: NamedSecretWriter;
}): void {
  if (w.user) userSecretWriter = w.user;
  if (w.named) namedSecretWriter = w.named;
}

/** Emulator/local-dev: an env override serves every key → skip provider validation. */
function isDevKeyEnv(): boolean {
  return Boolean(process.env["LEVELUP_AI_KEY"] || process.env["GEMINI_API_KEY"]);
}

type Doc = Record<string, unknown>;

/** Map a stored user-key doc → the masked, client-safe view (never the ref/value). */
function userKeyView(doc: Doc): ResOf<"v1.identity.saveUserProviderKey"> {
  const label = typeof doc["label"] === "string" ? (doc["label"] as string) : undefined;
  return {
    provider: doc["provider"] as "google",
    maskedKey: String(doc["maskedKey"] ?? ""),
    status: (doc["status"] as "active" | "invalid" | "revoked") ?? "active",
    enabled: doc["enabled"] !== false,
    ...(label ? { label } : {}),
    version: typeof doc["version"] === "number" ? (doc["version"] as number) : 1,
    validatedAt: doc["validatedAt"] ? asTimestamp(String(doc["validatedAt"])) : null,
    updatedAt: asTimestamp(String(doc["updatedAt"] ?? "")),
  };
}

// ── per-user BYOK ─────────────────────────────────────────────────────────────
export async function saveUserProviderKeyService(
  input: ReqOf<"v1.identity.saveUserProviderKey">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveUserProviderKey">> {
  const uid = ctx.uid;
  authorize(ctx, "userKey.manage", {
    ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    ownerUid: uid,
  });

  let validatedAt: string | null = null;
  if (!isDevKeyEnv()) {
    const v = await validateProviderKey(input.provider, input.apiKey);
    if (!v.ok) {
      fail("INVALID_API_KEY", "The provided API key was rejected by the provider");
    }
    if (v.validated) validatedAt = ctx.now();
  }

  const { version } = await userSecretWriter.writeSecret(uid, input.provider, input.apiKey);
  const now = ctx.now();
  const stored: Doc = {
    secretRef: userSecretNameFor(uid, input.provider),
    maskedKey: maskKey(input.apiKey),
    status: "active",
    enabled: input.enabled ?? true,
    ...(input.label ? { label: input.label } : {}),
    ...(ctx.tenantId ? { createdInTenantId: ctx.tenantId } : {}),
    version,
    validatedAt,
    lastUsedAt: null,
  };
  await xrepos(ctx).userProviderKeys.upsert(uid, input.provider, stored, now);
  await ctx.repos.audit.write(ctx.tenantId ?? "__platform__", {
    action: "user.ai.key.write",
    actorUid: uid,
    provider: input.provider,
    at: now,
  });
  return userKeyView({ ...stored, provider: input.provider, updatedAt: now });
}

export async function listUserProviderKeysService(
  _input: ReqOf<"v1.identity.listUserProviderKeys">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listUserProviderKeys">> {
  authorize(ctx, "userKey.manage", {
    ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    ownerUid: ctx.uid,
  });
  const docs = await xrepos(ctx).userProviderKeys.listByUser(ctx.uid);
  return { keys: docs.map(userKeyView) };
}

export async function setUserProviderKeyEnabledService(
  input: ReqOf<"v1.identity.setUserProviderKeyEnabled">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.setUserProviderKeyEnabled">> {
  authorize(ctx, "userKey.manage", {
    ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    ownerUid: ctx.uid,
  });
  const repo = xrepos(ctx).userProviderKeys;
  const existing = await repo.get(ctx.uid, input.provider);
  if (!existing) fail("NOT_FOUND", "No BYOK key for that provider");
  const now = ctx.now();
  await repo.patch(ctx.uid, input.provider, { enabled: input.enabled }, now);
  return userKeyView({ ...existing, enabled: input.enabled, updatedAt: now });
}

export async function deleteUserProviderKeyService(
  input: ReqOf<"v1.identity.deleteUserProviderKey">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.deleteUserProviderKey">> {
  authorize(ctx, "userKey.manage", {
    ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    ownerUid: ctx.uid,
  });
  // Best-effort Secret Manager destroy, then drop the metadata record.
  await userSecretWriter.deleteSecret(userSecretNameFor(ctx.uid, input.provider));
  await xrepos(ctx).userProviderKeys.delete(ctx.uid, input.provider);
  await ctx.repos.audit.write(ctx.tenantId ?? "__platform__", {
    action: "user.ai.key.revoke",
    actorUid: ctx.uid,
    provider: input.provider,
    at: ctx.now(),
  });
  return { id: userProviderKeyId(ctx.uid, input.provider), deleted: true };
}

// ── tenant-owned keys ─────────────────────────────────────────────────────────
function ownedStatus(
  provider: "google",
  meta: Doc | null,
  present: boolean,
  now: string
): ResOf<"v1.identity.getTenantKeyStatus"> {
  return {
    provider,
    present,
    ...(meta?.["maskedKey"] ? { maskedKey: String(meta["maskedKey"]) } : {}),
    ...(meta?.["status"] ? { status: meta["status"] as "active" | "invalid" | "revoked" } : {}),
    ...(typeof meta?.["version"] === "number" ? { version: meta["version"] as number } : {}),
    updatedAt: meta?.["updatedAt"]
      ? asTimestamp(String(meta["updatedAt"]))
      : present
        ? asTimestamp(now)
        : null,
  };
}

export async function rotateTenantKeyService(
  input: ReqOf<"v1.identity.rotateTenantKey">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.rotateTenantKey">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenantKey.manage", { tenantId });

  if (!isDevKeyEnv()) {
    const v = await validateProviderKey(input.provider, input.apiKey);
    if (!v.ok) fail("INVALID_API_KEY", "The provided API key was rejected by the provider");
  }
  // New Secret Manager version (resolver reads versions/latest); ref stamped on tenant.
  const { secretRef } = await xrepos(ctx).secrets.put(tenantId, input.apiKey);
  const now = ctx.now();
  await ctx.repos.tenants.upsert(tenantId, { id: tenantId, geminiKeyRef: secretRef }, now);
  const scope = `tenant:${tenantId}:${input.provider}`;
  const prev = await xrepos(ctx).keyMeta.get(scope);
  const version = (typeof prev?.["version"] === "number" ? (prev["version"] as number) : 0) + 1;
  const meta: Doc = {
    provider: input.provider,
    maskedKey: maskKey(input.apiKey),
    status: "active",
    version,
  };
  await xrepos(ctx).keyMeta.put(scope, meta, now);
  await ctx.repos.audit.write(tenantId, {
    action: "tenant.ai.key.rotate",
    actorUid: ctx.uid,
    provider: input.provider,
    version,
    at: now,
  });
  return ownedStatus(input.provider, { ...meta, updatedAt: now }, true, now);
}

export async function revokeTenantKeyService(
  input: ReqOf<"v1.identity.revokeTenantKey">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.revokeTenantKey">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenantKey.manage", { tenantId });
  const scope = `tenant:${tenantId}:${input.provider}`;
  const now = ctx.now();
  // Mark revoked + clear the tenant ref so resolution drops to the platform key.
  // Deleting the tenant secret is required because the resolver intentionally
  // probes `tenant-{tenantId}-gemini` before the platform fallback.
  await namedSecretWriter.deleteSecret(secretNameFor(tenantId as TenantId));
  await xrepos(ctx).keyMeta.put(scope, { status: "revoked", present: false }, now);
  await ctx.repos.tenants.upsert(tenantId, { id: tenantId, geminiKeyRef: null }, now);
  await ctx.repos.audit.write(tenantId, {
    action: "tenant.ai.key.revoke",
    actorUid: ctx.uid,
    provider: input.provider,
    at: now,
  });
  return { id: `tenant:${tenantId}:${input.provider}`, deleted: true };
}

export async function getTenantKeyStatusService(
  input: ReqOf<"v1.identity.getTenantKeyStatus">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getTenantKeyStatus">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenantKey.manage", { tenantId });
  const provider = input.provider ?? "google";
  const meta = await xrepos(ctx).keyMeta.get(`tenant:${tenantId}:${provider}`);
  const present = meta?.["status"] === "active";
  return ownedStatus(provider, meta, present, ctx.now());
}

// ── platform fallback keys (super-admin) ──────────────────────────────────────
export async function savePlatformKeyService(
  input: ReqOf<"v1.identity.savePlatformKey">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.savePlatformKey">> {
  authorize(ctx, "platformKey.manage", {});
  if (!isDevKeyEnv()) {
    const v = await validateProviderKey(input.provider, input.apiKey);
    if (!v.ok) fail("INVALID_API_KEY", "The provided API key was rejected by the provider");
  }
  const version = await namedSecretWriter.writeSecret(PLATFORM_GEMINI_SECRET_NAME, input.apiKey);
  const now = ctx.now();
  const meta: Doc = {
    provider: input.provider,
    maskedKey: maskKey(input.apiKey),
    status: "active",
    version,
  };
  await xrepos(ctx).keyMeta.put(`platform:${input.provider}`, meta, now);
  await ctx.repos.audit.write("__platform__", {
    action: "platform.ai.key.write",
    actorUid: ctx.uid,
    provider: input.provider,
    version,
    at: now,
  });
  return ownedStatus(input.provider, { ...meta, updatedAt: now }, true, now);
}

export async function getPlatformKeyStatusService(
  input: ReqOf<"v1.identity.getPlatformKeyStatus">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getPlatformKeyStatus">> {
  authorize(ctx, "platformKey.manage", {});
  const provider = input.provider ?? "google";
  const meta = await xrepos(ctx).keyMeta.get(`platform:${provider}`);
  return ownedStatus(provider, meta, Boolean(meta), ctx.now());
}

// ── gateway BYOK lookup port ──────────────────────────────────────────────────
/**
 * Back the gateway's `UserKeyLookup` with the `userProviderKeys` repo. Returns the
 * user's first active + enabled key (one provider today). Bootstrap wires this into
 * `createAiGateway` so BYOK precedence works without `@levelup/ai` touching Firestore.
 */
export function createUserKeyLookup(repos: {
  userProviderKeys: UserProviderKeyRepo;
}): UserKeyLookup {
  return {
    async getEligibleUserKey(userId: string) {
      const docs = await repos.userProviderKeys.listByUser(userId);
      const rec = docs.find((d) => d["status"] === "active" && d["enabled"] !== false);
      if (!rec || typeof rec["secretRef"] !== "string") return null;
      return { provider: String(rec["provider"] ?? "google"), secretRef: rec["secretRef"] };
    },
  };
}
