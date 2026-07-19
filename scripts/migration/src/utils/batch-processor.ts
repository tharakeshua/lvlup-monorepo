/**
 * Batch processor for Firestore migrations.
 * Processes documents in batches of 500 with rate limiting.
 */

import * as admin from "firebase-admin";
import { MigrationLogger } from "./logger.js";

const BATCH_SIZE = 500;
const BATCH_DELAY_MS = 1000;

export interface BatchProcessorOptions {
  dryRun: boolean;
  logger: MigrationLogger;
  batchSize?: number;
  delayMs?: number;
}

/**
 * Process a collection of documents in Firestore batches.
 * @param items - Array of items to process
 * @param processor - Function that adds write operations to the batch for each item
 * @param options - Batch processing options
 */
export async function processBatch<T>(
  items: T[],
  processor: (
    item: T,
    batch: admin.firestore.WriteBatch,
    db: admin.firestore.Firestore
  ) => Promise<{ action: "created" | "skipped" | "error"; id?: string }>,
  options: BatchProcessorOptions
): Promise<void> {
  const { dryRun, logger, batchSize = BATCH_SIZE, delayMs = BATCH_DELAY_MS } = options;
  const db = admin.firestore();
  const totalBatches = Math.ceil(items.length / batchSize);

  logger.info(
    `Processing ${items.length} items in ${totalBatches} batches (batchSize=${batchSize})`
  );
  logger.incrementTotal(items.length);

  for (let i = 0; i < items.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batchItems = items.slice(i, i + batchSize);
    const batch = db.batch();
    let batchCreated = 0;
    let batchSkipped = 0;
    let batchErrors = 0;

    for (const item of batchItems) {
      try {
        const result = await processor(item, batch, db);
        if (result.action === "created") {
          batchCreated++;
        } else if (result.action === "skipped") {
          batchSkipped++;
        } else {
          batchErrors++;
        }
      } catch (err) {
        batchErrors++;
        logger.error(`Error processing item`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!dryRun && batchCreated > 0) {
      try {
        await batch.commit();
      } catch (err) {
        logger.error(`Batch ${batchNum} commit failed`, {
          error: err instanceof Error ? err.message : String(err),
        });
        batchErrors += batchCreated;
        batchCreated = 0;
      }
    }

    logger.incrementCreated(batchCreated);
    logger.incrementSkipped(batchSkipped);
    logger.incrementErrors(batchErrors);

    logger.info(
      `Batch ${batchNum}/${totalBatches}: created=${batchCreated}, skipped=${batchSkipped}, errors=${batchErrors}`
    );

    // Rate limiting between batches
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
}

/**
 * Read all documents from a collection (or subcollection) with pagination.
 */
export async function readAllDocs<T>(
  collectionRef: admin.firestore.CollectionReference | admin.firestore.Query
): Promise<(T & { _docId: string })[]> {
  const results: (T & { _docId: string })[] = [];
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
  const pageSize = 1000;

  while (true) {
    let query = collectionRef.limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      results.push({ ...(doc.data() as T), _docId: doc.id });
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < pageSize) break;
  }

  return results;
}

/**
 * Check if a document already exists (idempotency check).
 */
export async function docExists(db: admin.firestore.Firestore, path: string): Promise<boolean> {
  const snap = await db.doc(path).get();
  return snap.exists;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
