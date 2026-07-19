/**
 * Consolidated endpoint: replaces createTeacher + updateTeacher + assignTeacherToClass + updateTeacherPermissions.
 * - No id = create new teacher
 * - id present = update (including classIds assignment, permissions, soft-delete)
 */
export declare const saveTeacher: import("firebase-functions/https").CallableFunction<
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
