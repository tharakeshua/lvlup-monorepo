/**
 * The single direct-Firestore site (Admin SDK). `getFirestore()` singleton +
 * the Timestamp↔ISO edge adapter (D4) + brand strip/restore converters (D8).
 *
 * NO other file outside `repo-admin/` may import `firebase-admin/*` — this is the
 * lint-enforced boundary (server-shared.md §8 rule 2). Services receive plain
 * already-normalized JSON through `ctx.repos`; they never see a Firestore
 * Timestamp, a snapshot, or a raw brand.
 *
 * Conversion rules:
 *   • on WRITE: any ISO-8601 string field that is a wall-clock value stays a
 *     string in Firestore (we keep ISO at rest — the canonical D4 representation
 *     above the storage edge). Firestore `Timestamp` objects handed in by legacy
 *     reads are normalized to ISO via `toTimestamp` before persistence.
 *   • on READ: Firestore `Timestamp` / `{seconds,nanoseconds}` / epoch-millis are
 *     collapsed to canonical ISO via the domain `toTimestamp` adapter. Brands are
 *     plain strings at rest; the domain Zod schemas re-brand on parse upstream.
 */
import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp as AdminTimestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { toTimestamp } from "@levelup/domain";

let appSingleton: App | undefined;
let dbSingleton: Firestore | undefined;
let authSingleton: Auth | undefined;

/** Lazily initialize the default Admin app (emulator-aware via env). */
export function adminApp(): App {
  if (appSingleton) return appSingleton;
  const existing = getApps();
  appSingleton =
    existing.length > 0
      ? (existing[0] as App)
      : initializeApp(
          process.env["GOOGLE_APPLICATION_CREDENTIALS"] ? { credential: applicationDefault() } : {}
        );
  return appSingleton;
}

export function db(): Firestore {
  if (!dbSingleton) {
    dbSingleton = getFirestore(adminApp());
  }
  return dbSingleton;
}

export function auth(): Auth {
  if (!authSingleton) {
    authSingleton = getAuth(adminApp());
  }
  return authSingleton;
}

/** Test-only reset of the cached singletons. */
export function _resetFirestoreSingletons(): void {
  appSingleton = undefined;
  dbSingleton = undefined;
  authSingleton = undefined;
}

const TS_DUCK = (v: unknown): v is { toDate: () => Date } =>
  typeof v === "object" && v !== null && typeof (v as { toDate?: unknown }).toDate === "function";

/**
 * READ converter: deep-walk a Firestore-decoded document and collapse every
 * Firestore Timestamp (and `{seconds,nanoseconds}` / `{_seconds,_nanoseconds}`
 * shapes) into the canonical ISO-8601 string (D4). Brands are already plain
 * strings at rest, so no work is needed for them on read.
 */
export function fromFirestore(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof AdminTimestamp) {
    return toTimestamp(value.toDate());
  }
  if (TS_DUCK(value)) {
    return toTimestamp((value as { toDate: () => Date }).toDate());
  }
  if (Array.isArray(value)) {
    return value.map(fromFirestore);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // `{seconds,nanoseconds}` / `{_seconds,_nanoseconds}` legacy serialized shapes
    if (
      ("seconds" in obj && "nanoseconds" in obj && Object.keys(obj).length === 2) ||
      ("_seconds" in obj && "_nanoseconds" in obj && Object.keys(obj).length === 2)
    ) {
      return toTimestamp(obj as never);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = fromFirestore(v);
    }
    return out;
  }
  return value;
}

/** READ converter for a whole document record. */
export function docFromFirestore(data: Record<string, unknown>): Record<string, unknown> {
  return fromFirestore(data) as Record<string, unknown>;
}

/**
 * WRITE converter: we keep ISO strings at rest (the canonical representation), so
 * the only normalization needed is collapsing any stray Firestore-Timestamp /
 * legacy-shape value a caller may have round-tripped back into ISO, and dropping
 * `undefined` (Firestore rejects undefined). Brands are written as bare strings —
 * which they already are structurally — so D8 strip-on-write is a no-op beyond
 * not persisting any brand symbol (symbols are not enumerable, so they never
 * reach Firestore). This keeps brands in the domain layer and bare strings at
 * rest.
 */
export function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = stripForWrite(v);
  }
  return out;
}

function stripForWrite(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof AdminTimestamp) return toTimestamp(value.toDate());
  if (TS_DUCK(value)) return toTimestamp((value as { toDate: () => Date }).toDate());
  if (value instanceof Date) return toTimestamp(value);
  if (Array.isArray(value)) return value.map(stripForWrite);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripForWrite(v);
    }
    return out;
  }
  return value;
}

export { AdminTimestamp };
