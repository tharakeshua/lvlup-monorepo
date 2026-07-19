/**
 * Consolidated endpoint: replaces createTenant + setTenantApiKey.
 * - No id = create new tenant (SuperAdmin only)
 * - id present = update existing tenant (TenantAdmin or SuperAdmin)
 * - data.geminiApiKey = store API key in Secret Manager
 */
export declare const saveTenant: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        id: string;
        created: true;
      }
    | {
        id: string;
        created: false;
      }
  >,
  unknown
>;
