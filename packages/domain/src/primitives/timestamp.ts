/**
 * The single canonical wall-clock representation above the storage edge:
 * an ISO-8601 UTC string, branded. Plus the edge adapter `toTimestamp()` that
 * collapses the live timestamp trichotomy (FirestoreTimestamp / epoch-millis /
 * ISO) into this one type (REVIEW D4).
 *
 * NO firebase import — the FirestoreTimestamp shape is matched structurally.
 */
import type { Brand } from "./brand.js";

export type Timestamp = Brand<string, "Timestamp">;

/** Strict ISO-8601 with milliseconds + 'Z'. The canonical output of every adapter. */
export const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isTimestamp = (v: unknown): v is Timestamp =>
  typeof v === "string" && ISO_8601_UTC.test(v);

/** Cast a known-good canonical ISO string. Throws (dev) if it isn't canonical. */
export const asTimestamp = (iso: string): Timestamp => {
  if (!ISO_8601_UTC.test(iso)) {
    throw new RangeError(`not a canonical ISO-8601 UTC timestamp: ${iso}`);
  }
  return iso as Timestamp;
};

/** A duck-typed FirestoreTimestamp ({ seconds, nanoseconds }). NEVER imported from firebase. */
export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
}

/** Serialized admin Timestamp over the wire ({ _seconds, _nanoseconds }). */
export interface SerializedFirestoreTimestampLike {
  _seconds: number;
  _nanoseconds: number;
}

/** Client/admin SDK Timestamp duck shape ({ toMillis() }). */
export interface MillisTimestampLike {
  toMillis(): number;
}

/** Anything the storage edge can hand us. */
export type TimestampInput =
  | Timestamp
  | string
  | number
  | Date
  | FirestoreTimestampLike
  | MillisTimestampLike
  | SerializedFirestoreTimestampLike;

const isFirestoreTimestampLike = (v: object): v is FirestoreTimestampLike =>
  "seconds" in v && "nanoseconds" in v;

const isSerializedFirestoreTimestampLike = (v: object): v is SerializedFirestoreTimestampLike =>
  "_seconds" in v && "_nanoseconds" in v;

const isMillisTimestampLike = (v: object): v is MillisTimestampLike =>
  "toMillis" in v && typeof (v as MillisTimestampLike).toMillis === "function";

/** Internal: resolve every input branch to a UTC `Date`. Throws on garbage. */
function toDate(input: TimestampInput): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError("invalid Date");
    return input;
  }
  if (typeof input === "number") {
    if (Number.isNaN(input)) throw new RangeError("invalid epoch-millis (NaN)");
    return new Date(input);
  }
  if (typeof input === "string") {
    const ms = Date.parse(input);
    if (Number.isNaN(ms)) throw new RangeError(`unparseable date string: ${input}`);
    return new Date(ms);
  }
  if (typeof input === "object" && input !== null) {
    if (isFirestoreTimestampLike(input)) {
      return new Date(input.seconds * 1000 + Math.round(input.nanoseconds / 1e6));
    }
    if (isSerializedFirestoreTimestampLike(input)) {
      return new Date(input._seconds * 1000 + Math.round(input._nanoseconds / 1e6));
    }
    if (isMillisTimestampLike(input)) {
      const ms = input.toMillis();
      if (Number.isNaN(ms)) throw new RangeError("invalid toMillis() result (NaN)");
      return new Date(ms);
    }
  }
  throw new RangeError("unsupported TimestampInput shape");
}

/** The edge adapter — the ONLY place the three live time encodings are normalized. */
export function toTimestamp(input: TimestampInput): Timestamp;
export function toTimestamp(input: TimestampInput | null | undefined): Timestamp | null;
export function toTimestamp(input: TimestampInput | null | undefined): Timestamp | null {
  if (input == null) return null;
  return toDate(input).toISOString() as Timestamp;
}

/** Reverse edge: Timestamp → epoch millis (for duration math / sorting). */
export const toMillis = (t: Timestamp): number => Date.parse(t);

/** Timestamp → Date (UI formatting only; UI never parses ISO by hand). */
export const toDateObj = (t: Timestamp): Date => new Date(t);

// ---------------------------------------------------------------------------
// Clock seam (server-authoritative, testable). AuthContext.now() returns a Timestamp.
// ---------------------------------------------------------------------------
export type Clock = () => Timestamp;
export const systemClock: Clock = () => new Date().toISOString() as Timestamp;

/** Convenience: "now" as a canonical Timestamp. */
export const isoNow = (): Timestamp => new Date().toISOString() as Timestamp;
