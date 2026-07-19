/**
 * Deterministic seed manifest.
 *
 * A dry run must be reviewable without touching Firestore.  Every planned
 * document is therefore captured as a stable logical key, resolved id, exact
 * path, and canonical content hash.  The same manifest is also used by verify
 * to prove that nested content documents still match the authored canonical
 * payload after a real emulator run.
 */

import { createHash } from "node:crypto";

export type SeedManifestAction = "upsert";

export interface SeedManifestEntry {
  logicalKey: string;
  resolvedId: string;
  exactPath: string;
  canonicalHash: string;
  action: SeedManifestAction;
  /** Internal/public verification labels (e.g. item + assessmentConfiguration). */
  verifyAs: readonly string[];
}

/** Stable JSON for JSON-like seed documents: object keys sort; undefined drops. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child !== undefined) out[key] = canonicalize(child);
    }
    return out;
  }
  return value;
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function pathId(path: string): string {
  const segments = path.split("/");
  return segments.at(-1) ?? path;
}

/** One entry per exact document path; a repeated upsert replaces the same plan entry. */
export class SeedManifest {
  private readonly byPath = new Map<string, SeedManifestEntry>();

  record(input: {
    kind: string;
    path: string;
    data: Record<string, unknown>;
    logicalKey?: string;
    verifyAs?: readonly string[];
  }): void {
    const resolvedId = typeof input.data.id === "string" ? input.data.id : pathId(input.path);
    this.byPath.set(input.path, {
      logicalKey: input.logicalKey ?? `${input.kind}:${resolvedId}`,
      resolvedId,
      exactPath: input.path,
      canonicalHash: canonicalHash(input.data),
      action: "upsert",
      verifyAs: [...new Set(input.verifyAs?.length ? input.verifyAs : [input.kind])].sort(),
    });
  }

  entries(): SeedManifestEntry[] {
    return [...this.byPath.values()].sort((left, right) =>
      left.exactPath.localeCompare(right.exactPath)
    );
  }
}
