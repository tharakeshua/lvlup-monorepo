/**
 * @levelup/seed — config-driven, idempotent Firebase Admin-SDK seeding engine.
 *
 * Public surface: the engine (BatchWriter, SeedContext, ensureAuthUser, claims builder, pipeline,
 * verify, seed/verifySeed orchestrators, deterministic `seedId`) + the SeedConfig type model +
 * the ASSEMBLED, validated mock dataset (`seedConfig`) and its derived analytics docs.
 *
 *   import { seed } from '@levelup/seed';
 *   import { seedConfig, derivedSeedDocs } from '@levelup/seed/config';
 *   await seed(seedConfig, { projectId, derivedDocs: derivedSeedDocs() });
 */
export * from "./engine/index.js";
export * from "./config/index.js";

// The assembled, validated default dataset (authoritative).
export { seedConfig, buildSeedConfig, derivedSeedDocs } from "./config/index.js";

// Back-compat alias: `mockSeedConfig` is the unmerged base composition (no analytics overlay).
export { mockSeedConfig } from "./data/index.js";
