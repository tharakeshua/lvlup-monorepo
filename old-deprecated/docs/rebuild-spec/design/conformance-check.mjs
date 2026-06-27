#!/usr/bin/env node
// S-sync static conformance checker (NO browser). Lyceum-token discipline + DesignSync card contract.
// Usage:  node conformance-check.mjs <file-or-glob> [more...]
//   node conformance-check.mjs build/components/**/*.card.html
//   node conformance-check.mjs build/prototypes/exams/*.card.html
// Exit 0 = all conformant. Exit 1 = at least one card has a HARD failure (exclude it from push).

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const BUILD = new URL('./build/', import.meta.url).pathname;

// ---- Lyceum rule set -------------------------------------------------------
const BANNED_FONTS = [
  /\bInter\b/i, /\bRoboto\b/i, /\bArial\b/i, /\bSpace Grotesk\b/i, /\bPlus Jakarta\b/i,
];
const BANNED_HEX = [
  /#3B82F6/i,            // SaaS blue — hard banned
];
// Lyceum legitimate hex primitives (only allowed to appear literally in token files, never in cards)
const ANY_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const ALLOWED_NAMESPACE = 'LvlupV0DesignSystem_5d0725'; // live compiler-derived namespace for lvlup-v0 (id 5d0725a6)

const DS_CARD_RE = /^<!--\s*@dsCard\s+group="[^"]+"\s+viewport="\d+x\d+"\s+name="[^"]+"\s+subtitle="[^"]*"\s*-->/;

function expandGlob(pattern) {
  // minimal glob: supports ** and * over the build tree; falls back to literal path
  if (!pattern.includes('*')) {
    try { statSync(pattern); return [pattern]; } catch { return []; }
  }
  const parts = pattern.split('/');
  let dirs = [parts[0] === '' ? '/' : parts[0]];
  // rebuild absolute-ish; simpler: walk from cwd
  const root = pattern.startsWith('/') ? '/' : process.cwd();
  const segs = pattern.replace(/^\//, '').split('/');
  let cur = [root];
  for (const seg of segs) {
    const next = [];
    for (const d of cur) {
      let entries;
      try { entries = readdirSync(d, { withFileTypes: true }); } catch { continue; }
      if (seg === '**') {
        // match zero or more dirs
        next.push(d);
        const stack = entries.filter(e => e.isDirectory()).map(e => join(d, e.name));
        while (stack.length) { const x = stack.pop(); next.push(x);
          try { for (const e of readdirSync(x, { withFileTypes: true })) if (e.isDirectory()) stack.push(join(x, e.name)); } catch {} }
      } else if (seg.includes('*')) {
        const re = new RegExp('^' + seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        for (const e of entries) if (re.test(e.name)) next.push(join(d, e.name));
      } else {
        const hit = entries.find(e => e.name === seg);
        if (hit) next.push(join(d, seg));
      }
    }
    cur = next;
  }
  return cur.filter(p => { try { return statSync(p).isFile(); } catch { return false; } });
}

function checkCard(path) {
  const rel = relative(process.cwd(), path);
  const isTokenFile = /\/(tokens\/|styles\.css|components\.css)/.test(path) || path.endsWith('.css');
  const isCardHtml = path.endsWith('.card.html');
  const src = readFileSync(path, 'utf8');
  const hard = [];   // must-fix → exclude from push
  const soft = [];   // warn

  if (isCardHtml) {
    const firstLine = src.split('\n')[0];
    if (!DS_CARD_RE.test(firstLine.trim())) {
      hard.push(`@dsCard marker invalid/missing on first line: "${firstLine.slice(0, 90)}"`);
    }
    if (!/styles\.css/.test(src)) hard.push('does not <link> the shared styles.css core');
    if (!/_ds_bundle\.js/.test(src)) hard.push('does not <script> the shared _ds_bundle.js');
    if (!new RegExp(`window\\.${ALLOWED_NAMESPACE}\\b`).test(src))
      soft.push(`does not reference window.${ALLOWED_NAMESPACE} (ok only if a pure-CSS specimen card)`);
  }

  // banned fonts everywhere
  for (const re of BANNED_FONTS) if (re.test(src)) hard.push(`banned font token matches ${re}`);
  // banned hex everywhere (incl. token files)
  for (const re of BANNED_HEX) if (re.test(src)) hard.push(`BANNED hex ${re} present`);

  // raw hex discipline: only token/css files may carry literal hex; cards must use var(--…)
  if (isCardHtml) {
    // strip HTML numeric char entities (&#8322; ₂ etc.) so they aren't mistaken for color hex
    const scan = src.replace(/&#x?[0-9a-fA-F]+;/g, '');
    const hits = [...scan.matchAll(ANY_HEX)].map(m => m[0]);
    // allow hex only inside inline <svg> gradients/icons — heuristic: if hex count is small & svg present, warn not fail
    const uniq = [...new Set(hits)];
    if (uniq.length) {
      const hasSvg = /<svg[\s>]/i.test(src);
      const msg = `raw hex in card (${uniq.slice(0, 8).join(', ')}${uniq.length > 8 ? ', …' : ''}) — cards must use var(--token)`;
      if (hasSvg) soft.push(msg + ' [svg present — verify each is an icon fill, not a design color]');
      else hard.push(msg);
    }
  }

  return { rel, isCardHtml, isTokenFile, hard, soft };
}

const patterns = process.argv.slice(2);
if (!patterns.length) { console.error('usage: node conformance-check.mjs <file-or-glob> [...]'); process.exit(2); }

let files = [];
for (const p of patterns) files.push(...expandGlob(p));
files = [...new Set(files)];

if (!files.length) { console.error('no files matched:', patterns.join(' ')); process.exit(2); }

let hardCount = 0, softCount = 0, clean = 0;
for (const f of files) {
  const r = checkCard(f);
  if (r.hard.length) {
    hardCount++;
    console.log(`\x1b[31m✗ FAIL\x1b[0m ${r.rel}`);
    for (const h of r.hard) console.log(`    HARD: ${h}`);
    for (const s of r.soft) console.log(`    warn: ${s}`);
  } else if (r.soft.length) {
    softCount++;
    console.log(`\x1b[33m~ WARN\x1b[0m ${r.rel}`);
    for (const s of r.soft) console.log(`    warn: ${s}`);
  } else {
    clean++;
    console.log(`\x1b[32m✓ OK  \x1b[0m ${r.rel}`);
  }
}
console.log(`\n— ${files.length} file(s): ${clean} clean, ${softCount} warn-only, ${hardCount} HARD-fail —`);
process.exit(hardCount ? 1 : 0);
