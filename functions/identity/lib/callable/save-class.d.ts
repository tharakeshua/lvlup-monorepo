/**
 * Consolidated endpoint: replaces createClass + updateClass + deleteClass.
 * - No id = create new class
 * - id present = update existing class
 * - data.status = 'deleted' = soft-delete (archives + decrements stats)
 */
export declare const saveClass: import("firebase-functions/https").CallableFunction<
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
