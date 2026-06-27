/**
 * Fixtures barrel — importing this loads EVERY per-module fixture file (each one
 * calls `registerFixture`), populating `CALLABLE_FIXTURES`.
 *
 * Consumers:
 *   • api-contract `registry-integrity.test.ts` imports this + `CALLABLE_NAMES`
 *     and fails if any callable name lacks a fixture.
 *   • the emulator contract loop (tests/sdk/contract/callable-contract.test.ts)
 *     drives `def.responseSchema.parse(liveResponse)` per fixture.
 */
// Curated fixtures FIRST (they win — registerFixture is first-write).
import "./identity.fixtures";
import "./levelup.fixtures";
import "./autograde.fixtures";
import "./analytics.fixtures";

export * from "./callable-fixture";
// The auto-derived backstop registrar (T1 gate). Callers inject the live contract
// registry — `tests/sdk` cannot resolve `@levelup/api-contract` directly — then
// every callable a curated file missed gets a schema-valid fixture.
export { registerAutoFixtures } from "./auto.fixtures";
export { SEED_STATE_ORDER, SEEDED_STATES, VIA_CALLABLE } from "./ordering";
