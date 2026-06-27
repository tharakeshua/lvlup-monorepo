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
exports.cleanupInactiveChats = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
/**
 * Scheduled function: deactivate inactive chat sessions (7-day threshold).
 *
 * Runs daily at 3:00 AM UTC. Finds chat sessions that are:
 * - isActive === true
 * - updatedAt is older than 7 days
 *
 * These sessions are deactivated (isActive = false) to reduce
 * query overhead and signal to the frontend that the session is stale.
 * The data is preserved for reference but won't appear in active session lists.
 */
exports.cleanupInactiveChats = (0, scheduler_1.onSchedule)(
  {
    schedule: "every day 03:00",
    region: "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = firestore_1.Timestamp.now();
    // 7 days ago
    const inactiveThreshold = firestore_1.Timestamp.fromMillis(
      now.toMillis() - 7 * 24 * 60 * 60 * 1000
    );
    // Query across all tenants using collectionGroup
    const inactiveSessions = await db
      .collectionGroup("chatSessions")
      .where("isActive", "==", true)
      .where("updatedAt", "<", inactiveThreshold)
      .limit(500)
      .get();
    if (inactiveSessions.empty) {
      v2_1.logger.info("No inactive chat sessions (7d) found");
      return;
    }
    v2_1.logger.info(`Found ${inactiveSessions.size} inactive chat sessions (7d+) to deactivate`);
    // Process in batches of 450 (Firestore batch limit)
    const docs = inactiveSessions.docs;
    let totalDeactivated = 0;
    for (let i = 0; i < docs.length; i += 450) {
      const chunk = docs.slice(i, i + 450);
      const batch = db.batch();
      for (const sessionDoc of chunk) {
        batch.update(sessionDoc.ref, {
          isActive: false,
          deactivatedAt: now,
          deactivatedReason: "inactive_7d",
          updatedAt: now,
        });
      }
      await batch.commit();
      totalDeactivated += chunk.length;
    }
    v2_1.logger.info(`Deactivated ${totalDeactivated} inactive chat sessions`);
  }
);
//# sourceMappingURL=cleanup-inactive-chats.js.map
