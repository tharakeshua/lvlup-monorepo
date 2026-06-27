/**
 * Deterministic ids + fixed clock for the SDK-rebuild contract/integration suite.
 *
 * The whole pyramid (contract fixtures T1, seed determinism T2) depends on the
 * "contract tenant" having STABLE, config-keyed ids and a PINNED clock so that:
 *   • a contract fixture can name its precondition entity (`demoUser('teacher')`)
 *     without first reading it back,
 *   • re-seeding is a verifiable no-op (snapshot the produced tree),
 *   • `serverDeadline`/`*At` fields are reproducible.
 *
 * These are the harness-side mirrors of `@levelup/seed`'s `seedId(kind,key)`.
 * Where the seed package is available, `harness/seed.ts#seededId` returns the
 * authoritative value; these constants are the deterministic *keys* + the fixed
 * clock the harness passes INTO the seed engine, plus a handful of well-known
 * stable ids for the contract tenant that fixtures reference by name.
 */

/** Pinned ISO-8601 wall clock injected into the seed + every AuthContext in tests. */
export const FIXED_CLOCK_ISO = "2026-01-01T00:00:00.000Z";

/** The single deterministic tenant every contract test runs against (T1/T2). */
export const CONTRACT_TENANT_KEY = "contract";
export const CONTRACT_TENANT_CODE = "SDK001";

/**
 * Well-known demo-user keys for the contract tenant — one per role so contract
 * tests + the per-rule access policy table (T5) can mint the right ctx. The
 * actual uid/entityId resolve via the seed engine's `seedId`; these are the
 * stable KEYS passed to it.
 */
export const DEMO_USER_KEYS = {
  superAdmin: "super.admin",
  tenantAdmin: "admin.contract",
  teacher: "teacher.alice",
  teacherOther: "teacher.bob",
  student: "student.sam",
  studentOther: "student.nora",
  parent: "parent.pat", // linked to `student`
  staff: "staff.stan",
  scanner: "scanner.scout",
} as const;

export type DemoUserKey = keyof typeof DEMO_USER_KEYS;

/** Deterministic content keys the contract tenant seeds (referenced by fixtures). */
export const DEMO_CONTENT_KEYS = {
  space: "space.dsa",
  storyPoint: "sp.arrays",
  item: "item.arrays.q1",
  exam: "exam.midterm",
  examQuestion: "examq.1",
  class: "class.10a",
  session: "session.2026",
} as const;

/**
 * Harness-side deterministic id derivation, used when the seed engine is not yet
 * available (scaffold window) so unit-level fixtures still type-check and run.
 * Stable + collision-free; NOT branded (the domain brand is a compile-time tag).
 * Once `@levelup/seed` lands, prefer `harness/seed.ts#seededId`.
 */
export function localSeedId(kind: string, key: string): string {
  // Deterministic, readable, 20-char-ish (Firestore-id-like) — no randomness.
  const base = `${kind}__${key}`.replace(/[^a-zA-Z0-9_]/g, "_");
  return base.padEnd(20, "0").slice(0, Math.max(20, base.length));
}
