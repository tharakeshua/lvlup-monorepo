/**
 * Centralized usage counter helpers.
 *
 * Uses FieldValue.increment() for atomic, race-free counter updates.
 * Never uses read-modify-write to avoid stale-data bugs.
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { isoNow } from "@levelup/domain";
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
export async function incrementUsage(
  tenantId: string,
  field: UsageField,
  amount = 1
): Promise<void> {
  const db = admin.firestore();
  await db.doc(`tenants/${tenantId}`).update({
    [`usage.${field}`]: FieldValue.increment(amount),
    // B8: timestamps at rest are canonical ISO strings.
    "usage.lastUpdated": isoNow(),
    updatedAt: isoNow(),
  });
}

/**
 * Atomically increment multiple usage counters in a single write.
 */
export async function incrementUsageMultiple(
  tenantId: string,
  increments: Partial<Record<UsageField, number>>
): Promise<void> {
  const db = admin.firestore();
  const updates: Record<string, unknown> = {
    "usage.lastUpdated": isoNow(),
    updatedAt: isoNow(),
  };

  for (const [field, amount] of Object.entries(increments)) {
    if (amount !== undefined && amount !== 0) {
      updates[`usage.${field}`] = FieldValue.increment(amount);
    }
  }

  await db.doc(`tenants/${tenantId}`).update(updates);
}
