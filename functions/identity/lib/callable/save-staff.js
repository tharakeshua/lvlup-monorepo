"use strict";
/**
 * saveStaff — Update staff member details and permissions.
 *
 * Uses the consolidated upsert pattern:
 * - id present → update existing staff member
 */
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
exports.saveStaff = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
exports.saveStaff = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
  const { id, tenantId, data } = (0, utils_1.parseRequest)(
    request.data,
    shared_types_1.SaveStaffRequestSchema
  );
  if (!tenantId) {
    throw new https_1.HttpsError("invalid-argument", "tenantId is required");
  }
  await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, tenantId);
  await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
  const db = admin.firestore();
  if (!id) {
    throw new https_1.HttpsError("invalid-argument", "Staff creation should use createOrgUser");
  }
  // Update staff doc
  const staffRef = db.doc(`tenants/${tenantId}/staff/${id}`);
  const staffDoc = await staffRef.get();
  if (!staffDoc.exists) {
    throw new https_1.HttpsError("not-found", `Staff member ${id} not found`);
  }
  const updates = {
    updatedAt: firestore_1.FieldValue.serverTimestamp(),
  };
  if (data.department !== undefined) updates.department = data.department;
  if (data.status !== undefined) updates.status = data.status;
  await staffRef.update(updates);
  // Update membership permissions if staffPermissions provided
  if (data.staffPermissions) {
    const staffData = staffDoc.data();
    if (staffData?.uid) {
      const membershipId = `${staffData.uid}_${tenantId}`;
      const membershipRef = db.doc(`userMemberships/${membershipId}`);
      const membershipDoc = await membershipRef.get();
      if (membershipDoc.exists) {
        await membershipRef.update({
          staffPermissions: data.staffPermissions,
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Refresh custom claims with new permissions
        const membershipData = membershipDoc.data();
        const claims = (0, utils_1.buildClaimsForMembership)({
          tenantId,
          tenantCode: membershipData.tenantCode,
          role: membershipData.role,
          staffPermissions: data.staffPermissions,
        });
        await admin.auth().setCustomUserClaims(staffData.uid, claims);
      }
    }
  }
  await (0, utils_1.logTenantAction)(tenantId, callerUid, "updateStaff", { staffId: id });
  return { id, created: false };
});
//# sourceMappingURL=save-staff.js.map
