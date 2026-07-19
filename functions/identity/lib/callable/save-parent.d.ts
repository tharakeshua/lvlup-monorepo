/**
 * Consolidated endpoint: replaces createParent + linkParentToStudent.
 * - No id = create new parent
 * - id present = update (childStudentIds manages parent-student links)
 */
export declare const saveParent: import("firebase-functions/https").CallableFunction<
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
