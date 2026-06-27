import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { loadSpace } from "../utils/firestore";
import { generateSlug } from "../utils/helpers";
import { SaveSpaceRequestSchema } from "@levelup/shared-types";
import type { SaveSpaceRequest, SaveResponse, Space } from "@levelup/shared-types";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { writeContentVersion } from "../utils/content-version";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
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
export const saveSpace = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const { id, tenantId, data } = parseRequest(request.data, SaveSpaceRequestSchema);

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId is required");
  }

  await assertTeacherOrAdmin(callerUid, tenantId);
  await enforceRateLimit(tenantId, callerUid, "write", 30);

  const db = admin.firestore();
  const isCreate = !id;

  // ── CREATE ──────────────────────────────────────────
  if (isCreate) {
    if (!data.title || !data.type) {
      throw new HttpsError("invalid-argument", "title and type are required for creation");
    }

    const spaceRef = db.collection(`tenants/${tenantId}/spaces`).doc();

    const spaceDoc = {
      id: spaceRef.id,
      tenantId,
      title: data.title,
      description: data.description ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      slug: data.slug ?? generateSlug(data.title),
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await spaceRef.set(spaceDoc);

    // Increment tenant stats and usage counters
    await db.doc(`tenants/${tenantId}`).update({
      "stats.totalSpaces": FieldValue.increment(1),
      "usage.currentSpaces": FieldValue.increment(1),
      "usage.lastUpdated": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Created space ${spaceRef.id} in tenant ${tenantId}`);
    return { id: spaceRef.id, created: true } satisfies SaveResponse;
  }

  // ── UPDATE ──────────────────────────────────────────
  const space = await loadSpace(tenantId, id);
  const spaceRef = db.doc(`tenants/${tenantId}/spaces/${id}`);
  const updates: Record<string, unknown> = {};

  // Handle status transition
  if (data.status && data.status !== space.status) {
    const allowed = ALLOWED_TRANSITIONS[space.status] ?? [];
    if (!allowed.includes(data.status)) {
      throw new HttpsError(
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
      updates.publishedAt = FieldValue.serverTimestamp();

      // Fire-and-forget student notifications
      notifyStudentsOfPublish(db, tenantId, id, space).catch((err) => {
        logger.warn("Failed to send space publish notifications:", err);
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
      updates.archivedAt = FieldValue.serverTimestamp();
    }
  }

  // Handle store listing fields
  if (data.publishedToStore !== undefined) {
    if (data.publishedToStore && space.status !== "published" && updates.status !== "published") {
      throw new HttpsError(
        "failed-precondition",
        "Space must be published before listing on the store"
      );
    }

    if (data.publishedToStore) {
      if (data.price == null || data.price < 0) {
        throw new HttpsError("invalid-argument", "price must be a non-negative number");
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp(),
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
    throw new HttpsError("invalid-argument", "No valid fields to update");
  }

  updates.updatedAt = FieldValue.serverTimestamp();
  await spaceRef.update(updates);

  // Write content version for status transitions
  if (data.status && data.status !== space.status) {
    const changeType = data.status as "published" | "archived" | "draft";
    const changeSummary =
      changeType === "published"
        ? `Space "${space.title}" published`
        : changeType === "archived"
          ? `Space "${space.title}" archived`
          : `Space "${space.title}" restored to draft`;

    writeContentVersion(db, tenantId, id, {
      entityType: "space",
      entityId: id,
      changeType: changeType === "draft" ? "updated" : changeType,
      changeSummary,
      changedBy: callerUid,
    }).catch((err) => logger.warn("Failed to write content version:", err));
  } else if (Object.keys(updates).length > 1) {
    // Non-status field updates
    const changedFields = Object.keys(updates).filter((k) => k !== "updatedAt");
    writeContentVersion(db, tenantId, id, {
      entityType: "space",
      entityId: id,
      changeType: "updated",
      changeSummary: `Updated fields: ${changedFields.join(", ")}`,
      changedBy: callerUid,
    }).catch((err) => logger.warn("Failed to write content version:", err));
  }

  logger.info(`Updated space ${id} in tenant ${tenantId}`);
  return { id, created: false } satisfies SaveResponse;
});

// ── Helpers ──────────────────────────────────────────────

/**
 * Validate publish rules (from publish-space.ts):
 * 1. Space must have a title
 * 2. At least one storyPoint exists
 * 3. Each timed_test storyPoint must have durationMinutes > 0
 * 4. At least one item exists per story point
 */
async function validatePublish(
  db: admin.firestore.Firestore,
  tenantId: string,
  spaceId: string,
  space: Space
): Promise<void> {
  if (!space.title?.trim()) {
    throw new HttpsError("failed-precondition", "Space must have a title");
  }

  const storyPointsSnap = await db
    .collection(`tenants/${tenantId}/spaces/${spaceId}/storyPoints`)
    .get();

  if (storyPointsSnap.empty) {
    throw new HttpsError("failed-precondition", "Space must have at least one story point");
  }

  const errors: string[] = [];

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
    throw new HttpsError("failed-precondition", `Publish validation failed:\n${errors.join("\n")}`);
  }
}

/**
 * Send notifications to students in the space's assigned classes (from publish-space.ts).
 */
async function notifyStudentsOfPublish(
  db: admin.firestore.Firestore,
  tenantId: string,
  spaceId: string,
  space: Space
): Promise<void> {
  const classIds = space.classIds ?? [];
  if (classIds.length === 0) return;

  const studentUids: string[] = [];
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
    const { sendBulkNotifications } = await import("../utils/notification-sender");
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
async function expireActiveSessions(
  db: admin.firestore.Firestore,
  tenantId: string,
  spaceId: string
): Promise<void> {
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
          endedAt: FieldValue.serverTimestamp(),
          autoSubmitted: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    logger.info(`Expired ${activeSessions.size} active sessions for space ${spaceId}`);
  }
}
