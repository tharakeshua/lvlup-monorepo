/**
 * Migrate items from flat path to nested storyPoints path.
 *
 * FROM: tenants/{tenantId}/spaces/{spaceId}/items
 * TO:   tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}/items
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/migrate-items-to-storypoints.ts
 */

import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const TENANT_ID = "UVrLA2eNZXwzu1GzyXpF";

async function migrate() {
  // Get all spaces
  const spacesSnap = await db.collection(`tenants/${TENANT_ID}/spaces`).get();
  console.log(`Found ${spacesSnap.size} spaces`);

  for (const spaceDoc of spacesSnap.docs) {
    const spaceId = spaceDoc.id;
    const spaceTitle = spaceDoc.data().title;
    console.log(`\nSpace: ${spaceTitle} (${spaceId})`);

    // Get all items from the flat path
    const itemsSnap = await db.collection(`tenants/${TENANT_ID}/spaces/${spaceId}/items`).get();
    console.log(`  Found ${itemsSnap.size} items at flat path`);

    if (itemsSnap.empty) continue;

    // Group items by storyPointId
    const itemsByStoryPoint: Record<string, admin.firestore.DocumentData[]> = {};
    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      const spId = data.storyPointId;
      if (!spId) {
        console.log(`  WARNING: Item ${itemDoc.id} has no storyPointId, skipping`);
        continue;
      }
      if (!itemsByStoryPoint[spId]) itemsByStoryPoint[spId] = [];
      itemsByStoryPoint[spId].push({ id: itemDoc.id, ...data });
    }

    // Write items to nested path
    for (const [storyPointId, items] of Object.entries(itemsByStoryPoint)) {
      console.log(`  Story Point ${storyPointId}: ${items.length} items`);

      // Check if items already exist at nested path
      const existingSnap = await db
        .collection(`tenants/${TENANT_ID}/spaces/${spaceId}/storyPoints/${storyPointId}/items`)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        console.log(`    Already has items at nested path, skipping`);
        continue;
      }

      const batch = db.batch();
      for (const item of items) {
        const newRef = db
          .collection(`tenants/${TENANT_ID}/spaces/${spaceId}/storyPoints/${storyPointId}/items`)
          .doc(item.id);
        const { id: _id, ...itemData } = item;
        batch.set(newRef, itemData);
      }
      await batch.commit();
      console.log(`    Migrated ${items.length} items to nested path`);
    }
  }

  console.log("\nMigration complete!");
}

migrate().catch(console.error);
