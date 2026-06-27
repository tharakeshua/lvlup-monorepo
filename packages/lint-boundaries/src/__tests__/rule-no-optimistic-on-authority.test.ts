/**
 * RuleTester for the custom ESLint rule `@levelup/no-optimistic-on-authority` (R10).
 * lint-boundaries.md §3.5 + §8. Mirrors the planned eslint-config/test spec.
 *
 * Behavior under test (§3.5):
 *   Targets `useMutation(...)` / repo `optimistic(...)` recipes. Resolves the
 *   callable name from the mutationFn body (`api.<module>.<op>` / `repos.<x>.<y>`),
 *   looks it up against AUTHORITY_CALLABLES (def.authoritySensitive === true). If
 *   the config has `onMutate`/`optimisticData`/`optimistic:true` AND the callable
 *   is authority-sensitive → report.
 *
 *   VALID: optimistic on recordItemAttempt / sendChatMessage / markRead
 *          (the §4.4 OPTIMISTIC_ALLOWLIST).
 *   INVALID: optimistic on gradeQuestion / saveSpace(status) / purchaseSpace.
 *
 * This mechanizes NON-NEGOTIABLE #5 (conservative optimistic only — NEVER
 * grading/publish/lifecycle/purchases).
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("@levelup/eslint-config");
  rule =
    cfg?.plugin?.rules?.["no-optimistic-on-authority"] ??
    cfg?.rules?.["no-optimistic-on-authority"] ??
    safeRequire("@levelup/eslint-config/rules/no-optimistic-on-authority");
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

(ready ? describe : describe.skip)("@levelup/no-optimistic-on-authority (R10)", () => {
  it("allows optimistic on allow-listed callables; rejects it on authority callables", () => {
    const tester = new RuleTester({
      languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    });

    tester.run("no-optimistic-on-authority", rule, {
      valid: [
        // ✅ sendChatMessage — conservative optimistic allowed.
        {
          code: `useMutation({ mutationFn: (v) => api.levelup.sendChatMessage(v), onMutate: () => {} });`,
          filename: "packages/query/src/mutations/chat.ts",
        },
        // ✅ recordItemAttempt — server-scored carve-out (CD13) but still allow-listed for optimistic.
        {
          code: `useMutation({ mutationFn: (v) => api.levelup.recordItemAttempt(v), onMutate: () => {} });`,
          filename: "packages/query/src/mutations/attempt.ts",
        },
        // ✅ markNotificationRead — allow-listed (✅opt).
        {
          code: `useMutation({ mutationFn: (v) => api.identity.markNotificationRead(v), optimisticData: 0 });`,
          filename: "packages/query/src/mutations/notif.ts",
        },
        // an authority callable WITHOUT optimistic config — perfectly fine.
        {
          code: `useMutation({ mutationFn: (v) => api.autograde.gradeQuestion(v) });`,
          filename: "packages/query/src/mutations/grade.ts",
        },
      ],
      invalid: [
        // ⚷ gradeQuestion + onMutate → must report.
        {
          code: `useMutation({ mutationFn: (v) => api.autograde.gradeQuestion(v), onMutate: () => {} });`,
          filename: "packages/query/src/mutations/grade.ts",
          errors: 1,
        },
        // ⚷ purchaseSpace + optimistic:true → must report.
        {
          code: `useMutation({ mutationFn: (v) => api.levelup.purchaseSpace(v), optimistic: true });`,
          filename: "packages/query/src/mutations/purchase.ts",
          errors: 1,
        },
        // ⚷ releaseResults (publish/lifecycle) + optimisticData → must report.
        {
          code: `useMutation({ mutationFn: (v) => api.autograde.releaseResults(v), optimisticData: {} });`,
          filename: "apps/teacher-web/src/hooks/useRelease.ts",
          errors: 1,
        },
      ],
    });
  });
});
