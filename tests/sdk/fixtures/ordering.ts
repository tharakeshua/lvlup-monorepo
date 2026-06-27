/**
 * Documented write-before-read ordering for the contract loop (T1).
 *
 * The single seeded "contract tenant" backs every contract test. Some callables
 * are READS whose precondition is produced by a WRITE callable (e.g.
 * `getSpaceProgress` needs `recordItemAttempt`/`startTestSession` to have run).
 * The contract loop runs `SeedState` preconditions via the seed engine where
 * possible; where a precondition is only reachable via a callable, it runs the
 * producing callable first in this order.
 *
 * The seed engine (loadDemoSeed) is expected to materialize every `SeedState`
 * EXCEPT the few marked `via-callable` below, which the loop produces in-line.
 */
import type { SeedState } from "./callable-fixture";

/** Topological order of seed states — earlier states are prerequisites of later. */
export const SEED_STATE_ORDER: SeedState[] = [
  "none",
  "contract-tenant",
  "draft-space",
  "story-point-with-item",
  "published-space",
  "enrolled-student",
  "parent-linked",
  "active-test-session",
  "graded-submission",
  "released-exam",
];

/**
 * States the demo seed materializes directly (deterministic, idempotent). The
 * contract loop asserts these exist before running any fixture that needs them.
 */
export const SEEDED_STATES: ReadonlySet<SeedState> = new Set<SeedState>([
  "contract-tenant",
  "draft-space",
  "published-space",
  "story-point-with-item",
  "enrolled-student",
  "parent-linked",
  "released-exam",
  "graded-submission",
  // the contract seed materializes a fixed-id in_progress session (ts1).
  "active-test-session",
  "none",
]);

/**
 * States produced by running a callable in-line before the dependent read
 * (write-before-read). Maps the state → the fixture name that produces it.
 */
export const VIA_CALLABLE: Partial<Record<SeedState, string>> = {
  // active-test-session is now seeded directly (fixed id ts1); nothing produced via-callable.
};
