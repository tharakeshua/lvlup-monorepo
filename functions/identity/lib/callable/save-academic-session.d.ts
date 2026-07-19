/**
 * Consolidated endpoint: replaces createAcademicSession + updateAcademicSession.
 * - No id = create new academic session
 * - id present = update existing session
 * - isCurrent = true automatically unsets previous current session
 */
export declare const saveAcademicSession: import("firebase-functions/https").CallableFunction<
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
