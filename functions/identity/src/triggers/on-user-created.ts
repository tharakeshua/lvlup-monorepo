import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { logger } from "firebase-functions/v2";
import type { UnifiedUser } from "@levelup/shared-types";
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastLogin: FieldValue.serverTimestamp(),
      };

      await admin.firestore().doc(`users/${user.uid}`).set(userDoc);
      logger.info(`Created /users/${user.uid}`);
    } catch (error) {
      logger.error(`Failed to create /users/${user.uid}`, error);
    }
  });
