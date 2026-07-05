import type { UnifiedItem } from "../types";
/**
 * getItemForEdit — returns the full UnifiedItem with answer-key data merged
 * back into the payload. Server-side strips answers into a protected
 * `answerKeys` subcollection for timed_test items so students can't see them
 * via Firestore reads. The teacher portal needs the unstripped version when
 * editing — otherwise saving overwrites the answer key with empty values.
 *
 * Auth: teacher or admin only.
 */
export declare const getItemForEdit: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    item: UnifiedItem;
  }>,
  unknown
>;
