/**
 * DP-1 regression — the canonical transport-seam types are DECLARED in exactly
 * ONE place: `@levelup/api-contract/src/transport/`.
 *
 * Before DP-1 these 6 types were hand-copied across ~24 declaration sites and
 * drifted (RR-T1). This test walks every package `src` tree and asserts each
 * canonical type is declared only at its single home — preventing a future
 * re-fork. Re-exports (`export type { Transport }`) and imports are NOT
 * declarations and are ignored.
 *
 * The ONE sanctioned exception is `@levelup/query`'s `provider/types.ts` widened
 * `Transport` alias — the deliberately-loosened `invoke(name: string, data:
 * unknown)` structural view (RR-T1 §6, NOT-unified case #1). It is allow-listed
 * explicitly so the intent stays visible.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PACKAGES_DIR = path.resolve(__dirname, "../../..");

/** name → the relative-to-`packages/` files allowed to DECLARE it. */
const ALLOWED: Record<string, string[]> = {
  Transport: [
    "api-contract/src/transport/transport.ts",
    // Sanctioned widened structural view (RR-T1 §6, NOT-unified case #1).
    "query/src/provider/types.ts",
  ],
  StorageTransport: ["api-contract/src/transport/storage.ts"],
  UploadBytesInput: ["api-contract/src/transport/storage.ts"],
  SubscriptionHandle: ["api-contract/src/transport/transport.ts"],
  SubscriptionCallbacks: ["api-contract/src/transport/transport.ts"],
  SubscriptionStatus: ["api-contract/src/transport/transport.ts"],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "__tests__") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/** Every package `src` TypeScript file, as paths relative to the packages dir. */
function allSourceFiles(): { rel: string; abs: string }[] {
  const files: { rel: string; abs: string }[] = [];
  for (const pkg of readdirSync(PACKAGES_DIR)) {
    const srcDir = path.join(PACKAGES_DIR, pkg, "src");
    try {
      if (!statSync(srcDir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const abs of walk(srcDir)) {
      files.push({ rel: path.relative(PACKAGES_DIR, abs).split(path.sep).join("/"), abs });
    }
  }
  return files;
}

/** A line that DECLARES `interface NAME`/`type NAME` (not a re-export/import). */
function declaresType(line: string, name: string): boolean {
  return new RegExp(`^\\s*(?:export\\s+)?(?:interface|type)\\s+${name}\\b`).test(line);
}

describe("DP-1 — canonical transport types declared only in api-contract/src/transport", () => {
  const files = allSourceFiles();

  for (const [name, allowed] of Object.entries(ALLOWED)) {
    it(`${name} is declared only at its canonical home`, () => {
      const declaredIn: string[] = [];
      for (const { rel, abs } of files) {
        const lines = readFileSync(abs, "utf8").split("\n");
        if (lines.some((l) => declaresType(l, name))) declaredIn.push(rel);
      }
      // Every declaration site must be allow-listed (no un-sanctioned fork)…
      for (const site of declaredIn) {
        expect(allowed, `${name} unexpectedly declared in ${site}`).toContain(site);
      }
      // …and the canonical api-contract home must actually declare it.
      expect(
        declaredIn.some((s) => s.startsWith("api-contract/src/transport/")),
        `${name} must be declared under api-contract/src/transport/`
      ).toBe(true);
    });
  }
});
