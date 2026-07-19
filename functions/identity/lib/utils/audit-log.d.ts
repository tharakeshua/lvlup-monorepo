/**
 * Log an administrative action to the tenant's audit log.
 * Collection: /tenants/{tenantId}/auditLogs/{logId}
 */
export declare function logTenantAction(
  tenantId: string,
  callerUid: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void>;
