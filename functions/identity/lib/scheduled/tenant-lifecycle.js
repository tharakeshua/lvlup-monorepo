"use strict";
/**
 * Tenant Lifecycle Automation — Daily trial expiry check.
 *
 * Runs daily at 00:00 UTC:
 * 1. Transitions trial tenants past expiresAt → expired
 * 2. Flags long-expired tenants (>30 days, no activity) for admin review
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
exports.tenantLifecycleCheck = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
exports.tenantLifecycleCheck = (0, scheduler_1.onSchedule)(
  {
    schedule: "every day 00:00",
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    // B8: timestamps at rest are canonical ISO strings; compare in epoch millis.
    const nowMs = Date.now();
    let expiredCount = 0;
    let flaggedCount = 0;
    // ── Step 1: Expire trial tenants past their subscription expiry ──
    const trialSnap = await db.collection("tenants").where("status", "==", "trial").get();
    for (const doc of trialSnap.docs) {
      const data = doc.data();
      const expiresAt = data.subscription?.expiresAt ?? data.trialEndsAt;
      if (!expiresAt) continue;
      // B8 read: a legacy doc field may be a Firestore Timestamp OR an ISO string —
      // collapse both shapes through the domain edge adapter.
      const expiryMs = (0, domain_1.toMillis)((0, domain_1.toTimestamp)(expiresAt));
      if (expiryMs > nowMs) continue;
      // Transition to expired
      await doc.ref.update({
        status: "expired",
        updatedAt: (0, domain_1.isoNow)(),
      });
      // Write audit log
      await db.collection(`tenants/${doc.id}/auditLog`).add({
        action: "trial_expired",
        tenantId: doc.id,
        actorId: "system",
        details: {
          previousStatus: "trial",
          expiresAt: (0, domain_1.toTimestamp)(expiresAt),
        },
        createdAt: (0, domain_1.isoNow)(),
      });
      expiredCount++;
    }
    // ── Step 2: Flag long-expired tenants for admin review ──
    const expiredSnap = await db.collection("tenants").where("status", "==", "expired").get();
    for (const doc of expiredSnap.docs) {
      const data = doc.data();
      const expiresAt = data.subscription?.expiresAt ?? data.trialEndsAt;
      if (!expiresAt) continue;
      // B8 read: collapse Firestore-Timestamp-or-ISO through the domain edge adapter.
      const expiryMs = (0, domain_1.toMillis)((0, domain_1.toTimestamp)(expiresAt));
      const daysSinceExpiry = nowMs - expiryMs;
      if (daysSinceExpiry < THIRTY_DAYS_MS) continue;
      // Check for recent activity (updated in last 30 days)
      const updatedAtMs = data.updatedAt
        ? (0, domain_1.toMillis)((0, domain_1.toTimestamp)(data.updatedAt))
        : null;
      if (updatedAtMs !== null && nowMs - updatedAtMs < THIRTY_DAYS_MS) {
        continue; // Has recent activity, skip
      }
      // Flag for admin review via platformActivityLog
      await db.collection("platformActivityLog").add({
        action: "tenant_review_needed",
        actorId: "system",
        tenantId: doc.id,
        metadata: {
          tenantName: data.name,
          status: "expired",
          expiredSince: (0, domain_1.toTimestamp)(expiresAt),
          daysSinceExpiry: Math.floor(daysSinceExpiry / (24 * 60 * 60 * 1000)),
        },
        createdAt: (0, domain_1.isoNow)(),
      });
      flaggedCount++;
    }
    v2_1.logger.info(
      `Tenant lifecycle check: ${expiredCount} trials expired, ${flaggedCount} flagged for review`
    );
  }
);
//# sourceMappingURL=tenant-lifecycle.js.map
