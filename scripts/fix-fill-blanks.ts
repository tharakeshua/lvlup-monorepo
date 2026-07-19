/**
 * Fix fill-blanks items: add missing textWithBlanks field.
 *
 * The FillBlanksAnswerer component expects `questionData.textWithBlanks` to exist,
 * but seed data only had `blanks` array without it.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/fix-fill-blanks.ts
 */

import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const TENANT_ID = "UVrLA2eNZXwzu1GzyXpF";

async function fixFillBlanks() {
  const spacesSnap = await db.collection(`tenants/${TENANT_ID}/spaces`).get();
  console.log(`Found ${spacesSnap.size} spaces`);

  let fixed = 0;

  for (const spaceDoc of spacesSnap.docs) {
    const spaceId = spaceDoc.id;
    const spsSnap = await db.collection(`tenants/${TENANT_ID}/spaces/${spaceId}/storyPoints`).get();

    for (const spDoc of spsSnap.docs) {
      const storyPointId = spDoc.id;
      const itemsSnap = await db
        .collection(`tenants/${TENANT_ID}/spaces/${spaceId}/storyPoints/${storyPointId}/items`)
        .get();

      for (const itemDoc of itemsSnap.docs) {
        const data = itemDoc.data();
        if (data.payload?.questionType === "fill-blanks") {
          const qd = data.payload.questionData;
          console.log(
            `Found fill-blanks: "${data.title}" | textWithBlanks: ${qd.textWithBlanks} | blanks: ${JSON.stringify(qd.blanks)}`
          );

          if (qd.textWithBlanks === undefined && qd.blanks) {
            // Reconstruct textWithBlanks from content + blanks
            const content = data.payload.content || data.content || "";
            console.log(`  Content: ${content}`);

            // Replace each __ placeholder with {{blankId}}
            let textWithBlanks = content;
            for (const blank of qd.blanks) {
              textWithBlanks = textWithBlanks.replace("__", `{{${blank.id}}}`);
            }
            console.log(`  Generated textWithBlanks: ${textWithBlanks}`);

            // Update Firestore
            await itemDoc.ref.update({
              "payload.questionData.textWithBlanks": textWithBlanks,
            });
            fixed++;
            console.log(`  FIXED!`);
          }
        }
      }
    }
  }

  console.log(`\nFixed ${fixed} fill-blanks items`);
}

fixFillBlanks().catch(console.error);
