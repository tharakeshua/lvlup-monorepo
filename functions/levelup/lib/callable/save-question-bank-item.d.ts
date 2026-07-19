/**
 * Create, update, or delete a question bank item.
 *
 * Save* pattern: id absent = create, id present = update,
 * data.deleted = true = soft delete.
 */
export declare const saveQuestionBankItem: import("firebase-functions/https").CallableFunction<
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
