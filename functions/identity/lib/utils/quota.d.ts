type QuotaResource = "student" | "teacher" | "space" | "exam";
/**
 * Assert a tenant has not exceeded the subscription quota for the given resource.
 * Throws `resource-exhausted` if the quota is exceeded.
 *
 * @param tenantId  The tenant to check quotas for
 * @param resource  The resource type being created
 * @param batchSize Number of resources being created in this operation (default 1)
 */
export declare function assertQuota(
  tenantId: string,
  resource: QuotaResource,
  batchSize?: number
): Promise<void>;
export {};
