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
exports.saveSpace = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_2 = require("../utils/firestore");
const helpers_1 = require("../utils/helpers");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const content_version_1 = require("../utils/content-version");
const ALLOWED_TRANSITIONS = {
  draft: ["published"],
  published: ["archived", "draft"],
  archived: ["draft"],
};
const UPDATABLE_FIELDS = new Set([
  "title",
  "description",
  "thumbnailUrl",
  "slug",
  "type",
  "subject",
  "labels",
  "classIds",
  "sectionIds",
  "teacherIds",
  "accessType",
  "academicSessionId",
  "defaultTimeLimitMinutes",
  "allowRetakes",
  "maxRetakes",
  "showCorrectAnswers",
  "defaultRubric",
  "defaultEvaluatorAgentId",
  "defaultTutorAgentId",
]);
/**
 * Consolidated space endpoint — replaces:
 *   createSpace, updateSpace, publishSpace, archiveSpace, publishToStore
 *
 * No id → create new space
 * id present → update (including status transitions and store listing)
 */
exports.saveSpace = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = (0, auth_1.assertAuth)(request.auth);
  const { id, tenantId, data } = (0, utils_1.parseRequest)(
    request.data,
    shared_types_1.SaveSpaceRequestSchema
  );
  if (!tenantId) {
    throw new https_1.HttpsError("invalid-argument", "tenantId is required");
  }
  await (0, auth_1.assertTeacherOrAdmin)(callerUid, tenantId);
  await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
  const db = admin.firestore();
  const isCreate = !id;
  // ── CREATE ──────────────────────────────────────────
  if (isCreate) {
    if (!data.title || !data.type) {
      throw new https_1.HttpsError("invalid-argument", "title and type are required for creation");
    }
    const spaceRef = db.collection(`tenants/${tenantId}/spaces`).doc();
    const spaceDoc = {
      id: spaceRef.id,
      tenantId,
      title: data.title,
      description: data.description ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      slug: data.slug ?? (0, helpers_1.generateSlug)(data.title),
      type: data.type,
      subject: data.subject ?? null,
      labels: data.labels ?? [],
      classIds: data.classIds ?? [],
      sectionIds: data.sectionIds ?? [],
      teacherIds: data.teacherIds ?? [callerUid],
      accessType: data.accessType ?? "class_assigned",
      defaultTimeLimitMinutes: data.defaultTimeLimitMinutes ?? null,
      allowRetakes: data.allowRetakes ?? true,
      maxRetakes: data.maxRetakes ?? 0,
      showCorrectAnswers: data.showCorrectAnswers ?? true,
      defaultRubric: data.defaultRubric ?? null,
      defaultEvaluatorAgentId: data.defaultEvaluatorAgentId ?? null,
      defaultTutorAgentId: data.defaultTutorAgentId ?? null,
      status: "draft",
      publishedAt: null,
      archivedAt: null,
      publishedToStore: false,
      stats: {
        totalStoryPoints: 0,
        totalItems: 0,
        totalStudents: 0,
        avgCompletionRate: 0,
      },
      createdBy: callerUid,
      createdAt: firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await spaceRef.set(spaceDoc);
    // Increment tenant stats and usage counters
    await db.doc(`tenants/${tenantId}`).update({
      "stats.totalSpaces": firestore_1.FieldValue.increment(1),
      "usage.currentSpaces": firestore_1.FieldValue.increment(1),
      "usage.lastUpdated": firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Created space ${spaceRef.id} in tenant ${tenantId}`);
    return { id: spaceRef.id, created: true };
  }
  // ── UPDATE ──────────────────────────────────────────
  const space = await (0, firestore_2.loadSpace)(tenantId, id);
  const spaceRef = db.doc(`tenants/${tenantId}/spaces/${id}`);
  const updates = {};
  // Handle status transition
  if (data.status && data.status !== space.status) {
    const allowed = ALLOWED_TRANSITIONS[space.status] ?? [];
    if (!allowed.includes(data.status)) {
      throw new https_1.HttpsError(
        "failed-precondition",
        `Cannot transition from '${space.status}' to '${data.status}'`,
        {
          currentStatus: space.status,
          requestedStatus: data.status,
          allowedTransitions: allowed,
        }
      );
    }
    // ── PUBLISH validation (draft → published) ───────
    if (data.status === "published") {
      await validatePublish(db, tenantId, id, space);
      updates.status = "published";
      updates.publishedAt = firestore_1.FieldValue.serverTimestamp();
      // Fire-and-forget student notifications
      notifyStudentsOfPublish(db, tenantId, id, space).catch((err) => {
        v2_1.logger.warn("Failed to send space publish notifications:", err);
      });
    }
    // ── UNPUBLISH / RESTORE TO DRAFT ─────────────────
    if (data.status === "draft") {
      updates.status = "draft";
      updates.publishedAt = null;
      updates.archivedAt = null;
      // Remove store listing if space was listed
      if (space.publishedToStore) {
        const storeRef = db.doc(`tenants/platform_public/spaces/${id}`);
        const storeDoc = await storeRef.get();
        if (storeDoc.exists) {
          await storeRef.delete();
        }
        updates.publishedToStore = false;
      }
    }
    // ── ARCHIVE side-effects (published → archived) ──
    if (data.status === "archived") {
      await expireActiveSessions(db, tenantId, id);
      updates.status = "archived";
      updates.archivedAt = firestore_1.FieldValue.serverTimestamp();
    }
  }
  // Handle store listing fields
  if (data.publishedToStore !== undefined) {
    if (data.publishedToStore && space.status !== "published" && updates.status !== "published") {
      throw new https_1.HttpsError(
        "failed-precondition",
        "Space must be published before listing on the store"
      );
    }
    if (data.publishedToStore) {
      if (data.price == null || data.price < 0) {
        throw new https_1.HttpsError("invalid-argument", "price must be a non-negative number");
      }
      // Write store listing under platform_public tenant
      const storeSpaceRef = db.doc(`tenants/platform_public/spaces/${id}`);
      await storeSpaceRef.set({
        id,
        tenantId: "platform_public",
        sourceTenantId: tenantId,
        title: data.title ?? space.title,
        description: data.description ?? space.description ?? null,
        thumbnailUrl: data.thumbnailUrl ?? space.thumbnailUrl ?? null,
        slug: space.slug ?? null,
        type: space.type,
        subject: data.subject ?? space.subject ?? null,
        labels: space.labels ?? [],
        accessType: "public_store",
        price: data.price,
        currency: data.currency || "USD",
        publishedToStore: true,
        storeDescription: data.storeDescription || space.description || "",
        storeThumbnailUrl: data.storeThumbnailUrl || space.thumbnailUrl || null,
        status: "published",
        stats: space.stats ?? { totalStoryPoints: 0, totalItems: 0, totalStudents: 0 },
        createdBy: callerUid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        publishedAt: firestore_1.FieldValue.serverTimestamp(),
      });
      updates.publishedToStore = true;
      updates.price = data.price;
      updates.currency = data.currency || "USD";
      updates.storeDescription = data.storeDescription || "";
    }
  }
  // Copy allowed plain fields
  for (const [key, value] of Object.entries(data)) {
    if (UPDATABLE_FIELDS.has(key) && value !== undefined) {
      updates[key] = value;
    }
  }
  if (Object.keys(updates).length === 0) {
    throw new https_1.HttpsError("invalid-argument", "No valid fields to update");
  }
  updates.updatedAt = firestore_1.FieldValue.serverTimestamp();
  await spaceRef.update(updates);
  // Write content version for status transitions
  if (data.status && data.status !== space.status) {
    const changeType = data.status;
    const changeSummary =
      changeType === "published"
        ? `Space "${space.title}" published`
        : changeType === "archived"
          ? `Space "${space.title}" archived`
          : `Space "${space.title}" restored to draft`;
    (0, content_version_1.writeContentVersion)(db, tenantId, id, {
      entityType: "space",
      entityId: id,
      changeType: changeType === "draft" ? "updated" : changeType,
      changeSummary,
      changedBy: callerUid,
    }).catch((err) => v2_1.logger.warn("Failed to write content version:", err));
  } else if (Object.keys(updates).length > 1) {
    // Non-status field updates
    const changedFields = Object.keys(updates).filter((k) => k !== "updatedAt");
    (0, content_version_1.writeContentVersion)(db, tenantId, id, {
      entityType: "space",
      entityId: id,
      changeType: "updated",
      changeSummary: `Updated fields: ${changedFields.join(", ")}`,
      changedBy: callerUid,
    }).catch((err) => v2_1.logger.warn("Failed to write content version:", err));
  }
  v2_1.logger.info(`Updated space ${id} in tenant ${tenantId}`);
  return { id, created: false };
});
// ── Helpers ──────────────────────────────────────────────
/**
 * Validate publish rules (from publish-space.ts):
 * 1. Space must have a title
 * 2. At least one storyPoint exists
 * 3. Each timed_test storyPoint must have durationMinutes > 0
 * 4. At least one item exists per story point
 */
async function validatePublish(db, tenantId, spaceId, space) {
  if (!space.title?.trim()) {
    throw new https_1.HttpsError("failed-precondition", "Space must have a title");
  }
  const storyPointsSnap = await db
    .collection(`tenants/${tenantId}/spaces/${spaceId}/storyPoints`)
    .get();
  if (storyPointsSnap.empty) {
    throw new https_1.HttpsError("failed-precondition", "Space must have at least one story point");
  }
  const errors = [];
  for (const spDoc of storyPointsSnap.docs) {
    const sp = spDoc.data();
    if (
      (sp.type === "timed_test" || sp.type === "test") &&
      (!sp.assessmentConfig?.durationMinutes || sp.assessmentConfig.durationMinutes <= 0)
    ) {
      errors.push(`StoryPoint "${sp.title}" (timed test) must have a duration > 0 minutes`);
    }
    const itemsSnap = await db
      .collection(`tenants/${tenantId}/spaces/${spaceId}/items`)
      .where("storyPointId", "==", spDoc.id)
      .limit(1)
      .get();
    if (itemsSnap.empty) {
      errors.push(`StoryPoint "${sp.title}" must have at least one item`);
    }
  }
  if (errors.length > 0) {
    throw new https_1.HttpsError(
      "failed-precondition",
      `Publish validation failed:\n${errors.join("\n")}`
    );
  }
}
/**
 * Send notifications to students in the space's assigned classes (from publish-space.ts).
 */
async function notifyStudentsOfPublish(db, tenantId, spaceId, space) {
  const classIds = space.classIds ?? [];
  if (classIds.length === 0) return;
  const studentUids = [];
  for (const classId of classIds) {
    const studentsSnap = await db
      .collection(`tenants/${tenantId}/students`)
      .where("classIds", "array-contains", classId)
      .where("status", "==", "active")
      .get();
    for (const sDoc of studentsSnap.docs) {
      const authUid = sDoc.data().authUid;
      if (authUid && !studentUids.includes(authUid)) {
        studentUids.push(authUid);
      }
    }
  }
  if (studentUids.length > 0) {
    const { sendBulkNotifications } = await Promise.resolve().then(() =>
      __importStar(require("../utils/notification-sender"))
    );
    await sendBulkNotifications(studentUids, {
      tenantId,
      recipientRole: "student",
      type: "space_published",
      title: "New Learning Space Available",
      body: `"${space.title}" has been published. Start learning now!`,
      entityType: "space",
      entityId: spaceId,
      actionUrl: `/spaces/${spaceId}`,
    });
  }
}
/**
 * Expire all in-progress test sessions for the space (from archive-space.ts).
 */
async function expireActiveSessions(db, tenantId, spaceId) {
  const activeSessions = await db
    .collection(`tenants/${tenantId}/digitalTestSessions`)
    .where("spaceId", "==", spaceId)
    .where("status", "==", "in_progress")
    .get();
  if (!activeSessions.empty) {
    const docs = activeSessions.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const chunk = docs.slice(i, i + 450);
      const batch = db.batch();
      for (const sessionDoc of chunk) {
        batch.update(sessionDoc.ref, {
          status: "expired",
          endedAt: firestore_1.FieldValue.serverTimestamp(),
          autoSubmitted: true,
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    v2_1.logger.info(`Expired ${activeSessions.size} active sessions for space ${spaceId}`);
  }
}
//# sourceMappingURL=save-space.js.map
