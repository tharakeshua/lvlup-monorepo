import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "../firebase";
import type { TenantCodeIndex, Tenant } from "@levelup/shared-types";

/**
 * Look up a tenant by its short code (e.g. "SPR001").
 *
 * Tries the PUBLIC v1 callable first: new (v2_) tenants only exist behind it —
 * their `v2_tenantCodes`/`v2_tenants` docs are client-deny-all, so the legacy
 * direct read can never resolve them. Falls back to the legacy
 * /tenantCodes/{code} → /tenants/{tenantId} read for pre-v2 tenants the v1
 * backend doesn't know about. Returns null if the code resolves nowhere.
 */
export async function lookupTenantByCode(code: string): Promise<Tenant | null> {
  const { db, functions } = getFirebaseServices();
  const normalised = code.toUpperCase().trim();

  type PublicView = {
    tenantId?: string;
    name?: string;
    status?: string;
    trialEndsAt?: string | null;
    branding?: unknown;
  };

  let callableView: PublicView | null = null;
  try {
    const fn = httpsCallable(functions, "v1-identity-lookupTenantByCode");
    const res = await fn({ tenantCode: normalised });
    callableView = (res.data as PublicView | null) ?? null;
  } catch {
    // NOT_FOUND for legacy tenants / callable unreachable — fall through.
  }

  // Legacy /tenantCodes/{code} → /tenants/{tenantId} (pre-v2 + seed-drift recovery).
  let legacyTenant: Tenant | null = null;
  const codeSnap = await getDoc(doc(db, "tenantCodes", normalised));
  if (codeSnap.exists()) {
    const { tenantId } = codeSnap.data() as TenantCodeIndex;
    const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
    if (tenantSnap.exists()) {
      legacyTenant = tenantSnap.data() as Tenant;
    }
  }

  if (callableView?.tenantId) {
    // Prefer callable when its tenant also exists in the unprefixed tenants
    // collection (shared with memberships). If the callable points at a v2-only
    // ghost while legacy index is healthy, school login must use legacy — otherwise
    // getMembership(uid, ghostId) fails with "No active membership for this school".
    const legacyOfCallable = await getDoc(doc(db, "tenants", callableView.tenantId));
    if (legacyOfCallable.exists()) {
      return { ...callableView, id: callableView.tenantId } as unknown as Tenant;
    }
    if (legacyTenant) {
      return legacyTenant;
    }
    // Pure v2 tenant (no unprefixed twin) — keep callable result.
    return { ...callableView, id: callableView.tenantId } as unknown as Tenant;
  }

  return legacyTenant;
}

/**
 * Derive a synthetic email address for a student from their roll number.
 * Mirrors the server-side logic in `functions/identity/src/utils/auth-helpers.ts`.
 *
 * Example: rollNumber="STU-001", tenantId="abc123"
 *   → "stu-001@abc123.levelup.internal"
 */
export function deriveStudentEmail(rollNumber: string, tenantId: string): string {
  const sanitised = rollNumber.replace(/[^a-zA-Z0-9\-_]/g, "").toLowerCase();
  return `${sanitised}@${tenantId}.levelup.internal`;
}
