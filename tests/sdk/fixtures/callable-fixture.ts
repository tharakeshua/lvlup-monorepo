/**
 * Per-callable request/response fixture mechanism (SDK-LAYERS-PLAN.md §7.2 / T1).
 *
 * The headline backend gate — "for every callable, validate a representative
 * request and the live response shape against the Zod schema, under the emulator"
 * — is unimplementable without a mechanism for (a) the representative request and
 * (b) the seed-state precondition each callable needs to return a non-error
 * response. This file is that mechanism.
 *
 * A `CallableFixture<N>` carries, for one callable name `N`:
 *   • `request`   — a VALID request sample (built from entity-factories, no
 *                   tenantId in the body — D2),
 *   • `as`        — which demo-user role mints the calling ctx/token,
 *   • `seedState` — a named precondition (which seeded entities must exist; the
 *                   contract loop runs writes-before-reads using this),
 *   • optional `expect` — extra assertions on the live response beyond schema
 *                   validation (e.g. "score is stripped until resultsReleased"),
 *   • optional `skip` / `reason` — for callables not yet wired.
 *
 * `registerFixture(name, fx)` adds to `CALLABLE_FIXTURES`. The contract test
 * `registry-integrity` (co-located in api-contract) and the emulator contract
 * loop (tests/sdk/contract) both read this registry:
 *   • registry-integrity FAILS if any `CALLABLE_NAMES` entry lacks a fixture.
 *   • the emulator loop drives `def.responseSchema.parse(liveResponse)`.
 *
 * Fixtures live in sibling files (`identity.fixtures.ts`, `levelup.fixtures.ts`,
 * …) which import this module and call `registerFixture`. Importing
 * `./index.ts` loads them all.
 */

export type DemoRole =
  | "superAdmin"
  | "tenantAdmin"
  | "teacher"
  | "student"
  | "parent"
  | "staff"
  | "scanner"
  | "public";

/**
 * Named seed-state preconditions. A callable's fixture declares which one it
 * needs; the contract loop ensures the precondition holds (the demo seed creates
 * all of these in the contract tenant; ordering is documented in
 * tests/sdk/fixtures/ordering.ts).
 */
export type SeedState =
  | "contract-tenant" // base tenant + roles exist (every authed read)
  | "draft-space" // a draft Space exists (publishSpace, saveStoryPoint)
  | "published-space" // a published Space exists (listStoreSpaces, purchaseSpace)
  | "story-point-with-item" // space→storyPoint→item exists (startTestSession, evaluateAnswer)
  | "active-test-session" // an in_progress session exists (submitTestSession, saveTestAnswer)
  | "graded-submission" // a submission graded but NOT released (release-gate tests)
  | "released-exam" // an exam with resultsReleased=true (getSubmission visible)
  | "enrolled-student" // student enrolled in a published space (progress reads)
  | "parent-linked" // parent linked to a student (child reads, parent-gate)
  | "none"; // pre-auth / no precondition (lookupTenantByCode)

export interface CallableFixture<Req = unknown> {
  /** A valid request sample — NEVER carries a body `tenantId` (D2). */
  request: Req;
  /** The demo-user role that mints the calling token/ctx. */
  as: DemoRole;
  /** Precondition the contract tenant must satisfy before the call. */
  seedState: SeedState;
  /** Super-admin cross-tenant escape — only on `allowsTenantOverride` defs. */
  tenantOverride?: string;
  /** Extra assertions on the live response (beyond responseSchema.parse). */
  expect?: (res: unknown, vars: { uid: string; tenantId: string | null }) => void;
  /** Skip this fixture in the emulator loop (callable not wired yet). */
  skip?: boolean;
  reason?: string;
}

/** The fixture registry, keyed by fully-qualified callable name `v1.<mod>.<op>`. */
export const CALLABLE_FIXTURES: Record<string, CallableFixture> = {};

export function registerFixture<Req>(name: string, fx: CallableFixture<Req>): void {
  if (CALLABLE_FIXTURES[name]) {
    throw new Error(`[fixtures] duplicate fixture registered for '${name}'`);
  }
  CALLABLE_FIXTURES[name] = fx as CallableFixture;
}

export function getFixture(name: string): CallableFixture | undefined {
  return CALLABLE_FIXTURES[name];
}

export function fixtureNames(): string[] {
  return Object.keys(CALLABLE_FIXTURES);
}
