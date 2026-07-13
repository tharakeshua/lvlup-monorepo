/**
 * Platform-level user identity types.
 * Collection: /users/{uid}
 */

/**
 * Portable Firestore Timestamp interface.
 * Matches both client SDK `Timestamp` and Admin SDK `Timestamp`
 * so shared-types avoids a direct Firebase dependency.
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

/** Firebase Auth provider identifier. */
export type AuthProvider = "email" | "phone" | "google" | "apple";

/** A single consumer space purchase record. */
export interface PurchaseRecord {
  spaceId: string;
  spaceTitle: string;
  amount: number;
  currency: string;
  purchasedAt: FirestoreTimestamp;
  transactionId: string;
}

/** Consumer (B2C) profile, optional for school users. */
export interface ConsumerProfile {
  plan: "free" | "pro" | "premium";
  enrolledSpaceIds: string[];
  purchaseHistory: PurchaseRecord[];
  totalSpend: number;
}

/**
 * Platform-wide user document.
 * Document ID = Firebase Auth UID.
 */
export interface UnifiedUser {
  uid: string;
  email?: string | null;
  phone?: string | null;
  authProviders: AuthProvider[];

  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  photoURL?: string | null;

  // Consumer-specific (LevelUp B2C)
  country?: string;
  age?: number;
  grade?: string;
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;

  // Platform flags
  isSuperAdmin: boolean;
  consumerProfile?: ConsumerProfile;

  // Multi-tenancy: currently active tenant
  activeTenantId?: string;

  // Lifecycle
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  lastLogin?: FirestoreTimestamp;
  status: "active" | "suspended" | "deleted";
}
