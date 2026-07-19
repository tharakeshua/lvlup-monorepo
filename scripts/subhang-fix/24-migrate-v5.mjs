/** v5 (final): handles v2_ canonical shape for materials. */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const SRC='tenants/tenant_subhang', DST='v2_tenants/tenant_subhang';
const IMG_MARKER = /<!--\s*imgs:auto\s*-->/;
const alt = (a) => (String(a.fileName||'').replace(/\.[a-z0-9]+$/i,'').replace(/[-_]/g,' ').trim() || 'diagram');

async function main(){
  const summary = { srcScanned:0, srcWithAtt:0, dstExists:0, dstMissing:0, planned:0, byKind:{}, imagesInjected:0, alreadyPatched:0, skippedShape:0 };
  const writes = [];
  const spaces = await db.collection(`${SRC}/spaces`).get();
  let processed=0;
  for (const s of spaces.docs) {
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs) {
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs) {
        summary.srcScanned++;
        if (++processed % 500 === 0) process.stdout.write(`  scanned ${processed}\r`);
        const src = it.data();
        const att = Array.isArray(src.attachments) ? src.attachments.filter(a=>a?.url&&a?.type==='image') : [];
        if (!att.length) continue;
        summary.srcWithAtt++;
        const relPath = it.ref.path.replace(SRC+'/', '');
        const dstRef = db.doc(`${DST}/${relPath}`);
        const dstDoc = await dstRef.get();
        if (!dstDoc.exists) { summary.dstMissing++; continue; }
        summary.dstExists++;
        const dst = dstDoc.data();
        if (dst.meta?._imagesPatchedV5) { summary.alreadyPatched++; continue; }

        const p = dst.payload || {};
        const meta = { ...(dst.meta||{}), _imagesPatchedV5: true, _imagesCount: att.length };
        let patchData = null, kind = null;

        // Detect material rich in BOTH legacy and canonical shapes
        const mtLegacy = p.materialType;
        const mtCanon = p.materialData?.materialType;
        const isRichMaterial = dst.type === 'material' && (mtLegacy === 'rich' || mtCanon === 'rich');

        if (isRichMaterial) {
          // Prefer canonical materialData.blocks (what v2_ uses)
          const md = p.materialData || {};
          const rc = p.richContent || {};
          const blocks = Array.isArray(md.blocks) && md.blocks.length ? md.blocks.slice()
                       : Array.isArray(rc.blocks) ? rc.blocks.slice() : [];
          const has = blocks.some(b => b?.type==='paragraph' && IMG_MARKER.test(b?.content||''));
          if (has) { summary.alreadyPatched++; continue; }
          const mdText = att.map(a=>`![${alt(a)}](${a.url})`).join('\n\n');
          blocks.push({ id:'imgs_auto_paragraph', type:'paragraph', content:`<!-- imgs:auto -->\n${mdText}` });
          // Write to whichever the doc uses (materialData for v2_ canonical)
          const newPayload = { ...p };
          if (md.materialType === 'rich' || Array.isArray(md.blocks)) {
            newPayload.materialData = { ...md, blocks };
          } else {
            newPayload.richContent = { ...rc, blocks };
          }
          patchData = { meta, payload: newPayload };
          kind = 'material-paragraph-md';
        } else if (dst.type === 'question') {
          const cur = typeof dst.content === 'string' ? dst.content : '';
          if (IMG_MARKER.test(cur)) { summary.alreadyPatched++; continue; }
          const mdText = att.map(a=>`![${alt(a)}](${a.url})`).join('\n\n');
          const newContent = `${cur}\n\n<!-- imgs:auto -->\n${mdText}`.replace(/^\n+/, '');
          patchData = { meta, content: newContent };
          kind = 'question-toplevel-md';
        } else {
          summary.skippedShape++;
          continue;
        }
        summary.planned++;
        summary.byKind[kind] = (summary.byKind[kind]||0)+1;
        summary.imagesInjected += att.length;
        writes.push({ ref: dstRef, data: patchData });
      }
    }
  }
  console.log(`\nsummary: ${JSON.stringify(summary,null,2)}`);
  if (!APPLY) { console.log(`(dry) ${writes.length} writes`); return; }
  console.log(`applying ${writes.length}...`);
  for (let i=0;i<writes.length;i+=400){
    const b = db.batch();
    for (const w of writes.slice(i,i+400)) b.set(w.ref, w.data, {merge:true});
    await b.commit();
    process.stdout.write(`  ${Math.min(i+400,writes.length)}/${writes.length}\r`);
  }
  console.log('\ndone');
  writeFileSync('subhang-fix/dumps/migrate-v5-result.json', JSON.stringify(summary,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
