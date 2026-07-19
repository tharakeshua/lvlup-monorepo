/**
 * Per-user BYOK provider-key metadata (identity). METADATA ONLY — the key value
 * lives in GCP Secret Manager under `secretRef`; this record never holds it. A
 * user's own key follows them across tenants (user-global), so the doc id is
 * `${userId}:${provider}` and there is exactly one per (user, provider).
 *
 * Resolution precedence is `user BYOK → tenant → platform`. A user key is only
 * eligible when `status === 'active' && enabled === true`; when a user's own key
 * fails at call time the gateway surfaces the error rather than silently spending
 * tenant/platform budget (owner decision 2026-07-18).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zUserId, zTenantId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zKeyProvider, zKeyStatus } from "../../enums/keys.js";

export const UserProviderKeySchema = zObject({
  // `${userId}:${provider}` — one key per user per provider.
  id: z.string(),
  userId: zUserId,
  provider: zKeyProvider,
  // Secret Manager secret name (opaque ref) — NEVER the key value.
  secretRef: z.string(),
  // Display hint only, e.g. "AIza…4f2c" (first-4…last-4). Never enough to use.
  maskedKey: z.string(),
  status: zKeyStatus,
  // User's opt-in to actually route their calls through this key.
  enabled: z.boolean().default(true),
  label: z.string().optional(),
  // Where the key was first created (audit only; the key stays user-global).
  createdInTenantId: zTenantId.optional(),
  // Increments on each rotation (each Secret Manager version).
  version: z.number().int().default(1),
  // Last successful provider-side validation.
  validatedAt: zTimestamp.nullable(),
  lastUsedAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type UserProviderKey = z.infer<typeof UserProviderKeySchema>;

/** Masked, client-safe projection returned by callables (never the value/ref). */
export const UserProviderKeyViewSchema = zObject({
  provider: zKeyProvider,
  maskedKey: z.string(),
  status: zKeyStatus,
  enabled: z.boolean(),
  label: z.string().optional(),
  version: z.number().int(),
  validatedAt: zTimestamp.nullable(),
  updatedAt: zTimestamp,
});
export type UserProviderKeyView = z.infer<typeof UserProviderKeyViewSchema>;

/** Status projection for a tenant/platform-owned key (admin/super-admin surfaces). */
export const OwnedKeyStatusSchema = zObject({
  provider: zKeyProvider,
  present: z.boolean(),
  maskedKey: z.string().optional(),
  status: zKeyStatus.optional(),
  version: z.number().int().optional(),
  updatedAt: zTimestamp.nullable(),
});
export type OwnedKeyStatus = z.infer<typeof OwnedKeyStatusSchema>;

/** Deterministic doc id for a user's per-provider key. */
export const userProviderKeyId = (userId: string, provider: string): string =>
  `${userId}:${provider}`;

/**
 * Build the display mask for a raw key: first 4 + ellipsis + last 4. Short keys
 * (≤ 8 chars) collapse to all-dots so we never reveal a usable fraction.
 */
export const maskKey = (raw: string): string => {
  const k = raw.trim();
  if (k.length <= 8) return "•".repeat(Math.max(k.length, 4));
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
};
