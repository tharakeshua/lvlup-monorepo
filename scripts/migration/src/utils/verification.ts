/**
 * Verification utilities for migration scripts.
 * Compare source vs target counts and spot-check data integrity.
 */

import * as admin from "firebase-admin";
import { MigrationLogger } from "./logger.js";

export interface VerificationResult {
  collection: string;
  sourceCount: number;
  targetCount: number;
  match: boolean;
  spotCheckPassed: boolean;
  errors: string[];
}

/**
 * Count documents in a collection or subcollection.
 */
export async function countDocs(
  ref: admin.firestore.CollectionReference | admin.firestore.Query
): Promise<number> {
  const snapshot = await ref.count().get();
  return snapshot.data().count;
}

/**
 * Compare source and target collection counts.
 */
export async function verifyCollectionCounts(
  db: admin.firestore.Firestore,
  sourcePath: string,
  targetPath: string,
  label: string,
  logger: MigrationLogger
): Promise<VerificationResult> {
  const sourceCount = await countDocs(db.collection(sourcePath));
  const targetCount = await countDocs(db.collection(targetPath));
  const match = sourceCount === targetCount;

  const result: VerificationResult = {
    collection: label,
    sourceCount,
    targetCount,
    match,
    spotCheckPassed: true,
    errors: [],
  };

  if (!match) {
    result.errors.push(
      `Count mismatch: source=${sourceCount}, target=${targetCount} (diff=${sourceCount - targetCount})`
    );
  }

  logger.info(
    `Verification [${label}]: source=${sourceCount}, target=${targetCount}, match=${match}`
  );
  return result;
}

/**
 * Verify a single document was migrated correctly by checking key fields.
 */
export async function spotCheckDocument(
  db: admin.firestore.Firestore,
  sourcePath: string,
  targetPath: string,
  fieldMap: Record<string, string>,
  logger: MigrationLogger
): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];
  const sourceSnap = await db.doc(sourcePath).get();
  const targetSnap = await db.doc(targetPath).get();

  if (!sourceSnap.exists) {
    errors.push(`Source doc does not exist: ${sourcePath}`);
    return { passed: false, errors };
  }
  if (!targetSnap.exists) {
    errors.push(`Target doc does not exist: ${targetPath}`);
    return { passed: false, errors };
  }

  const sourceData = sourceSnap.data()!;
  const targetData = targetSnap.data()!;

  for (const [sourceField, targetField] of Object.entries(fieldMap)) {
    const sourceVal = getNestedField(sourceData, sourceField);
    const targetVal = getNestedField(targetData, targetField);

    if (JSON.stringify(sourceVal) !== JSON.stringify(targetVal)) {
      errors.push(
        `Field mismatch: source.${sourceField}=${JSON.stringify(sourceVal)} vs target.${targetField}=${JSON.stringify(targetVal)}`
      );
    }
  }

  const passed = errors.length === 0;
  if (!passed) {
    logger.warn(`Spot check failed for ${sourcePath} → ${targetPath}`, { errors });
  }
  return { passed, errors };
}

function getNestedField(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Print verification results summary.
 */
export function printVerificationResults(results: VerificationResult[]): void {
  console.log("\n========== Verification Results ==========");
  let allPassed = true;

  for (const r of results) {
    const status = r.match && r.spotCheckPassed ? "PASS" : "FAIL";
    if (status === "FAIL") allPassed = false;
    console.log(`[${status}] ${r.collection}: source=${r.sourceCount}, target=${r.targetCount}`);
    for (const err of r.errors) {
      console.log(`       ${err}`);
    }
  }

  console.log(`\nOverall: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);
  console.log("==========================================\n");
}
