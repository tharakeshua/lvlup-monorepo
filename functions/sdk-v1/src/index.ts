/**
 * Deployable `v1.*` Cloud Functions codebase entrypoint (additive — the four
 * legacy codebases identity/levelup/autograde/analytics are untouched).
 *
 * ── Bootstrap order (load-bearing) ──
 * `./bootstrap` is imported FIRST, for side-effect: it runs
 * `admin.initializeApp()` and `configureRuntime({ repos, ai, clock })` so every
 * `makeCallable`/`makeTrigger`/… shell in the module barrels resolves the same
 * injected runtime ports (`getRepos()`/`getAi()`/`getClock()`) the moment its
 * module is evaluated.
 *
 * ── Deployed-id naming convention (the dotted↔dashed reconciliation point) ──
 * Firebase derives a function's deployed/emulator id from its EXPORT PATH joined
 * with dashes — a function id may not contain dots. We export the four module
 * groups NESTED:
 *
 *   export const v1 = { identity: {…}, levelup: {…}, autograde: {…}, analytics: {…} };
 *
 * so each wired capability `v1.<module>.<op>` deploys under the id
 * `v1-<module>-<op>` (e.g. `v1.levelup.saveSpace` → `v1-levelup-saveSpace`).
 *
 *   contract name (dots)   :  v1.levelup.saveSpace      (CALLABLES key; what
 *                                                        makeCallable is given)
 *   deployed/emulator id   :  v1-levelup-saveSpace      (what Firebase registers)
 *
 * The transport client (`invokeViaCallable`) calls `httpsCallable(fns, name)` with
 * the DOTTED contract name. Reconciling the dotted client name to the dashed
 * deployed id (so the wire path reaches the function) is the wire-green step's job
 * — it owns the single mapping (e.g. transport name-mangling, or an `onRequest`
 * dotted-name router/rewrite). This codebase only fixes the deployed-id grammar:
 * **`v1-<module>-<op>`, derived mechanically from the nested export tree.**
 *
 * The module barrels (`./identity` etc.) start as empty `export {}` shells; the
 * shell writers append one wired `export const <op> = makeCallable(...)` per
 * capability. `import * as <module>` below re-namespaces each file's exports into
 * the nested `v1` group with zero further edits to this file.
 */
import "./bootstrap.js";

import * as identity from "./identity.js";
import * as levelup from "./levelup.js";
import * as autograde from "./autograde.js";
import * as analytics from "./analytics.js";

/**
 * Nested export group → Firebase derives deployed ids `v1-<module>-<op>` from this
 * tree. Empty groups during the scaffold window register no functions (valid).
 */
export const v1 = {
  identity,
  levelup,
  autograde,
  analytics,
};
