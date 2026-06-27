/**
 * ISO Timestamp + edge adapter — domain-core.md §3 + §9 row "Timestamp adapter".
 *
 * Locks the REVIEW D4 trichotomy fix: `toTimestamp()` is the ONE place the three
 * live time encodings (FirestoreTimestamp {seconds,nanoseconds} audit, epoch-millis
 * progress/attempts, ISO chat) — plus the {_seconds,_nanoseconds} serialized-admin
 * shape and the {toMillis()} duck shape — collapse to a single byte-canonical
 * `ISO_8601_UTC` `Timestamp`. Proves all 6 input branches normalize identically,
 * the reverse edge round-trips within ms precision, null/undefined → null, and
 * garbage throws. No firebase import: Firestore shapes are duck-typed (§3.4).
 *
 * Imports concrete module paths (resolve now under moduleResolution:bundler).
 */
import { describe, it, expect } from "vitest";
import {
  ISO_8601_UTC,
  isTimestamp,
  asTimestamp,
  toTimestamp,
  toMillis,
  toDateObj,
  systemClock,
  isoNow,
  type Timestamp,
  type TimestampInput,
} from "../primitives/timestamp.js";
import { zTimestamp, zTimestampInput } from "../primitives/timestamp.zod.js";

// A fixed wall-clock instant used across every branch so they must all agree.
const EPOCH_MS = 1_750_417_925_123; // 2025-06-20T11:12:05.123Z
const CANONICAL = "2025-06-20T11:12:05.123Z";

describe("ISO_8601_UTC + isTimestamp + asTimestamp", () => {
  it("ISO_8601_UTC requires ms precision and a trailing Z", () => {
    expect(ISO_8601_UTC.test("2025-06-20T11:12:05.123Z")).toBe(true);
    // no millis
    expect(ISO_8601_UTC.test("2025-06-20T11:12:05Z")).toBe(false);
    // offset instead of Z
    expect(ISO_8601_UTC.test("2025-06-20T11:12:05.123+05:30")).toBe(false);
    // space separator
    expect(ISO_8601_UTC.test("2025-06-20 11:12:05.123Z")).toBe(false);
  });

  it("isTimestamp is a type guard over canonical strings only", () => {
    expect(isTimestamp(CANONICAL)).toBe(true);
    expect(isTimestamp("not-a-date")).toBe(false);
    expect(isTimestamp(EPOCH_MS)).toBe(false);
    expect(isTimestamp(new Date())).toBe(false);
    expect(isTimestamp(null)).toBe(false);
    expect(isTimestamp(undefined)).toBe(false);
  });

  it("asTimestamp passes canonical strings and throws RangeError on non-canonical", () => {
    expect(asTimestamp(CANONICAL)).toBe(CANONICAL);
    expect(() => asTimestamp("2025-06-20T11:12:05Z")).toThrow(RangeError);
    expect(() => asTimestamp("garbage")).toThrow(RangeError);
  });
});

describe("toTimestamp — all 6 input branches collapse to ONE canonical value (D4)", () => {
  const fst = { seconds: Math.floor(EPOCH_MS / 1000), nanoseconds: (EPOCH_MS % 1000) * 1e6 };
  const serialized = { _seconds: fst.seconds, _nanoseconds: fst.nanoseconds };
  const millisLike = { toMillis: () => EPOCH_MS };

  const BRANCHES: Array<[string, TimestampInput]> = [
    ["epoch number", EPOCH_MS],
    ["ISO string", CANONICAL],
    ["Date", new Date(EPOCH_MS)],
    ["FirestoreTimestamp {seconds,nanoseconds}", fst],
    ["serialized {_seconds,_nanoseconds}", serialized],
    ["{toMillis()} duck shape", millisLike],
    ["already-canonical Timestamp", CANONICAL as Timestamp],
  ];

  it.each(BRANCHES)("branch %s → byte-identical canonical ISO", (_label, input) => {
    const out = toTimestamp(input);
    expect(out).toBe(CANONICAL);
    expect(ISO_8601_UTC.test(out)).toBe(true);
  });

  it("every branch produces a byte-identical result (no drift across encodings)", () => {
    const outs = BRANCHES.map(([, input]) => toTimestamp(input));
    const uniq = new Set(outs);
    expect(uniq.size).toBe(1);
    expect([...uniq][0]).toBe(CANONICAL);
  });

  it("output is always canonical even for a non-canonical ISO-ish input string", () => {
    // an input string without millis / with an offset must be re-canonicalized
    expect(ISO_8601_UTC.test(toTimestamp("2025-06-20T11:12:05Z"))).toBe(true);
    expect(toTimestamp("2025-06-20T16:42:05.123+05:30")).toBe(CANONICAL);
  });

  it("null / undefined map to null (overload)", () => {
    expect(toTimestamp(null)).toBeNull();
    expect(toTimestamp(undefined)).toBeNull();
  });

  it("rejects NaN / unparseable / unsupported shapes (throws RangeError)", () => {
    expect(() => toTimestamp(Number.NaN)).toThrow(RangeError);
    expect(() => toTimestamp("definitely-not-a-date")).toThrow(RangeError);
    expect(() => toTimestamp(new Date("invalid"))).toThrow(RangeError);
    // an object with none of the recognized duck shapes
    expect(() => toTimestamp({ foo: "bar" } as unknown as TimestampInput)).toThrow(RangeError);
    // toMillis returning NaN
    expect(() => toTimestamp({ toMillis: () => Number.NaN })).toThrow(RangeError);
  });
});

describe("reverse edges round-trip within ms precision", () => {
  it("toMillis(toTimestamp(ms)) === ms", () => {
    expect(toMillis(toTimestamp(EPOCH_MS))).toBe(EPOCH_MS);
  });

  it("toDateObj(toTimestamp(date)).getTime() === date.getTime()", () => {
    const d = new Date(EPOCH_MS);
    expect(toDateObj(toTimestamp(d)).getTime()).toBe(d.getTime());
  });

  it("Firestore {seconds,nanoseconds} round-trips back to its millis", () => {
    const fst = { seconds: 1_700_000_000, nanoseconds: 500_000_000 };
    expect(toMillis(toTimestamp(fst))).toBe(1_700_000_000 * 1000 + 500);
  });
});

describe("clock seam (server-authoritative, testable)", () => {
  it("systemClock() and isoNow() return canonical Timestamps", () => {
    expect(ISO_8601_UTC.test(systemClock())).toBe(true);
    expect(ISO_8601_UTC.test(isoNow())).toBe(true);
  });
});

describe("zTimestamp (strict, canonical wire) vs zTimestampInput (lenient edge)", () => {
  it("zTimestamp accepts a canonical string and rejects non-canonical", () => {
    expect(zTimestamp.parse(CANONICAL)).toBe(CANONICAL);
    expect(zTimestamp.safeParse("2025-06-20T11:12:05Z").success).toBe(false);
    expect(zTimestamp.safeParse(EPOCH_MS).success).toBe(false);
  });

  it("zTimestampInput normalizes the whole trichotomy at the storage edge", () => {
    expect(zTimestampInput.parse(EPOCH_MS)).toBe(CANONICAL);
    expect(zTimestampInput.parse(new Date(EPOCH_MS))).toBe(CANONICAL);
    expect(
      zTimestampInput.parse({ seconds: Math.floor(EPOCH_MS / 1000), nanoseconds: 123_000_000 })
    ).toBe(CANONICAL);
    // and its output is itself canonical (validatable by the strict schema)
    expect(zTimestamp.safeParse(zTimestampInput.parse(EPOCH_MS)).success).toBe(true);
  });
});
