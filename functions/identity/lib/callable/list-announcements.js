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
exports.listAnnouncements = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
exports.listAnnouncements = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(request.data, wire_1.ListAnnouncementsRequestSchema);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId ?? "global", callerUid, "read", 60);
    const callerUser = await (0, utils_1.getUser)(callerUid);
    const isSuperAdmin = callerUser?.isSuperAdmin === true;
    const db = admin.firestore();
    const pageLimit = data.limit ?? 20;
    const scope = data.scope ?? (data.tenantId ? "tenant" : "platform");
    const collectionPath =
      scope === "platform" ? "announcements" : `tenants/${data.tenantId}/announcements`;
    let q = db.collection(collectionPath).orderBy("createdAt", "desc");
    // Non-superadmin and non-tenantAdmin users only see published announcements
    if (!isSuperAdmin && data.status === undefined) {
      q = q.where("status", "==", "published");
    } else if (data.status) {
      q = q.where("status", "==", data.status);
    }
    if (data.cursor) {
      const cursorDoc = await db.doc(`${collectionPath}/${data.cursor}`).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }
    q = q.limit(pageLimit + 1);
    const snap = await q.get();
    const hasMore = snap.docs.length > pageLimit;
    const docs = hasMore ? snap.docs.slice(0, pageLimit) : snap.docs;
    const announcements = docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        title: raw.title,
        body: raw.body,
        authorName: raw.authorName,
        scope: raw.scope,
        status: raw.status,
        targetRoles: raw.targetRoles,
        targetClassIds: raw.targetClassIds,
        // B8: timestamps at rest are canonical ISO strings; collapse legacy
        // Firestore Timestamp objects (old docs) and ISO strings uniformly.
        publishedAt: (0, domain_1.toTimestamp)(raw.publishedAt),
        archivedAt: (0, domain_1.toTimestamp)(raw.archivedAt),
        expiresAt: (0, domain_1.toTimestamp)(raw.expiresAt),
        createdAt: (0, domain_1.toTimestamp)(raw.createdAt),
        updatedAt: (0, domain_1.toTimestamp)(raw.updatedAt),
      };
    });
    return {
      announcements,
      nextCursor: hasMore ? docs[docs.length - 1].id : undefined,
    };
  }
);
//# sourceMappingURL=list-announcements.js.map
