/**
 * Verify user migration: ensure no duplicates, all memberships correct.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { countDocs } from "../utils/verification.js";
import { MigrationLogger } from "../utils/logger.js";

export async function verifyUsers(options: { logger: MigrationLogger }): Promise<boolean> {
  const { logger } = options;
  const db = getFirestore();
  let passed = true;

  logger.info("Verifying user migration integrity");

  // 1. Count total users
  const totalUsers = await countDocs(db.collection("users"));
  logger.info(`Total users: ${totalUsers}`);

  // 2. Count total memberships
  const totalMemberships = await countDocs(db.collection("userMemberships"));
  logger.info(`Total memberships: ${totalMemberships}`);

  // 3. Check for duplicate memberships (same uid+tenantId)
  const membershipsSnap = await db.collection("userMemberships").get();
  const membershipKeys = new Set<string>();
  const duplicates: string[] = [];

  for (const doc of membershipsSnap.docs) {
    const data = doc.data();
    const key = `${data.uid}_${data.tenantId}`;
    if (membershipKeys.has(key)) {
      duplicates.push(doc.id);
    }
    membershipKeys.add(key);
  }

  if (duplicates.length > 0) {
    logger.error(`Found ${duplicates.length} duplicate memberships`, {
      duplicates: duplicates.slice(0, 10),
    });
    passed = false;
  } else {
    logger.info("No duplicate memberships found");
  }

  // 4. Verify every membership references a valid user
  let orphanedMemberships = 0;
  const sampleSize = Math.min(100, membershipsSnap.docs.length);
  const sampleDocs = membershipsSnap.docs.slice(0, sampleSize);

  for (const doc of sampleDocs) {
    const data = doc.data();
    const userSnap = await db.doc(`users/${data.uid}`).get();
    if (!userSnap.exists) {
      orphanedMemberships++;
      logger.warn(`Orphaned membership: ${doc.id} references non-existent user ${data.uid}`);
    }
  }

  if (orphanedMemberships > 0) {
    logger.error(`Found ${orphanedMemberships} orphaned memberships (in sample of ${sampleSize})`);
    passed = false;
  } else {
    logger.info(`All ${sampleSize} sampled memberships reference valid users`);
  }

  // 5. Verify every membership references a valid tenant
  let orphanedTenants = 0;
  for (const doc of sampleDocs) {
    const data = doc.data();
    const tenantSnap = await db.doc(`tenants/${data.tenantId}`).get();
    if (!tenantSnap.exists) {
      orphanedTenants++;
      logger.warn(`Membership ${doc.id} references non-existent tenant ${data.tenantId}`);
    }
  }

  if (orphanedTenants > 0) {
    logger.error(
      `Found ${orphanedTenants} memberships with non-existent tenants (sample of ${sampleSize})`
    );
    passed = false;
  } else {
    logger.info(`All ${sampleSize} sampled memberships reference valid tenants`);
  }

  // Summary
  console.log("\n========== User Verification Summary ==========");
  console.log(`Total users:           ${totalUsers}`);
  console.log(`Total memberships:     ${totalMemberships}`);
  console.log(`Duplicate memberships: ${duplicates.length}`);
  console.log(`Orphaned memberships:  ${orphanedMemberships} (sample of ${sampleSize})`);
  console.log(`Orphaned tenants:      ${orphanedTenants} (sample of ${sampleSize})`);
  console.log(`Overall: ${passed ? "PASSED" : "FAILED"}`);
  console.log("================================================\n");

  return passed;
}
