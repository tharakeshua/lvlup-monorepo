/**
 * Migrate AutoGrade /clients/{clientId} → /tenants/{tenantId}
 *
 * Maps Client documents to the new Tenant schema, preserving the original
 * clientId as tenantId for traceability.
 */

import * as admin from "firebase-admin";
import { getFirestore, toTimestamp } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyClient {
  _docId: string;
  id: string;
  name: string;
  schoolCode: string;
  email: string;
  adminUid: string;
  geminiApiKey?: string;
  status: "active" | "suspended" | "trial";
  subscriptionPlan: "trial" | "basic" | "premium";
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  metadata?: {
    address?: string;
    phone?: string;
    contactPerson?: string;
  };
}

export async function migrateClientsToTenants(options: {
  clientId?: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();

  logger.info("Starting AutoGrade clients → tenants migration");

  // Read source clients
  let query: admin.firestore.Query = db.collection("clients");
  if (clientId) {
    query = query.where(admin.firestore.FieldPath.documentId(), "==", clientId);
  }

  const clients = await readAllDocs<LegacyClient>(query as admin.firestore.CollectionReference);
  logger.info(`Found ${clients.length} client(s) to migrate`);

  await processBatch(
    clients,
    async (client, batch, db) => {
      const tenantId = client._docId;
      const tenantPath = `tenants/${tenantId}`;

      // Idempotency: skip if already migrated
      if (await docExists(db, tenantPath)) {
        logger.debug(`Tenant ${tenantId} already exists, skipping`);
        return { action: "skipped", id: tenantId };
      }

      const tenant = {
        id: tenantId,
        name: client.name,
        slug: client.schoolCode.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        tenantCode: client.schoolCode,
        ownerUid: client.adminUid,
        contactEmail: client.email,
        contactPhone: client.metadata?.phone || null,
        contactPerson: client.metadata?.contactPerson || null,
        logoUrl: null,
        bannerUrl: null,
        website: null,
        address: client.metadata?.address ? { street: client.metadata.address } : null,
        status: client.status,
        subscription: {
          plan: client.subscriptionPlan,
          expiresAt: null,
          maxStudents: null,
          maxTeachers: null,
          maxSpaces: null,
          maxExamsPerMonth: null,
        },
        features: {
          autoGradeEnabled: true,
          levelUpEnabled: false,
          scannerAppEnabled: true,
          aiChatEnabled: false,
          aiGradingEnabled: true,
          analyticsEnabled: true,
          parentPortalEnabled: true,
          bulkImportEnabled: true,
          apiAccessEnabled: false,
        },
        settings: {
          // NOTE: Raw geminiApiKey must be moved to Secret Manager post-migration.
          // Store a reference path; actual secret rotation is a separate step.
          geminiKeyRef: client.geminiApiKey
            ? `projects/${process.env.GCP_PROJECT || "levelup-prod"}/secrets/tenant-${tenantId}-gemini`
            : null,
          geminiKeySet: !!client.geminiApiKey,
          defaultEvaluationSettingsId: "default",
          defaultAiModel: null,
          timezone: null,
          locale: null,
          gradingPolicy: null,
        },
        stats: {
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSpaces: 0,
          totalExams: 0,
        },
        createdAt: client.createdAt || admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "autograde",
        _migrationSourceId: client._docId,
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would create tenant: ${tenantId} (${client.name})`);
        return { action: "created", id: tenantId };
      }

      batch.set(db.doc(tenantPath), tenant);

      // Also create the tenantCode index entry
      const codePath = `tenantCodes/${client.schoolCode}`;
      if (!(await docExists(db, codePath))) {
        batch.set(db.doc(codePath), {
          tenantId,
          createdAt: admin.firestore.Timestamp.now(),
        });
      }

      return { action: "created", id: tenantId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
