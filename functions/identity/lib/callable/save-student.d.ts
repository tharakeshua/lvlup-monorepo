/**
 * Consolidated endpoint: replaces createStudent + updateStudent + deleteStudent + assignStudentToClass.
 * - No id = create new student
 * - id present = update existing student (including classIds assignment and soft-delete via status)
 */
export declare const saveStudent: import("firebase-functions/https").CallableFunction<
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
