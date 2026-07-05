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
exports.cleanupStaleSessions = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
/**
 * Scheduled function: cleanup truly stale test sessions (24h threshold).
 *
 * Runs hourly. Finds sessions that are:
 * - status === 'in_progress'
 * - createdAt is older than 24 hours
 *
 * These are sessions that were never properly submitted or expired via
 * the deadline-based expiry trigger. They are marked as 'abandoned'.
 *
 * This is distinct from on-test-session-expired.ts which handles
 * deadline-based expiry (serverDeadline + 30s grace).
 */
exports.cleanupStaleSessions = (0, scheduler_1.onSchedule)(
  {
    schedule: "every 1 hours",
    region: "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = firestore_1.Timestamp.now();
    // 24 hours ago
    const staleThreshold = firestore_1.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    // B8: createdAt is a Timestamp on pre-U3.2 docs and an ISO string after.
    // Firestore range filters only match values of the operand's type, so the
    // two representations need one query each.
    const staleThresholdIso = (0, domain_1.toTimestamp)(staleThreshold);
    // Query across all tenants using collectionGroup
    const baseQuery = db
      .collectionGroup("digitalTestSessions")
      .where("status", "==", "in_progress");
    const [tsSnap, isoSnap] = await Promise.all([
      baseQuery.where("createdAt", "<", staleThreshold).limit(500).get(),
      baseQuery.where("createdAt", "<", staleThresholdIso).limit(500).get(),
    ]);
    const staleDocs = [...tsSnap.docs, ...isoSnap.docs];
    if (staleDocs.length === 0) {
      v2_1.logger.info("No stale test sessions (24h) found");
      return;
    }
    v2_1.logger.info(`Found ${staleDocs.length} stale test sessions (24h+) to mark as abandoned`);
    // Batch update
    const batch = db.batch();
    let count = 0;
    for (const sessionDoc of staleDocs) {
      batch.update(sessionDoc.ref, {
        status: "abandoned",
        // U3.5: session timing fields stay Firestore Timestamps at rest.
        endedAt: now,
        autoSubmitted: true,
        abandonedReason: "stale_24h",
        updatedAt: (0, domain_1.isoNow)(),
      });
      count++;
    }
    await batch.commit();
    v2_1.logger.info(`Marked ${count} stale test sessions as abandoned`);
  }
);
//# sourceMappingURL=cleanup-stale-sessions.js.map
