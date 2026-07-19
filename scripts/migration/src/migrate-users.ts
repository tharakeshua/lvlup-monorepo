#!/usr/bin/env node
/**
 * Migrate legacy user accounts to the new multi-tenant membership model.
 *
 * This is a unified script that handles user migration from both legacy systems:
 *
 *   1. AutoGrade users: /clients/{cId}/students|teachers|parents → /users + /userMemberships
 *   2. LevelUp org users: /userOrgs + /userRoles → /users + /userMemberships
 *   3. LevelUp consumer users: standalone /users → add consumerProfile
 *
 * The unified user model:
 *   /users/{uid}                    — single identity doc per user
 *   /userMemberships/{uid}_{tenantId} — one per tenant the user belongs to
 *
 * Field mapping (AutoGrade → Unified):
 *   firstName + lastName        → displayName, firstName, lastName
 *   email                       → email, authProviders
 *   status: 'active'|'inactive' → status: 'active'|'suspended'
 *   clientId                    → tenantId (in membership)
 *   classIds                    → permissions.managedClassIds (teacher) or linked via student doc
 *
 * Field mapping (LevelUp → Unified):
 *   fullName/displayName        → displayName
 *   userOrgs.orgId              → tenantId (in membership)
 *   userRoles.orgAdmin[orgId]   → role: 'tenantAdmin'
 *   userRoles.courseAdmin[cId]  → role: 'teacher'
 *   (default)                   → role: 'student'
 *   country, age, grade         → preserved in user doc
 *
 * Consumer users (no org):
 *   No membership record created. User doc gets consumerProfile: { plan, enrolledSpaceIds }
 *
 * Usage:
 *   # Migrate AutoGrade users for one client
 *   npx tsx src/migrate-users.ts --source autograde --client-id abc123 --dry-run
 *
 *   # Migrate LevelUp users for one org
 *   npx tsx src/migrate-users.ts --source levelup --org-id orgXyz --dry-run
 *
 *   # Migrate consumer users (B2C, no org)
 *   npx tsx src/migrate-users.ts --source consumer --dry-run
 *
 *   # Migrate all sources for a combined tenant
 *   npx tsx src/migrate-users.ts --source all --client-id tenantXyz --dry-run
 *
 *   # Verify user migration integrity
 *   npx tsx src/migrate-users.ts --verify
 */

import { Command } from "commander";
import { initFirebase } from "./config.js";
import { MigrationLogger, generateRunId } from "./utils/logger.js";

// Migration functions
import { migrateAutogradeUsers } from "./autograde/migrate-users.js";
import { migrateLevelUpUsers } from "./levelup/migrate-users.js";
import { migrateConsumerUsers } from "./levelup/migrate-consumer-users.js";

// Verification
import { verifyUsers } from "./verify/verify-users.js";

// ── CLI ─────────────────────────────────────────────

const program = new Command();

program
  .name("migrate-users")
  .description("Migrate legacy user accounts to the unified multi-tenant membership model")
  .version("1.0.0")
  .option("--source <source>", "Migration source: autograde | levelup | consumer | all")
  .option("--client-id <id>", "AutoGrade client ID (required for source=autograde)")
  .option("--org-id <id>", "LevelUp org ID (required for source=levelup)")
  .option("--dry-run", "Log what would be migrated without writing", false)
  .option("--verify", "Verify user migration integrity", false);

program.parse(process.argv);

const opts = program.opts<{
  source?: string;
  clientId?: string;
  orgId?: string;
  dryRun: boolean;
  verify: boolean;
}>();

async function main(): Promise<void> {
  initFirebase();
  const runId = generateRunId();

  // Handle verification
  if (opts.verify) {
    const logger = new MigrationLogger(runId, "verify-users");
    console.log("\n=== Verifying User Migration Integrity ===\n");
    const passed = await verifyUsers({ logger });
    process.exit(passed ? 0 : 1);
  }

  if (!opts.source) {
    console.error("Error: --source is required (autograde | levelup | consumer | all)");
    program.help();
    process.exit(1);
  }

  const dryRun = opts.dryRun;
  if (dryRun) {
    console.log("=== DRY RUN MODE -- no data will be written ===\n");
  }

  const sources = opts.source === "all" ? ["autograde", "levelup", "consumer"] : [opts.source];

  for (const source of sources) {
    const logger = new MigrationLogger(runId, `users-${source}`);

    switch (source) {
      case "autograde": {
        if (!opts.clientId) {
          console.error("Error: --client-id is required for AutoGrade user migration");
          process.exit(1);
        }
        console.log(`\n=== Migrating AutoGrade Users: ${opts.clientId} ===\n`);
        console.log("Source: /clients/{clientId}/students|teachers|parents");
        console.log("Target: /users/{uid} + /userMemberships/{uid}_{tenantId}\n");

        await migrateAutogradeUsers({
          clientId: opts.clientId,
          dryRun,
          logger,
        });
        break;
      }

      case "levelup": {
        if (!opts.orgId) {
          console.error("Error: --org-id is required for LevelUp user migration");
          process.exit(1);
        }
        console.log(`\n=== Migrating LevelUp Users: ${opts.orgId} ===\n`);
        console.log("Source: /userOrgs + /userRoles + /users");
        console.log("Target: /users/{uid} + /userMemberships/{uid}_{tenantId}\n");

        await migrateLevelUpUsers({
          orgId: opts.orgId,
          dryRun,
          logger,
        });
        break;
      }

      case "consumer": {
        console.log("\n=== Migrating Consumer (B2C) Users ===\n");
        console.log("Source: /users (without userOrg membership)");
        console.log("Target: /users/{uid} with consumerProfile\n");

        await migrateConsumerUsers({
          dryRun,
          logger,
        });
        break;
      }

      default:
        console.error(`Unknown source: ${source}`);
        console.error("Valid sources: autograde, levelup, consumer, all");
        process.exit(1);
    }

    logger.printSummary();
  }

  // Auto-verify at end
  if (sources.length > 0) {
    console.log("\nUser migration complete. Run with --verify to check integrity.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
