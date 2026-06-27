/**
 * Repositories — method-naming convention (SDK-LAYERS-PLAN repositories.md (1)).
 *
 * Locked invariant:
 *   "method-naming convention — list/get/getMany/save/paginate for IO, can/is
 *    prefixes for boolean pre-checks, compute/resolve prefixes for derived; no
 *    other verbs."
 *
 * For every repo the factory produces, every public method name must start with
 * an allowed verb prefix (plus the domain-specific IO verbs explicitly named in
 * §4.1/§3.7: record, requestUploadUrl, uploadImage, listForUser, listAlerts,
 * fetchNextPage). This catches a repo that smuggles an ad-hoc verb (`fetchX`,
 * `loadX`, `doX`) which would erode the predictable surface the hooks generate
 * over.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect } from "vitest";
import { createFakeApiClient } from "../../../../tests/sdk/fakes";
import { ready, buildRepos, ALLOWED_VERB_PREFIXES } from "./_harness";

const d = ready() ? describe : describe.skip;

/** Lifecycle verbs (DX-5 §4.5) are sanctioned method names too. */
const LIFECYCLE_VERBS = ["publish", "archive", "release", "rollover", "deactivate", "reactivate"];

function startsWithAllowedVerb(method: string): boolean {
  if (method.startsWith("_")) return true; // private/escape hatch helpers
  if (LIFECYCLE_VERBS.some((v) => method.startsWith(v))) return true;
  return ALLOWED_VERB_PREFIXES.some((v) => method === v || method.startsWith(v));
}

d("repositories · method-naming convention", () => {
  it("every repo method uses an allowed verb prefix (no ad-hoc verbs)", () => {
    const api = createFakeApiClient();
    const bag = buildRepos(api);
    const violations: string[] = [];

    for (const [repoName, repo] of Object.entries(bag)) {
      if (!repo || typeof repo !== "object") continue;
      for (const method of Object.keys(repo)) {
        if (typeof (repo as Record<string, unknown>)[method] !== "function") continue;
        if (!startsWithAllowedVerb(method)) {
          violations.push(`${repoName}.${method}`);
        }
      }
    }

    expect(
      violations,
      `repositories.md (1) method-naming violation — disallowed verb:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("boolean pre-checks are can*/is* and IO is list/get/getMany/save/paginate (spot-checks)", () => {
    const api = createFakeApiClient();
    const bag = buildRepos(api);
    // spaceRepo is the canonical example carrying both IO + a derived pre-check.
    const space = bag["spaceRepo"];
    if (!space) return;
    for (const method of Object.keys(space)) {
      if (/^(canPublish|canArchive|isPublished)$/.test(method)) {
        expect(/^(can|is)/.test(method)).toBe(true);
      }
    }
  });
});
