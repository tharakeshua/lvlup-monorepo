import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Log an administrative action to the tenant's audit log.
 * Collection: /tenants/{tenantId}/auditLogs/{logId}
 */
export async function logTenantAction(
  tenantId: string,
  callerUid: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await admin
      .firestore()
      .collection(`tenants/${tenantId}/auditLogs`)
      .add({
        action,
        callerUid,
        details: details ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    // Audit logging should never block the main operation
    logger.warn(`Failed to write audit log for tenant ${tenantId}: ${err}`);
  }
}
