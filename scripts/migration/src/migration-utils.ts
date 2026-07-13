/**
 * Shared migration utilities: batch writer, progress logger, dry-run mode, rollback support.
 *
 * Re-exports all utility modules and provides a unified MigrationContext
 * that wires config, logging, batch processing, and verification together.
 */

import { initFirebase, getFirestore, getAuth, serverTimestamp, toTimestamp } from "./config.js";
import { MigrationLogger, generateRunId } from "./utils/logger.js";
import {
  processBatch,
  readAllDocs,
  docExists,
  type BatchProcessorOptions,
} from "./utils/batch-processor.js";
import {
  countDocs,
  verifyCollectionCounts,
  spotCheckDocument,
  printVerificationResults,
  type VerificationResult,
} from "./utils/verification.js";

// ── Re-exports ──────────────────────────────────────
export {
  // Config
  initFirebase,
  getFirestore,
  getAuth,
  serverTimestamp,
  toTimestamp,

  // Logger
  MigrationLogger,
  generateRunId,

  // Batch processing
  processBatch,
  readAllDocs,
  docExists,
  type BatchProcessorOptions,

  // Verification
  countDocs,
  verifyCollectionCounts,
  spotCheckDocument,
  printVerificationResults,
  type VerificationResult,
};

// ── Unified MigrationContext ────────────────────────

export interface MigrationOptions {
  /** Source system identifier: 'autograde' | 'levelup' */
  source: "autograde" | "levelup";
  /** Client or org ID being migrated */
  clientId: string;
  /** If true, logs operations without writing to Firestore */
  dryRun: boolean;
  /** Batch size override (default: 500) */
  batchSize?: number;
  /** Rate limit delay between batches in ms (default: 1000) */
  delayMs?: number;
}

/**
 * MigrationContext bundles all dependencies needed for a migration run.
 * Use `createMigrationContext()` to create one.
 */
export interface MigrationContext {
  runId: string;
  source: "autograde" | "levelup";
  clientId: string;
  tenantId: string;
  dryRun: boolean;
  logger: MigrationLogger;
  db: FirebaseFirestore.Firestore;
  batchSize: number;
  delayMs: number;
}

/**
 * Create a MigrationContext from options.
 * Initializes Firebase, creates a logger, and returns all dependencies.
 */
export function createMigrationContext(options: MigrationOptions): MigrationContext {
  initFirebase();
  const runId = generateRunId();
  const logger = new MigrationLogger(runId, `${options.source}-migration`);
  const db = getFirestore();

  if (options.dryRun) {
    logger.info("=== DRY RUN MODE -- no data will be written ===");
  }

  return {
    runId,
    source: options.source,
    clientId: options.clientId,
    tenantId: options.clientId, // 1:1 mapping
    dryRun: options.dryRun,
    logger,
    db,
    batchSize: options.batchSize ?? 500,
    delayMs: options.delayMs ?? 1000,
  };
}

// ── Rollback helpers ────────────────────────────────

const ROLLBACK_BATCH_SIZE = 500;

/**
 * Delete all documents in a collection that have a specific _migratedFrom marker.
 * Used for safe rollback -- only removes documents created by the migration.
 */
export async function deleteMarkedDocs(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  migratedFrom: "autograde" | "levelup",
  logger: MigrationLogger,
  dryRun: boolean
): Promise<number> {
  let deleted = 0;
  const query = db.collection(collectionPath).where("_migratedFrom", "==", migratedFrom);

  while (true) {
    const snapshot = await query.limit(ROLLBACK_BATCH_SIZE).get();
    if (snapshot.empty) break;

    if (dryRun) {
      logger.info(`[DRY RUN] Would delete ${snapshot.size} docs from ${collectionPath}`);
      deleted += snapshot.size;
      break; // In dry run, just report the first batch
    }

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;
    logger.info(`Deleted ${snapshot.size} docs from ${collectionPath} (total: ${deleted})`);

    // Rate limit
    await sleep(1000);
  }

  return deleted;
}

/**
 * Delete migration-sourced memberships for a tenant.
 */
export async function deleteMigrationMemberships(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  logger: MigrationLogger,
  dryRun: boolean
): Promise<number> {
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", tenantId)
    .where("joinSource", "==", "migration")
    .get();

  if (!dryRun && membershipsSnap.size > 0) {
    // Process in batches of 500
    for (let i = 0; i < membershipsSnap.docs.length; i += ROLLBACK_BATCH_SIZE) {
      const batch = db.batch();
      const chunk = membershipsSnap.docs.slice(i, i + ROLLBACK_BATCH_SIZE);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  }

  logger.info(
    `${dryRun ? "[DRY RUN] Would delete" : "Deleted"} ${membershipsSnap.size} migration memberships for tenant ${tenantId}`
  );
  return membershipsSnap.size;
}

// ── Internal helpers ────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
