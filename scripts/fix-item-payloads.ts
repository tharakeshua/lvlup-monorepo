/**
 * Fix item payloads: flatten { type, data: {...} } → just the data object.
 *
 * The app expects item.payload to be a flat QuestionPayload or MaterialPayload,
 * but the seed script wrapped them in { type: 'question', data: {...} }.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/fix-item-payloads.ts
 */

import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const TENANT_ID = "UVrLA2eNZXwzu1GzyXpF";

async function fixPayloads() {
  const spacesSnap = await db.collection(`tenants/${TENANT_ID}/spaces`).get();
  console.log(`Found ${spacesSnap.size} spaces`);

  let totalFixed = 0;

  for (const spaceDoc of spacesSnap.docs) {
    const spaceId = spaceDoc.id;
    const spaceTitle = spaceDoc.data().title;

    // Get all story points
    const spSnap = await db.collection(`tenants/${TENANT_ID}/spaces/${spaceId}/storyPoints`).get();

    for (const spDoc of spSnap.docs) {
      const storyPointId = spDoc.id;
      const spTitle = spDoc.data().title;

      // Get all items under this story point
      const itemsSnap = await db
        .collection(`tenants/${TENANT_ID}/spaces/${spaceId}/storyPoints/${storyPointId}/items`)
        .get();

      if (itemsSnap.empty) continue;

      const batch = db.batch();
      let batchCount = 0;

      for (const itemDoc of itemsSnap.docs) {
        const data = itemDoc.data();
        const payload = data.payload;

        if (!payload) continue;

        // Check if payload has the wrapped format { type: '...', data: {...} }
        if (payload.data && (payload.type === "question" || payload.type === "material")) {
          // Flatten: replace payload with payload.data
          const flatPayload = payload.data;
          batch.update(itemDoc.ref, { payload: flatPayload });
          batchCount++;
          console.log(`  Fix: ${spaceTitle} > ${spTitle} > ${data.title} (${payload.type} → flat)`);
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        totalFixed += batchCount;
      }
    }
  }

  console.log(`\nFixed ${totalFixed} item payloads`);
}

fixPayloads().catch(console.error);
