/**
 * One-time script to add canCreateExams permission to teacher's claims.
 * Run: npx tsx scripts/fix-teacher-claims.ts
 */
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve(
  __dirname,
  "../lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json"
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function fixTeacherClaims() {
  // Find the teacher user by email
  const email = "priya.sharma@greenwood.edu";

  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${user.uid} (${email})`);
    console.log("Current claims:", JSON.stringify(user.customClaims, null, 2));

    // Merge permissions into existing claims
    const existingClaims = user.customClaims || {};
    const updatedClaims = {
      ...existingClaims,
      permissions: {
        ...(existingClaims.permissions || {}),
        canCreateExams: true,
        canEditRubrics: true,
        canManuallyGrade: true,
        canViewAllExams: true,
        canCreateSpaces: true,
        canManageContent: true,
        canViewAnalytics: true,
      },
    };

    await admin.auth().setCustomUserClaims(user.uid, updatedClaims);
    console.log("Updated claims:", JSON.stringify(updatedClaims, null, 2));
    console.log("Done! The teacher will get new claims on next token refresh.");

    // Also update the membership document to include permissions
    const db = admin.firestore();
    const tenantId = existingClaims.tenantId;
    if (tenantId) {
      const membershipId = `${user.uid}_${tenantId}`;
      const membershipRef = db.doc(`userMemberships/${membershipId}`);
      const membershipDoc = await membershipRef.get();
      if (membershipDoc.exists) {
        await membershipRef.update({
          "permissions.canCreateExams": true,
          "permissions.canEditRubrics": true,
          "permissions.canManuallyGrade": true,
          "permissions.canViewAllExams": true,
        });
        console.log(`Updated membership ${membershipId} with permissions.`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }

  process.exit(0);
}

fixTeacherClaims();
