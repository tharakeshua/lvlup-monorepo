/**
 * Start a new timed test / quiz session.
 *
 * Creates a DigitalTestSession with:
 * - Server timestamp for startedAt
 * - Precomputed serverDeadline
 * - Shuffled question order (if configured)
 * - Section mapping (itemId → sectionId)
 * - Adaptive difficulty ordering (if enabled)
 * - Max attempts enforcement
 */
export declare const startTestSession: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    sessionId: any;
    startedAt: any;
    serverDeadline: any;
    questionOrder: any;
    totalQuestions: any;
    attemptNumber: any;
    sectionMapping: any;
    lastVisitedIndex: any;
    resuming: boolean;
  }>,
  unknown
>;
