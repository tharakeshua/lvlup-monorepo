/**
 * Top-level orchestrators: `seed()` writes a SeedConfig, `verifySeed()` re-reads and asserts.
 * Both build a SeedContext (emulator-detected, fixed-clock by default) and tear it down.
 */

import { SeedContext } from "./context.js";
import { SeedPipeline } from "./pipeline.js";
import { verify, type VerifyReport } from "./verify.js";
import { validateSeedConfig } from "../config/schema.js";
import type { SeedConfig, SeedRunOptions } from "../config/types.js";

/** A pre-resolved `{ path, data, kind }` doc the pipeline does not synthesize (analytics projections). */
export interface DerivedDoc {
  path: string;
  data: Record<string, unknown>;
  kind: string;
}

export interface SeedExtraOptions {
  /**
   * Extra DERIVED docs (e.g. ExamAnalytics, summaries, leaderboards, cost/llm) written with a thin
   * idempotent `ensureDoc` loop AFTER the pipeline. Each is keyed by a deterministic id, so re-runs
   * upsert in place (no dupes). Pass `derivedSeedDocs(clock)` from `@levelup/seed/config`.
   */
  derivedDocs?: readonly DerivedDoc[];
}

export interface SeedResult {
  counts: Record<string, number>;
  batch: { totalOps: number; sets: number; updates: number; commits: number };
  verify: VerifyReport;
}

function makeContext(opts: SeedRunOptions): SeedContext {
  return new SeedContext({
    projectId: opts.projectId,
    serviceAccountPath: opts.serviceAccountPath,
    databaseURL: opts.databaseURL,
    dryRun: opts.dryRun,
    logLevel: opts.logLevel,
    clock: opts.clock,
    clockEpochMs: opts.clockEpochMs,
  });
}

/** Validate + write + verify a SeedConfig. Idempotent: safe to re-run (upsert semantics). */
export async function seed(
  config: SeedConfig,
  opts: SeedRunOptions & SeedExtraOptions = {} as SeedRunOptions & SeedExtraOptions
): Promise<SeedResult> {
  validateSeedConfig(config);
  const ctx = makeContext(opts);
  const log = ctx.logger;

  log.info("seed: starting");
  const pipeline = new SeedPipeline(ctx);
  await pipeline.run(config);
  await ctx.flush();

  // Rich DERIVED docs (analytics/gamification projections) — thin idempotent upsert loop.
  if (opts.derivedDocs?.length) {
    log.info(`seed: writing ${opts.derivedDocs.length} derived doc(s)`);
    for (const doc of opts.derivedDocs) {
      await ctx.ensureDoc(doc.kind, doc.path, doc.data);
    }
    await ctx.flush();
  }

  log.info(
    `seed: writes done — ${ctx.batch.stats.totalOps} ops in ${ctx.batch.stats.commits} commit(s)`
  );

  const report = await verify(ctx, config);

  return {
    counts: ctx.counts,
    batch: {
      totalOps: ctx.batch.stats.totalOps,
      sets: ctx.batch.stats.sets,
      updates: ctx.batch.stats.updates,
      commits: ctx.batch.stats.commits,
    },
    verify: report,
  };
}

/** Verify-only: re-read an already-seeded tree and assert counts (no writes). */
export async function verifySeed(config: SeedConfig, opts: SeedRunOptions): Promise<VerifyReport> {
  validateSeedConfig(config);
  const ctx = makeContext({ ...opts, dryRun: false });
  return verify(ctx, config);
}
