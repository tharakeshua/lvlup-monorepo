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
exports.switchActiveTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * switchActiveTenant — Switch a user's active tenant context.
 *
 * Validates the user has an active membership in the target tenant,
 * updates custom claims to reflect the new tenant, and updates the
 * user's activeTenantId.
 */
exports.switchActiveTenant = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.SwitchActiveTenantRequestSchema
    );
    if (!data.tenantId) {
      throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "auth", 10);
    // Verify the user has an active membership in this tenant
    const membership = await (0, utils_1.getMembership)(callerUid, data.tenantId);
    if (!membership || membership.status !== "active") {
      throw new https_1.HttpsError(
        "permission-denied",
        "No active membership found for this tenant"
      );
    }
    // Verify the tenant is accessible
    const tenant = await (0, utils_1.getTenant)(data.tenantId);
    (0, utils_1.assertTenantAccessible)(tenant, "access");
    // Build and set new custom claims for this tenant
    const claims = (0, utils_1.buildClaimsForMembership)(membership);
    await admin.auth().setCustomUserClaims(callerUid, claims);
    // Update user's activeTenantId
    await admin.firestore().doc(`users/${callerUid}`).update({
      activeTenantId: data.tenantId,
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(
      `User ${callerUid} switched to tenant ${data.tenantId} (role: ${membership.role})`
    );
    return { success: true, role: membership.role };
  }
);
//# sourceMappingURL=switch-active-tenant.js.map
