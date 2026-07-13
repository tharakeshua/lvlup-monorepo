#!/usr/bin/env node
/**
 * Migrate legacy AutoGrade data (exams, submissions, questions) to new tenant-scoped collections.
 *
 * Orchestrates all AutoGrade migration steps in dependency order:
 *   1. Clients → Tenants
 *   2. Users → /users + /userMemberships
 *   3. Classes → /tenants/{tId}/classes
 *   4. Exams → /tenants/{tId}/exams + /questions subcollection
 *   5. Submissions → /tenants/{tId}/submissions + /questionSubmissions subcollection
 *   6. Evaluation Settings → /tenants/{tId}/evaluationSettings
 *
 * Legacy source structure:
 *   /clients/{clientId}
 *   /clients/{clientId}/students/{studentId}
 *   /clients/{clientId}/teachers/{teacherId}
 *   /clients/{clientId}/parents/{parentId}
 *   /clients/{clientId}/classes/{classId}
 *   /clients/{clientId}/exams/{examId}
 *   /clients/{clientId}/exams/{examId}/questions/{questionId}
 *   /clients/{clientId}/submissions/{submissionId}
 *   /clients/{clientId}/submissions/{submissionId}/questionSubmissions/{qsId}
 *   /clients/{clientId}/evaluationSettings/{settingsId}
 *
 * New target structure:
 *   /tenants/{tenantId}
 *   /tenantCodes/{code}
 *   /users/{uid}
 *   /userMemberships/{uid}_{tenantId}
 *   /tenants/{tenantId}/students/{studentId}
 *   /tenants/{tenantId}/teachers/{teacherId}
 *   /tenants/{tenantId}/parents/{parentId} (new -- parents not in legacy autograde)
 *   /tenants/{tenantId}/classes/{classId}
 *   /tenants/{tenantId}/exams/{examId}
 *   /tenants/{tenantId}/exams/{examId}/questions/{questionId}
 *   /tenants/{tenantId}/submissions/{submissionId}
 *   /tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{qsId}
 *   /tenants/{tenantId}/evaluationSettings/{settingsId}
 *
 * Usage:
 *   # Dry run for one client
 *   npx tsx src/migrate-autograde.ts --client-id abc123 --dry-run
 *
 *   # Full migration for one client
 *   npx tsx src/migrate-autograde.ts --client-id abc123
 *
 *   # Migrate only exams
 *   npx tsx src/migrate-autograde.ts --client-id abc123 --type exams
 *
 *   # Verify migration
 *   npx tsx src/migrate-autograde.ts --client-id abc123 --verify
 *
 *   # Rollback migration
 *   npx tsx src/migrate-autograde.ts --client-id abc123 --rollback --dry-run
 */

import { Command } from "commander";
import { createMigrationContext, type MigrationContext } from "./migration-utils.js";
import { MigrationLogger, generateRunId } from "./utils/logger.js";
import { initFirebase } from "./config.js";

// Migration steps
import { migrateClientsToTenants } from "./autograde/migrate-clients-to-tenants.js";
import { migrateAutogradeUsers } from "./autograde/migrate-users.js";
import { migrateClasses } from "./autograde/migrate-classes.js";
import { migrateExams } from "./autograde/migrate-exams.js";
import { migrateSubmissions } from "./autograde/migrate-submissions.js";
import { migrateEvaluationSettings } from "./autograde/migrate-evaluation-settings.js";

// Verification & Rollback
import { verifyAutograde } from "./verify/verify-autograde.js";
import { rollbackAutograde } from "./rollback/rollback-autograde.js";

// Post-migration
import { recomputeTenantStats } from "./post-migration/recompute-tenant-stats.js";

// ── Migration step registry ────────────────────────

type MigrationStep = {
  name: string;
  description: string;
  run: (ctx: MigrationContext) => Promise<void>;
};

