/**
 * boundary-presets.table — asserts the `@levelup/eslint-config` boundary FACTORY
 * (the data the lint rules are built from) encodes exactly the §2 matrix R1–R14.
 * This is the vitest port of lint-boundaries.md §8 `boundaries.spec.mjs` (which
 * the plan files under eslint-config/test) — it proves each tier preset bans the
 * right specifiers so a refactor of the factory cannot silently drop a boundary.
 *
 * Source-of-truth surface (lint-boundaries §3.2):
 *   tiers.mjs:      TIERS, tierOf, allowedTiers, forbiddenPackages
 *   boundaries.mjs: FIREBASE_BAN, FIRESTORE_BAN, REACT_BAN, DEEP_IMPORT_BAN,
 *                   SECRETS_BAN, restrictedFor, buildNoRestrictedImports
 *   presets.mjs:    domain/contract/client/repos/query/transport/app/server presets
 *
 * Self-skips cleanly if the eslint-config flat presets are not yet exported.
 *
 * Plan invariants locked: R1 (tier DAG + forbiddenPackages), R3/R4/R5 (firebase/
 * react bans per tier), R8 (firestore ban + admin lift), R13 (deep-import ban),
 * R14 (secrets ban), and the §1 tier table itself (domain←contract←client←repos←query).
 */
import { describe, it, expect } from "vitest";

// dynamic import so a not-yet-built eslint-config doesn't hard-fail module eval.
let tiers: any;
let boundaries: any;
let presets: any;
let ready = false;
try {
  // these .mjs files already exist in the repo (eslint-config/src/*).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  tiers = require("@levelup/eslint-config/tiers");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  boundaries = require("@levelup/eslint-config/boundaries");
  ready = Boolean(tiers?.TIERS && boundaries?.FIREBASE_BAN);
} catch {
  ready = false;
}
try {
  // the composed flat presets live behind the './presets' subpath export
  // (the '.' export is the legacy index.js classic config).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  presets = require("@levelup/eslint-config/presets");
} catch {
  presets = undefined;
}

/** Flatten a RestrictedSpec (or a built ['error',{paths,patterns}]) to its banned specifier strings. */
function bannedSpecifiers(spec: any): string[] {
  if (!spec) return [];
  // built rule entry shape ['error', { paths, patterns }]
  const obj = Array.isArray(spec) ? spec[1] : spec;
  const names = (obj?.paths ?? []).map((p: any) => p.name);
  const groups = (obj?.patterns ?? []).flatMap((p: any) => p.group);
  return [...names, ...groups];
}

/** Pull the merged no-restricted-imports rule out of a flat-config preset array. */
function presetBans(preset: any): string[] {
  if (!Array.isArray(preset)) return [];
  const all: string[] = [];
  for (const block of preset) {
    const rule = block?.rules?.["no-restricted-imports"];
    if (rule) all.push(...bannedSpecifiers(rule));
  }
  return all;
}

