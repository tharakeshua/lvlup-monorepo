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
exports.listStoreSpaces = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const wire_1 = require("../contracts/wire");
const auth_1 = require("../utils/auth");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * List spaces published to the public B2C store.
 * Minimal auth: works for any authenticated user (consumer or school).
 */
exports.listStoreSpaces = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data ?? {}, wire_1.ListStoreSpacesRequestSchema);
    await (0, rate_limit_1.enforceRateLimit)("platform_public", callerUid, "read", 60);
    const pageSize = Math.min(data.limit ?? 20, 50);
    const db = admin.firestore();
    let query = db
      .collection("tenants/platform_public/spaces")
      .where("publishedToStore", "==", true)
      .orderBy("publishedAt", "desc");
    // Optional subject filter
    if (data.subject) {
      query = query.where("subject", "==", data.subject);
    }
    // Cursor pagination
    if (data.startAfter) {
      const cursorDoc = await db.doc(`tenants/platform_public/spaces/${data.startAfter}`).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }
    query = query.limit(pageSize);
    const snapshot = await query.get();
    const spaces = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title ?? "",
        storeDescription: d.storeDescription ?? d.description ?? "",
        storeThumbnailUrl: d.storeThumbnailUrl ?? d.thumbnailUrl ?? null,
        subject: d.subject ?? null,
        labels: d.labels ?? [],
        price: d.price ?? 0,
        currency: d.currency ?? "USD",
        totalStudents: d.stats?.totalStudents ?? 0,
        totalStoryPoints: d.stats?.totalStoryPoints ?? 0,
      };
    });
    // Client-side search filter (simple title match for MVP)
    let filtered = spaces;
    if (data.search) {
      const term = data.search.toLowerCase();
      filtered = spaces.filter(
        (s) =>
          s.title.toLowerCase().includes(term) || s.storeDescription.toLowerCase().includes(term)
      );
    }
    return {
      spaces: filtered,
      hasMore: snapshot.docs.length === pageSize,
      lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
    };
  }
);
//# sourceMappingURL=list-store-spaces.js.map
