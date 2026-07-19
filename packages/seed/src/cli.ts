#!/usr/bin/env node
/**
 * Seed CLI — emulator-first entrypoint.
 *
 * Usage:
 *   pnpm --filter @levelup/seed seed:emulator
 *   tsx src/cli.ts --project lvlup-ff6fa --dry-run
 *   tsx src/cli.ts --verify-only
 *   tsx src/cli.ts --config ./my-seed.json
 *
 * Flags:
 *   --project <id>          Firebase projectId (default: GCLOUD_PROJECT / 'lvlup-local')
 *   --config <path>         JSON SeedConfig file (default: bundled, assembled `seedConfig`)
 *   --service-account <p>   service-account JSON (real project only)
 *   --database-url <url>    RTDB url (only if seeding RTDB read-models)
 *   --dry-run               count + log only, no writes
 *   --verify-only           re-read and assert counts, no writes
 *   --log <level>           silent|error|warn|info|debug (default: info)
 *   --real-clock            use wall-clock instead of the deterministic fixed clock
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seed, verifySeed } from "./engine/run.js";
import { createSystemClock, type Clock } from "./engine/clock.js";
import { seedConfig, derivedSeedDocs } from "./config/index.js";
import type { SeedConfig } from "./config/types.js";

interface Args {
  project: string;
  config?: string;
  serviceAccount?: string;
  databaseURL?: string;
  dryRun: boolean;
  verifyOnly: boolean;
  log: "silent" | "error" | "warn" | "info" | "debug";
  realClock: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    project: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? "lvlup-local",
    dryRun: false,
    verifyOnly: false,
    log: "info",
    realClock: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--project":
        a.project = next() ?? a.project;
        break;
      case "--config":
        a.config = next();
        break;
      case "--service-account":
        a.serviceAccount = next();
        break;
      case "--database-url":
        a.databaseURL = next();
        break;
      case "--dry-run":
        a.dryRun = true;
        break;
      case "--verify-only":
        a.verifyOnly = true;
        break;
      case "--log":
        a.log = (next() as Args["log"]) ?? "info";
        break;
      case "--real-clock":
        a.realClock = true;
        break;
      default:
        if (arg?.startsWith("--")) {
          console.error(`unknown flag: ${arg}`);
          process.exit(2);
        }
    }
  }
  return a;
}

/** Returns the config + whether it is the bundled dataset (only the bundled set carries derived docs). */
function loadConfig(path?: string): { config: SeedConfig; bundled: boolean } {
  if (!path) return { config: seedConfig, bundled: true };
  const raw = readFileSync(resolve(process.cwd(), path), "utf-8");
  return { config: JSON.parse(raw) as SeedConfig, bundled: false };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { config, bundled } = loadConfig(args.config);
  const clock: Clock | undefined = args.realClock ? createSystemClock() : undefined;

  const opts = {
    projectId: args.project,
    serviceAccountPath: args.serviceAccount,
    databaseURL: args.databaseURL,
    logLevel: args.log,
    dryRun: args.dryRun,
    clock,
    // Rich derived analytics docs only ship with the bundled dataset (same fragments / ids).
    derivedDocs: bundled ? derivedSeedDocs(clock) : undefined,
  };

  if (args.verifyOnly) {
    const report = await verifySeed(config, opts);
    console.log(JSON.stringify({ verify: report }, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const result = await seed(config, opts);
  console.log(
    JSON.stringify(
      {
        counts: result.counts,
        batch: result.batch,
        verifyOk: result.verify.ok,
        ...(args.dryRun ? { manifest: result.manifest } : {}),
      },
      null,
      2
    )
  );
  process.exit(result.verify.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
