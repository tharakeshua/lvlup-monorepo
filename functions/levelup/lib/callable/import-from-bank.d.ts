/**
 * Import questions from the question bank into a story point.
 * Creates UnifiedItem copies from QuestionBankItem sources.
 */
export declare const importFromBank: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: boolean;
    importedCount: number;
    itemIds: string[];
  }>,
  unknown
>;
