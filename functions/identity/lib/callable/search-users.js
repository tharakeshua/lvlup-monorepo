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
exports.searchUsers = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const zod_1 = require("zod");
const SearchUsersRequestSchema = zod_1.z.object({
  query: zod_1.z.string().min(1).max(200),
  limit: zod_1.z.number().min(1).max(50).optional(),
});
exports.searchUsers = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const callerUser = await (0, utils_1.getUser)(callerUid);
    if (!callerUser?.isSuperAdmin) {
      throw new https_1.HttpsError("permission-denied", "SuperAdmin only");
    }
    await (0, rate_limit_1.enforceRateLimit)("global", callerUid, "read", 60);
    const data = (0, utils_1.parseRequest)(request.data, SearchUsersRequestSchema);
    const searchQuery = data.query.toLowerCase();
    const pageLimit = data.limit ?? 20;
    const db = admin.firestore();
    // Search users collection by email prefix match
    const usersSnap = await db
      .collection("users")
      .orderBy("email")
      .startAt(searchQuery)
      .endAt(searchQuery + "\uf8ff")
      .limit(pageLimit)
      .get();
    // Also search by displayName if email search returns few results
    let displayNameResults = [];
    if (usersSnap.docs.length < pageLimit) {
      const nameSnap = await db
        .collection("users")
        .orderBy("displayName")
        .startAt(searchQuery)
        .endAt(searchQuery + "\uf8ff")
        .limit(pageLimit)
        .get();
      displayNameResults = nameSnap.docs;
    }
    // Merge and deduplicate
    const seenUids = new Set();
    const allDocs = [...usersSnap.docs, ...displayNameResults];
    const uniqueUsers = [];
    for (const doc of allDocs) {
      if (seenUids.has(doc.id)) continue;
      seenUids.add(doc.id);
      const userData = doc.data();
      uniqueUsers.push({
        uid: doc.id,
        email: userData.email ?? null,
        displayName: userData.displayName ?? null,
        isSuperAdmin: userData.isSuperAdmin ?? false,
        activeTenantId: userData.activeTenantId ?? null,
        // B8: timestamps out are canonical ISO strings (legacy Timestamp
        // objects and ISO strings collapse uniformly; null stays null).
        lastLoginAt: (0, domain_1.toTimestamp)(userData.lastLoginAt),
        createdAt: (0, domain_1.toTimestamp)(userData.createdAt),
      });
      if (uniqueUsers.length >= pageLimit) break;
    }
    // Get membership info for found users
    const results = [];
    for (const user of uniqueUsers) {
      const membershipSnap = await db
        .collection("userMemberships")
        .where("uid", "==", user.uid)
        .where("status", "==", "active")
        .get();
      const memberships = membershipSnap.docs.map((m) => {
        const mData = m.data();
        return {
          tenantId: mData.tenantId,
          tenantCode: mData.tenantCode ?? "",
          role: mData.role,
        };
      });
      results.push({ ...user, memberships });
    }
    v2_1.logger.info("searchUsers completed", { query: data.query, resultCount: results.length });
    return { users: results };
  }
);
//# sourceMappingURL=search-users.js.map
