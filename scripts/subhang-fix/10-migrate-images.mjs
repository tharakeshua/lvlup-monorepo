/**
 * Mechanical migration: inject image attachments back into pass-through fields
 * that the deployed backend PRESERVES (payload.content markdown for questions,
 * payload.richContent.blocks image blocks for rich materials).
 *
 * Reads from + writes to: tenants/tenant_subhang (the unprefixed SSOT the
 * deployed v1-levelup-* callables read). Idempotent — skips items that carry
 * the `_imagesPatched` sentinel we set on first pass.
 *
 * Usage:
 *   node 10-migrate-images.mjs           # dry-run (default)
 *   node 10-migrate-images.mjs --apply   # write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'tenants/tenant_subhang';

const IMG_MARKER = /<!--\s*imgs:auto\s*-->/;
function altFrom(a) {
  const name = String(a.fileName || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ').trim();
  return name || 'diagram';
}

function planPatch(item) {
  const att = Array.isArray(item.attachments) ? item.attachments.filter(a => a && a.url && a.type === 'image') : [];
  if (att.length === 0) return null;

  // Idempotent: item.meta._imagesPatched sentinel
  if (item.meta && item.meta._imagesPatched === true) return null;

  const p = item.payload || {};
  const patch = { meta: { ...(item.meta || {}), _imagesPatched: true, _imagesCount: att.length } };

  if (item.type === 'material' && p.materialType === 'rich') {
    // Append image blocks to payload.richContent.blocks
    const rc = p.richContent || {};
    const blocks = Array.isArray(rc.blocks) ? rc.blocks.slice() : [];
    // dedupe: skip URLs already present
    const already = new Set(blocks.filter(b => b?.type === 'image').map(b => b.content || b.metadata?.url).filter(Boolean));
    let added = 0;
    for (const a of att) {
      if (already.has(a.url)) continue;
      blocks.push({
        id: `img_${a.id || added}`,
        type: 'image',
        content: a.url,
        metadata: { alt: altFrom(a), fileName: a.fileName, mimeType: a.mimeType, url: a.url },
      });
      added++;
    }
    if (added === 0) return null;
    patch.payload = { ...p, richContent: { ...rc, blocks } };
    patch._kind = 'material-rich-blocks';
    patch._added = added;
    return patch;
  }

  if (item.type === 'question') {
    // Append markdown image refs at the end of payload.content
    const content = typeof p.content === 'string' ? p.content : '';
    if (IMG_MARKER.test(content)) return null;
    const md = att.map(a => `![${altFrom(a)}](${a.url})`).join('\n');
    const newContent = `${content}\n\n<!-- imgs:auto -->\n${md}`.replace(/^\n+/, '');
    patch.payload = { ...p, content: newContent };
    patch._kind = 'question-content-md';
    patch._added = att.length;
    return patch;
  }

  // Other item types (rare) — no safe channel for images through the deployed
  // backend right now; log and skip.
  return { _kind: 'skipped-no-channel', _added: 0, meta: patch.meta };
}

async function main() {
  const spaces = await db.collection(`${T}/spaces`).get();
  const summary = { scanned: 0, planned: 0, byKind: {}, imagesInjected: 0, skippedAlreadyPatched: 0, skippedNoChannel: 0, samples: [] };
  const writes = [];

  for (const s of spaces.docs) {
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs) {
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs) {
        summary.scanned++;
        const d = it.data();
        const att = Array.isArray(d.attachments) ? d.attachments.filter(a => a?.url && a?.type === 'image') : [];
        if (att.length === 0) continue;
        if (d.meta?._imagesPatched) { summary.skippedAlreadyPatched++; continue; }
        const patch = planPatch(d);
        if (!patch) continue;
        summary.byKind[patch._kind] = (summary.byKind[patch._kind] || 0) + 1;
        summary.imagesInjected += patch._added || 0;
        if (patch._kind === 'skipped-no-channel') { summary.skippedNoChannel++; continue; }
        summary.planned++;
        writes.push({ ref: it.ref, data: { payload: patch.payload, meta: patch.meta } });
        if (summary.samples.length < 3) summary.samples.push({ path: it.ref.path.replace(T + '/', ''), kind: patch._kind, added: patch._added });
      }
    }
  }

  console.log('DRY-RUN summary:');
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) { console.log(`\n(dry-run) ${writes.length} writes planned. Rerun with --apply to write.`); process.exit(0); }

  console.log(`\nAPPLYING ${writes.length} writes in batches of 400...`);
  let done = 0;
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.set(w.ref, w.data, { merge: true });
    await batch.commit();
    done += Math.min(400, writes.length - i);
    process.stdout.write(`  ${done}/${writes.length}\r`);
  }
  console.log(`\nDONE: ${done} items updated.`);
  writeFileSync('subhang-fix/dumps/migrate-images-result.json', JSON.stringify(summary, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.stack || e.message); process.exit(1); });
