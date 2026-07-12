/**
 * `useDuplicateSpace` — server-side deep-copy mutation for the space duplicate
 * flow in SpaceListPage. Replaces the fragile client-side waterfall that
 * read + wrote every story point and item individually.
 */
import { defineMutation } from "../mutation/define-mutation.js";

type Repos = Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
const call = (repos: unknown, name: string, method: string, vars: unknown): Promise<unknown> =>
  (repos as Repos)[name][method](vars as never);

export const useDuplicateSpace = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.duplicateSpace",
  run: (repos, vars) => call(repos, "spaceRepo", "duplicate", vars),
});
