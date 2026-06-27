"use strict";
/**
 * Monthly Usage Counter Reset — Runs on the 1st of each month at 00:00 UTC.
 *
 * Resets monthly counters (examsThisMonth, aiCallsThisMonth) for all
 * active and trial tenants. Processes in batches of 450.
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
exports.monthlyUsageReset = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const BATCH_SIZE = 450;
exports.monthlyUsageReset = (0, scheduler_1.onSchedule)(
  {
    schedule: "0 0 1 * *", // 1st of every month at 00:00 UTC
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    let resetCount = 0;
    // Query active and trial tenants
    const tenantsSnap = await db
      .collection("tenants")
      .where("status", "in", ["active", "trial"])
      .get();
    const docs = tenantsSnap.docs;
    // Process in batches
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.update(doc.ref, {
          "usage.examsThisMonth": 0,
          "usage.aiCallsThisMonth": 0,
          "usage.lastUpdated": firestore_1.FieldValue.serverTimestamp(),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        resetCount++;
      }
      await batch.commit();
    }
    v2_1.logger.info(`Monthly usage reset: ${resetCount} tenants reset`);
  }
);
//# sourceMappingURL=usage-reset.js.map
