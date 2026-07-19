/**
 * Verify LevelUp migration: compare source vs target counts and spot-check data.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import {
  countDocs,
  spotCheckDocument,
  printVerificationResults,
  type VerificationResult,
} from "../utils/verification.js";
import { MigrationLogger } from "../utils/logger.js";

export async function verifyLevelUp(options: {
  orgId: string;
  logger: MigrationLogger;
}): Promise<boolean> {
  const { orgId, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;
  const results: VerificationResult[] = [];

  logger.info(`Verifying LevelUp migration for org ${orgId}`);

  // 1. Verify tenant exists
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    logger.error(`Tenant ${tenantId} does not exist!`);
    return false;
  }
  logger.info(`Tenant ${tenantId} exists: ${tenantSnap.data()?.name}`);

  // 2. Verify spaces (from courses)
  const sourceCourseCount = await countDocs(db.collection("courses").where("orgId", "==", orgId));
  const targetSpaceCount = await countDocs(db.collection(`tenants/${tenantId}/spaces`));
  results.push({
    collection: "Spaces (from courses)",
    sourceCount: sourceCourseCount,
    targetCount: targetSpaceCount,
    match: sourceCourseCount === targetSpaceCount,
    spotCheckPassed: true,
    errors:
      sourceCourseCount !== targetSpaceCount
        ? [`Count mismatch: source=${sourceCourseCount}, target=${targetSpaceCount}`]
        : [],
  });

  // 3. Verify user memberships
  const sourceUserOrgCount = await countDocs(db.collection("userOrgs").where("orgId", "==", orgId));
  // Count memberships for this tenant (approximate — we check by tenantId)
  const targetMembershipCount = await countDocs(
    db.collection("userMemberships").where("tenantId", "==", tenantId)
  );
  results.push({
    collection: "UserMemberships",
    sourceCount: sourceUserOrgCount,
    targetCount: targetMembershipCount,
    match: sourceUserOrgCount <= targetMembershipCount, // target may have more (admins added)
    spotCheckPassed: true,
    errors:
      sourceUserOrgCount > targetMembershipCount
        ? [`Missing memberships: source=${sourceUserOrgCount}, target=${targetMembershipCount}`]
        : [],
  });

  // 4. Verify items for each course
  const coursesSnap = await db.collection("courses").where("orgId", "==", orgId).get();
  let totalSourceItems = 0;
  let totalTargetItems = 0;

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const sourceItemCount = await countDocs(
      db.collection("items").where("courseId", "==", courseId)
    );
    const targetItemCount = await countDocs(
      db.collection(`tenants/${tenantId}/spaces/${courseId}/items`)
    );
    totalSourceItems += sourceItemCount;
    totalTargetItems += targetItemCount;
  }

  results.push({
    collection: "Items (all spaces)",
    sourceCount: totalSourceItems,
    targetCount: totalTargetItems,
    match: totalSourceItems === totalTargetItems,
    spotCheckPassed: true,
    errors:
      totalSourceItems !== totalTargetItems
        ? [`Count mismatch: source=${totalSourceItems}, target=${totalTargetItems}`]
        : [],
  });

  // 5. Verify storyPoints for each course
  let totalSourceStoryPoints = 0;
  let totalTargetStoryPoints = 0;

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const sourceSpCount = await countDocs(
      db.collection("storyPoints").where("courseId", "==", courseId)
    );
    const targetSpCount = await countDocs(
      db.collection(`tenants/${tenantId}/spaces/${courseId}/storyPoints`)
    );
    totalSourceStoryPoints += sourceSpCount;
    totalTargetStoryPoints += targetSpCount;
  }

  results.push({
    collection: "StoryPoints (all spaces)",
    sourceCount: totalSourceStoryPoints,
    targetCount: totalTargetStoryPoints,
    match: totalSourceStoryPoints === totalTargetStoryPoints,
    spotCheckPassed: true,
    errors:
      totalSourceStoryPoints !== totalTargetStoryPoints
        ? [`Count mismatch: source=${totalSourceStoryPoints}, target=${totalTargetStoryPoints}`]
        : [],
  });

  // 6. Verify chat sessions
  let totalSourceChatSessions = 0;
  let totalTargetChatSessions = 0;

  for (const courseDoc of coursesSnap.docs) {
    totalSourceChatSessions += await countDocs(
      db.collection("chatSessions").where("courseId", "==", courseDoc.id)
    );
  }
  totalTargetChatSessions = await countDocs(db.collection(`tenants/${tenantId}/chatSessions`));

  results.push({
    collection: "ChatSessions",
    sourceCount: totalSourceChatSessions,
    targetCount: totalTargetChatSessions,
    match: totalSourceChatSessions === totalTargetChatSessions,
    spotCheckPassed: true,
    errors:
      totalSourceChatSessions !== totalTargetChatSessions
        ? [`Count mismatch: source=${totalSourceChatSessions}, target=${totalTargetChatSessions}`]
        : [],
  });

  // 7. Spot-check: verify first course → space mapping
  if (!coursesSnap.empty) {
    const firstCourse = coursesSnap.docs[0];
    const spotCheck = await spotCheckDocument(
      db,
      `courses/${firstCourse.id}`,
      `tenants/${tenantId}/spaces/${firstCourse.id}`,
      { title: "title", slug: "slug" },
      logger
    );
    if (!spotCheck.passed) {
      const spaceResult = results.find((r) => r.collection.includes("Spaces"));
      if (spaceResult) {
        spaceResult.spotCheckPassed = false;
        spaceResult.errors.push(...spotCheck.errors);
      }
    }
  }

  printVerificationResults(results);

  const allPassed = results.every((r) => r.match && r.spotCheckPassed);
  return allPassed;
}
