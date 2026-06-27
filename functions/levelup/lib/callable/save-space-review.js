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
exports.saveSpaceReview = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("../utils/auth");
const rate_limit_1 = require("../utils/rate-limit");
const utils_1 = require("../utils");
const shared_types_1 = require("@levelup/shared-types");
/**
 * Save or update a space review (one review per user per space).
 * Also updates the denormalized rating aggregate on the Space document.
 */
exports.saveSpaceReview = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const { tenantId, spaceId, rating, comment } = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.SaveSpaceReviewRequestSchema
    );
    await (0, auth_1.assertTenantMember)(callerUid, tenantId);
    await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 10);
    const db = admin.firestore();
    const reviewRef = db.doc(`tenants/${tenantId}/spaces/${spaceId}/reviews/${callerUid}`);
    const spaceRef = db.doc(`tenants/${tenantId}/spaces/${spaceId}`);
    // Check space exists
    const spaceDoc = await spaceRef.get();
    if (!spaceDoc.exists) {
      throw new https_1.HttpsError("not-found", "Space not found");
    }
    const now = firestore_1.FieldValue.serverTimestamp();
    const existingReview = await reviewRef.get();
    const isUpdate = existingReview.exists;
    // Get user display name
    const userDoc = await db.doc(`users/${callerUid}`).get();
    const userName = userDoc.exists ? (userDoc.data()?.displayName ?? "Anonymous") : "Anonymous";
    // Save/update the review
    const reviewData = {
      id: callerUid,
      spaceId,
      tenantId,
      userId: callerUid,
      userName,
      rating,
      comment: comment?.trim() || null,
      updatedAt: now,
      ...(isUpdate ? {} : { createdAt: now }),
    };
    await reviewRef.set(reviewData, { merge: true });
    // Recompute aggregate from all reviews
    const allReviews = await db.collection(`tenants/${tenantId}/spaces/${spaceId}/reviews`).get();
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    let totalReviews = 0;
    for (const doc of allReviews.docs) {
      const r = doc.data().rating;
      if (r >= 1 && r <= 5) {
        distribution[r] = (distribution[r] || 0) + 1;
        totalRating += r;
        totalReviews++;
      }
    }
    const averageRating = totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;
    await spaceRef.update({
      ratingAggregate: { averageRating, totalReviews, distribution },
      updatedAt: now,
    });
    return { success: true, isUpdate };
  }
);
//# sourceMappingURL=save-space-review.js.map
