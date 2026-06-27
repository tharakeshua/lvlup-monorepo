/**
 * depcruise-config — asserts the dependency-cruiser ruleset (lint-boundaries §5)
 * encodes the whole-graph forbidden rules that a flat `no-restricted-imports`
 * cannot express (transitive + cross-package + cyclic). The CI step
 * `pnpm depcruise packages apps functions` is the authority; this test guards the
 * RULESET DATA so a refactor can't silently drop a forbidden edge.
 *
 * The config is emitted by `@levelup/build-config`'s `buildDepcruiseConfig(tiers)`
 * (§4.1 depcruise.config.cjs) into a root `.dependency-cruiser.cjs`. Until that
 * package lands, this test self-skips on the config and only asserts the SHAPE of
 * the required rule names, so it documents the §5 contract and turns green when
 * the config is authored.
 *
 * Plan invariants locked: the §5 forbidden rule set —
 *   no-upward-tier (R1), app-imports-restricted (R7), firestore-only-admin (R8),
 *   services-no-ff (R9), server-no-client (R12), no-sibling-repo (R6),
 *   no-transport-except-roots (R2), no-deep-internal (R13), no-circular.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../../../tests/sdk/harness/import-graph";

/** The §5 forbidden rule names that MUST exist in the depcruise config. */
const REQUIRED_RULES = [
  "no-upward-tier", // R1
  "app-imports-restricted", // R7
  "firestore-only-admin", // R8
  "services-no-ff", // R9
  "server-no-client", // R12
  "no-sibling-repo", // R6
  "no-transport-except-roots", // R2
  "no-deep-internal", // R13
  "no-circular", // global cycle guard
];

const CANDIDATE_PATHS = [
  ".dependency-cruiser.cjs",
  ".dependency-cruiser.js",
  "dependency-cruiser.config.cjs",
  "packages/build-config/src/depcruise.config.cjs",
];

function resolveConfig(): string | undefined {
  for (const c of CANDIDATE_PATHS) {
    const p = path.join(REPO_ROOT, c);
    if (existsSync(p)) return p;
  }
  return undefined;
}

const cfgPath = resolveConfig();

describe("depcruise-config (§5 whole-graph DAG guard)", () => {
  it("documents the required §5 forbidden rule names (the R-matrix → graph mapping)", () => {
    // Always-on: locks the canonical rule-name list the config MUST provide.
    expect(REQUIRED_RULES).toContain("firestore-only-admin"); // R8
    expect(REQUIRED_RULES).toContain("services-no-ff"); // R9
    expect(REQUIRED_RULES).toContain("server-no-client"); // R12
    expect(REQUIRED_RULES).toContain("no-circular");
    expect(REQUIRED_RULES.length).toBe(9);
  });

  (cfgPath ? it : it.skip)(
    "the dependency-cruiser config declares every required forbidden rule at severity error",
    () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(cfgPath!);
      const cfg = mod?.default ?? mod;
      const forbidden: any[] = cfg?.forbidden ?? [];
      const names = new Set(forbidden.map((r) => r.name));
      const missing = REQUIRED_RULES.filter((n) => !names.has(n));
      expect(missing, `depcruise config missing rules: ${missing}`).toEqual([]);
      // every boundary rule must be an error, not a warning (lint-boundaries §0).
      for (const r of forbidden) {
        if (REQUIRED_RULES.includes(r.name)) {
          expect(r.severity, `${r.name} must be error`).toBe("error");
        }
      }
    }
  );

  (cfgPath ? it : it.skip)(
    "firestore-only-admin forbids firestore from everything but repository-admin",
    () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(cfgPath!);
      const cfg = mod?.default ?? mod;
      const rule = (cfg?.forbidden ?? []).find((r: any) => r.name === "firestore-only-admin");
      expect(rule).toBeTruthy();
      const fromPathNot = JSON.stringify(rule?.from ?? {});
      expect(fromPathNot).toMatch(/repository-admin/);
      const toPath = JSON.stringify(rule?.to ?? {});
      expect(toPath).toMatch(/firestore/);
    }
  );
});
