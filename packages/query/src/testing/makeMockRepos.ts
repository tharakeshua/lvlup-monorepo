/**
 * `makeMockRepos` — typed repo doubles for hook tests (query-infra.md §1 testing).
 *
 * Returns a `Repositories`-shaped bag of `vi`-agnostic stub methods. Each repo
 * method is a plain async function returning the supplied canned value (or
 * `undefined`). Callers override per-method via the `overrides` bag. Kept
 * framework-free so it builds in the platform-neutral package (no `vitest`
 * import at module scope).
 */
import type { Repositories } from "@levelup/repositories";

export type RepoStub = (...args: never[]) => Promise<unknown>;

export interface MakeMockReposOptions {
  /** Per-repo, per-method canned responses: `{ spaceRepo: { list: async () => [] } }`. */
  overrides?: Record<string, Record<string, RepoStub>>;
}

/**
 * Build a mock repositories bag. Unknown repo/method access returns a stub that
 * resolves `undefined`, so a hook calling any `repos.*.method()` never throws.
 */
export function makeMockRepos(options: MakeMockReposOptions = {}): Repositories {
  const overrides = options.overrides ?? {};
  const repoCache = new Map<string, unknown>();

  const makeRepo = (repoName: string): unknown =>
    new Proxy(
      {},
      {
        get(_t, method: string) {
          const override = overrides[repoName]?.[method];
          if (override) return override;
          return async () => undefined;
        },
      }
    );

  return new Proxy(
    {},
    {
      get(_t, repoName: string) {
        if (typeof repoName !== "string") return undefined;
        if (!repoCache.has(repoName)) repoCache.set(repoName, makeRepo(repoName));
        return repoCache.get(repoName);
      },
    }
  ) as unknown as Repositories;
}
