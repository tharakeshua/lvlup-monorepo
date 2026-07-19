import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'v2_tenants/tenant_subhang';
async function main() {
  const sp = await db.doc(`${T}/storyPoints/20KKFipTUan5hYBpyXNd`).get();
  const d = sp.data();
  console.log('SD storyPoint keys:', Object.keys(d).join(','));
  console.log('title:', d.title, ' type:', d.type, ' spaceId:', d.spaceId);
  const itemsField = d.items ?? d.contentItems ?? d.questions;
  console.log('items array present?', Array.isArray(itemsField), ' length:', Array.isArray(itemsField)?itemsField.length:'-');
  if (Array.isArray(itemsField)) {
    // find an item with image
    for (const it of itemsField) {
      const js = JSON.stringify(it);
      if (/image|\.png|\.jpg|diagram|storage|http/i.test(js)) {
        console.log('\n=== IMG item shape ===');
        console.log(JSON.stringify(it,null,1).slice(0,1800));
        break;
      }
    }
    console.log('\n=== first item shape (any) ===');
    console.log(JSON.stringify(itemsField[0],null,1).slice(0,1200));
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