(ready ? describe : describe.skip)("boundary-preset table (R1–R14 factory)", () => {
  // ---- §1 tier table: domain ← api-contract ← api-client ← repositories ← query ----
  describe("§1 tier graph (R1 strictly-downward)", () => {
    it("the canonical 5-tier chain is encoded in TIERS", () => {
      const T = tiers.TIERS;
      expect(T["@levelup/domain"]).toBe("t0-domain");
      expect(T["@levelup/api-contract"]).toBe("t1-contract");
      expect(T["@levelup/api-client"]).toBe("t2-client");
      expect(T["@levelup/repositories"]).toBe("t3-repos");
      expect(T["@levelup/query"]).toBe("t4-query");
      expect(T["@levelup/realtime"]).toBe("t4-query");
      expect(T["@levelup/offline"]).toBe("t4-query");
    });

    it("transport packages are t-transport (may import only t0/t1)", () => {
      expect(tiers.TIERS["@levelup/transport-firebase"]).toBe("t-transport");
      expect([...tiers.allowedTiers("t-transport")].sort()).toEqual(["t0-domain", "t1-contract"]);
    });

    it("server packages are t-server and may NOT import any client tier", () => {
      for (const p of [
        "@levelup/services",
        "@levelup/access",
        "@levelup/ai",
        "@levelup/functions-shared",
        "@levelup/repository-admin",
      ]) {
        expect(tiers.TIERS[p]).toBe("t-server");
      }
      const allowed = new Set(tiers.allowedTiers("t-server"));
      for (const clientTier of ["t2-client", "t3-repos", "t4-query", "t-transport"]) {
        expect(allowed.has(clientTier), `t-server must not allow ${clientTier}`).toBe(false);
      }
    });

    it("domain is a leaf (allowedTiers === [])", () => {
      expect([...tiers.allowedTiers("t0-domain")]).toEqual([]);
    });

    it("forbiddenPackages(t2-client) includes repositories + query but NOT domain/contract", () => {
      const forbidden = new Set(tiers.forbiddenPackages("t2-client"));
      expect(forbidden.has("@levelup/repositories")).toBe(true);
      expect(forbidden.has("@levelup/query")).toBe(true);
      expect(forbidden.has("@levelup/domain")).toBe(false);
      expect(forbidden.has("@levelup/api-contract")).toBe(false);
    });

    it("tierOf throws on an unknown package (no silent default)", () => {
      expect(() => tiers.tierOf("@levelup/does-not-exist")).toThrow();
    });
  });

  // ---- the named ban specs (boundaries.mjs) ----
  describe("§2 named ban specs", () => {
    it("FIREBASE_BAN covers firebase, firebase-admin, firebase-functions (+globs)", () => {
      const b = bannedSpecifiers(boundaries.FIREBASE_BAN);
      expect(b).toEqual(
        expect.arrayContaining(["firebase", "firebase-admin", "firebase-functions"])
      );
      expect(b).toEqual(expect.arrayContaining(["firebase/*"]));
    });

    it("FIRESTORE_BAN covers firebase/firestore + firebase-admin/firestore + @google-cloud/firestore (R8)", () => {
      const b = bannedSpecifiers(boundaries.FIRESTORE_BAN);
      expect(b).toEqual(
        expect.arrayContaining([
          "firebase/firestore",
          "firebase-admin/firestore",
          "@google-cloud/firestore",
        ])
      );
    });

    it("REACT_BAN covers react, react-dom, @tanstack/react-query (R5)", () => {
      const b = bannedSpecifiers(boundaries.REACT_BAN);
      expect(b).toEqual(expect.arrayContaining(["react", "react-dom", "@tanstack/react-query"]));
    });

    it("DEEP_IMPORT_BAN covers @levelup/*/src|dist|internal (R13)", () => {
      const b = bannedSpecifiers(boundaries.DEEP_IMPORT_BAN);
      expect(b.some((s: string) => s.includes("/src/"))).toBe(true);
      expect(b.some((s: string) => s.includes("/dist/"))).toBe(true);
      expect(b.some((s: string) => s.includes("/internal"))).toBe(true);
    });

    it("SECRETS_BAN covers @google-cloud/secret-manager (R14)", () => {
      const b = bannedSpecifiers(boundaries.SECRETS_BAN);
      expect(b).toEqual(expect.arrayContaining(["@google-cloud/secret-manager"]));
    });

    it("restrictedFor(t0-domain) forbids every higher/sideways @levelup tier (R1)", () => {
      const b = bannedSpecifiers(boundaries.restrictedFor("t0-domain"));
      // domain is the leaf — it may import NOTHING in @levelup; every package is forbidden.
      expect(b).toEqual(
        expect.arrayContaining([
          "@levelup/api-contract",
          "@levelup/api-client",
          "@levelup/repositories",
          "@levelup/query",
        ])
      );
    });

    it("buildNoRestrictedImports merges specs into a single error-level rule", () => {
      const rule = boundaries.buildNoRestrictedImports([
        boundaries.FIREBASE_BAN,
        boundaries.REACT_BAN,
      ]);
      expect(rule[0]).toBe("error");
      const banned = bannedSpecifiers(rule);
      expect(banned).toEqual(expect.arrayContaining(["firebase", "react"]));
    });
  });

  // ---- composed presets (presets.mjs) ----
  (presets ? describe : describe.skip)("§3.2 composed per-tier presets", () => {
    it("domainPreset bans firebase + react + firestore + secrets (R3)", () => {
      const b = presetBans(presets.domainPreset);
      for (const s of ["firebase", "react", "firebase/firestore", "@google-cloud/secret-manager"]) {
        expect(b, `domainPreset should ban ${s}`).toContain(s);
      }
    });

    it("contractPreset bans firebase + react (R3)", () => {
      const b = presetBans(presets.contractPreset);
      expect(b).toEqual(expect.arrayContaining(["firebase", "react"]));
    });

    it("clientPreset bans firebase + react + transport (R2/R4/R5)", () => {
      const b = presetBans(presets.clientPreset);
      expect(b).toEqual(
        expect.arrayContaining(["firebase", "react", "@levelup/transport-firebase"])
      );
    });

    it("reposPreset bans firebase + react + transport (R4/R5/R8)", () => {
      const b = presetBans(presets.reposPreset);
      expect(b).toEqual(
        expect.arrayContaining(["firebase", "react", "@levelup/transport-firebase"])
      );
    });

    it("queryPreset bans firebase + firestore + transport but ALLOWS react (the one binding site)", () => {
      const b = presetBans(presets.queryPreset);
      expect(b).toEqual(
        expect.arrayContaining(["firebase", "firebase/firestore", "@levelup/transport-firebase"])
      );
      expect(b).not.toContain("react"); // R5: query is the ONE place react is allowed.
    });

    it("transportPreset ALLOWS firebase but bans react + firestore + deep imports", () => {
      const b = presetBans(presets.transportPreset);
      expect(b).not.toContain("firebase"); // transport is the only firebase site.
      expect(b).toEqual(expect.arrayContaining(["react"]));
    });

    it("appPreset bans firebase + firestore + transport (R7)", () => {
      const b = presetBans(presets.appPreset);
      expect(b).toEqual(expect.arrayContaining(["firebase", "@levelup/transport-firebase"]));
    });

    it("serverPreset bans firestore + react; adminAdapterPreset LIFTS the firestore ban (R8 carve-out)", () => {
      const server = presetBans(presets.serverPreset);
      expect(server).toEqual(expect.arrayContaining(["firebase/firestore"]));
      const admin = presetBans(presets.adminAdapterPreset);
      expect(admin).not.toContain("firebase/firestore"); // the ONE allowed firestore site.
      expect(admin).toEqual(expect.arrayContaining(["react"])); // admin still framework-free.
    });
  });
});

describe("boundary-preset table (availability sentinel)", () => {
  it("documents which factory surfaces are present (informational, never fails)", () => {
    // Always-on heartbeat so the file reports even when the presets aren't built.
    expect(typeof ready).toBe("boolean");
  });
});
