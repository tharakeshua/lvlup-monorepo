/**
 * Save or update a space review (one review per user per space).
 * Also updates the denormalized rating aggregate on the Space document.
 */
export declare const saveSpaceReview: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: boolean;
    isUpdate: boolean;
  }>,
  unknown
>;
