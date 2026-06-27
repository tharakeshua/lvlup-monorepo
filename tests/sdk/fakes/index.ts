/**
 * Fakes barrel — the unit-test seam surface co-located package tests import from.
 *   import { createFakeTransport, createFakeApiClient, createInMemoryRepos,
 *            createFakeAiGateway, makeSpace } from '../../../tests/sdk/fakes';
 *
 * NOTE: these fakes live under tests/sdk/fakes so they are SHARED by both the
 * pure-package unit tests (imported relatively) and the emulator project. They
 * are intentionally framework-free and have no `@levelup/*` import dependency at
 * module-eval time (only dynamic, fall-back imports inside `wrapTransport` and
 * `validateAgainstDomain`), so a co-located test can import them even while a
 * downstream package is still a scaffold.
 */
export * from "./fake-transport";
export * from "./fake-api-client";
export * from "./in-memory-repos";
export * from "./fake-ai-gateway";
export * from "./entity-factories";
