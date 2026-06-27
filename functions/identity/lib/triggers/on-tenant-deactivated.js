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
exports.onTenantDeactivated = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
/**
 * Firestore trigger: when a tenant status changes to 'suspended' or 'expired',
 * suspend all active memberships for that tenant.
 *
 * This prevents orphaned active memberships from allowing access
 * to a deactivated tenant's resources.
 */
exports.onTenantDeactivated = (0, firestore_2.onDocumentUpdated)(
  {
    document: "tenants/{tenantId}",
    region: "asia-south1",
  },
  async (event) => {
    try {
      const beforeRaw = event.data?.before.data();
      const afterRaw = event.data?.after.data();
      if (!beforeRaw || !afterRaw) return;
      const beforeResult = shared_types_1.TenantSchema.safeParse({
        id: event.data.before.id,
        ...beforeRaw,
      });
      const afterResult = shared_types_1.TenantSchema.safeParse({
        id: event.data.after.id,
        ...afterRaw,
      });
      if (!beforeResult.success || !afterResult.success) {
        v2_1.logger.error("Invalid Tenant document in trigger", {
          beforeValid: beforeResult.success,
          afterValid: afterResult.success,
        });
        return;
      }
      const before = beforeResult.data;
      const after = afterResult.data;
      // Only trigger when status changes TO suspended or expired
      const deactivatedStatuses = ["suspended", "expired"];
      if (
        deactivatedStatuses.includes(before.status) ||
        !deactivatedStatuses.includes(after.status)
      ) {
        return;
      }
      const tenantId = event.params.tenantId;
      const db = admin.firestore();
      const BATCH_LIMIT = 450;
      // Find all active memberships for this tenant
      const membershipsSnap = await db
        .collection("userMemberships")
        .where("tenantId", "==", tenantId)
        .where("status", "==", "active")
        .get();
      if (membershipsSnap.empty) {
        v2_1.logger.info(`No active memberships to suspend for tenant ${tenantId}`);
        return;
      }
      // Batch update memberships to suspended
      const docs = membershipsSnap.docs;
      let totalSuspended = 0;
      for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const chunk = docs.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "suspended",
            suspendedReason: `tenant_${after.status}`,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        totalSuspended += chunk.length;
      }
      v2_1.logger.info(
        `Suspended ${totalSuspended} memberships for deactivated tenant ${tenantId} (status: ${after.status})`
      );
    } catch (error) {
      v2_1.logger.error("Failed to suspend memberships for deactivated tenant", error);
    }
  }
);
//# sourceMappingURL=on-tenant-deactivated.js.map
