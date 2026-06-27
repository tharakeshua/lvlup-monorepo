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
exports.joinTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * joinTenant — Allow a user to join a tenant using a tenant code.
 *
 * Creates a UserMembership with a pending role (defaults to 'student').
 * The tenant admin can later update the role/permissions.
 */
exports.joinTenant = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
  const data = (0, utils_1.parseRequest)(request.data, shared_types_1.JoinTenantRequestSchema);
  if (!data.tenantCode?.trim()) {
    throw new https_1.HttpsError("invalid-argument", "tenantCode is required");
  }
  const db = admin.firestore();
  const normalizedCode = data.tenantCode.trim().toUpperCase();
  // Look up tenant by code
  const tenantCodeDoc = await db.doc(`tenantCodes/${normalizedCode}`).get();
  if (!tenantCodeDoc.exists) {
    throw new https_1.HttpsError("not-found", "Invalid tenant code");
  }
  const tenantId = tenantCodeDoc.data().tenantId;
  await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "auth", 10);
  // Verify the tenant is accessible
  const tenant = await (0, utils_1.getTenant)(tenantId);
  (0, utils_1.assertTenantAccessible)(tenant, "access");
  // Check if user already has a membership
  const membershipId = `${callerUid}_${tenantId}`;
  const existingMembership = await db.doc(`userMemberships/${membershipId}`).get();
  if (existingMembership.exists) {
    const existing = existingMembership.data();
    if (existing.status === "active") {
      throw new https_1.HttpsError(
        "already-exists",
        "You are already a member of this organization"
      );
    }
    // Re-activate if previously deactivated
    await existingMembership.ref.update({
      status: "active",
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Re-activated membership ${membershipId} for user ${callerUid}`);
    return { tenantId, membershipId, role: existing.role };
  }
  // Ensure the user doc exists
  const callerUser = await (0, utils_1.getUser)(callerUid);
  if (!callerUser) {
    throw new https_1.HttpsError(
      "failed-precondition",
      "User profile not found. Please complete registration first."
    );
  }
  // Create new membership (default role: student, pending admin assignment)
  const membership = {
    id: membershipId,
    uid: callerUid,
    tenantId,
    tenantCode: normalizedCode,
    role: "student",
    status: "active",
    joinSource: "tenant_code",
    createdAt: firestore_1.FieldValue.serverTimestamp(),
    updatedAt: firestore_1.FieldValue.serverTimestamp(),
  };
  await db.doc(`userMemberships/${membershipId}`).set(membership);
  // Set custom claims for the new tenant
  const claims = (0, utils_1.buildClaimsForMembership)(membership);
  await admin.auth().setCustomUserClaims(callerUid, claims);
  // Update user's activeTenantId if they don't have one
  if (!callerUser.activeTenantId) {
    await db.doc(`users/${callerUid}`).update({
      activeTenantId: tenantId,
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
  }
  v2_1.logger.info(`User ${callerUid} joined tenant ${tenantId} via code ${normalizedCode}`);
  return { tenantId, membershipId, role: "student" };
});
//# sourceMappingURL=join-tenant.js.map
