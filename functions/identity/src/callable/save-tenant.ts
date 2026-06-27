import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { SaveTenantRequestSchema } from "@levelup/shared-types";
import type { SaveResponse } from "@levelup/shared-types";
import {
  getUser,
  generateSlug,
  assertTenantAdminOrSuperAdmin,
  parseRequest,
  logTenantAction,
  writePlatformActivity,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

const secretClient = new SecretManagerServiceClient();

/**
 * Consolidated endpoint: replaces createTenant + setTenantApiKey.
 * - No id = create new tenant (SuperAdmin only)
 * - id present = update existing tenant (TenantAdmin or SuperAdmin)
 * - data.geminiApiKey = store API key in Secret Manager
 */
export const saveTenant = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { id, data } = parseRequest(request.data, SaveTenantRequestSchema);

  if (!id) {
    // ── CREATE ──
    const callerUser = await getUser(callerUid);
    if (!callerUser?.isSuperAdmin) {
      throw new HttpsError("permission-denied", "SuperAdmin only");
    }

    await enforceRateLimit("global", callerUid, "write", 30);

    if (!data.name || !data.contactEmail) {
      throw new HttpsError("invalid-argument", "name and contactEmail are required for creation");
    }

    // tenantCode is derived from shortName or name
    const tenantCode = (data.shortName ?? data.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    const tenantRef = admin.firestore().collection("tenants").doc();
    const tenantCodeRef = admin.firestore().doc(`tenantCodes/${tenantCode}`);

    await admin.firestore().runTransaction(async (tx) => {
      const existingCode = await tx.get(tenantCodeRef);
      if (existingCode.exists) {
        throw new HttpsError("already-exists", `Tenant code "${tenantCode}" is already in use`);
      }

      const tenantDoc = {
        id: tenantRef.id,
        name: data.name!,
        shortName: data.shortName ?? null,
        slug: generateSlug(data.name!),
        description: data.description ?? null,
        tenantCode,
        ownerUid: callerUid,
        contactEmail: data.contactEmail!,
        contactPhone: data.contactPhone ?? null,
        contactPerson: data.contactPerson ?? null,
        logoUrl: data.logoUrl ?? null,
        bannerUrl: data.bannerUrl ?? null,
        website: data.website ?? null,
        address: data.address ?? null,
        status: data.status ?? "active",
        subscription: {
          plan: "trial",
          ...data.subscription,
        },
        features: {
          autoGradeEnabled: true,
          levelUpEnabled: true,
          scannerAppEnabled: false,
          aiChatEnabled: false,
          aiGradingEnabled: false,
          analyticsEnabled: true,
          parentPortalEnabled: false,
          bulkImportEnabled: true,
          apiAccessEnabled: false,
          ...data.features,
        },
        settings: { geminiKeySet: false },
        branding: data.branding ?? {},
        onboarding: { completed: false, completedSteps: [] },
        usage: {
          currentStudents: 0,
          currentTeachers: 0,
          currentSpaces: 0,
          examsThisMonth: 0,
          aiCallsThisMonth: 0,
          storageBytes: 0,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        stats: {
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSpaces: 0,
          totalExams: 0,
        },
        createdAt: FieldValue.serverTimestamp(),
        createdBy: callerUid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: callerUid,
      };

      const membershipId = `${callerUid}_${tenantRef.id}`;
      const membershipRef = admin.firestore().doc(`userMemberships/${membershipId}`);

      tx.set(tenantRef, tenantDoc);
      tx.set(tenantCodeRef, {
        tenantId: tenantRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(membershipRef, {
        id: membershipId,
        uid: callerUid,
        tenantId: tenantRef.id,
        tenantCode,
        role: "tenantAdmin",
        status: "active",
        joinSource: "admin_created",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await admin.auth().setCustomUserClaims(callerUid, {
      role: "tenantAdmin",
      tenantId: tenantRef.id,
      tenantCode,
    });

    // Handle geminiApiKey if provided during creation
    if (data.geminiApiKey) {
      await storeGeminiApiKey(tenantRef.id, data.geminiApiKey);
    }

    logger.info(`Created tenant ${tenantRef.id} (${data.name})`);

    await logTenantAction(tenantRef.id, callerUid, "createTenant", {
      name: data.name,
      tenantCode,
      plan: data.subscription?.plan ?? "trial",
    });

    await writePlatformActivity(
      "tenant_created",
      callerUid,
      {
        tenantName: data.name,
        tenantCode,
        plan: data.subscription?.plan ?? "trial",
      },
      tenantRef.id
    );

    return { id: tenantRef.id, created: true } satisfies SaveResponse;
  } else {
    // ── UPDATE ──
    await assertTenantAdminOrSuperAdmin(callerUid, id);

    await enforceRateLimit(id, callerUid, "write", 30);

    // Check if caller is SuperAdmin (needed for privilege-gated fields)
    const callerUser = await getUser(callerUid);
    const isSuperAdmin = callerUser?.isSuperAdmin === true;

    const tenantRef = admin.firestore().doc(`tenants/${id}`);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) {
      throw new HttpsError("not-found", "Tenant not found");
    }

    // Gate privileged fields: only SuperAdmin can change status, subscription, features
    if (!isSuperAdmin) {
      if (data.status !== undefined) {
        throw new HttpsError("permission-denied", "Only SuperAdmin can change tenant status");
      }
      if (data.subscription !== undefined) {
        throw new HttpsError(
          "permission-denied",
          "Only SuperAdmin can change subscription settings"
        );
      }
      if (data.features !== undefined) {
        throw new HttpsError("permission-denied", "Only SuperAdmin can change feature flags");
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.shortName !== undefined) updates.shortName = data.shortName;
    if (data.description !== undefined) updates.description = data.description;
    if (data.contactEmail !== undefined) updates.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updates.contactPhone = data.contactPhone;
    if (data.contactPerson !== undefined) updates.contactPerson = data.contactPerson;
    if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;
    if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
    if (data.website !== undefined) updates.website = data.website;
    if (data.address !== undefined) updates.address = data.address;
    if (data.status !== undefined) updates.status = data.status;
    if (data.subscription !== undefined) {
      for (const [k, v] of Object.entries(data.subscription)) {
        updates[`subscription.${k}`] = v;
      }
    }
    if (data.features !== undefined) {
      for (const [k, v] of Object.entries(data.features)) {
        updates[`features.${k}`] = v;
      }
    }
    if (data.settings !== undefined) {
      for (const [k, v] of Object.entries(data.settings)) {
        updates[`settings.${k}`] = v;
      }
    }
    if (data.branding !== undefined) {
      for (const [k, v] of Object.entries(data.branding)) {
        updates[`branding.${k}`] = v;
      }
    }
    if (data.onboarding !== undefined) {
      for (const [k, v] of Object.entries(data.onboarding)) {
        updates[`onboarding.${k}`] = v;
      }
      if (data.onboarding.completed) {
        updates["onboarding.completedAt"] = FieldValue.serverTimestamp();
      }
    }

    await tenantRef.update(updates);

    // Handle geminiApiKey
    if (data.geminiApiKey) {
      await storeGeminiApiKey(id, data.geminiApiKey);
    }

    logger.info(`Updated tenant ${id}`);

    await logTenantAction(id, callerUid, "updateTenant", {
      fields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy"),
    });

    await writePlatformActivity(
      "tenant_updated",
      callerUid,
      {
        fields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy"),
      },
      id
    );

    return { id, created: false } satisfies SaveResponse;
  }
});

async function storeGeminiApiKey(tenantId: string, apiKey: string): Promise<void> {
  if (apiKey.length < 10) {
    throw new HttpsError("invalid-argument", "Invalid API key");
  }

  const secretId = `tenant-${tenantId}-gemini`;
  const parent = `projects/${process.env.GCLOUD_PROJECT}`;

  try {
    await secretClient.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (err: unknown) {
    const grpcErr = err as { code?: number };
    if (grpcErr.code !== 6) throw err; // 6 = ALREADY_EXISTS
  }

  await secretClient.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: { data: Buffer.from(apiKey, "utf8") },
  });

  await admin.firestore().doc(`tenants/${tenantId}`).update({
    "settings.geminiKeyRef": secretId,
    "settings.geminiKeySet": true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`Set Gemini API key for tenant ${tenantId}`);
}
