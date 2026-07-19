/**
 * v3 (correct root): Deployed backend reads v2_tenants/tenant_subhang.
 * Read attachments from tenants/tenant_subhang (original source, has attachments),
 * write patched content/blocks into v2_tenants/tenant_subhang.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const SRC = 'tenants/tenant_subhang';   // original with attachments
const DST = 'v2_tenants/tenant_subhang'; // what deployed reads
const IMG_MARKER = /<!--\s*imgs:auto\s*-->/;
const alt = (a) => (String(a.fileName||'').replace(/\.[a-z0-9]+$/i,'').replace(/[-_]/g,' ').trim() || 'diagram');

async function main(){
  // Build index of DST items so we know which exist there
  console.log('indexing v2_ items...');
  const dstIdx = new Map();
  for (const root of ['spaces','storyPoints']) {
    // v2_ has BOTH tenant-level storyPoints AND space-nested storyPoints. Items live under storyPoints.
  }
  // v2_ items are under tenant-level storyPoints/{sp}/items
  const dstSps = await db.collection(`${DST}/storyPoints`).get();
  for (const sp of dstSps.docs) {
    const its = await db.collection(`${sp.ref.path}/items`).get();
    for (const it of its.docs) dstIdx.set(it.id, it.ref);
  }
  console.log('v2_ items indexed:', dstIdx.size);

  // Walk SRC for items with attachments, plan writes to DST
  const writes = [];
  const summary = { srcScanned:0, srcWithAtt:0, dstFound:0, dstMissing:0, planned:0, byKind:{}, imagesInjected:0, alreadyPatched:0 };
  const spaces = await db.collection(`${SRC}/spaces`).get();
  const missingSample = [];
  for (const s of spaces.docs) {
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs) {
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs) {
        summary.srcScanned++;
        const src = it.data();
        const att = Array.isArray(src.attachments) ? src.attachments.filter(a=>a?.url&&a?.type==='image') : [];
        if (!att.length) continue;
        summary.srcWithAtt++;
        const dstRef = dstIdx.get(it.id);
        if (!dstRef) { summary.dstMissing++; if(missingSample.length<3) missingSample.push(it.id); continue; }
        summary.dstFound++;
        const dstDoc = await dstRef.get();
        const dst = dstDoc.data();
        if (dst.meta?._imagesPatchedV3) { summary.alreadyPatched++; continue; }

        const p = dst.payload || {};
        const meta = { ...(dst.meta||{}), _imagesPatchedV3: true, _imagesCount: att.length };

        // material rich → append paragraph block with markdown
        if (dst.type === 'material' && p.materialType === 'rich') {
          const rc = p.richContent || {};
          const blocks = Array.isArray(rc.blocks) ? rc.blocks.slice() : [];
          const has = blocks.some(b => b?.type==='paragraph' && IMG_MARKER.test(b?.content||''));
          if (has) { summary.alreadyPatched++; continue; }
          const md = att.map(a=>`![${alt(a)}](${a.url})`).join('\n\n');
          blocks.push({ id:'imgs_auto_paragraph', type:'paragraph', content:`<!-- imgs:auto -->\n${md}` });
          summary.planned++;
          const kind='material-paragraph-md'; summary.byKind[kind]=(summary.byKind[kind]||0)+1;
          summary.imagesInjected += att.length;
          writes.push({ ref: dstRef, data: { meta, payload: { ...p, richContent: { ...rc, blocks } } } });
          continue;
        }

        // question → append markdown to top-level content
        if (dst.type === 'question') {
          const cur = typeof dst.content === 'string' ? dst.content : '';
          if (IMG_MARKER.test(cur)) { summary.alreadyPatched++; continue; }
          const md = att.map(a=>`![${alt(a)}](${a.url})`).join('\n\n');
          const newContent = `${cur}\n\n<!-- imgs:auto -->\n${md}`.replace(/^\n+/, '');
          summary.planned++;
          const kind='question-toplevel-md'; summary.byKind[kind]=(summary.byKind[kind]||0)+1;
          summary.imagesInjected += att.length;
          writes.push({ ref: dstRef, data: { meta, content: newContent } });
          continue;
        }
      }
    }
  }
  console.log('summary:', JSON.stringify(summary,null,2));
  if (missingSample.length) console.log('sample dst-missing item ids:', missingSample);
  if (!APPLY) { console.log(`(dry) ${writes.length} writes`); return; }
  console.log(`applying ${writes.length}...`);
  for (let i=0;i<writes.length;i+=400){
    const b = db.batch();
    for (const w of writes.slice(i,i+400)) b.set(w.ref, w.data, {merge:true});
    await b.commit();
    process.stdout.write(`  ${Math.min(i+400,writes.length)}/${writes.length}\r`);
  }
  console.log('\ndone');
  writeFileSync('subhang-fix/dumps/migrate-images-v3-result.json', JSON.stringify(summary,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
