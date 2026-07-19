/**
 * Consolidated space endpoint — replaces:
 *   createSpace, updateSpace, publishSpace, archiveSpace, publishToStore
 *
 * No id → create new space
 * id present → update (including status transitions and store listing)
 */
export declare const saveSpace: import("firebase-functions/https").CallableFunction<
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
