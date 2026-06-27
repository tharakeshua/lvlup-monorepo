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
exports.bulkUpdateStatus = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const zod_1 = require("zod");
const BulkUpdateStatusRequestSchema = zod_1.z.object({
  tenantId: zod_1.z.string().min(1),
  entityType: zod_1.z.enum(["student", "teacher", "class"]),
  entityIds: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(500),
  newStatus: zod_1.z.enum(["active", "archived"]),
});
exports.bulkUpdateStatus = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 300, memory: "512MiB", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(request.data, BulkUpdateStatusRequestSchema);
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 10);
    const db = admin.firestore();
    const collectionMap = {
      student: "students",
      teacher: "teachers",
      class: "classes",
    };
    const collectionName = collectionMap[data.entityType];
    const basePath = `tenants/${data.tenantId}/${collectionName}`;
    let updated = 0;
    const BATCH_SIZE = 450;
    for (let i = 0; i < data.entityIds.length; i += BATCH_SIZE) {
      const chunk = data.entityIds.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const entityId of chunk) {
        const ref = db.doc(`${basePath}/${entityId}`);
        batch.update(ref, {
          status: data.newStatus,
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        updated++;
      }
      await batch.commit();
    }
    v2_1.logger.info(
      `Bulk status update: ${updated} ${data.entityType}s -> ${data.newStatus} in tenant ${data.tenantId}`
    );
    await (0, utils_1.logTenantAction)(data.tenantId, callerUid, "bulkUpdateStatus", {
      entityType: data.entityType,
      count: updated,
      newStatus: data.newStatus,
    });
    return { success: true, updated };
  }
);
//# sourceMappingURL=bulk-update-status.js.map
