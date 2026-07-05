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
exports.listVersions = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const domain_1 = require("@levelup/domain");
const auth_1 = require("../utils/auth");
const rate_limit_1 = require("../utils/rate-limit");
const zod_1 = require("zod");
const ListVersionsRequestSchema = zod_1.z.object({
  tenantId: zod_1.z.string().min(1),
  spaceId: zod_1.z.string().min(1),
  entityType: zod_1.z.enum(["space", "storyPoint", "item"]).optional(),
  entityId: zod_1.z.string().optional(),
  limit: zod_1.z.number().min(1).max(100).optional(),
  startAfter: zod_1.z.string().optional(),
});
exports.listVersions = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const parsed = ListVersionsRequestSchema.parse(request.data);
    const { tenantId, spaceId, entityType, entityId, limit: queryLimit = 20, startAfter } = parsed;
    await (0, auth_1.assertTeacherOrAdmin)(callerUid, tenantId);
    await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "read", 60);
    const db = admin.firestore();
    const versionsPath = `tenants/${tenantId}/spaces/${spaceId}/versions`;
    let q = db.collection(versionsPath).orderBy("changedAt", "desc");
    if (entityType) {
      q = q.where("entityType", "==", entityType);
    }
    if (entityId) {
      q = q.where("entityId", "==", entityId);
    }
    if (startAfter) {
      const cursorDoc = await db.doc(`${versionsPath}/${startAfter}`).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }
    const snap = await q.limit(queryLimit + 1).get();
    const hasMore = snap.docs.length > queryLimit;
    const docs = hasMore ? snap.docs.slice(0, queryLimit) : snap.docs;
    const versions = docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        version: data.version ?? 0,
        entityType: data.entityType ?? "space",
        entityId: data.entityId ?? "",
        changeType: data.changeType ?? "updated",
        changeSummary: data.changeSummary ?? "",
        changedBy: data.changedBy ?? "",
        // B8 collapse: Timestamp (old docs) or ISO string (post-U3.2) → ISO out.
        changedAt: data.changedAt ? (0, domain_1.toTimestamp)(data.changedAt) : null,
      };
    });
    return {
      versions,
      hasMore,
      lastId: docs.length > 0 ? docs[docs.length - 1].id : null,
    };
  }
);
//# sourceMappingURL=list-versions.js.map
