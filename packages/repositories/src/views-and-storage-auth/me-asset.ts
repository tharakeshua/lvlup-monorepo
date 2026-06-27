/**
 * `meAssetRepo` (C22 — SDK-LAYERS-PLAN §9.1 C22; §4.3
 * `uploadUserAsset/updateMyProfile→{me}`). The self-owned avatar/profile-asset
 * surface for the session user.
 *
 * Identity already owns the canonical `meRepo` (get/switchTenant/joinByCode);
 * this repo carries the C22 avatar capability as a distinct, collision-free
 * member during the parallel wave so the typecheck/fix wave can fold
 * `uploadAvatar` onto `meRepo` without two factories writing the same bag key.
 *
 * `uploadAvatar` invokes `v1.identity.uploadUserAsset {kind:'avatar', …}`
 * (server writes `photoURL`/`consumerProfile`, returns the asset URL). The
 * inline base64 path mirrors `uploadTenantAsset`; the signed-PUT path is
 * available via `storageRepo` when a `kind:'avatar'` grant is preferred.
 * **Never optimistic** (authority-sensitive self write).
 */
import type { ApiClientSeam, UploadUserAssetInput, UploadUserAssetResponse } from "./seam.js";

/** Avatar upload input — the bytes are base64 (inline `uploadUserAsset` path). */
export interface UploadAvatarInput {
  contentType: string;
  bytesBase64: string;
}

export interface MeAssetRepo {
  /** Upload the session user's avatar; returns the persisted asset URL. */
  uploadAvatar(input: UploadAvatarInput): Promise<UploadUserAssetResponse>;
  /** Pure UX pre-check — non-empty bytes + contentType. No wire call. */
  canUploadAvatar(input: UploadAvatarInput): boolean;
}

export function createMeAssetRepo(api: ApiClientSeam): MeAssetRepo {
  return {
    uploadAvatar: (input) => {
      const req: UploadUserAssetInput = {
        kind: "avatar",
        contentType: input.contentType,
        bytesBase64: input.bytesBase64,
      };
      return api.identity.uploadUserAsset(req);
    },
    canUploadAvatar: (input) => input.contentType.trim().length > 0 && input.bytesBase64.length > 0,
  };
}
