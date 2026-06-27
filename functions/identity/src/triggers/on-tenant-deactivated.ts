import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import type { Tenant } from "@levelup/shared-types";
import { TenantSchema } from "@levelup/shared-types";

/**
 * Firestore trigger: when a tenant status changes to 'suspended' or 'expired',
 * suspend all active memberships for that tenant.
 *
 * This prevents orphaned active memberships from allowing access
 * to a deactivated tenant's resources.
 */
export const onTenantDeactivated = onDocumentUpdated(
  {
    document: "tenants/{tenantId}",
    region: "asia-south1",
  },
  async (event) => {
    try {
      const beforeRaw = event.data?.before.data();
      const afterRaw = event.data?.after.data();
      if (!beforeRaw || !afterRaw) return;

      const beforeResult = TenantSchema.safeParse({ id: event.data!.before.id, ...beforeRaw });
      const afterResult = TenantSchema.safeParse({ id: event.data!.after.id, ...afterRaw });
      if (!beforeResult.success || !afterResult.success) {
        logger.error("Invalid Tenant document in trigger", {
          beforeValid: beforeResult.success,
          afterValid: afterResult.success,
        });
        return;
      }
      const before = beforeResult.data as unknown as Tenant;
      const after = afterResult.data as unknown as Tenant;

      // Only trigger when status changes TO suspended or expired
      const deactivatedStatuses = ["suspended", "expired"];
      if (
        deactivatedStatuses.includes(before.status) ||
        !deactivatedStatuses.includes(after.status)
      ) {
        return;
      }

      const tenantId = event.params.tenantId;
      const db = admin.firestore();
      const BATCH_LIMIT = 450;

      // Find all active memberships for this tenant
      const membershipsSnap = await db
        .collection("userMemberships")
        .where("tenantId", "==", tenantId)
        .where("status", "==", "active")
        .get();

      if (membershipsSnap.empty) {
        logger.info(`No active memberships to suspend for tenant ${tenantId}`);
        return;
      }

      // Batch update memberships to suspended
      const docs = membershipsSnap.docs;
      let totalSuspended = 0;

      for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const chunk = docs.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();

        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "suspended",
            suspendedReason: `tenant_${after.status}`,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        totalSuspended += chunk.length;
      }

      logger.info(
        `Suspended ${totalSuspended} memberships for deactivated tenant ${tenantId} (status: ${after.status})`
      );
    } catch (error) {
      logger.error("Failed to suspend memberships for deactivated tenant", error);
    }
  }
);
