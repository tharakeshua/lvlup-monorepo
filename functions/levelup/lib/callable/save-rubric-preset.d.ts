/**
 * Create, update, or delete a rubric preset.
 * Save* pattern: id absent = create, id present = update,
 * data.deleted = true = soft delete.
 */
export declare const saveRubricPreset: import("firebase-functions/https").CallableFunction<
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
