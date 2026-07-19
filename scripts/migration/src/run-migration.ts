#!/usr/bin/env node
/**
 * CLI entry point for migration scripts.
 *
 * Usage:
 *   # Dry run AutoGrade migration for one client
 *   npx tsx src/run-migration.ts --source autograde --type all --client-id abc123 --dry-run
 *
 *   # Actually migrate exams
 *   npx tsx src/run-migration.ts --source autograde --type exams --client-id abc123
 *
 *   # Migrate LevelUp org (all types including chat-sessions and agents)
 *   npx tsx src/run-migration.ts --source levelup --type all --client-id orgId123
 *
 *   # Verify
 *   npx tsx src/run-migration.ts --verify autograde --client-id abc123
 *
 *   # Rollback
 *   npx tsx src/run-migration.ts --rollback autograde --client-id abc123
 *
 *   # Verify users globally
 *   npx tsx src/run-migration.ts --verify users
 *
 *   # Post-migration: recompute tenant stats
 *   npx tsx src/run-migration.ts --post-migration stats --client-id abc123
 *
 *   # Post-migration: migrate Gemini keys to Secret Manager
 *   npx tsx src/run-migration.ts --post-migration gemini-keys --client-id abc123
 */

import { Command } from "commander";
import { initFirebase } from "./config.js";
import { MigrationLogger, generateRunId } from "./utils/logger.js";

// AutoGrade migrations
import { migrateClientsToTenants } from "./autograde/migrate-clients-to-tenants.js";
import { migrateAutogradeUsers } from "./autograde/migrate-users.js";
import { migrateExams } from "./autograde/migrate-exams.js";
import { migrateSubmissions } from "./autograde/migrate-submissions.js";
import { migrateEvaluationSettings } from "./autograde/migrate-evaluation-settings.js";
import { migrateClasses } from "./autograde/migrate-classes.js";

// LevelUp migrations
import { migrateOrgsToTenants } from "./levelup/migrate-orgs-to-tenants.js";
import { migrateLevelUpUsers } from "./levelup/migrate-users.js";
import { migrateCoursesToSpaces } from "./levelup/migrate-courses-to-spaces.js";
import { migrateItems } from "./levelup/migrate-items.js";
import { migrateProgress } from "./levelup/migrate-progress.js";
import { migrateConsumerUsers } from "./levelup/migrate-consumer-users.js";
import { migrateChatSessions } from "./levelup/migrate-chat-sessions.js";
import { migrateAgents } from "./levelup/migrate-agents.js";

// Verification
import { verifyAutograde } from "./verify/verify-autograde.js";
import { verifyLevelUp } from "./verify/verify-levelup.js";
import { verifyUsers } from "./verify/verify-users.js";

// Rollback
import { rollbackAutograde } from "./rollback/rollback-autograde.js";
import { rollbackLevelUp } from "./rollback/rollback-levelup.js";

// Post-migration
import { recomputeTenantStats } from "./post-migration/recompute-tenant-stats.js";
import { migrateGeminiKeys } from "./post-migration/migrate-gemini-keys.js";

const program = new Command();

program
  .name("run-migration")
  .description("Migrate legacy AutoGrade and LevelUp data to unified tenant structure")
  .version("1.0.0");

// Main migration command
program
  .option("--source <source>", "Migration source: autograde | levelup")
  .option(
    "--type <type>",
    "Migration type: all | tenants | users | exams | submissions | evaluation-settings | classes | spaces | items | progress | consumer-users | chat-sessions | agents"
  )
  .option("--client-id <id>", "Client/Org ID to migrate (required for per-tenant migration)")
  .option("--dry-run", "Log what would be migrated without writing", false)
  .option("--verify <source>", "Run verification: autograde | levelup | users")
  .option("--rollback <source>", "Run rollback: autograde | levelup")
  .option("--post-migration <type>", "Post-migration tasks: stats | gemini-keys");

program.parse(process.argv);

const opts = program.opts();

