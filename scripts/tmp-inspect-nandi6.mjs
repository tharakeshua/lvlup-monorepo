/** READ-ONLY: walk nested spaces/storyPoints/items path and dump MCQ docs. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(
  readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8')
);
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);

const T = 'v2_tenants/tn_content-levelup_526ba51515';

async function main() {
  const spaces = await db.collection(`${T}/spaces`).listDocuments();
  let dumped = 0;
  for (const sp of spaces) {
    const sps = await db.collection(`${sp.path}/storyPoints`).listDocuments();
    if (sps.length) console.log(`${sp.path} → ${sps.length} nested storyPoints`);
    for (const spt of sps) {
      const items = await db.collection(`${spt.path}/items`).get();
      if (items.size === 0) continue;
      const qts = {};
      for (const it of items.docs) {
        const d = it.data();
        const qt = d?.payload?.questionData?.questionType ?? d?.payload?.questionType ?? d?.questionType ?? `type:${d?.type ?? d?.payload?.kind}`;
        qts[qt] = (qts[qt] ?? 0) + 1;
      }
      console.log(`  ${spt.path}/items: ${items.size} — ${JSON.stringify(qts)}`);
      for (const it of items.docs) {
        const d = it.data();
        const qt = d?.payload?.questionData?.questionType ?? d?.payload?.questionType ?? d?.questionType;
        if (qt === 'mcq' && dumped < 3) {
          console.log(`\n=== FULL DOC: ${it.ref.path}`);
          console.log(JSON.stringify(d, null, 1));
          dumped++;
        }
      }
    }
  }
  console.log(`\nDumped ${dumped} MCQ docs.`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
