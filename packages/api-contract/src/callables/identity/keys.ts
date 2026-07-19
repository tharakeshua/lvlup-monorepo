/**
 * API key management callables (identity).
 *
 * Three ownership tiers with distinct authority:
 *  - Per-user BYOK (`saveUserProviderKey`/`list`/`setEnabled`/`delete`) — any
 *    signed-in user manages their OWN keys (self ownership).
 *  - Tenant provider keys (`rotateTenantKey`/`revokeTenantKey`/`getTenantKeyStatus`)
 *    — tenant admins.
 *  - Platform fallback keys (`savePlatformKey`/`getPlatformKeyStatus`) — super-admin.
 *
 * The plaintext `apiKey` travels on the WIRE only; the server validates it with the
 * provider, stores it in Secret Manager, and persists just an opaque ref + masked
 * hint. Key values are NEVER returned. Save/rotate/revoke are `authoritySensitive`.
 */
import { z } from "zod";
import { zKeyProvider, UserProviderKeyViewSchema, OwnedKeyStatusSchema } from "@levelup/domain";
import { defineCallable, SaveResponseSchema, type CallableDef } from "./_shared.js";

// ── per-user BYOK ─────────────────────────────────────────────────────────────
export const SaveUserProviderKeyRequestSchema = z
  .object({
    provider: zKeyProvider,
    // Plaintext ONLY on the wire; validated + stored in Secret Manager server-side.
    apiKey: z.string().min(1),
    label: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type SaveUserProviderKeyRequest = z.infer<typeof SaveUserProviderKeyRequestSchema>;

export const saveUserProviderKey = defineCallable({
  name: "v1.identity.saveUserProviderKey",
  module: "identity",
  requestSchema: SaveUserProviderKeyRequestSchema,
  responseSchema: UserProviderKeyViewSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userProviderKeys"],
  authoritySensitive: true,
});

export const ListUserProviderKeysRequestSchema = z.object({}).strict();
export type ListUserProviderKeysRequest = z.infer<typeof ListUserProviderKeysRequestSchema>;

export const ListUserProviderKeysResponseSchema = z
  .object({ keys: z.array(UserProviderKeyViewSchema) })
  .strict();

export const listUserProviderKeys = defineCallable({
  name: "v1.identity.listUserProviderKeys",
  module: "identity",
  requestSchema: ListUserProviderKeysRequestSchema,
  responseSchema: ListUserProviderKeysResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

export const SetUserProviderKeyEnabledRequestSchema = z
  .object({ provider: zKeyProvider, enabled: z.boolean() })
  .strict();
export type SetUserProviderKeyEnabledRequest = z.infer<
  typeof SetUserProviderKeyEnabledRequestSchema
>;

export const setUserProviderKeyEnabled = defineCallable({
  name: "v1.identity.setUserProviderKeyEnabled",
  module: "identity",
  requestSchema: SetUserProviderKeyEnabledRequestSchema,
  responseSchema: UserProviderKeyViewSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userProviderKeys"],
});

export const DeleteUserProviderKeyRequestSchema = z.object({ provider: zKeyProvider }).strict();
export type DeleteUserProviderKeyRequest = z.infer<typeof DeleteUserProviderKeyRequestSchema>;

export const deleteUserProviderKey = defineCallable({
  name: "v1.identity.deleteUserProviderKey",
  module: "identity",
  requestSchema: DeleteUserProviderKeyRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userProviderKeys"],
  authoritySensitive: true,
});

// ── tenant-owned keys ─────────────────────────────────────────────────────────
export const RotateTenantKeyRequestSchema = z
  .object({
    tenantOverride: z.string().optional(),
    provider: zKeyProvider,
    apiKey: z.string().min(1),
  })
  .strict();
export type RotateTenantKeyRequest = z.infer<typeof RotateTenantKeyRequestSchema>;

export const rotateTenantKey = defineCallable({
  name: "v1.identity.rotateTenantKey",
  module: "identity",
  requestSchema: RotateTenantKeyRequestSchema,
  responseSchema: OwnedKeyStatusSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenantKeys", "tenants"],
  authoritySensitive: true,
});

export const RevokeTenantKeyRequestSchema = z
  .object({ tenantOverride: z.string().optional(), provider: zKeyProvider })
  .strict();
export type RevokeTenantKeyRequest = z.infer<typeof RevokeTenantKeyRequestSchema>;

export const revokeTenantKey = defineCallable({
  name: "v1.identity.revokeTenantKey",
  module: "identity",
  requestSchema: RevokeTenantKeyRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenantKeys", "tenants"],
  authoritySensitive: true,
});

export const GetTenantKeyStatusRequestSchema = z
  .object({ tenantOverride: z.string().optional(), provider: zKeyProvider.optional() })
  .strict();
export type GetTenantKeyStatusRequest = z.infer<typeof GetTenantKeyStatusRequestSchema>;

export const getTenantKeyStatus = defineCallable({
  name: "v1.identity.getTenantKeyStatus",
  module: "identity",
  requestSchema: GetTenantKeyStatusRequestSchema,
  responseSchema: OwnedKeyStatusSchema,
  authMode: "authed",
  rateTier: "read",
  allowsTenantOverride: true,
});

// ── platform fallback keys (super-admin) ──────────────────────────────────────
export const SavePlatformKeyRequestSchema = z
  .object({ provider: zKeyProvider, apiKey: z.string().min(1) })
  .strict();
export type SavePlatformKeyRequest = z.infer<typeof SavePlatformKeyRequestSchema>;

export const savePlatformKey = defineCallable({
  name: "v1.identity.savePlatformKey",
  module: "identity",
  requestSchema: SavePlatformKeyRequestSchema,
  responseSchema: OwnedKeyStatusSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["platformKeys"],
  authoritySensitive: true,
});

export const GetPlatformKeyStatusRequestSchema = z
  .object({ provider: zKeyProvider.optional() })
  .strict();
export type GetPlatformKeyStatusRequest = z.infer<typeof GetPlatformKeyStatusRequestSchema>;

export const getPlatformKeyStatus = defineCallable({
  name: "v1.identity.getPlatformKeyStatus",
  module: "identity",
  requestSchema: GetPlatformKeyStatusRequestSchema,
  responseSchema: OwnedKeyStatusSchema,
  authMode: "authed",
  rateTier: "read",
});

export const KEY_CALLABLES = {
  saveUserProviderKey,
  listUserProviderKeys,
  setUserProviderKeyEnabled,
  deleteUserProviderKey,
  rotateTenantKey,
  revokeTenantKey,
  getTenantKeyStatus,
  savePlatformKey,
  getPlatformKeyStatus,
} as const satisfies Record<string, CallableDef>;
