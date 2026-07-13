/**
 * Submit a timed test / quiz session.
 *
 * Validates timing, auto-evaluates deterministic questions,
 * triggers AI evaluation for subjective questions, computes scores
 * and detailed analytics (topic, difficulty, section, Bloom's breakdowns).
 */
export declare const submitTestSession: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: boolean;
    pointsEarned: number;
    totalPoints: number;
    marksEarned: number;
    totalMarks: number;
    percentage: number;
  }>,
  unknown
>;