async function main(): Promise<void> {
  initFirebase();
  const runId = generateRunId();

  // Handle post-migration tasks
  if (opts.postMigration) {
    const logger = new MigrationLogger(runId, `post-${opts.postMigration}`);
    const dryRun = opts.dryRun || false;

    if (dryRun) {
      console.log("=== DRY RUN MODE — no data will be written ===\n");
    }

    switch (opts.postMigration) {
      case "stats":
        await recomputeTenantStats({ tenantId: opts.clientId, dryRun, logger });
        break;
      case "gemini-keys":
        await migrateGeminiKeys({ tenantId: opts.clientId, dryRun, logger });
        break;
      default:
        console.error(`Unknown post-migration type: ${opts.postMigration}`);
        process.exit(1);
    }
    process.exit(0);
  }

  // Handle verification
  if (opts.verify) {
    const logger = new MigrationLogger(runId, `verify-${opts.verify}`);

    if (opts.verify === "autograde") {
      if (!opts.clientId) {
        console.error("Error: --client-id is required for autograde verification");
        process.exit(1);
      }
      const passed = await verifyAutograde({ clientId: opts.clientId, logger });
      process.exit(passed ? 0 : 1);
    }

    if (opts.verify === "levelup") {
      if (!opts.clientId) {
        console.error("Error: --client-id is required for levelup verification");
        process.exit(1);
      }
      const passed = await verifyLevelUp({ orgId: opts.clientId, logger });
      process.exit(passed ? 0 : 1);
    }

    if (opts.verify === "users") {
      const passed = await verifyUsers({ logger });
      process.exit(passed ? 0 : 1);
    }

    console.error(`Unknown verify source: ${opts.verify}`);
    process.exit(1);
  }

  // Handle rollback
  if (opts.rollback) {
    const logger = new MigrationLogger(runId, `rollback-${opts.rollback}`);

    if (!opts.clientId) {
      console.error("Error: --client-id is required for rollback");
      process.exit(1);
    }

    if (opts.rollback === "autograde") {
      await rollbackAutograde({
        clientId: opts.clientId,
        dryRun: opts.dryRun || false,
        logger,
      });
      process.exit(0);
    }

    if (opts.rollback === "levelup") {
      await rollbackLevelUp({
        orgId: opts.clientId,
        dryRun: opts.dryRun || false,
        logger,
      });
      process.exit(0);
    }

    console.error(`Unknown rollback source: ${opts.rollback}`);
    process.exit(1);
  }

  // Handle migration
  if (!opts.source) {
    console.error("Error: --source is required (autograde | levelup)");
    program.help();
    process.exit(1);
  }

  if (!opts.type) {
    console.error("Error: --type is required");
    process.exit(1);
  }

  const dryRun = opts.dryRun || false;

  if (dryRun) {
    console.log("=== DRY RUN MODE — no data will be written ===\n");
  }

  if (opts.source === "autograde") {
    await runAutogradeMigration(opts.type, opts.clientId, dryRun, runId);
  } else if (opts.source === "levelup") {
    await runLevelUpMigration(opts.type, opts.clientId, dryRun, runId);
  } else {
    console.error(`Unknown source: ${opts.source}`);
    process.exit(1);
  }
}

async function runAutogradeMigration(
  type: string,
  clientId: string | undefined,
  dryRun: boolean,
  runId: string
): Promise<void> {
  const logger = new MigrationLogger(runId, `autograde-${type}`);

  const types =
    type === "all"
      ? ["tenants", "users", "classes", "exams", "submissions", "evaluation-settings"]
      : [type];

  for (const t of types) {
    console.log(`\n--- Migrating: ${t} ---\n`);

    switch (t) {
      case "tenants":
        await migrateClientsToTenants({ clientId, dryRun, logger });
        break;

      case "users":
        if (!clientId) {
          console.error("--client-id required for users");
          process.exit(1);
        }
        await migrateAutogradeUsers({ clientId, dryRun, logger });
        break;

      case "classes":
        if (!clientId) {
          console.error("--client-id required for classes");
          process.exit(1);
        }
        await migrateClasses({ clientId, dryRun, logger });
        break;

      case "exams":
        if (!clientId) {
          console.error("--client-id required for exams");
          process.exit(1);
        }
        await migrateExams({ clientId, dryRun, logger });
        break;

      case "submissions":
        if (!clientId) {
          console.error("--client-id required for submissions");
          process.exit(1);
        }
        await migrateSubmissions({ clientId, dryRun, logger });
        break;

      case "evaluation-settings":
        if (!clientId) {
          console.error("--client-id required for evaluation-settings");
          process.exit(1);
        }
        await migrateEvaluationSettings({ clientId, dryRun, logger });
        break;

      default:
        console.error(`Unknown autograde migration type: ${t}`);
        process.exit(1);
    }
  }
}

async function runLevelUpMigration(
  type: string,
  clientId: string | undefined,
  dryRun: boolean,
  runId: string
): Promise<void> {
  const logger = new MigrationLogger(runId, `levelup-${type}`);

  const types =
    type === "all"
      ? [
          "tenants",
          "users",
          "spaces",
          "items",
          "progress",
          "chat-sessions",
          "agents",
          "consumer-users",
        ]
      : [type];

  for (const t of types) {
    console.log(`\n--- Migrating: ${t} ---\n`);

    switch (t) {
      case "tenants":
        await migrateOrgsToTenants({ orgId: clientId, dryRun, logger });
        break;

      case "users":
        if (!clientId) {
          console.error("--client-id required for users");
          process.exit(1);
        }
        await migrateLevelUpUsers({ orgId: clientId, dryRun, logger });
        break;

      case "spaces":
        if (!clientId) {
          console.error("--client-id required for spaces");
          process.exit(1);
        }
        await migrateCoursesToSpaces({ orgId: clientId, dryRun, logger });
        break;

      case "items":
        if (!clientId) {
          console.error("--client-id required for items");
          process.exit(1);
        }
        await migrateItems({ orgId: clientId, dryRun, logger });
        break;

      case "progress":
        if (!clientId) {
          console.error("--client-id required for progress");
          process.exit(1);
        }
        await migrateProgress({ orgId: clientId, dryRun, logger });
        break;

      case "chat-sessions":
        if (!clientId) {
          console.error("--client-id required for chat-sessions");
          process.exit(1);
        }
        await migrateChatSessions({ orgId: clientId, dryRun, logger });
        break;

      case "agents":
        if (!clientId) {
          console.error("--client-id required for agents");
          process.exit(1);
        }
        await migrateAgents({ orgId: clientId, dryRun, logger });
        break;

      case "consumer-users":
        await migrateConsumerUsers({ dryRun, logger });
        break;

      default:
        console.error(`Unknown levelup migration type: ${t}`);
        process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
