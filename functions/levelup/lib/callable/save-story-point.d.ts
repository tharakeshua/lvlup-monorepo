/**
 * Consolidated story-point endpoint — replaces: createStoryPoint, updateStoryPoint, deleteStoryPoint
 *
 * No id → create new story point
 * id present → update existing story point
 * data.deleted = true → delete story point + all items within it, decrement stats
 */
export declare const saveStoryPoint: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        id: string;
        created: false;
      }
    | {
        id: string;
        created: true;
      }
  >,
  unknown
>;
