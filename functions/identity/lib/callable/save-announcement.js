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
exports.saveAnnouncement = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
exports.saveAnnouncement = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const {
      id,
      tenantId,
      data,
      delete: shouldDelete,
    } = (0, utils_1.parseRequest)(request.data, wire_1.SaveAnnouncementRequestSchema);
    await (0, rate_limit_1.enforceRateLimit)(tenantId ?? "global", callerUid, "write", 30);
    const callerUser = await (0, utils_1.getUser)(callerUid);
    const isSuperAdmin = callerUser?.isSuperAdmin === true;
    const db = admin.firestore();
    // Determine scope
    const scope = data.scope ?? (tenantId ? "tenant" : "platform");
    if (scope === "platform" && !isSuperAdmin) {
      throw new https_1.HttpsError(
        "permission-denied",
        "Only SuperAdmin can manage platform announcements"
      );
    }
    if (scope === "tenant") {
      if (!tenantId) {
        throw new https_1.HttpsError(
          "invalid-argument",
          "tenantId required for tenant-scoped announcements"
        );
      }
      await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, tenantId);
    }
    // Determine collection path
    const collectionPath =
      scope === "platform" ? "announcements" : `tenants/${tenantId}/announcements`;
    if (shouldDelete && id) {
      await db.doc(`${collectionPath}/${id}`).delete();
      v2_1.logger.info(`Deleted announcement ${id}`);
      return { id, deleted: true };
    }
    if (!id) {
      // CREATE
      if (!data.title || !data.body) {
        throw new https_1.HttpsError("invalid-argument", "title and body are required");
      }
      const ref = db.collection(collectionPath).doc();
      // B8: timestamps at rest are canonical ISO strings.
      const now = (0, domain_1.isoNow)();
      const status = data.status ?? "draft";
      await ref.set({
        id: ref.id,
        tenantId: tenantId ?? null,
        title: data.title,
        body: data.body,
        authorUid: callerUid,
        authorName: callerUser?.displayName ?? callerUser?.email ?? "Unknown",
        scope,
        targetRoles: data.targetRoles ?? [],
        targetClassIds: data.targetClassIds ?? [],
        status,
        publishedAt: status === "published" ? now : null,
        archivedAt: null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        readBy: [],
        createdAt: now,
        updatedAt: now,
      });
      v2_1.logger.info(`Created announcement ${ref.id} (scope=${scope})`);
      return { id: ref.id, created: true };
    }
    // UPDATE
    const docRef = db.doc(`${collectionPath}/${id}`);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new https_1.HttpsError("not-found", "Announcement not found");
    }
    const updates = {
      updatedAt: (0, domain_1.isoNow)(),
    };
    if (data.title !== undefined) updates.title = data.title;
    if (data.body !== undefined) updates.body = data.body;
    if (data.targetRoles !== undefined) updates.targetRoles = data.targetRoles;
    if (data.targetClassIds !== undefined) updates.targetClassIds = data.targetClassIds;
    if (data.expiresAt !== undefined)
      updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.status !== undefined) {
      updates.status = data.status;
      if (data.status === "published") {
        updates.publishedAt = (0, domain_1.isoNow)();
      } else if (data.status === "archived") {
        updates.archivedAt = (0, domain_1.isoNow)();
      }
    }
    await docRef.update(updates);
    v2_1.logger.info(`Updated announcement ${id}`);
    return { id, created: false };
  }
);
//# sourceMappingURL=save-announcement.js.map
