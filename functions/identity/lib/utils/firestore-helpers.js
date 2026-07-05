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
exports.getUser = getUser;
exports.getMembership = getMembership;
exports.getTenant = getTenant;
exports.updateTenantStats = updateTenantStats;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const domain_1 = require("@levelup/domain");
const db = () => admin.firestore();
/** Get a user document by UID. */
async function getUser(uid) {
  const doc = await db().doc(`users/${uid}`).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}
/** Get a membership document. */
async function getMembership(uid, tenantId) {
  const doc = await db().doc(`userMemberships/${uid}_${tenantId}`).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}
/** Get a tenant document. */
async function getTenant(tenantId) {
  const doc = await db().doc(`tenants/${tenantId}`).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}
/** Atomically increment or decrement a tenant stat counter. */
async function updateTenantStats(tenantId, role, operation) {
  const delta = operation === "increment" ? 1 : -1;
  const fieldMap = {
    student: "stats.totalStudents",
    teacher: "stats.totalTeachers",
  };
  const field = fieldMap[role];
  if (!field) return;
  await db()
    .doc(`tenants/${tenantId}`)
    .update({
      [field]: firestore_1.FieldValue.increment(delta),
      // B8: timestamps at rest are canonical ISO strings.
      updatedAt: (0, domain_1.isoNow)(),
    });
}
//# sourceMappingURL=firestore-helpers.js.map
