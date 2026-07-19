/**
 * Migrate LevelUp org users → /users/{uid} + /userMemberships/{uid}_{tenantId}
 *
 * Processes /userOrgs (memberships) and /users (profiles) and /userRoles
 * to create unified user documents and membership records.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyLevelUpUser {
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

interface LegacyUserOrg {
  _docId: string;
  userId: string;
  orgId: string;
  joinedAt: number;
  source: string;
  roles?: string[];
  orgName: string;
  orgImageUrl?: string;
  isArchived?: boolean;
}

interface LegacyUserRoles {
  _docId: string;
  userId: string;
  isSuperAdmin: boolean;
  orgAdmin: Record<string, { orgId: string; orgName: string }>;
  courseAdmin: Record<string, { courseId: string; courseName: string; orgId?: string }>;
}

export async function migrateLevelUpUsers(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Migrating LevelUp users for org ${orgId}`);

  // Find all users that belong to this org
  const userOrgs = await readAllDocs<LegacyUserOrg>(
    db.collection("userOrgs").where("orgId", "==", orgId) as admin.firestore.Query
  );
  logger.info(`Found ${userOrgs.length} user-org memberships`);

  // Read user roles for this org
  const userRoles = new Map<string, LegacyUserRoles>();
  for (const uo of userOrgs) {
    const roleSnap = await db.doc(`userRoles/${uo.userId}`).get();
    if (roleSnap.exists) {
      userRoles.set(uo.userId, { ...(roleSnap.data() as LegacyUserRoles), _docId: roleSnap.id });
    }
  }

  await processBatch(
    userOrgs,
    async (uo, batch, db) => {
      const uid = uo.userId;
      if (uo.isArchived) {
        logger.debug(`User ${uid} is archived in org, skipping`);
        return { action: "skipped", id: uid };
      }

      // Read the user profile
      const userSnap = await db.doc(`users/${uid}`).get();
      const userData = userSnap.exists ? (userSnap.data() as LegacyLevelUpUser) : null;

      // Create or merge /users/{uid}
      const userPath = `users/${uid}`;
      const userExists = await docExists(db, userPath);

      if (dryRun) {
        logger.info(`[DRY RUN] Would ${userExists ? "merge" : "create"} user ${uid}`);
      } else {
        const userDoc: Record<string, unknown> = {
          uid,
          email: userData?.email || null,
          phone: userData?.phone || null,
          authProviders: userData?.email ? ["email"] : userData?.phone ? ["phone"] : [],
          displayName: userData?.displayName || userData?.fullName || "",
          firstName: null,
          lastName: null,
          photoURL: userData?.photoURL || null,
          country: userData?.country || null,
          age: userData?.age || null,
          grade: userData?.grade || null,
          onboardingCompleted: userData?.onboardingCompleted || false,
          isSuperAdmin: userRoles.get(uid)?.isSuperAdmin || false,
          status: "active",
          updatedAt: admin.firestore.Timestamp.now(),
        };
        if (!userExists) {
          userDoc.createdAt = userData?.createdAt
            ? admin.firestore.Timestamp.fromMillis(userData.createdAt)
            : admin.firestore.Timestamp.now();
        }
        batch.set(db.doc(userPath), userDoc, { merge: true });
      }

      // Create /userMemberships/{uid}_{tenantId}
      const membershipId = `${uid}_${tenantId}`;
      const membershipPath = `userMemberships/${membershipId}`;

      if (await docExists(db, membershipPath)) {
        logger.debug(`Membership ${membershipId} already exists, skipping`);
        return { action: "skipped", id: uid };
      }

      // Determine role
      const roles = userRoles.get(uid);
      let role = "student";
      if (roles?.orgAdmin && roles.orgAdmin[orgId]) {
        role = "tenantAdmin";
      } else if (roles?.courseAdmin) {
        const hasCourseAdminInOrg = Object.values(roles.courseAdmin).some(
          (ca) => ca.orgId === orgId
        );
        if (hasCourseAdminInOrg) role = "teacher";
      } else if (uo.roles?.includes("admin")) {
        role = "tenantAdmin";
      }

      if (dryRun) {
        logger.info(`[DRY RUN] Would create membership: ${membershipId} (role=${role})`);
        return { action: "created", id: uid };
      }

      batch.set(db.doc(membershipPath), {
        id: membershipId,
        uid,
        tenantId,
        tenantCode: "", // Will be set from tenant
        role,
        status: "active",
        joinSource: "migration",
        createdAt: uo.joinedAt
          ? admin.firestore.Timestamp.fromMillis(uo.joinedAt)
          : admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      return { action: "created", id: uid };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
