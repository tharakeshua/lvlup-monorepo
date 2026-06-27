/**
 * read-only-realtime lint (transport-realtime.md §8.6 / principle 5).
 *
 * Subscriptions NEVER write. `subscribe-via-firestore.ts` / `subscribe-via-rtdb.ts`
 * (and server-time-offset.ts) must not contain any Firestore/RTDB write primitive:
 * set / update / push / setDoc / updateDoc / addDoc / deleteDoc / runTransaction.
 * Grep-asserts the absence (the listeners are read-only by construction).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const READ_PATH_FILES = [
  "../subscribe/subscribe-via-firestore.ts",
  "../subscribe/subscribe-via-rtdb.ts",
  "../server-time/server-time-offset.ts",
];

// Word-boundary write primitives; `onValue`/`onSnapshot`/`get(...)` reads are fine.
const WRITE_PRIMITIVES = [
  /\bsetDoc\b/,
  /\bupdateDoc\b/,
  /\baddDoc\b/,
  /\bdeleteDoc\b/,
  /\brunTransaction\b/,
  /\bwriteBatch\b/,
  /\bpush\s*\(/,
  /\bset\s*\(\s*(ref|nodeRef|offsetRef)/,
  /\bupdate\s*\(\s*(ref|nodeRef)/,
];

/** Strip block + line comments so JSDoc that NAMES write primitives doesn't trip the scan. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("realtime read path is write-free (§8.6)", () => {
  for (const rel of READ_PATH_FILES) {
    it(`${rel} contains no Firestore/RTDB write primitive`, () => {
      const src = stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
      const hits = WRITE_PRIMITIVES.filter((re) => re.test(src)).map((re) => re.source);
      expect(hits, `write primitives found in ${rel}: ${hits.join(", ")}`).toEqual([]);
    });
  }
});
