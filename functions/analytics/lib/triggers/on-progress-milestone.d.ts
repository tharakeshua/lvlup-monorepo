/**
 * onProgressMilestone — Firestore trigger that sends notifications when a
 * student's progress summary changes and they hit achievement milestones.
 *
 * Milestones:
 *   - First exam completed
 *   - Exam average crosses 80% threshold
 *   - First space completed
 *   - All spaces completed
 *   - 7-day streak achieved
 *   - Student newly at-risk (notify admin + parent)
 *   - Student no longer at-risk (notify parent)
 *
 * Triggers on: /tenants/{tenantId}/studentProgressSummaries/{studentId}
 */
export declare const onProgressMilestone: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      studentId: string;
    }
  >
>;
