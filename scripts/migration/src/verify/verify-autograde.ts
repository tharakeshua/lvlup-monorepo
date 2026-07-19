/**
 * Verify AutoGrade migration: compare source vs target counts and spot-check data.
 */

import { getFirestore } from "../config.js";
import {
  verifyCollectionCounts,
  spotCheckDocument,
  printVerificationResults,
  type VerificationResult,
} from "../utils/verification.js";
import { MigrationLogger } from "../utils/logger.js";

export async function verifyAutograde(options: {
  clientId: string;
  logger: MigrationLogger;
}): Promise<boolean> {
  const { clientId, logger } = options;
  const db = getFirestore();
  const tenantId = clientId;
  const results: VerificationResult[] = [];

  logger.info(`Verifying AutoGrade migration for client ${clientId}`);

  // 1. Verify tenant exists
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    logger.error(`Tenant ${tenantId} does not exist!`);
    return false;
  }
  logger.info(`Tenant ${tenantId} exists: ${tenantSnap.data()?.name}`);

  // 2. Verify classes
  results.push(
    await verifyCollectionCounts(
      db,
      `clients/${clientId}/classes`,
      `tenants/${tenantId}/classes`,
      "Classes",
      logger
    )
  );

  // 3. Verify exams
  results.push(
    await verifyCollectionCounts(
      db,
      `clients/${clientId}/exams`,
      `tenants/${tenantId}/exams`,
      "Exams",
      logger
    )
  );

  // 4. Verify submissions
  results.push(
    await verifyCollectionCounts(
      db,
      `clients/${clientId}/submissions`,
      `tenants/${tenantId}/submissions`,
      "Submissions",
      logger
    )
  );

  // 5. Verify evaluation settings
  results.push(
    await verifyCollectionCounts(
      db,
      `clients/${clientId}/evaluationSettings`,
      `tenants/${tenantId}/evaluationSettings`,
      "EvaluationSettings",
      logger
    )
  );

  // 6. Verify students
  results.push(
    await verifyCollectionCounts(
      db,
      `clients/${clientId}/students`,
      `tenants/${tenantId}/students`,
      "Students",
      logger
    )
  );

  // 7. Verify teachers
  results.push(
    await verifyCollectionCounts(
      db,
      `clients/${clientId}/teachers`,
      `tenants/${tenantId}/teachers`,
      "Teachers",
      logger
    )
  );

  // 8. Spot-check: pick the first exam and verify key fields
  const examsSnap = await db.collection(`clients/${clientId}/exams`).limit(1).get();
  if (!examsSnap.empty) {
    const examId = examsSnap.docs[0].id;
    const spotCheck = await spotCheckDocument(
      db,
      `clients/${clientId}/exams/${examId}`,
      `tenants/${tenantId}/exams/${examId}`,
      { title: "title", totalMarks: "totalMarks", subject: "subject" },
      logger
    );
    if (!spotCheck.passed) {
      const examResult = results.find((r) => r.collection === "Exams");
      if (examResult) {
        examResult.spotCheckPassed = false;
        examResult.errors.push(...spotCheck.errors);
      }
    }
  }

  printVerificationResults(results);

  const allPassed = results.every((r) => r.match && r.spotCheckPassed);
  return allPassed;
}
