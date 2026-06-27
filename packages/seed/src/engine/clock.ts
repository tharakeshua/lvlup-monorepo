/**
 * Injected clock — server-authoritative, ISO-8601 (matches `@levelup/domain` Timestamp: a
 * branded ISO string, NOT a Firestore Timestamp). The seed engine writes ISO strings; the
 * repository-admin Timestamp<->ISO edge adapter is bypassed because seeding is admin-side and
 * the domain entities store ISO above the storage edge (D4).
 *
 * A FIXED clock makes `seed.determinism.test.ts` reproducible: the same config produces a
 * byte-identical Firestore tree because every timestamp is deterministic.
 */

/** Branded ISO-8601 instant, structurally compatible with `@levelup/domain` `Timestamp`. */
export type Timestamp = string & { readonly __brand: "Timestamp" };

/** Branded calendar date (YYYY-MM-DD), matches gamification `IsoDate`. */
export type IsoDate = string & { readonly __brand: "IsoDate" };

export interface Clock {
  /** Current instant as ISO-8601. */
  now(): Timestamp;
  /** Instant offset from `now()` by `deltaMs` (negative = past). Useful for createdAt < updatedAt. */
  at(deltaMs: number): Timestamp;
  /** Calendar date (UTC) offset by `deltaDays` from now. */
  date(deltaDays?: number): IsoDate;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function asTimestamp(iso: string): Timestamp {
  if (!ISO_RE.test(iso)) {
    throw new Error(`asTimestamp: not an ISO-8601 instant: ${iso}`);
  }
  return iso as Timestamp;
}

/**
 * Fixed clock anchored at `epochMs`. Deterministic — every call to `now()` returns the
 * anchor, `at(delta)` returns anchor+delta. Default anchor is a stable seed epoch so a
 * fresh seed without an explicit clock is still reproducible.
 */
export function createFixedClock(epochMs = Date.parse("2026-01-01T00:00:00.000Z")): Clock {
  const base = new Date(epochMs);
  return {
    now: () => base.toISOString() as Timestamp,
    at: (deltaMs: number) => new Date(epochMs + deltaMs).toISOString() as Timestamp,
    date: (deltaDays = 0) => {
      const d = new Date(epochMs + deltaDays * 86_400_000);
      return d.toISOString().slice(0, 10) as IsoDate;
    },
  };
}

/** Wall-clock clock (non-deterministic) — for real-project seeding where reproducibility isn't required. */
export function createSystemClock(): Clock {
  return {
    now: () => new Date().toISOString() as Timestamp,
    at: (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString() as Timestamp,
    date: (deltaDays = 0) =>
      new Date(Date.now() + deltaDays * 86_400_000).toISOString().slice(0, 10) as IsoDate,
  };
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
