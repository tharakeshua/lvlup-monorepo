import { defineConfig } from "tsup";

/**
 * Bundle the deployable `v1.*` Cloud Functions codebase for Firebase.
 *
 * Firebase's cloud build runs `npm install --production` against the deployed
 * `package.json`; it cannot resolve `workspace:*` deps. We therefore INLINE every
 * `@levelup/*` workspace package (domain, api-contract, ai, access, services,
 * functions-adapters, functions-shared + transitive) into `lib/index.js` via
 * `noExternal`, and keep only the real npm packages (firebase-admin,
 * firebase-functions, zod, @google-cloud/secret-manager, @google/generative-ai)
 * external so Firebase installs them from the deployed `dependencies`.
 *
 * ESM output (the package is `type: module`); single entry preserves the nested
 * `v1` export group so each capability deploys under `v1-<module>-<op>`.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  noExternal: [/^@levelup\//],
  outDir: "lib",
  clean: true,
  dts: false,
  sourcemap: true,
});
