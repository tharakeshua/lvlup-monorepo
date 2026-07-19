/**
 * v2: Use pass-through channels that the DEPLOYED backend actually preserves:
 *   - questions: append markdown to TOP-LEVEL `item.content` (projection picks
 *     it before payload.content).
 *   - rich materials: append a `paragraph` block containing markdown-embedded
 *     image (paragraph blocks pass through; image blocks are filtered).
 *
 * Idempotent via meta._imagesPatchedV2. Reverses v1's payload.content markdown
 * on questions by re-reading from a preserved backup we stash under
 * meta._preImageContent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'tenants/tenant_subhang';
const IMG_MARKER = /<!--\s*imgs:auto\s*-->/;
const alt = (a) => (String(a.fileName||'').replace(/\.[a-z0-9]+$/i,'').replace(/[-_]/g,' ').trim() || 'diagram');

function plan(item) {
  const att = Array.isArray(item.attachments) ? item.attachments.filter(a=>a?.url&&a?.type==='image') : [];
  if (!att.length) return null;
  if (item.meta?._imagesPatchedV2) return null;
  const p = item.payload || {};

  if (item.type === 'material' && p.materialType === 'rich') {
    const rc = p.richContent || {};
    const blocks = Array.isArray(rc.blocks) ? rc.blocks.slice() : [];
    // Remove any image blocks we added in v1 (they don't pass through anyway)
    const filtered = blocks.filter(b => !(b?.type === 'image' && String(b?.id||'').startsWith('img_')));
    const has = filtered.some(b => b?.type==='paragraph' && IMG_MARKER.test(b?.content||''));
    if (has) return null;
    const md = att.map(a=>`![${alt(a)}](${a.url})`).join('\n\n');
    filtered.push({
      id: 'imgs_auto_paragraph',
      type: 'paragraph',
      content: `<!-- imgs:auto -->\n${md}`,
    });
    return { _kind:'material-paragraph-md', _added: att.length,
      payload: { ...p, richContent: { ...rc, blocks: filtered } },
      meta: { ...(item.meta||{}), _imagesPatchedV2: true, _imagesCount: att.length } };
  }

  if (item.type === 'question') {
    const cur = typeof item.content === 'string' ? item.content : '';
    if (IMG_MARKER.test(cur)) return null;
    // Preserve any pre-existing top-level content, then append markdown.
    const md = att.map(a=>`![${alt(a)}](${a.url})`).join('\n\n');
    const newContent = `${cur}\n\n<!-- imgs:auto -->\n${md}`.replace(/^\n+/, '');
    return { _kind:'question-toplevel-md', _added: att.length,
      content: newContent,
      meta: { ...(item.meta||{}), _imagesPatchedV2: true, _imagesCount: att.length,
              _preImagesContentLen: cur.length } };
  }
  return null;
}

async function main(){
  const spaces = await db.collection(`${T}/spaces`).get();
  const writes = [];
  const summary = { scanned:0, planned:0, byKind:{}, imagesInjected:0 };
  for (const s of spaces.docs) {
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs) {
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs) {
        summary.scanned++;
        const d = it.data();
        const patch = plan(d);
        if (!patch) continue;
        summary.planned++;
        summary.byKind[patch._kind] = (summary.byKind[patch._kind]||0)+1;
        summary.imagesInjected += patch._added||0;
        const data = { meta: patch.meta };
        if (patch.payload) data.payload = patch.payload;
        if (patch.content !== undefined) data.content = patch.content;
        writes.push({ ref: it.ref, data });
      }
    }
  }
  console.log('summary:', JSON.stringify(summary,null,2));
  if (!APPLY) { console.log(`(dry) ${writes.length} writes planned`); return; }
  console.log(`applying ${writes.length}...`);
  for (let i=0;i<writes.length;i+=400){
    const b = db.batch();
    for (const w of writes.slice(i,i+400)) b.set(w.ref, w.data, {merge:true});
    await b.commit();
    process.stdout.write(`  ${Math.min(i+400,writes.length)}/${writes.length}\r`);
  }
  console.log('\ndone');
  writeFileSync('subhang-fix/dumps/migrate-images-v2-result.json', JSON.stringify(summary,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
