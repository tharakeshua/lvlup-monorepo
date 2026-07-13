/**
 * Consumer purchases a space from the public store.
 * MVP: no actual payment processing — just records the purchase.
 * Adds spaceId to user.consumerProfile.enrolledSpaceIds and appends a PurchaseRecord.
 */
export declare const purchaseSpace: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: boolean;
    transactionId: string;
  }>,
  unknown
>;
