import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { assertTenantAdminOrSuperAdmin, parseRequest, logTenantAction } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { z } from "zod";

const BulkUpdateStatusRequestSchema = z.object({
  tenantId: z.string().min(1),
  entityType: z.enum(["student", "teacher", "class"]),
  entityIds: z.array(z.string().min(1)).min(1).max(500),
  newStatus: z.enum(["active", "archived"]),
});

export const bulkUpdateStatus = onCall(
  { region: "asia-south1", timeoutSeconds: 300, memory: "512MiB", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

    const data = parseRequest(request.data, BulkUpdateStatusRequestSchema);
    await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);
    await enforceRateLimit(data.tenantId, callerUid, "write", 10);

    const db = admin.firestore();
    const collectionMap: Record<string, string> = {
      student: "students",
      teacher: "teachers",
      class: "classes",
    };
    const collectionName = collectionMap[data.entityType];
    const basePath = `tenants/${data.tenantId}/${collectionName}`;

    let updated = 0;
    const BATCH_SIZE = 450;

    for (let i = 0; i < data.entityIds.length; i += BATCH_SIZE) {
      const chunk = data.entityIds.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const entityId of chunk) {
        const ref = db.doc(`${basePath}/${entityId}`);
        batch.update(ref, {
          status: data.newStatus,
          // B8: timestamps at rest are canonical ISO strings.
          updatedAt: isoNow(),
        });
        updated++;
      }

      await batch.commit();
    }

    logger.info(
      `Bulk status update: ${updated} ${data.entityType}s -> ${data.newStatus} in tenant ${data.tenantId}`
    );

    await logTenantAction(data.tenantId, callerUid, "bulkUpdateStatus", {
      entityType: data.entityType,
      count: updated,
      newStatus: data.newStatus,
    });

    return { success: true, updated };
  }
);
