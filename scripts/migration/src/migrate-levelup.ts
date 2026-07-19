#!/usr/bin/env node
/**
 * Migrate legacy LevelUp data (courses -> spaces, storyPoints, items, progress)
 * to new tenant-scoped schema.
 *
 * Orchestrates all LevelUp migration steps in dependency order:
 *   1. Orgs → Tenants (+ tenantCodes)
 *   2. Users → /users + /userMemberships
 *   3. Courses → Spaces (+ storyPoints subcollection)
 *   4. Items → /tenants/{tId}/spaces/{sId}/items
 *   5. Agents → /tenants/{tId}/spaces/{sId}/agents
 *   6. Progress → /tenants/{tId}/spaceProgress
 *   7. Chat Sessions → /tenants/{tId}/chatSessions
 *   8. Consumer Users (B2C users without org membership)
 *
 * Legacy source structure:
 *   /orgs/{orgId}
 *   /userOrgs/{userOrgId}           — userId + orgId membership
 *   /userRoles/{userId}             — isSuperAdmin, orgAdmin, courseAdmin
 *   /users/{uid}                    — legacy user profile
 *   /courses/{courseId}             — learning courses
 *   /storyPoints/{storyPointId}     — global collection, linked by courseId
 *   /items/{itemId}                 — global collection, linked by courseId
 *   /agents/{agentId}               — global or /courses/{cId}/agents subcollection
 *   /chatSessions/{sessionId}       — global, linked by courseId
 *   /userStoryPointProgress/{id}    — userId_storyPointId compound key
 *
 * New target structure:
 *   /tenants/{tenantId}
 *   /tenantCodes/{code}
 *   /users/{uid}                    — unified user doc
 *   /userMemberships/{uid}_{tenantId}
 *   /tenants/{tenantId}/spaces/{spaceId}
 *   /tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}
 *   /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}
 *   /tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}
 *   /tenants/{tenantId}/chatSessions/{sessionId}
 *   /tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
 *
 * Usage:
 *   # Dry run for one org
 *   npx tsx src/migrate-levelup.ts --org-id orgXyz --dry-run
 *
 *   # Full migration
 *   npx tsx src/migrate-levelup.ts --org-id orgXyz
 *
 *   # Migrate only spaces
 *   npx tsx src/migrate-levelup.ts --org-id orgXyz --type spaces
 *
 *   # Migrate consumer users (no org required)
 *   npx tsx src/migrate-levelup.ts --type consumer-users
 *
 *   # Verify migration
 *   npx tsx src/migrate-levelup.ts --org-id orgXyz --verify
 *
 *   # Rollback migration
 *   npx tsx src/migrate-levelup.ts --org-id orgXyz --rollback --dry-run
 */

import { Command } from "commander";
import { createMigrationContext, type MigrationContext } from "./migration-utils.js";
import { MigrationLogger, generateRunId } from "./utils/logger.js";
import { initFirebase } from "./config.js";

// Migration steps
import { migrateOrgsToTenants } from "./levelup/migrate-orgs-to-tenants.js";
import { migrateLevelUpUsers } from "./levelup/migrate-users.js";
import { migrateCoursesToSpaces } from "./levelup/migrate-courses-to-spaces.js";
import { migrateItems } from "./levelup/migrate-items.js";
import { migrateAgents } from "./levelup/migrate-agents.js";
import { migrateProgress } from "./levelup/migrate-progress.js";
import { migrateChatSessions } from "./levelup/migrate-chat-sessions.js";
import { migrateConsumerUsers } from "./levelup/migrate-consumer-users.js";

// Verification & Rollback
import { verifyLevelUp } from "./verify/verify-levelup.js";
import { rollbackLevelUp } from "./rollback/rollback-levelup.js";

// Post-migration
import { recomputeTenantStats } from "./post-migration/recompute-tenant-stats.js";

// ── Migration step registry ────────────────────────

type MigrationStep = {
  name: string;
  description: string;
  requiresOrgId: boolean;
  run: (ctx: MigrationContext) => Promise<void>;
};

