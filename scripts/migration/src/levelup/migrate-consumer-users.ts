/**
 * Migrate LevelUp consumer (B2C) users.
 *
 * Consumer users don't belong to an org. They stay in /users/{uid}
 * with a consumerProfile added. No membership records needed.
 *
 * This script finds all users in the legacy /users collection that
 * do NOT have any userOrg membership and adds the consumerProfile.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyUser {
  _docId: string;
  uid: string;
  email?: string;
  phone?: string;
  fullName?: string;
  displayName?: string;
  photoURL?: string;
  country?: string;
  age?: number;
  grade?: string;
  onboardingCompleted?: boolean;
  roles?: string[];
  createdAt: number;
  updatedAt: number;
}

export async function migrateConsumerUsers(options: {
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { dryRun, logger } = options;
  const db = getFirestore();

  logger.info("Migrating LevelUp consumer (B2C) users");

  // Read all users
  const allUsers = await readAllDocs<LegacyUser>(
    db.collection("users") as admin.firestore.CollectionReference
  );
  logger.info(`Found ${allUsers.length} total users`);

  // Read all userOrgs to find org-affiliated users
  const allUserOrgs = await readAllDocs<{ _docId: string; userId: string }>(
    db.collection("userOrgs") as admin.firestore.CollectionReference
  );
  const orgUserIds = new Set(allUserOrgs.map((uo) => uo.userId));

  // Filter to consumer-only users (no org membership)
  const consumerUsers = allUsers.filter((u) => !orgUserIds.has(u._docId));
  logger.info(`Found ${consumerUsers.length} consumer users (no org membership)`);

  // Also find users who have enrolled in public courses
  const enrolledCourses = new Map<string, string[]>();
  // We'll look at progress records to determine enrolled courses
  for (const user of consumerUsers) {
    const progressSnap = await db
      .collection("userStoryPointProgress")
      .where("userId", "==", user._docId)
      .limit(100)
      .get();

    const courseIds = new Set<string>();
    for (const doc of progressSnap.docs) {
      const data = doc.data();
      if (data.courseId) courseIds.add(data.courseId);
    }
    if (courseIds.size > 0) {
      enrolledCourses.set(user._docId, Array.from(courseIds));
    }
  }

  await processBatch(
    consumerUsers,
    async (user, batch, db) => {
      const uid = user._docId;
      const userPath = `users/${uid}`;

      // Check if user already has been updated with unified schema
      const existingSnap = await db.doc(userPath).get();
      const existingData = existingSnap.data();
      if (existingData?.consumerProfile) {
        logger.debug(`User ${uid} already has consumerProfile, skipping`);
        return { action: "skipped", id: uid };
      }

      const enrolled = enrolledCourses.get(uid) || [];

      const updates: Record<string, unknown> = {
        uid,
        email: user.email || null,
        phone: user.phone || null,
        authProviders: user.email ? ["email"] : user.phone ? ["phone"] : [],
        displayName: user.displayName || user.fullName || "",
        firstName: null,
        lastName: null,
        photoURL: user.photoURL || null,
        country: user.country || null,
        age: user.age || null,
        grade: user.grade || null,
        onboardingCompleted: user.onboardingCompleted || false,
        isSuperAdmin: false,
        consumerProfile: {
          plan: "free",
          enrolledSpaceIds: enrolled,
        },
        status: "active",
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (dryRun) {
        logger.info(
          `[DRY RUN] Would update consumer user: ${uid} (enrolled in ${enrolled.length} courses)`
        );
        return { action: "created", id: uid };
      }

      batch.set(db.doc(userPath), updates, { merge: true });
      return { action: "created", id: uid };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
