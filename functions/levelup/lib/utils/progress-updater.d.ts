import type { ItemProgressEntry } from "../types";
/** Item entry passed into the updater — extends ItemProgressEntry with storyPointId. */
export interface StoredItemProgressEntry extends ItemProgressEntry {
  storyPointId: string;
}
export interface RecalculateProgressParams {
  db: FirebaseFirestore.Firestore;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  /** New/updated item entries keyed by itemId. Will be merged (best-score) with existing entries. */
  newItemEntries: Record<string, StoredItemProgressEntry>;
  /** If true, mark the storyPoint as completed regardless of item count (e.g. test submitted). */
  forceStoryPointComplete?: boolean;
}
/**
 * Recalculate and persist progress inside a Firestore transaction.
 *
 * 1. Reads existing storyPoint progress subdoc
 * 2. Merges new items (best-score retention)
 * 3. Re-aggregates storyPoint-level scores from ALL items in subdoc
 * 4. Writes storyPoint subdoc
 * 5. Re-aggregates space-level scores from ALL storyPoint summaries
 * 6. Detects storyPoint and space completion
 * 7. Writes space-level doc
 * 8. Updates RTDB leaderboard
 */
export declare function recalculateAndWriteProgress(params: RecalculateProgressParams): Promise<{
  totalPointsEarned: number;
  overallPercentage: number;
}>;
