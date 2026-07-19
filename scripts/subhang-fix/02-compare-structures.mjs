/** Mechanical structural comparison: original (tenants/tenant_subhang) vs live (v2_tenants/tenant_subhang). */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);

async function structure(T){
  const out = { tenant:T, spaces:0, storyPoints:0, items:0, imgItems:0, spNested:0, spTenantLevel:0, itemPaths:new Set(), spaceItemCounts:{} };
  // tenant-level storyPoints
  const tlsp = await db.collection(`${T}/storyPoints`).get();
  out.spTenantLevel = tlsp.size;
  const spaces = await db.collection(`${T}/spaces`).get();
  out.spaces = spaces.size;
  for (const s of spaces.docs){
    const nested = await db.collection(`${s.ref.path}/storyPoints`).get();
    out.spNested += nested.size;
  }
  // Determine where items live: try tenant-level storyPoints subcoll AND nested
  const allSp = [];
  for (const sp of tlsp.docs) allSp.push(sp.ref.path);
  for (const s of spaces.docs){ const n=await db.collection(`${s.ref.path}/storyPoints`).get(); for(const sp of n.docs) allSp.push(sp.ref.path); }
  out.storyPoints = allSp.length;
  for (const spPath of allSp){
    const its = await db.collection(`${spPath}/items`).get();
    out.items += its.size;
    for (const it of its.docs){
      const d = it.data();
      const sid = d.spaceId || spPath.split('/spaces/')[1]?.split('/')[0] || '?';
      out.spaceItemCounts[sid] = (out.spaceItemCounts[sid]||0)+1;
      if (Array.isArray(d.attachments) && d.attachments.length) out.imgItems++;
      if (out.itemPaths.size<3) out.itemPaths.add(it.ref.path.replace(T+'/',''));
    }
  }
  out.itemPaths=[...out.itemPaths];
  return out;
}
async function main(){
  for (const T of ['tenants/tenant_subhang','v2_tenants/tenant_subhang']){
    const s = await structure(T);
    console.log(`\n### ${T}`);
    console.log(` spaces=${s.spaces} storyPoints=${s.storyPoints} (tenantLevel=${s.spTenantLevel}, nestedUnderSpaces=${s.spNested}) items=${s.items} itemsWithAttachments=${s.imgItems}`);
    console.log(' sample item paths:', JSON.stringify(s.itemPaths));
    console.log(' per-space item counts:', JSON.stringify(s.spaceItemCounts));
  }
  // Does live item id 7Ishu8K5F7PBmbzx0OjJ exist in v2_ or original?
  for (const T of ['v2_tenants/tenant_subhang','tenants/tenant_subhang']){
    const cg = await db.collectionGroup('items').where('id','==','7Ishu8K5F7PBmbzx0OjJ').get().catch(()=>({docs:[]}));
    console.log(`\nitem 7Ishu8K5F7PBmbzx0OjJ via collectionGroup: ${cg.docs.map(d=>d.ref.path).join(' | ')||'(index-needed/none)'}`);
    break;
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
