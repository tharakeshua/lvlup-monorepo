/**
 * uploadTenantAsset — Generates a signed upload URL for tenant branding assets.
 *
 * Accepts { tenantId, assetType, contentType } and returns { uploadUrl, publicUrl }.
 * The client uploads directly to Cloud Storage using the signed URL.
 */
export declare const uploadTenantAsset: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    uploadUrl: string;
    publicUrl: string;
  }>,
  unknown
>;
