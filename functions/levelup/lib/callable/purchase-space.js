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
exports.purchaseSpace = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consumer purchases a space from the public store.
 * MVP: no actual payment processing — just records the purchase.
 * Adds spaceId to user.consumerProfile.enrolledSpaceIds and appends a PurchaseRecord.
 */
exports.purchaseSpace = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data, shared_types_1.PurchaseSpaceRequestSchema);
    if (!data.spaceId) {
      throw new https_1.HttpsError("invalid-argument", "spaceId is required");
    }
    await (0, rate_limit_1.enforceRateLimit)("platform_public", callerUid, "write", 30);
    const db = admin.firestore();
    // Load the store space
    const storeSpaceRef = db.doc(`tenants/platform_public/spaces/${data.spaceId}`);
    const storeSpaceDoc = await storeSpaceRef.get();
    if (!storeSpaceDoc.exists) {
      throw new https_1.HttpsError("not-found", "Space not found in the store");
    }
    const storeSpace = storeSpaceDoc.data();
    if (!storeSpace.publishedToStore) {
      throw new https_1.HttpsError("failed-precondition", "Space is not available for purchase");
    }
    // Check user hasn't already enrolled
    const userRef = db.doc(`users/${callerUid}`);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new https_1.HttpsError("not-found", "User profile not found");
    }
    const userData = userDoc.data();
    const existingEnrolled = userData.consumerProfile?.enrolledSpaceIds ?? [];
    if (existingEnrolled.includes(data.spaceId)) {
      throw new https_1.HttpsError("already-exists", "You are already enrolled in this space");
    }
    // Build purchase record
    const transactionId = db.collection("_transactions").doc().id;
    const purchaseRecord = {
      spaceId: data.spaceId,
      spaceTitle: storeSpace.title || "",
      amount: storeSpace.price ?? 0,
      currency: storeSpace.currency ?? "USD",
      purchasedAt: firestore_1.FieldValue.serverTimestamp(),
      transactionId,
    };
    // Update user document atomically
    await userRef.update({
      "consumerProfile.enrolledSpaceIds": firestore_1.FieldValue.arrayUnion(data.spaceId),
      "consumerProfile.purchaseHistory": firestore_1.FieldValue.arrayUnion(purchaseRecord),
      "consumerProfile.totalSpend": firestore_1.FieldValue.increment(storeSpace.price ?? 0),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Increment store space student count
    await storeSpaceRef.update({
      "stats.totalStudents": firestore_1.FieldValue.increment(1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(
      `Consumer ${callerUid} purchased space ${data.spaceId} (txn: ${transactionId})`
    );
    return { success: true, transactionId };
  }
);
//# sourceMappingURL=purchase-space.js.map
