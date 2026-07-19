/**
 * Client-side mirror of server `LVLUP_COLLECTION_PREFIX` (repo-admin / seed paths).
 *
 * Production (`lvlup-ff6fa`) stores identity SSOT under `v2_*` top-level collections.
 * School login historically queried bare `userMemberships`, which Firestore rules
 * deny when the doc is missing — surfacing as "Missing or insufficient permissions".
 *
 * Resolution order:
 *   1. `VITE_LVLUP_COLLECTION_PREFIX` / `LVLUP_COLLECTION_PREFIX` (explicit)
 *   2. Default `v2_` when the Firebase project is `lvlup-ff6fa`
 *   3. Empty string (emulator / unprefixed deploys)
 */
export function collectionPrefix(): string {
  const fromEnv =
    process.env["VITE_LVLUP_COLLECTION_PREFIX"] ??
    process.env["NEXT_PUBLIC_LVLUP_COLLECTION_PREFIX"] ??
    process.env["LVLUP_COLLECTION_PREFIX"];

  // Explicit empty string means "unprefixed" (emulator); do not fall through to proj default.
  if (typeof fromEnv === "string") {
    return fromEnv;
  }

  const projectId =
    process.env["VITE_FIREBASE_PROJECT_ID"] ??
    process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] ??
    process.env["FIREBASE_PROJECT_ID"] ??
    "";

  return projectId === "lvlup-ff6fa" ? "v2_" : "";
}

/** Prefix a top-level collection name (first path segment only). */
export function topLevelCollection(name: string): string {
  return `${collectionPrefix()}${name}`;
}

/**
 * Candidate top-level collection names for identity reads.
 * Preferred (prefixed) first, then the known prod SSOT, then bare legacy.
 */
export function identityCollectionCandidates(baseName: string): string[] {
  const preferred = topLevelCollection(baseName);
  const out: string[] = [];
  for (const name of [preferred, `v2_${baseName}`, baseName]) {
    if (!out.includes(name)) out.push(name);
  }
  return out;
}