const MIGRATION_STEPS: MigrationStep[] = [
  {
    name: "tenants",
    description: "Migrate /clients/{clientId} → /tenants/{tenantId}",
    run: async (ctx) => {
      await migrateClientsToTenants({
        clientId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "users",
    description: "Migrate students/teachers/parents → /users + /userMemberships",
    run: async (ctx) => {
      await migrateAutogradeUsers({
        clientId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "classes",
    description: "Migrate classes + create tenant student/teacher docs",
    run: async (ctx) => {
      await migrateClasses({
        clientId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "exams",
    description: "Migrate exams + questions subcollection",
    run: async (ctx) => {
      await migrateExams({
        clientId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "submissions",
    description: "Migrate submissions + questionSubmissions subcollection",
    run: async (ctx) => {
      await migrateSubmissions({
        clientId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
  {
    name: "evaluation-settings",
    description: "Migrate evaluation settings",
    run: async (ctx) => {
      await migrateEvaluationSettings({
        clientId: ctx.clientId,
        dryRun: ctx.dryRun,
        logger: ctx.logger,
      });
    },
  },
];

// ── CLI ─────────────────────────────────────────────

const program = new Command();

program
  .name("migrate-autograde")
  .description("Migrate legacy AutoGrade data to unified tenant structure")
  .version("1.0.0")
  .requiredOption("--client-id <id>", "AutoGrade client ID to migrate")
  .option(
    "--type <type>",
    "Migrate specific type: tenants | users | classes | exams | submissions | evaluation-settings"
  )
  .option("--dry-run", "Log what would be migrated without writing", false)
  .option("--verify", "Run verification after migration", false)
  .option("--rollback", "Roll back migration for this client", false)
  .option("--recompute-stats", "Recompute tenant stats after migration", false);

program.parse(process.argv);

const opts = program.opts<{
  clientId: string;
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
    const logger = new MigrationLogger(runId, "autograde-rollback");
    console.log(`\n=== Rolling back AutoGrade migration for client ${opts.clientId} ===\n`);
    await rollbackAutograde({
      clientId: opts.clientId,
      dryRun: opts.dryRun,
      logger,
    });
    return;
  }

  // Handle verification only
  if (opts.verify && !opts.type) {
    const logger = new MigrationLogger(runId, "autograde-verify");
    console.log(`\n=== Verifying AutoGrade migration for client ${opts.clientId} ===\n`);
    const passed = await verifyAutograde({ clientId: opts.clientId, logger });
    process.exit(passed ? 0 : 1);
  }

  // Create migration context
  const ctx = createMigrationContext({
    source: "autograde",
    clientId: opts.clientId,
    dryRun: opts.dryRun,
  });

  // Determine which steps to run
  const stepsToRun = opts.type
    ? MIGRATION_STEPS.filter((s) => s.name === opts.type)
    : MIGRATION_STEPS;

  if (stepsToRun.length === 0) {
    console.error(`Unknown migration type: ${opts.type}`);
    console.error(`Valid types: ${MIGRATION_STEPS.map((s) => s.name).join(", ")}`);
    process.exit(1);
  }

  // Run migration steps
  console.log(`\n=== AutoGrade Migration: ${opts.clientId} ===`);
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
  if (opts.recomputeStats) {
    console.log("\n--- Post-migration: Recomputing tenant stats ---\n");
    await recomputeTenantStats({
      tenantId: opts.clientId,
      dryRun: opts.dryRun,
      logger: ctx.logger,
    });
  }

  // Auto-verify if requested
  if (opts.verify) {
    console.log("\n--- Running verification ---\n");
    const logger = new MigrationLogger(runId, "autograde-verify");
    const passed = await verifyAutograde({ clientId: opts.clientId, logger });
    if (!passed) {
      console.error("\nVerification FAILED. Review the results above.");
      process.exit(1);
    }
  }

  ctx.logger.printSummary();
  console.log("\nAutoGrade migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
