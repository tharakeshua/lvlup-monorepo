/**
 * SpaceReview — student ratings and reviews for spaces.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/reviews/{userId}
 * @module levelup/space-review
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface SpaceReview {
  id: string;
  spaceId: string;
  tenantId: string;
  userId: string;
  userName?: string;

  rating: number; // 1-5 stars
  comment?: string;

  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

/**
 * Denormalized aggregate rating stored on Space document.
 */
export interface SpaceRatingAggregate {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>; // { 1: count, 2: count, ... 5: count }
}
