/**
 * Centralized usage counter helpers.
 *
 * Uses FieldValue.increment() for atomic, race-free counter updates.
 * Never uses read-modify-write to avoid stale-data bugs.
 */
import type { TenantUsage } from "../contracts/legacy-docs";
/** Fields on TenantUsage that can be atomically incremented. */
export type UsageField = keyof Omit<TenantUsage, "lastUpdated" | "storageBytes">;
/**
 * Atomically increment (or decrement) a usage counter on a tenant document.
 *
 * @param tenantId - The tenant whose usage to update
 * @param field    - The TenantUsage field to increment
 * @param amount   - How much to add (use negative for decrement). Defaults to 1.
 */
export declare function incrementUsage(
  tenantId: string,
  field: UsageField,
  amount?: number
): Promise<void>;
/**
 * Atomically increment multiple usage counters in a single write.
 */
export declare function incrementUsageMultiple(
  tenantId: string,
  increments: Partial<Record<UsageField, number>>
): Promise<void>;
