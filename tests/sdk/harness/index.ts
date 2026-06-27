/**
 * Harness barrel — the public surface integration/contract suites import from.
 *   import { signInAsDemoUser, makeAuthContext, loadDemoSeed, clientFunctions } from '../harness';
 */
export * from "./emulator";
export * from "./fixtures-ids";
export * from "./seed";
export * from "./auth-context";
export { requireEmulators, requireSeed, emulatorsDown, seedUnavailable } from "./per-test-setup";
