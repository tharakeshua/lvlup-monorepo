/**
 * Consolidated endpoint for global evaluation preset management.
 * - No id → create new preset (SuperAdmin only)
 * - id present → update existing preset (SuperAdmin only)
 * - delete: true → delete preset (SuperAdmin only)
 */
export declare const saveGlobalEvaluationPreset: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        id: string;
        deleted: boolean;
        created?: undefined;
      }
    | {
        id: string;
        created: boolean;
        deleted?: undefined;
      }
  >,
  unknown
>;
