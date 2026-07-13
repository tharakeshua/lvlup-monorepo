interface StoreSpaceSummary {
  id: string;
  title: string;
  storeDescription: string;
  storeThumbnailUrl: string | null;
  subject: string | null;
  labels: string[];
  price: number;
  currency: string;
  totalStudents: number;
  totalStoryPoints: number;
}
/**
 * List spaces published to the public B2C store.
 * Minimal auth: works for any authenticated user (consumer or school).
 */
export declare const listStoreSpaces: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    spaces: StoreSpaceSummary[];
    hasMore: boolean;
    lastId: string | null;
  }>,
  unknown
>;
export {};
