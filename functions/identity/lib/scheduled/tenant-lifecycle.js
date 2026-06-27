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
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
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
    const now = firestore_1.Timestamp.now();
    let expiredCount = 0;
    let flaggedCount = 0;
    // ── Step 1: Expire trial tenants past their subscription expiry ──
    const trialSnap = await db.collection("tenants").where("status", "==", "trial").get();
    for (const doc of trialSnap.docs) {
      const data = doc.data();
      const expiresAt = data.subscription?.expiresAt ?? data.trialEndsAt;
      if (!expiresAt) continue;
      const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
      if (expiryDate > now.toDate()) continue;
      // Transition to expired
      await doc.ref.update({
        status: "expired",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      });
      // Write audit log
      await db.collection(`tenants/${doc.id}/auditLog`).add({
        action: "trial_expired",
        tenantId: doc.id,
        actorId: "system",
        details: {
          previousStatus: "trial",
          expiresAt: expiresAt,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
      });
      expiredCount++;
    }
    // ── Step 2: Flag long-expired tenants for admin review ──
    const expiredSnap = await db.collection("tenants").where("status", "==", "expired").get();
    for (const doc of expiredSnap.docs) {
      const data = doc.data();
      const expiresAt = data.subscription?.expiresAt ?? data.trialEndsAt;
      if (!expiresAt) continue;
      const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
      const daysSinceExpiry = now.toDate().getTime() - expiryDate.getTime();
      if (daysSinceExpiry < THIRTY_DAYS_MS) continue;
      // Check for recent activity (updated in last 30 days)
      const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;
      if (updatedAt && now.toDate().getTime() - updatedAt.getTime() < THIRTY_DAYS_MS) {
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
          expiredSince: expiresAt,
          daysSinceExpiry: Math.floor(daysSinceExpiry / (24 * 60 * 60 * 1000)),
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
      });
      flaggedCount++;
    }
    v2_1.logger.info(
      `Tenant lifecycle check: ${expiredCount} trials expired, ${flaggedCount} flagged for review`
    );
  }
);
//# sourceMappingURL=tenant-lifecycle.js.map
