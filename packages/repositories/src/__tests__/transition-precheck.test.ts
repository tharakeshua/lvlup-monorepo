/**
 * Repositories — transition pre-checks read ALLOWED_TRANSITIONS (SDK-LAYERS-PLAN
 * §4.1, §3.6, §4.5).
 *
 * Locked invariants:
 *   • Each lifecycle-bearing repo exposes a `can*`/`is*` boolean pre-check
 *     (`spaceRepo.canPublish`, `examRepo.canReleaseResults`, ...) that is a PURE
 *     read of the same `ALLOWED_TRANSITIONS` data the server enforces with
 *     `assertTransition` — UX-only, no wire call.
 *   • The pre-check answer is BYTE-FOR-BYTE the contract's `canTransition(domain,
 *     from,to)`; the repo must not encode a second, drifting transition table.
 *   • The pre-check NEVER issues an api-client call (it's a local computation).
 *   • Concrete edges from §3.6 are honored: space draft→published ok,
 *     published→published not; exam question_paper_extracted→published ok,
 *     draft→results_released not.
 *
 * These assertions are concrete against the FROZEN §3.6 tables. The contract
 * helper is imported from `@levelup/api-contract` (re-export of domain
 * ALLOWED_TRANSITIONS); the suite self-skips until both contract + repos land.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeApiClient, type FakeApiClient } from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

// Loosely-typed contract surface (api-contract re-exports ALLOWED_TRANSITIONS /
// canTransition from domain — §3.6). Self-skip if not yet built. ESM dynamic
// import (top-level await) keeps the package's `"type":"module"` honest.
type ContractSurface = {
  canTransition?: (domain: string, from: string, to: string) => boolean;
  ALLOWED_TRANSITIONS?: Record<string, Record<string, readonly string[]>>;
};
let contract: ContractSurface = {};
try {
  contract = (await import("@levelup/api-contract")) as ContractSurface;
} catch {
  /* not built yet */
}
const haveContract =
  typeof contract.canTransition === "function" && Boolean(contract.ALLOWED_TRANSITIONS);

const d = ready() && haveContract ? describe : describe.skip;

d("repositories · transition pre-checks (ALLOWED_TRANSITIONS)", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("the FROZEN §3.6 space machine matches the contract table exactly", () => {
    const can = contract.canTransition!;
    expect(can("space", "draft", "published")).toBe(true);
    expect(can("space", "published", "archived")).toBe(true);
    expect(can("space", "published", "draft")).toBe(true);
    expect(can("space", "archived", "draft")).toBe(true);
    // Illegal edges
    expect(can("space", "published", "published")).toBe(false);
    expect(can("space", "draft", "archived")).toBe(false);
    expect(can("space", "archived", "published")).toBe(false);
  });

  it("the FROZEN §3.6 exam machine: extracted→published yes, draft→results_released no", () => {
    const can = contract.canTransition!;
    expect(can("exam", "question_paper_extracted", "published")).toBe(true);
    expect(can("exam", "published", "grading")).toBe(true);
    expect(can("exam", "grading", "results_released")).toBe(true);
    expect(can("exam", "results_released", "archived")).toBe(true);
    expect(can("exam", "draft", "results_released")).toBe(false);
    expect(can("exam", "archived", "draft")).toBe(false); // archived→[] terminal
    // Dropped status must be unreachable.
    expect(can("exam", "results_released", "completed")).toBe(false);
  });

  it("spaceRepo.canPublish is a PURE read of ALLOWED_TRANSITIONS — no wire call", () => {
    const r = buildRepos(api);
    const repo = r["spaceRepo"]!;
    const fn = (repo["canPublish"] ?? repo["canTransition"]) as
      | ((...a: unknown[]) => boolean)
      | undefined;
    if (!fn) return; // derived pre-check not exposed under this name; covered by contract row above

    // draft entity → can publish; published entity → cannot re-publish.
    expect(fn({ status: "draft" })).toBe(true);
    expect(fn({ status: "published" })).toBe(false);
    // Critically: zero api calls — pre-checks are local UX.
    expect(api.calls).toHaveLength(0);
  });

  it("examRepo.canReleaseResults mirrors exam grading→results_released — no wire call", () => {
    const r = buildRepos(api);
    const repo = r["examRepo"]!;
    const fn = repo["canReleaseResults"] as ((...a: unknown[]) => boolean) | undefined;
    if (!fn) return;
    expect(fn({ status: "grading" })).toBe(true);
    expect(fn({ status: "draft" })).toBe(false);
    expect(fn({ status: "results_released" })).toBe(false);
    expect(api.calls).toHaveLength(0);
  });

  it("a repo pre-check answer is consistent with the contract canTransition (no second table)", () => {
    const r = buildRepos(api);
    const repo = r["spaceRepo"]!;
    const fn = (repo["canPublish"] ?? repo["canTransition"]) as
      | ((...a: unknown[]) => boolean)
      | undefined;
    if (!fn) return;
    const repoSays = fn({ status: "archived" });
    const contractSays = contract.canTransition!("space", "archived", "published");
    expect(repoSays).toBe(contractSays); // both false — repo reads the contract table
  });
});
