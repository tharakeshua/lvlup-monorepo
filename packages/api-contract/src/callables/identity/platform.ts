/**
 * Session/profile reads + account self-service + super-admin platform ops
 * (identity): getMe, updateMyProfile, uploadUserAsset, deleteConsumerAccount,
 * searchUsers, saveGlobalEvaluationPreset, listGlobalEvaluationPresets,
 * setUserStatus, sendPasswordReset, startImpersonation, endImpersonation.
 *
 * Impersonation (§3.7.1) carries `allowsTenantOverride:true` — the target tenant
 * travels as `tenantOverride`, never a body `tenantId` — and is `authoritySensitive`,
 * `idempotent`, never optimistic; `setUserStatus`/`sendPasswordReset(uid)` are
 * audited super-admin/admin control-plane ops (`authoritySensitive`). Schemas
 * are `.strict()`.
 */
import { z } from "zod";
import {
  UnifiedUserSchema,
  UserMembershipSchema,
  PlatformClaimsSchema,
  TenantSchema,
  zUserId,
  zTenantId,
  zTenantCode,
  zTenantRole,
} from "@levelup/domain";
import {
  defineCallable,
  pageResponse,
  withPaging,
  SaveResponseSchema,
  type CallableDef,
} from "./_shared.js";

// ── getMe ─────────────────────────────────────────────────────────────────────
export const GetMeRequestSchema = z.object({}).strict();
export type GetMeRequest = z.infer<typeof GetMeRequestSchema>;

export const GetMeResponseSchema = z
  .object({
    user: UnifiedUserSchema,
    memberships: z.array(UserMembershipSchema),
    claims: PlatformClaimsSchema,
    activeTenant: TenantSchema.optional(),
  })
  .strict();

