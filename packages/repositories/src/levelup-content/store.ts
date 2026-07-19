/**
 * storeRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md) — B2C store/reviews/purchase.
 *
 *   listStoreSpaces(filter)  — listStoreSpaces (paginated)
 *   getStoreSpace(id)        — getStoreSpace
 *   listReviews(spaceId)     — listSpaceReviews (paginated)
 *   saveReview(input)        — saveSpaceReview
 *   recordPurchase(input)    — purchaseSpace (the `purchase` verb, named with the
 *                              sanctioned `record*` IO prefix; ⚷ server-authoritative
 *                              enrollment — never optimistic, §6.8)
 *
 * N+1 collapse: review aggregates are batched SERVER-side (the listing already
 * carries `ratingAggregate`); the repo never fans a per-space review read.
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  makePaginator,
  toPage,
} from "./_kit";

export interface StoreSpaceFilter extends PageRequest {
  subject?: string;
  search?: string;
}

export interface SaveReviewInput {
  spaceId: string;
  rating: number;
  comment?: string;
}

export interface PurchaseInput {
  spaceId: string;
  paymentToken?: string;
  idempotencyKey?: string;
}

export interface PurchaseResult {
  success: boolean;
  transactionId: string;
  enrolledSpaceId: string;
}

export interface StoreRepo {
  listStoreSpaces(filter?: StoreSpaceFilter): Promise<Page<unknown>>;
  paginateStoreSpaces(filter?: StoreSpaceFilter): Promise<PageBag<unknown>>;
  getStoreSpace(id: string): Promise<unknown>;
  listReviews(filter: { spaceId: string } & PageRequest): Promise<Page<unknown>>;
  saveReview(input: SaveReviewInput): Promise<unknown>;
  recordPurchase(input: PurchaseInput): Promise<PurchaseResult>;
}

export function createStoreRepo(api: ApiClientLike): StoreRepo {
  const lv = api.levelup;
  return {
    listStoreSpaces: (filter = {}) => lv["listStoreSpaces"]!(filter).then((r) => toPage(r)),
    paginateStoreSpaces: (filter = {}) =>
      makePaginator((req) => lv["listStoreSpaces"]!(req), filter),
    // Callable returns `{ listing }`; callers expect the listing view itself.
    getStoreSpace: (id) =>
      lv["getStoreSpace"]!({ spaceId: id }).then((r) => (r as { listing: unknown }).listing),
    listReviews: (filter) => lv["listSpaceReviews"]!(filter).then((r) => toPage(r)),
    saveReview: (input) => lv["saveSpaceReview"]!(input),
    recordPurchase: async (input) => (await lv["purchaseSpace"]!(input)) as PurchaseResult,
  };
}
