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
exports.reactivateTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * reactivateTenant — SuperAdmin reactivates a deactivated tenant.
 * - Restores tenant to its previous status (or 'active')
 * - Reactivates all memberships that were suspended during deactivation
 */
exports.reactivateTenant = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const { tenantId } = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.ReactivateTenantRequestSchema
    );
    // SuperAdmin only
    const callerUser = await (0, utils_1.getUser)(callerUid);
    if (!callerUser?.isSuperAdmin) {
      throw new https_1.HttpsError("permission-denied", "SuperAdmin only");
    }
    await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
    const db = admin.firestore();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) {
      throw new https_1.HttpsError("not-found", "Tenant not found");
    }
    const tenantData = tenantDoc.data();
    if (tenantData.status !== "deactivated") {
      throw new https_1.HttpsError("failed-precondition", "Tenant is not deactivated");
    }
    // Restore to previous status or default to 'active'
    const restoredStatus = tenantData.deactivation?.previousStatus ?? "active";
    // Reactivate all suspended memberships
    const membershipsSnap = await db
      .collection("userMemberships")
      .where("tenantId", "==", tenantId)
      .where("status", "==", "suspended")
      .get();
    // Update tenant status first
    await tenantRef.update({
      status: restoredStatus,
      "deactivation.reactivatedAt": firestore_1.FieldValue.serverTimestamp(),
      "deactivation.reactivatedBy": callerUid,
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    });
    // Reactivate memberships in chunks (Firestore batch limit is 500)
    const BATCH_CHUNK_SIZE = 450;
    const membershipDocs = membershipsSnap.docs;
    for (let i = 0; i < membershipDocs.length; i += BATCH_CHUNK_SIZE) {
      const chunk = membershipDocs.slice(i, i + BATCH_CHUNK_SIZE);
      const batch = db.batch();
      for (const membershipDoc of chunk) {
        batch.update(membershipDoc.ref, {
          status: "active",
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    v2_1.logger.info(
      `Reactivated tenant ${tenantId} (${membershipsSnap.size} memberships restored)`
    );
    await (0, utils_1.logTenantAction)(tenantId, callerUid, "reactivateTenant", {
      restoredStatus,
      membershipsReactivated: membershipsSnap.size,
    });
    await (0, utils_1.writePlatformActivity)(
      "tenant_reactivated",
      callerUid,
      {
        restoredStatus,
        membershipsReactivated: membershipsSnap.size,
        tenantName: tenantData.name,
      },
      tenantId
    );
    return {
      success: true,
      membershipsReactivated: membershipsSnap.size,
    };
  }
);
//# sourceMappingURL=reactivate-tenant.js.map
