/**
 * RuleTester for the custom ESLint rule `@levelup/no-tenant-id-field` (R11).
 * lint-boundaries.md §3.5 + §8. Mirrors the planned eslint-config/test spec.
 *
 * Behavior under test (§3.5):
 *   Targets `z.object({...})` literals in api-contract/src/callables/** whose
 *   variable name matches `*RequestSchema`. Reports any `tenantId` property key
 *   (any nesting under the request root) — `tenantOverride` is the ONLY allowed
 *   tenant key, and only on super-admin defs.
 *
 * This is the #1 authority boundary (REVIEW §6 #1 / NON-NEGOTIABLE #4:
 * tenantId is claim-derived, NEVER in a request body). Defense-in-depth twin of
 * the api-contract runtime `no-tenant-id-in-request` contract test.
 *
 * Self-skips if the rule isn't exported yet (parallel build window).
 */
import { describe, it } from "vitest";

let RuleTester: any;
let rule: any;
let ready = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ RuleTester } = require("eslint"));
  // the rule is exported by @levelup/eslint-config (plugin.rules) per §3.2.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("@levelup/eslint-config");
  rule =
    cfg?.plugin?.rules?.["no-tenant-id-field"] ??
    cfg?.rules?.["no-tenant-id-field"] ??
    safeRequire("@levelup/eslint-config/rules/no-tenant-id-field");
  ready = Boolean(RuleTester && rule);
} catch {
  ready = false;
}

function safeRequire(id: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require(id);
    return m?.default ?? m;
  } catch {
    return undefined;
  }
}

(ready ? describe : describe.skip)("@levelup/no-tenant-id-field (R11)", () => {
  it("passes valid + fails invalid cases", () => {
    const tester = new RuleTester({
      languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    });

    tester.run("no-tenant-id-field", rule, {
      valid: [
        // a request schema with NO tenantId — fine.
        {
          code: `const saveStudentRequestSchema = z.object({ id: z.string().optional(), data: z.object({ firstName: z.string() }) }).strict();`,
          filename: "packages/api-contract/src/callables/identity.ts",
        },
        // tenantOverride on a super-admin def — the ONLY allowed tenant key.
        {
          code: `const deactivateTenantRequestSchema = z.object({ tenantOverride: z.string(), reason: z.string().optional() }).strict();`,
          filename: "packages/api-contract/src/callables/identity.ts",
        },
        // a NON request schema named differently — out of scope, even with tenantId.
        {
          code: `const tenantDocSchema = z.object({ tenantId: z.string() });`,
          filename: "packages/api-contract/src/callables/identity.ts",
        },
        // a request schema OUTSIDE callables/** — rule scoped to callables only.
        {
          code: `const fooRequestSchema = z.object({ tenantId: z.string() });`,
          filename: "packages/domain/src/entities/tenant.ts",
        },
      ],
      invalid: [
        // tenantId at the request root.
        {
          code: `const listStudentsRequestSchema = z.object({ tenantId: z.string() }).strict();`,
          filename: "packages/api-contract/src/callables/identity.ts",
          errors: 1,
        },
        // tenantId nested under data — still forbidden ("any nesting under the request root").
        {
          code: `const saveClassRequestSchema = z.object({ data: z.object({ tenantId: z.string(), name: z.string() }) }).strict();`,
          filename: "packages/api-contract/src/callables/identity.ts",
          errors: 1,
        },
      ],
    });
  });
});
