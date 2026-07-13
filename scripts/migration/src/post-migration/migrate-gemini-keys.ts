/**
 * Post-migration: Move Gemini API keys from Firestore to Secret Manager.
 *
 * Legacy AutoGrade stored geminiApiKey as an encrypted string in the client doc.
 * The unified platform stores keys in Google Cloud Secret Manager with only a
 * reference path in Firestore.
 *
 * This script:
 * 1. Reads the raw geminiApiKey from legacy /clients/{clientId}
 * 2. Creates a secret in Secret Manager: tenant-{tenantId}-gemini
 * 3. Updates the tenant doc with geminiKeyRef and geminiKeySet
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS must have Secret Manager Admin role
 *   - Secret Manager API must be enabled on the GCP project
 *
 * Usage:
 *   npx tsx src/run-migration.ts --post-migration gemini-keys --client-id <tenantId>
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { MigrationLogger } from "../utils/logger.js";

// Using dynamic import for Secret Manager since it may not be installed.
// The @google-cloud/secret-manager package is an optional peer dependency.
async function getSecretManagerClient(): Promise<{
  createSecret(req: Record<string, unknown>): Promise<[{ name: string }]>;
  addSecretVersion(req: Record<string, unknown>): Promise<unknown>;
} | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await (Function('return import("@google-cloud/secret-manager")')() as Promise<{
      SecretManagerServiceClient: new () => {
        createSecret(req: Record<string, unknown>): Promise<[{ name: string }]>;
        addSecretVersion(req: Record<string, unknown>): Promise<unknown>;
      };
    }>);
    return new mod.SecretManagerServiceClient();
  } catch {
    return null;
  }
}

export async function migrateGeminiKeys(options: {
  tenantId?: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { tenantId, dryRun, logger } = options;
  const db = getFirestore();

  logger.info("Migrating Gemini API keys to Secret Manager");

  const client = await getSecretManagerClient();
  if (!client && !dryRun) {
    logger.error(
      "Secret Manager client not available. Install @google-cloud/secret-manager or use --dry-run"
    );
    return;
  }

  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "";
  if (!projectId && !dryRun) {
    logger.error("GCP_PROJECT environment variable is required");
    return;
  }

  // Get tenants that were migrated from AutoGrade (they may have gemini keys)
  let query: admin.firestore.Query = db
    .collection("tenants")
    .where("_migratedFrom", "==", "autograde");
  if (tenantId) {
    query = query.where(admin.firestore.FieldPath.documentId(), "==", tenantId);
  }

  const tenantsSnap = await query.get();
  logger.info(`Found ${tenantsSnap.size} AutoGrade-migrated tenant(s)`);

  for (const tenantDoc of tenantsSnap.docs) {
    const tId = tenantDoc.id;
    const tenantData = tenantDoc.data();

    // Read the original client doc to get the raw key
    const clientSnap = await db.doc(`clients/${tId}`).get();
    if (!clientSnap.exists) {
      logger.warn(`Original client doc not found for tenant ${tId}`);
      continue;
    }

    const clientData = clientSnap.data()!;
    const rawKey = clientData.geminiApiKey;

    if (!rawKey) {
      logger.debug(`Tenant ${tId} has no Gemini API key, skipping`);
      continue;
    }

    const secretId = `tenant-${tId}-gemini`;
    const secretPath = `projects/${projectId}/secrets/${secretId}`;

    if (dryRun) {
      logger.info(`[DRY RUN] Would create secret ${secretId} and update tenant ${tId}`);
      continue;
    }

    try {
      // Create the secret
      const [secret] = await client!.createSecret({
        parent: `projects/${projectId}`,
        secretId,
        secret: {
          replication: { automatic: {} },
          labels: {
            "tenant-id": tId,
            "migrated-from": "autograde",
          },
        },
      });

      // Add the secret version with the actual key
      await client!.addSecretVersion({
        parent: secret.name!,
        payload: {
          data: Buffer.from(rawKey, "utf8"),
        },
      });

      // Update tenant doc
      await db.doc(`tenants/${tId}`).update({
        "settings.geminiKeyRef": secretPath,
        "settings.geminiKeySet": true,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      logger.info(`Migrated Gemini key for tenant ${tId} → ${secretPath}`);
    } catch (err) {
      logger.error(`Failed to migrate Gemini key for tenant ${tId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.printSummary();
}