const MIGRATION_STEPS: MigrationStep[] = [
  {
    name: "tenants",
    description: "Migrate /orgs/{orgId} → /tenants/{tenantId} + tenantCodes",
    requiresOrgId: false, // can migrate all orgs if no orgId given
    run: async (ctx) => {
      await migrateOrgsToTenants({
        orgId: ctx.clientId || undefined,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "users",
    description: "Migrate /userOrgs + /userRoles → /users + /userMemberships",
    requiresOrgId: true,
    run: async (ctx) => {
      await migrateLevelUpUsers({
        orgId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "spaces",
    description: "Migrate /courses → /tenants/{tId}/spaces + storyPoints",
    requiresOrgId: true,
    run: async (ctx) => {
      await migrateCoursesToSpaces({
        orgId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "items",
    description: "Migrate /items → /tenants/{tId}/spaces/{sId}/items",
    requiresOrgId: true,
    run: async (ctx) => {
      await migrateItems({
        orgId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "agents",
    description: "Migrate agents → /tenants/{tId}/spaces/{sId}/agents",
    requiresOrgId: true,
    run: async (ctx) => {
      await migrateAgents({
        orgId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "progress",
    description: "Migrate /userStoryPointProgress → /tenants/{tId}/spaceProgress",
    requiresOrgId: true,
    run: async (ctx) => {
      await migrateProgress({
        orgId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "chat-sessions",
    description: "Migrate /chatSessions → /tenants/{tId}/chatSessions",
    requiresOrgId: true,
    run: async (ctx) => {
      await migrateChatSessions({
        orgId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "consumer-users",
    description: "Update B2C users with consumerProfile (no org membership needed)",
    requiresOrgId: false,
    run: async (ctx) => {
      await migrateConsumerUsers({
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
];

// ── CLI ─────────────────────────────────────────────

const program = new Command();

program
  .name("migrate-levelup")
  .description("Migrate legacy LevelUp data to unified tenant structure")
  .version("1.0.0")
  .option("--org-id <id>", "LevelUp organization ID to migrate")
  .option(
    "--type <type>",
    "Migrate specific type: tenants | users | spaces | items | agents | progress | chat-sessions | consumer-users"
  )
  .option("--dry-run", "Log what would be migrated without writing", false)
  .option("--verify", "Run verification after migration", false)
  .option("--rollback", "Roll back migration for this org", false)
  .option("--recompute-stats", "Recompute tenant stats after migration", false);

program.parse(process.argv);

const opts = program.opts<{
  orgId?: string;
  type?: string;
  dryRun: boolean;
  verify: boolean;
  rollback: boolean;
  recomputeStats: boolean;
}>();

async function main(): Promise<void> {
  initFirebase();
  const runId = generateRunId();

  // Handle rollback
  if (opts.rollback) {
    if (!opts.orgId) {
      console.error("Error: --org-id is required for rollback");
      process.exit(1);
    }
    const logger = new MigrationLogger(runId, "levelup-rollback");
    console.log(`\n=== Rolling back LevelUp migration for org ${opts.orgId} ===\n`);
    await rollbackLevelUp({
      orgId: opts.orgId,
      dryRun: opts.dryRun,
      logger,
    });
    return;
  }

  // Handle verification only
  if (opts.verify && !opts.type) {
    if (!opts.orgId) {
      console.error("Error: --org-id is required for verification");
      process.exit(1);
    }
    const logger = new MigrationLogger(runId, "levelup-verify");
    console.log(`\n=== Verifying LevelUp migration for org ${opts.orgId} ===\n`);
    const passed = await verifyLevelUp({ orgId: opts.orgId, logger });
    process.exit(passed ? 0 : 1);
  }

  // Determine which steps to run
  const stepsToRun = opts.type
    ? MIGRATION_STEPS.filter((s) => s.name === opts.type)
    : MIGRATION_STEPS;

  if (stepsToRun.length === 0) {
    console.error(`Unknown migration type: ${opts.type}`);
    console.error(`Valid types: ${MIGRATION_STEPS.map((s) => s.name).join(", ")}`);
    process.exit(1);
  }

  // Validate org-id requirement
  const needsOrgId = stepsToRun.some((s) => s.requiresOrgId);
  if (needsOrgId && !opts.orgId) {
    console.error("Error: --org-id is required for the selected migration type(s)");
    process.exit(1);
  }

  // Create migration context
  const ctx = createMigrationContext({
    source: "levelup",
    clientId: opts.orgId || "",
    dryRun: opts.dryRun,
  });

  // Run migration steps
  console.log(`\n=== LevelUp Migration${opts.orgId ? `: ${opts.orgId}` : ""} ===`);
  console.log(`Steps: ${stepsToRun.map((s) => s.name).join(" → ")}`);
  console.log(`Dry run: ${ctx.dryRun}\n`);

  for (const step of stepsToRun) {
    console.log(`\n--- Step: ${step.name} ---`);
    console.log(`    ${step.description}\n`);

    try {
      await step.run(ctx);
    } catch (err) {
      ctx.logger.error(`Step "${step.name}" failed`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      console.error(`\nMigration failed at step "${step.name}". Subsequent steps skipped.`);
      console.error("Run with --verify to check partial migration state.");
      console.error("Run with --rollback to undo the migration.");
      process.exit(1);
    }
  }

  // Post-migration stats
  if (opts.recomputeStats && opts.orgId) {
    console.log("\n--- Post-migration: Recomputing tenant stats ---\n");
    await recomputeTenantStats({
      tenantId: opts.orgId,
      dryRun: opts.dryRun,
      logger: ctx.logger,
    });
  }

  // Auto-verify if requested
  if (opts.verify && opts.orgId) {
    console.log("\n--- Running verification ---\n");
    const logger = new MigrationLogger(runId, "levelup-verify");
    const passed = await verifyLevelUp({ orgId: opts.orgId, logger });
    if (!passed) {
      console.error("\nVerification FAILED. Review the results above.");
      process.exit(1);
    }
  }

  ctx.logger.printSummary();
  console.log("\nLevelUp migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
