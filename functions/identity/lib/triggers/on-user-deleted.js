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
exports.onUserDeleted = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions/v1"));
const v2_1 = require("firebase-functions/v2");
const firestore_helpers_1 = require("../utils/firestore-helpers");
/**
 * Auth trigger: runs when a Firebase Auth account is deleted.
 * Soft-deletes the user doc and deactivates all memberships.
 */
exports.onUserDeleted = functions
  .region("asia-south1")
  .auth.user()
  .onDelete(async (user) => {
    try {
      const batch = admin.firestore().batch();
      // 1. Soft-delete user doc
      const userRef = admin.firestore().doc(`users/${user.uid}`);
      batch.update(userRef, {
        status: "deleted",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      });
      // 2. Deactivate all memberships
      const membershipsQuery = await admin
        .firestore()
        .collection("userMemberships")
        .where("uid", "==", user.uid)
        .get();
      for (const doc of membershipsQuery.docs) {
        batch.update(doc.ref, {
          status: "inactive",
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      // 3. Update tenant stats (outside batch)
      for (const doc of membershipsQuery.docs) {
        const m = doc.data();
        await (0, firestore_helpers_1.updateTenantStats)(m.tenantId, m.role, "decrement");
      }
      v2_1.logger.info(
        `Soft-deleted user ${user.uid}, deactivated ${membershipsQuery.size} memberships`
      );
    } catch (error) {
      v2_1.logger.error(`Failed to handle deletion of user ${user.uid}`, error);
    }
  });
//# sourceMappingURL=on-user-deleted.js.map
