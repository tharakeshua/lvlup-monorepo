import * as admin from "firebase-admin";
import { isoNow } from "@levelup/domain";
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
        // B8: timestamps at rest are canonical ISO strings.
        createdAt: isoNow(),
      });
  } catch (err) {
    // Audit logging should never block the main operation
    logger.warn(`Failed to write audit log for tenant ${tenantId}: ${err}`);
  }
}
