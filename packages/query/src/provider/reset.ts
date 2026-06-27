/**
 * Tenant-switch cache reset (query-infra.md §4.4).
 *
 * Every key is tenant-implicit (one provider = one active tenant). The only safe
 * cross-tenant boundary is a full `qc.clear()`. Called by the identity hook after
 * `switchActiveTenant` → `getIdToken(true)`.
 */
import type { QueryClient } from "@tanstack/react-query";

export function resetForTenantSwitch(qc: Pick<QueryClient, "clear">): void {
  qc.clear();
}
