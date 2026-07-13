/**
 * Migrate LevelUp organizations → /tenants/{tenantId}
 *
 * Maps /orgs/{orgId} documents to the new Tenant schema.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyOrg {
  _docId: string;
  name: string;
  title?: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  bannerUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  code: string;
  isPublic?: boolean;
  adminUids: string[];
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
}

export async function migrateOrgsToTenants(options: {
  orgId?: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();

  logger.info("Starting LevelUp orgs → tenants migration");

  let query: admin.firestore.Query = db.collection("orgs");
  if (orgId) {
    query = query.where(admin.firestore.FieldPath.documentId(), "==", orgId);
  }

  const orgs = await readAllDocs<LegacyOrg>(query as admin.firestore.CollectionReference);
  logger.info(`Found ${orgs.length} organization(s) to migrate`);

  await processBatch(
    orgs,
    async (org, batch, db) => {
      const tenantId = org._docId;
      const tenantPath = `tenants/${tenantId}`;

      if (await docExists(db, tenantPath)) {
        logger.debug(`Tenant ${tenantId} already exists, skipping`);
        return { action: "skipped", id: tenantId };
      }

      const tenant = {
        id: tenantId,
        name: org.name || org.title || "",
        shortName: null,
        slug: org.slug,
        description: org.description || null,
        tenantCode: org.code,
        ownerUid: org.ownerUid,
        contactEmail: org.contactEmail || "",
        contactPhone: org.contactPhone || null,
        contactPerson: null,
        logoUrl: org.imageUrl || null,
        bannerUrl: org.bannerUrl || null,
        website: org.website || null,
        address: org.address || null,
        status: "active" as const,
        subscription: {
          plan: "basic" as const,
          expiresAt: null,
          maxStudents: null,
          maxTeachers: null,
          maxSpaces: null,
          maxExamsPerMonth: null,
        },
        features: {
          autoGradeEnabled: false,
          levelUpEnabled: true,
          scannerAppEnabled: false,
          aiChatEnabled: true,
          aiGradingEnabled: false,
          analyticsEnabled: true,
          parentPortalEnabled: false,
          bulkImportEnabled: true,
          apiAccessEnabled: false,
        },
        settings: {
          geminiKeySet: false,
        },
        stats: {
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSpaces: 0,
          totalExams: 0,
        },
        createdAt: org.createdAt
          ? admin.firestore.Timestamp.fromMillis(org.createdAt)
          : admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "levelup",
        _migrationSourceId: org._docId,
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would create tenant: ${tenantId} (${org.name})`);
        return { action: "created", id: tenantId };
      }

      batch.set(db.doc(tenantPath), tenant);

      // Create tenantCode index
      const codePath = `tenantCodes/${org.code}`;
      if (!(await docExists(db, codePath))) {
        batch.set(db.doc(codePath), {
          tenantId,
          createdAt: admin.firestore.Timestamp.now(),
        });
      }

      // Create memberships for admin users
      for (const adminUid of org.adminUids || []) {
        const membershipId = `${adminUid}_${tenantId}`;
        const membershipPath = `userMemberships/${membershipId}`;
        if (await docExists(db, membershipPath)) continue;

        const role = adminUid === org.ownerUid ? "tenantAdmin" : "teacher";
        batch.set(db.doc(membershipPath), {
          id: membershipId,
          uid: adminUid,
          tenantId,
          tenantCode: org.code,
          role,
          status: "active",
          joinSource: "migration",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }

      return { action: "created", id: tenantId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
