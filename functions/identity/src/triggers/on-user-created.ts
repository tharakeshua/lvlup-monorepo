import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import type { UnifiedUser } from "../contracts/legacy-docs";
import { determineProvider } from "../utils/auth-helpers";

/**
 * Auth trigger: runs when a new Firebase Auth account is created.
 * Creates the platform-level /users/{uid} document.
 */
export const onUserCreated = functions
  .region("asia-south1")
  .auth.user()
  .onCreate(async (user) => {
    try {
      const userDoc: Omit<UnifiedUser, "createdAt" | "updatedAt" | "lastLogin"> &
        Record<string, unknown> = {
        uid: user.uid,
        email: user.email ?? null,
        phone: user.phoneNumber ?? null,
        authProviders: [determineProvider(user)],
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
        firstName: null,
        lastName: null,
        photoURL: user.photoURL ?? null,
        isSuperAdmin: false,
        status: "active" as const,
        // B8: timestamps at rest are canonical ISO strings.
        createdAt: isoNow(),
        updatedAt: isoNow(),
        lastLogin: isoNow(),
      };

      await admin.firestore().doc(`users/${user.uid}`).set(userDoc);
      logger.info(`Created /users/${user.uid}`);
    } catch (error) {
      logger.error(`Failed to create /users/${user.uid}`, error);
    }
  });
