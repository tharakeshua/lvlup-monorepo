export declare const rolloverSession: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    newSessionId: string;
    classesCreated: number;
    teacherAssignments: number;
    studentsPromoted: number;
    studentsUnassigned: number;
  }>,
  unknown
>;
