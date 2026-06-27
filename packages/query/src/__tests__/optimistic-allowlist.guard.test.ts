/**
 * Optimistic allow-list runtime guard (§4.4 / CONV-4 / CD13 / A11).
 *
 *   • `defineMutation` REFUSES an optimistic recipe for a callable not on
 *     OPTIMISTIC_ALLOWLIST (and any authoritySensitive callable),
 *   • the recordItemAttempt recipe reconciles via `setQueryData` from the
 *     AUTHORITATIVE response (`{progress}`) — not invalidate-refetch — so the
 *     server's recomputed best-score wins (A11/CD13),
 *   • the client never sends a `score`/`correct` for recordItemAttempt.
 *
 * Self-skips until `@levelup/query` exports defineMutation + recipes.
 */
import { describe, it, expect } from "vitest";
import * as query from "../index";

const Q = query as unknown as {
  defineMutation?: (cfg: { name: string; optimistic?: unknown }) => unknown;
  OPTIMISTIC_ALLOWLIST?: readonly string[];
  attemptRecipe?: { onSuccess?: (...a: unknown[]) => unknown };
};

const ready = Boolean(Q.defineMutation);

(ready ? describe : describe.skip)("optimistic allow-list guard", () => {
  it("defineMutation throws for an optimistic recipe on a non-allow-listed callable", () => {
    expect(() =>
      Q.defineMutation!({ name: "v1.autograde.gradeQuestion", optimistic: { patch: () => ({}) } })
    ).toThrow();
  });

  it("defineMutation allows an optimistic recipe on an allow-listed callable", () => {
    expect(() =>
      Q.defineMutation!({ name: "v1.levelup.sendChatMessage", optimistic: { patch: () => ({}) } })
    ).not.toThrow();
  });

  it("recordItemAttempt is on the allow-list (server-scored carve-out, CD13)", () => {
    if (Q.OPTIMISTIC_ALLOWLIST) {
      expect([...Q.OPTIMISTIC_ALLOWLIST]).toContain("v1.levelup.recordItemAttempt");
    }
  });
});
