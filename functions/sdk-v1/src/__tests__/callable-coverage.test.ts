/**
 * LVL-2 wire-gap pin: EVERY api-contract callable has a deployed-function
 * export in the matching sdk-v1 module (the exact class of gap DEP-1's smoke
 * found — 15 contract callables with no function). A new contract callable
 * with no wiring fails HERE, at unit time, instead of at deploy-smoke time.
 */
import { describe, it, expect } from "vitest";
import { CALLABLES } from "@levelup/api-contract";
import * as identity from "../identity.js";
import * as levelup from "../levelup.js";
import * as autograde from "../autograde.js";
import * as analytics from "../analytics.js";

const MODULES: Record<string, Record<string, unknown>> = {
  identity,
  levelup,
  autograde,
  analytics,
};

describe("sdk-v1 callable coverage (contract ↔ function exports)", () => {
  for (const name of Object.keys(CALLABLES)) {
    const [, module, op] = name.split(".");
    it(`${name} has a function export`, () => {
      const mod = MODULES[module!];
      expect(mod, `unknown contract module '${module}'`).toBeDefined();
      expect(
        typeof mod![op!],
        `contract callable ${name} has NO export in sdk-v1/src/${module}.ts`
      ).toBe("function");
    });
  }
});
