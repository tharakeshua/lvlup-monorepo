"use strict";
/**
 * Centralized usage counter helpers.
 *
 * Uses FieldValue.increment() for atomic, race-free counter updates.
 * Never uses read-modify-write to avoid stale-data bugs.
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
exports.incrementUsage = incrementUsage;
exports.incrementUsageMultiple = incrementUsageMultiple;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const domain_1 = require("@levelup/domain");
/**
 * Atomically increment (or decrement) a usage counter on a tenant document.
 *
 * @param tenantId - The tenant whose usage to update
 * @param field    - The TenantUsage field to increment
 * @param amount   - How much to add (use negative for decrement). Defaults to 1.
 */
async function incrementUsage(tenantId, field, amount = 1) {
  const db = admin.firestore();
  await db.doc(`tenants/${tenantId}`).update({
    [`usage.${field}`]: firestore_1.FieldValue.increment(amount),
    // B8: timestamps at rest are canonical ISO strings.
    "usage.lastUpdated": (0, domain_1.isoNow)(),
    updatedAt: (0, domain_1.isoNow)(),
  });
}
/**
 * Atomically increment multiple usage counters in a single write.
 */
async function incrementUsageMultiple(tenantId, increments) {
  const db = admin.firestore();
  const updates = {
    "usage.lastUpdated": (0, domain_1.isoNow)(),
    updatedAt: (0, domain_1.isoNow)(),
  };
  for (const [field, amount] of Object.entries(increments)) {
    if (amount !== undefined && amount !== 0) {
      updates[`usage.${field}`] = firestore_1.FieldValue.increment(amount);
    }
  }
  await db.doc(`tenants/${tenantId}`).update(updates);
}
//# sourceMappingURL=usage.js.map
