/**
 * Runtime injection seam for the adapters. The four function codebases call
 * `configureRuntime({ repos, ai, clock })` ONCE at module load (Phase 5 wiring),
 * so every `makeCallable`/`makeTrigger`/`makeScheduler`/`makeTaskHandler` shell
 * resolves the SAME injected `repos`/`ai` without importing those packages here.
 *
 * Kept as a settable seam (not a hard import) so `@levelup/functions-shared`
 * stays decoupled from `@levelup/repositories-admin` / `@levelup/ai` at the type
 * level (structural ports) and at the wiring level (set by the codebase).
 */
import type { Timestamp } from "@levelup/domain";
import type { Repos, AiGateway, StorageSignerPort, PipelineEnqueuePort } from "../context/ports.js";

export interface RuntimeDeps {
  repos: Repos;
  ai: AiGateway;
  clock?: () => Timestamp;
  /**
   * Signed-upload-URL signer surfaced to services as `ctx.storage`. OPTIONAL:
   * when unset (emulator/unit tests) `requestUploadUrlService` falls back to its
   * `https://storage.local/…` stub grant.
   */
  storage?: StorageSignerPort;
  /**
   * Cloud Tasks pipeline-advance enqueue surfaced to services as
   * `ctx.enqueuePipelineAdvance` (curried over the ctx tenant). OPTIONAL: when
   * unset (emulator/unit tests) the pipeline reducer runs steps INLINE.
   */
  pipelineTasks?: PipelineEnqueuePort;
}

let runtime: RuntimeDeps | null = null;

/** Wire the injected ports once at codebase bootstrap. */
export function configureRuntime(deps: RuntimeDeps): void {
  runtime = deps;
}

function requireRuntime(): RuntimeDeps {
  if (!runtime) {
    throw new Error(
      "[functions-shared] runtime not configured — call configureRuntime({ repos, ai }) at bootstrap"
    );
  }
  return runtime;
}

export function getRepos(): Repos {
  return requireRuntime().repos;
}
export function getAi(): AiGateway {
  return requireRuntime().ai;
}
export function getClock(): (() => Timestamp) | undefined {
  return runtime?.clock;
}
/** Optional — undefined preserves the service-layer stub-URL fallback. */
export function getStorage(): StorageSignerPort | undefined {
  return runtime?.storage;
}
/** Optional — undefined preserves the service-layer inline-pipeline fallback. */
export function getPipelineTasks(): PipelineEnqueuePort | undefined {
  return runtime?.pipelineTasks;
}
