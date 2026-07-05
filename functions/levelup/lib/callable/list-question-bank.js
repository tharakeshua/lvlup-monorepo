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
exports.listQuestionBank = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("../utils/auth");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * List/search question bank items with filtering and pagination.
 */
exports.listQuestionBank = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data, wire_1.ListQuestionBankRequestSchema);
    if (!data.tenantId) {
      throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await (0, auth_1.assertTeacherOrAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "read", 60);
    const db = admin.firestore();
    let query = db.collection(`tenants/${data.tenantId}/questionBank`);
    // Apply filters
    if (data.subject) {
      query = query.where("subject", "==", data.subject);
    }
    if (data.difficulty) {
      query = query.where("difficulty", "==", data.difficulty);
    }
    if (data.bloomsLevel) {
      query = query.where("bloomsLevel", "==", data.bloomsLevel);
    }
    if (data.questionType) {
      query = query.where("questionType", "==", data.questionType);
    }
    // Sort
    const sortField = data.sortBy ?? "createdAt";
    const sortDir = data.sortDir ?? "desc";
    query = query.orderBy(sortField, sortDir);
    // Pagination
    if (data.startAfter) {
      const lastDoc = await db
        .doc(`tenants/${data.tenantId}/questionBank/${data.startAfter}`)
        .get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }
    const limit = Math.min(data.limit ?? 20, 50);
    query = query.limit(limit);
    const snapshot = await query.get();
    let items = snapshot.docs.map((doc) => doc.data());
    // Client-side filters for array fields (Firestore limitation)
    if (data.topics && data.topics.length > 0) {
      items = items.filter((item) => data.topics.some((t) => item.topics?.includes(t)));
    }
    if (data.tags && data.tags.length > 0) {
      items = items.filter((item) => data.tags.some((t) => item.tags?.includes(t)));
    }
    // Client-side text search (simple substring match)
    if (data.search) {
      const searchLower = data.search.toLowerCase();
      items = items.filter((item) => {
        const title = (item.title ?? "").toLowerCase();
        const content = (item.content ?? "").toLowerCase();
        return title.includes(searchLower) || content.includes(searchLower);
      });
    }
    return {
      items,
      hasMore: snapshot.docs.length === limit,
      lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
    };
  }
);
//# sourceMappingURL=list-question-bank.js.map
