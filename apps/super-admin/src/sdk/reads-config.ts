/**
 * SDK parity-gap reads/writes for super-admin Lane D.
 *
 * The fat-SDK (@levelup/query) has no callable for two super-admin-only shapes, so
 * these stay on the firebase/firestore composition surface. This is the ONLY page-
 * layer file permitted to import `firebase/firestore` (alongside src/sdk/{firebase,api}).
 *
 *  GAP 1 — `platform/config` doc (SettingsPage): no callable exists. read + write.
 *  GAP 2 — `tenants` collection feature-flag matrix (FeatureFlagsPage): the
 *          `listTenants` projection (`TenantSummary`) drops `features`/`tenantCode`,
 *          so the per-tenant flag grid is read straight off the collection. The
 *          WRITE is NOT a gap — it goes through the real `useSaveTenant` callable hook.
 */
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Tenant } from "@levelup/domain";

// ── GAP 1: platform/config ───────────────────────────────────────────────────

export interface PlatformConfig {
  defaultFeatures?: Record<string, boolean>;
  announcement?: string;
  maintenanceMode?: boolean;
  defaultPlan?: string;
  maxTenantsAllowed?: number;
}

export interface PlatformConfigWrite {
  announcement: string | null;
  maintenanceMode: boolean;
  defaultFeatures: Record<string, boolean>;
  defaultPlan: string;
  maxTenantsAllowed: number | null;
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const { db } = getFirebaseServices();
  const snap = await getDoc(doc(db, "platform", "config"));
  if (!snap.exists()) return {};
  return snap.data() as PlatformConfig;
}

export async function savePlatformConfig(input: PlatformConfigWrite): Promise<void> {
  const { db } = getFirebaseServices();
  await setDoc(doc(db, "platform", "config"), input, { merge: true });
}

// ── GAP 2: tenants collection feature-flag matrix (READ only) ────────────────

export interface TenantFlags {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  status: string;
  flags: Record<string, boolean>;
}

export async function getTenantsWithFlags(): Promise<TenantFlags[]> {
  const { db } = getFirebaseServices();
  const snap = await getDocs(collection(db, "tenants"));
  return snap.docs.map((d) => {
    const data = d.data() as Tenant;
    return {
      tenantId: d.id,
      tenantName: data.name,
      tenantCode: data.tenantCode,
      status: data.status,
      flags: (data.features as unknown as Record<string, boolean>) ?? {},
    };
  });
}