export const getMe = defineCallable({
  name: "v1.identity.getMe",
  module: "identity",
  requestSchema: GetMeRequestSchema,
  responseSchema: GetMeResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── updateMyProfile (C24) ─────────────────────────────────────────────────────
export const UpdateMyProfileRequestSchema = z
  .object({
    displayName: z.string().optional(),
    photoURL: z.string().optional(),
  })
  .strict();
export type UpdateMyProfileRequest = z.infer<typeof UpdateMyProfileRequestSchema>;

export const OkResponseSchema = z.object({ ok: z.literal(true) }).strict();

export const updateMyProfile = defineCallable({
  name: "v1.identity.updateMyProfile",
  module: "identity",
  requestSchema: UpdateMyProfileRequestSchema,
  responseSchema: OkResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["me"],
});

// ── uploadUserAsset (C22 — self-owned avatar) ─────────────────────────────────
export const UploadUserAssetRequestSchema = z
  .object({
    kind: z.literal("avatar"),
    contentType: z.string(),
    bytesBase64: z.string(),
  })
  .strict();
export type UploadUserAssetRequest = z.infer<typeof UploadUserAssetRequestSchema>;

export const UploadUserAssetResponseSchema = z.object({ assetUrl: z.string() }).strict();

export const uploadUserAsset = defineCallable({
  name: "v1.identity.uploadUserAsset",
  module: "identity",
  requestSchema: UploadUserAssetRequestSchema,
  responseSchema: UploadUserAssetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["me"],
});

// ── deleteConsumerAccount (C23) ───────────────────────────────────────────────
export const DeleteConsumerAccountRequestSchema = z.object({ confirm: z.literal(true) }).strict();
export type DeleteConsumerAccountRequest = z.infer<typeof DeleteConsumerAccountRequestSchema>;

export const DeleteConsumerAccountResponseSchema = z
  .object({ scheduled: z.literal(true) })
  .strict();

export const deleteConsumerAccount = defineCallable({
  name: "v1.identity.deleteConsumerAccount",
  module: "identity",
  requestSchema: DeleteConsumerAccountRequestSchema,
  responseSchema: DeleteConsumerAccountResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["me"],
  authoritySensitive: true,
});

// ── searchUsers (super-admin; batched memberships, no N+1) ────────────────────
export const UserSearchResultSchema = z
  .object({
    uid: zUserId,
    email: z.string().optional(),
    displayName: z.string(),
    isSuperAdmin: z.boolean(),
    activeTenantId: zTenantId.optional(),
    memberships: z.array(
      z.object({ tenantId: zTenantId, tenantCode: zTenantCode, role: zTenantRole }).strict()
    ),
  })
  .strict();

export const SearchUsersRequestSchema = withPaging(z.object({ query: z.string() }));
export type SearchUsersRequest = z.infer<typeof SearchUsersRequestSchema>;

export const searchUsers = defineCallable({
  name: "v1.identity.searchUsers",
  module: "identity",
  requestSchema: SearchUsersRequestSchema,
  responseSchema: pageResponse(UserSearchResultSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── saveGlobalEvaluationPreset (super-admin) ──────────────────────────────────
/**
 * Identity owns the CRUD shell; the rubric body shape lives in the content/levelup
 * domain (kept as an opaque JSON snapshot here to decouple identity from rubric
 * internals — the levelup domain validates the body).
 */
export const GlobalEvaluationPresetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    status: z.enum(["active", "archived"]),
    rubricSnapshot: z.unknown(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const SaveGlobalEvaluationPresetRequestSchema = z
  .object({
    id: z.string().optional(),
    data: z
      .object({
        name: z.string(),
        description: z.string().optional(),
        category: z.string().optional(),
        status: z.enum(["active", "archived"]).optional(),
        rubricSnapshot: z.unknown().optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveGlobalEvaluationPresetRequest = z.infer<
  typeof SaveGlobalEvaluationPresetRequestSchema
>;

export const saveGlobalEvaluationPreset = defineCallable({
  name: "v1.identity.saveGlobalEvaluationPreset",
  module: "identity",
  requestSchema: SaveGlobalEvaluationPresetRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["preset"],
});

// ── listGlobalEvaluationPresets (C31) ─────────────────────────────────────────
export const ListGlobalEvaluationPresetsRequestSchema = withPaging(
  z.object({ status: z.enum(["active", "archived"]).optional() })
);
export type ListGlobalEvaluationPresetsRequest = z.infer<
  typeof ListGlobalEvaluationPresetsRequestSchema
>;

export const listGlobalEvaluationPresets = defineCallable({
  name: "v1.identity.listGlobalEvaluationPresets",
  module: "identity",
  requestSchema: ListGlobalEvaluationPresetsRequestSchema,
  responseSchema: pageResponse(GlobalEvaluationPresetSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── setUserStatus (C26 — super-admin, revoke+audit, never optimistic) ─────────
export const SetUserStatusRequestSchema = z
  .object({
    uid: zUserId,
    status: z.enum(["disabled", "active"]),
  })
  .strict();
export type SetUserStatusRequest = z.infer<typeof SetUserStatusRequestSchema>;

export const SetUserStatusResponseSchema = z
  .object({ uid: zUserId, status: z.enum(["disabled", "active"]) })
  .strict();

export const setUserStatus = defineCallable({
  name: "v1.identity.setUserStatus",
  module: "identity",
  requestSchema: SetUserStatusRequestSchema,
  responseSchema: SetUserStatusResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userSearch"],
  authoritySensitive: true,
});

// ── sendPasswordReset by uid (C27 — admin-initiated, audited) ─────────────────
export const SendPasswordResetRequestSchema = z.object({ uid: zUserId }).strict();
export type SendPasswordResetRequest = z.infer<typeof SendPasswordResetRequestSchema>;

export const SendPasswordResetResponseSchema = z.object({ sent: z.literal(true) }).strict();

export const sendPasswordReset = defineCallable({
  name: "v1.identity.sendPasswordReset",
  module: "identity",
  requestSchema: SendPasswordResetRequestSchema,
  responseSchema: SendPasswordResetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["userSearch"],
  authoritySensitive: true,
});

// ── startImpersonation (C28 — §3.7.1) ─────────────────────────────────────────
export const StartImpersonationRequestSchema = z
  .object({
    targetUid: zUserId,
    // super-admin cross-tenant field (never a body `tenantId`).
    tenantOverride: zTenantId,
    reason: z.string(),
  })
  .strict();
export type StartImpersonationRequest = z.infer<typeof StartImpersonationRequestSchema>;

export const StartImpersonationResponseSchema = z
  .object({ sessionToken: z.string(), expiresAt: z.string() })
  .strict();

export const startImpersonation = defineCallable({
  name: "v1.identity.startImpersonation",
  module: "identity",
  requestSchema: StartImpersonationRequestSchema,
  responseSchema: StartImpersonationResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  allowsTenantOverride: true,
  invalidates: ["userSearch"],
  authoritySensitive: true,
});

// ── endImpersonation (C28) ────────────────────────────────────────────────────
export const EndImpersonationRequestSchema = z.object({}).strict();
export type EndImpersonationRequest = z.infer<typeof EndImpersonationRequestSchema>;

export const EndImpersonationResponseSchema = z.object({ ended: z.literal(true) }).strict();

export const endImpersonation = defineCallable({
  name: "v1.identity.endImpersonation",
  module: "identity",
  requestSchema: EndImpersonationRequestSchema,
  responseSchema: EndImpersonationResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["userSearch"],
  authoritySensitive: true,
});

export const PLATFORM_CALLABLES = {
  getMe,
  updateMyProfile,
  uploadUserAsset,
  deleteConsumerAccount,
  searchUsers,
  saveGlobalEvaluationPreset,
  listGlobalEvaluationPresets,
  setUserStatus,
  sendPasswordReset,
  startImpersonation,
  endImpersonation,
} as const satisfies Record<string, CallableDef>;
