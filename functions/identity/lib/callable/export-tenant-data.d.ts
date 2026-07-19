/**
 * exportTenantData — Export tenant subcollection data as JSON or CSV.
 * Generates a file in Cloud Storage and returns a signed download URL.
 */
export declare const exportTenantData: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    downloadUrl: string;
    expiresAt: string;
    recordCount: number;
  }>,
  unknown
>;
