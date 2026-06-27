/**
 * Region + emulator config (transport-realtime.md §2.2 config/region.ts).
 *
 * Single source for the default Functions region so the app root and the future
 * `transport-http` share one default and per-file hardcodes die (common-api §8).
 *
 * The transport does NOT call `initializeFirebase` / `getFunctions(app, region)` —
 * the app's `getFirebaseServices()` binds the region when it constructs the
 * `Functions` instance and hands the already-regioned instance to this adapter via
 * `services.functions`. `resolveRegion` exists purely so the default is shared.
 */

/** The single canonical default Functions region. */
export const DEFAULT_REGION = "asia-south1" as const;

/** A Cloud Functions region identifier (e.g. `asia-south1`). */
export type FunctionsRegion = string;

/** Optional emulator host/port wiring, mirroring `initializeFirebase`'s emulator hookup. */
export interface EmulatorConfig {
  functionsHost?: string;
  functionsPort?: number;
  firestoreHost?: string;
  firestorePort?: number;
  databaseHost?: string;
  databasePort?: number;
}

export interface RegionOptions {
  region?: FunctionsRegion;
  emulator?: EmulatorConfig;
}

/** `opts.region ?? DEFAULT_REGION` — the shared default resolver. */
export function resolveRegion(opts?: RegionOptions): FunctionsRegion {
  return opts?.region ?? DEFAULT_REGION;
}
