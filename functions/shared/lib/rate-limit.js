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
exports.enforceRateLimit = enforceRateLimit;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * Simple rate limiter using Firestore.
 * Tracks calls per user per action type within a sliding window.
 */
async function enforceRateLimit(tenantId, userId, actionType, maxPerMinute) {
  const db = admin.firestore();
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const docId = `${userId}_${actionType}`;
  const ref = db.doc(`tenants/${tenantId}/rateLimits/${docId}`);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data();
    if (data) {
      // Filter to only timestamps within the window
      const timestamps = (data.timestamps || []).filter((t) => now - t < windowMs);
      if (timestamps.length >= maxPerMinute) {
        throw new https_1.HttpsError(
          "resource-exhausted",
          `Rate limit exceeded: max ${maxPerMinute} ${actionType} requests per minute`
        );
      }
      timestamps.push(now);
      tx.update(ref, { timestamps, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    } else {
      tx.set(ref, {
        userId,
        actionType,
        timestamps: [now],
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      });
    }
  });
}
//# sourceMappingURL=rate-limit.js.map
