/**
 * Migrate AutoGrade evaluation settings:
 *   /clients/{cId}/evaluationSettings/{esId} → /tenants/{tId}/evaluationSettings/{esId}
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyEvaluationSettings {
  _docId: string;
  id: string;
  clientId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic?: boolean;
  enabledDimensions: Array<{
    id: string;
    name: string;
    description: string;
    icon?: string;
    priority: string;
    promptGuidance: string;
    enabled: boolean;
    isDefault: boolean;
    isCustom: boolean;
    expectedFeedbackCount?: number;
  }>;
  displaySettings: {
    showStrengths: boolean;
    showKeyTakeaway: boolean;
    prioritizeByImportance: boolean;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  createdBy?: string;
}

export async function migrateEvaluationSettings(options: {
  clientId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = clientId;

  logger.info(`Migrating evaluation settings for client ${clientId}`);

  const settings = await readAllDocs<LegacyEvaluationSettings>(
    db.collection(`clients/${clientId}/evaluationSettings`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${settings.length} evaluation settings`);

  await processBatch(
    settings,
    async (setting, batch, db) => {
      const settingsId = setting._docId;
      const targetPath = `tenants/${tenantId}/evaluationSettings/${settingsId}`;

      if (await docExists(db, targetPath)) {
        logger.debug(`EvaluationSettings ${settingsId} already migrated, skipping`);
        return { action: "skipped", id: settingsId };
      }

      const newSettings = {
        id: settingsId,
        tenantId,
        name: setting.name,
        description: setting.description || null,
        isDefault: setting.isDefault,
        isPublic: setting.isPublic || false,
        enabledDimensions: setting.enabledDimensions || [],
        displaySettings: setting.displaySettings || {
          showStrengths: true,
          showKeyTakeaway: true,
          prioritizeByImportance: true,
        },
        createdBy: setting.createdBy || null,
        createdAt: setting.createdAt || admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "autograde",
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would migrate evaluation settings: ${settingsId} (${setting.name})`);
        return { action: "created", id: settingsId };
      }

      batch.set(db.doc(targetPath), newSettings);
      return { action: "created", id: settingsId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
