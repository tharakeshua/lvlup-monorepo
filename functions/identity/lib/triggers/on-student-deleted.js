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
exports.onStudentArchived = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
/**
 * Firestore trigger: when a student status changes to 'archived',
 * remove studentId from parent.childStudentIds[] and class.studentIds[].
 */
exports.onStudentArchived = (0, firestore_2.onDocumentUpdated)(
  {
    document: "tenants/{tenantId}/students/{studentId}",
    region: "asia-south1",
  },
  async (event) => {
    try {
      const before = event.data?.before.data();
      const after = event.data?.after.data();
      if (!before || !after) return;
      // Only trigger when status changes to 'archived'
      if (before.status === "archived" || after.status !== "archived") return;
      const tenantId = event.params.tenantId;
      const studentId = event.params.studentId;
      const db = admin.firestore();
      const BATCH_LIMIT = 450;
      // Collect all update operations as [ref, updateData] pairs
      const ops = [];
      if (after.parentIds?.length) {
        for (const parentId of after.parentIds) {
          ops.push([
            db.doc(`tenants/${tenantId}/parents/${parentId}`),
            {
              childStudentIds: firestore_1.FieldValue.arrayRemove(studentId),
              // B8: timestamps at rest are canonical ISO strings.
              updatedAt: (0, domain_1.isoNow)(),
            },
          ]);
        }
      }
      if (after.classIds?.length) {
        for (const classId of after.classIds) {
          ops.push([
            db.doc(`tenants/${tenantId}/classes/${classId}`),
            {
              studentIds: firestore_1.FieldValue.arrayRemove(studentId),
              studentCount: firestore_1.FieldValue.increment(-1),
              updatedAt: (0, domain_1.isoNow)(),
            },
          ]);
        }
      }
      // Chunk into batches of BATCH_LIMIT to stay under Firestore's 500 op limit
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const chunk = ops.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const [ref, data] of chunk) {
          batch.update(ref, data);
        }
        await batch.commit();
      }
      v2_1.logger.info(
        `Cleaned up references for archived student ${studentId} in tenant ${tenantId}: ` +
          `${after.parentIds?.length ?? 0} parents, ${after.classIds?.length ?? 0} classes`
      );
    } catch (error) {
      v2_1.logger.error("Failed to clean up archived student references", error);
    }
  }
);
//# sourceMappingURL=on-student-deleted.js.map
