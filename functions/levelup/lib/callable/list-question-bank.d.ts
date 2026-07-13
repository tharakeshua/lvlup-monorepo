import * as admin from "firebase-admin";
/**
 * List/search question bank items with filtering and pagination.
 */
export declare const listQuestionBank: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    items: admin.firestore.DocumentData[];
    hasMore: boolean;
    lastId: string | null;
  }>,
  unknown
>;
