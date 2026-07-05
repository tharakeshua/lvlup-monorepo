"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const secret_manager_1 = require("@google-cloud/secret-manager");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const secretClient = new secret_manager_1.SecretManagerServiceClient();
/**
 * Consolidated endpoint: replaces createTenant + setTenantApiKey.
 * - No id = create new tenant (SuperAdmin only)
 * - id present = update existing tenant (TenantAdmin or SuperAdmin)
 * - data.geminiApiKey = store API key in Secret Manager
 */
exports.saveTenant = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
  const { id, data } = (0, utils_1.parseRequest)(request.data, wire_1.SaveTenantRequestSchema);
  if (!id) {
    // ── CREATE ──
    const callerUser = await (0, utils_1.getUser)(callerUid);
    if (!callerUser?.isSuperAdmin) {
      throw new https_1.HttpsError("permission-denied", "SuperAdmin only");
    }
    await (0, rate_limit_1.enforceRateLimit)("global", callerUid, "write", 30);
    if (!data.name || !data.contactEmail) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "name and contactEmail are required for creation"
      );
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
        throw new https_1.HttpsError(
          "already-exists",
          `Tenant code "${tenantCode}" is already in use`
        );
      }
      const tenantDoc = {
        id: tenantRef.id,
        name: data.name,
        shortName: data.shortName ?? null,
        slug: (0, utils_1.generateSlug)(data.name),
        description: data.description ?? null,
        tenantCode,
        ownerUid: callerUid,
        contactEmail: data.contactEmail,
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
          // B8: timestamps at rest are canonical ISO strings.
          lastUpdated: (0, domain_1.isoNow)(),
        },
        stats: {
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSpaces: 0,
          totalExams: 0,
        },
        createdAt: (0, domain_1.isoNow)(),
        createdBy: callerUid,
        updatedAt: (0, domain_1.isoNow)(),
        updatedBy: callerUid,
      };
      const membershipId = `${callerUid}_${tenantRef.id}`;
      const membershipRef = admin.firestore().doc(`userMemberships/${membershipId}`);
      tx.set(tenantRef, tenantDoc);
      tx.set(tenantCodeRef, {
        tenantId: tenantRef.id,
        createdAt: (0, domain_1.isoNow)(),
      });
      tx.set(membershipRef, {
        id: membershipId,
        uid: callerUid,
        tenantId: tenantRef.id,
        tenantCode,
        role: "tenantAdmin",
        status: "active",
        joinSource: "admin_created",
        createdAt: (0, domain_1.isoNow)(),
        updatedAt: (0, domain_1.isoNow)(),
      });
    });
    // DEP-1 fix: the create branch already verified the caller is a super-admin;
    // hand-rolling the claim wiped isSuperAdmin. Mint via the converged builder
    // and preserve the super-admin claim through the re-mint.
    await admin
      .auth()
      .setCustomUserClaims(
        callerUid,
        (0, utils_1.buildClaimsForMembership)(
          { role: "tenantAdmin", tenantId: tenantRef.id, tenantCode },
          { isSuperAdmin: true }
        )
      );
    // Handle geminiApiKey if provided during creation
    if (data.geminiApiKey) {
      await storeGeminiApiKey(tenantRef.id, data.geminiApiKey);
    }
    v2_1.logger.info(`Created tenant ${tenantRef.id} (${data.name})`);
    await (0, utils_1.logTenantAction)(tenantRef.id, callerUid, "createTenant", {
      name: data.name,
      tenantCode,
      plan: data.subscription?.plan ?? "trial",
    });
    await (0, utils_1.writePlatformActivity)(
      "tenant_created",
      callerUid,
      {
        tenantName: data.name,
        tenantCode,
        plan: data.subscription?.plan ?? "trial",
      },
      tenantRef.id
    );
    return { id: tenantRef.id, created: true };
  } else {
    // ── UPDATE ──
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, id);
    await (0, rate_limit_1.enforceRateLimit)(id, callerUid, "write", 30);
    // Check if caller is SuperAdmin (needed for privilege-gated fields)
    const callerUser = await (0, utils_1.getUser)(callerUid);
    const isSuperAdmin = callerUser?.isSuperAdmin === true;
    const tenantRef = admin.firestore().doc(`tenants/${id}`);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) {
      throw new https_1.HttpsError("not-found", "Tenant not found");
    }
    // Gate privileged fields: only SuperAdmin can change status, subscription, features
    if (!isSuperAdmin) {
      if (data.status !== undefined) {
        throw new https_1.HttpsError(
          "permission-denied",
          "Only SuperAdmin can change tenant status"
        );
      }
      if (data.subscription !== undefined) {
        throw new https_1.HttpsError(
          "permission-denied",
          "Only SuperAdmin can change subscription settings"
        );
      }
      if (data.features !== undefined) {
        throw new https_1.HttpsError(
          "permission-denied",
          "Only SuperAdmin can change feature flags"
        );
      }
    }
    const updates = {
      updatedAt: (0, domain_1.isoNow)(),
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
        updates["onboarding.completedAt"] = (0, domain_1.isoNow)();
      }
    }
    await tenantRef.update(updates);
    // Handle geminiApiKey
    if (data.geminiApiKey) {
      await storeGeminiApiKey(id, data.geminiApiKey);
    }
    v2_1.logger.info(`Updated tenant ${id}`);
    await (0, utils_1.logTenantAction)(id, callerUid, "updateTenant", {
      fields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy"),
    });
    await (0, utils_1.writePlatformActivity)(
      "tenant_updated",
      callerUid,
      {
        fields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy"),
      },
      id
    );
    return { id, created: false };
  }
});
async function storeGeminiApiKey(tenantId, apiKey) {
  if (apiKey.length < 10) {
    throw new https_1.HttpsError("invalid-argument", "Invalid API key");
  }
  const secretId = `tenant-${tenantId}-gemini`;
  const parent = `projects/${process.env.GCLOUD_PROJECT}`;
  try {
    await secretClient.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (err) {
    const grpcErr = err;
    if (grpcErr.code !== 6) throw err; // 6 = ALREADY_EXISTS
  }
  await secretClient.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: { data: Buffer.from(apiKey, "utf8") },
  });
  await admin
    .firestore()
    .doc(`tenants/${tenantId}`)
    .update({
      "settings.geminiKeyRef": secretId,
      "settings.geminiKeySet": true,
      updatedAt: (0, domain_1.isoNow)(),
    });
  v2_1.logger.info(`Set Gemini API key for tenant ${tenantId}`);
}
//# sourceMappingURL=save-tenant.js.map
