#!/usr/bin/env node
// S-sync ONLY — compile build/_ds_manifest.json from the bundle exports + every @dsCard marker.
// Run before each finalize_plan. Idempotent. No other actor writes this file.
//   node build-manifest.mjs            (writes build/_ds_manifest.json, prints summary)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BUILD = new URL('./build/', import.meta.url).pathname.replace(/\/$/, '');
// Project-derived runtime global (PascalCase(name)+_+first6HexOfId). Cards reference window.<NAMESPACE>.
const NAMESPACE = 'LvlupV0DesignSystem_5d0725';

// 1) components = the real .jsx source modules the app compiler ingests (name = file basename, PascalCase).
function scanJsx(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) scanJsx(p, out);
    else if (e.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}
const components = scanJsx(join(BUILD, 'components'))
  .map(p => ({ name: p.replace(/.*\//, '').replace(/\.jsx$/, ''), sourcePath: relative(BUILD, p) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// 2) walk build/ for cards carrying an @dsCard first-line marker
const DS = /^<!--\s*@dsCard\s+group="([^"]+)"\s+viewport="(\d+x\d+)"\s+name="([^"]+)"\s+subtitle="([^"]*)"\s*-->/;
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/^\.|^node_modules$/.test(e.name)) walk(p, out); }
    else if (/\.(card\.html|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
// INCLUDE SCOPE: only cards under these handed-off + verified roots go into the manifest.
// Pass roots as CLI args (e.g. `node build-manifest.mjs components foundations prototypes/exams`).
// No args = include everything (final-assembly mode).
const includeRoots = process.argv.slice(2);
const inScope = (rel) => includeRoots.length === 0 || includeRoots.some(r => rel === r || rel.startsWith(r.replace(/\/$/, '') + '/'));

const htmlFiles = walk(BUILD).sort();
const cards = [];
const malformed = [];
const deferred = [];
for (const f of htmlFiles) {
  const rel = relative(BUILD, f);
  if (!inScope(rel)) { deferred.push(rel); continue; }
  const first = readFileSync(f, 'utf8').split('\n')[0].trim();
  const m = first.match(DS);
  if (!m) { if (/\.card\.html$/.test(f)) malformed.push(rel); continue; }
  cards.push({ path: rel, group: m[1], viewport: m[2], name: m[3], subtitle: m[4] });
}

// 3) startingPoints — surface component cards + the richest screen cards
const startingPoints = cards
  .filter(c => /^(Components|Buttons|Forms|Data|Gamification)$/i.test(c.group))
  .map(c => ({ name: c.name, path: c.path, previewPath: c.path, kind: 'component', section: c.group, subtitle: c.subtitle, viewport: c.viewport }));

const manifest = {
  namespace: NAMESPACE,
  components,
  startingPoints,
  cards,
  templates: [],
  globalCssPaths: ['tokens/fonts.css', 'tokens/lyceum.css', 'components.css', 'styles.css'],
  tokens: [],            // enriched by the app self-check on render
  themes: [],            // light-only for v0 (dark = later pass)
  fonts: [],
  brandFonts: [
    { family: 'Fraunces', status: 'ok', tokens: ['--font-display'], path: 'tokens/fonts.css' },
    { family: 'Schibsted Grotesk', status: 'ok', tokens: ['--font-ui'], path: 'tokens/fonts.css' },
    { family: 'Spline Sans Mono', status: 'ok', tokens: ['--font-mono'], path: 'tokens/fonts.css' },
  ],
  source: 'designsync-incremental',
};

writeFileSync(join(BUILD, '_ds_manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const byGroup = cards.reduce((a, c) => ((a[c.group] = (a[c.group] || 0) + 1), a), {});
console.log(`_ds_manifest.json written: ${components.length} components, ${cards.length} cards`);
console.log('include roots:', includeRoots.length ? includeRoots.join(', ') : '(all)');
console.log('cards by group:', JSON.stringify(byGroup));
if (deferred.length) console.log(`deferred (out of scope, NOT in manifest): ${deferred.length} html files`);
if (malformed.length) { console.log(`\n⚠ ${malformed.length} .card.html WITHOUT a valid @dsCard marker (excluded):`); malformed.forEach(m => console.log('   ' + m)); }
