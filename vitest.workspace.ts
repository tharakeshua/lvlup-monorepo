import { defineWorkspace } from "vitest/config";

/**
 * Vitest workspace configuration for monorepo
 * This allows running tests across all packages in the workspace
 */
export default defineWorkspace([
  // Root level tests (if any)
  ".",
  // All packages
  "packages/*",
  // All apps (if they have tests)
  "apps/*",
  // Cloud functions (if they have tests)
  "functions/*",
]);
