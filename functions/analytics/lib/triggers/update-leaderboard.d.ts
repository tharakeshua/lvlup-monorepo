/**
 * updateLeaderboard — Firestore trigger that updates RTDB leaderboard entries
 * when a student's progress summary changes.
 *
 * Triggers on: /tenants/{tenantId}/studentProgressSummaries/{studentId}
 *
 * Updates two leaderboard nodes in RTDB:
 * 1. Per-space leaderboard (courseLeaderboard/{spaceId}/{userId})
 * 2. Tenant-wide leaderboard (tenantLeaderboard/{tenantId}/{userId})
 *
 * These are consumed by the LeaderboardService on the client for real-time
 * ranking displays.
 */
export declare const updateLeaderboard: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").DocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      studentId: string;
    }
  >
>;
