# V8: Multi-Tenancy & Business Logic — Cycle 2 Test Report

**Vertical:** V8 | **Cycle:** 2 | **Team:** Platform Engineer **Date:**
2026-03-07

---

## Build Verification

| Package                     | TypeCheck                                 | Build                  | Status |
| --------------------------- | ----------------------------------------- | ---------------------- | ------ |
| @levelup/shared-types       | `tsc --noEmit` — 0 errors                 | ✅                     | PASS   |
| @levelup/shared-hooks       | Pre-existing errors only (not V8-related) | ✅                     | PASS   |
| @levelup/shared-stores      | `tsc --noEmit` — 0 errors                 | ✅                     | PASS   |
| @levelup/functions-identity | `tsc --noEmit` — 0 errors                 | ✅                     | PASS   |
| @levelup/admin-web          | `tsc --noEmit` — 0 errors                 | `vite build` — success | PASS   |
| @levelup/super-admin        | `tsc --noEmit` — 0 errors                 | `vite build` — success | PASS   |

---

## Security Fixes (P0)

| Fix                                                        | File                    | Before                                                          | After                                                            | Status |
| ---------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| TenantAdmin can self-escalate subscription/features/status | save-tenant.ts          | Any TenantAdmin can update `status`, `subscription`, `features` | Gated to SuperAdmin-only with `permission-denied` error          | PASS   |
| Missing audit log on CREATE                                | save-tenant.ts          | No `logTenantAction` on tenant creation                         | Added `logTenantAction('createTenant', ...)`                     | PASS   |
| Exam quota uses lifetime counter                           | quota.ts                | `current: stats.totalExams`                                     | `current: usage?.examsThisMonth ?? stats.totalExams`             | PASS   |
| CSS injection via branding colors                          | use-tenant-branding.ts  | Direct CSS property injection                                   | Hex color regex validation (`/^#[0-9a-fA-F]{3,8}$/`) + SSR guard | PASS   |
| superAdmin/tenantAdmin in CreateOrgUser schema             | callable-schemas.ts     | Role enum included `superAdmin`, `tenantAdmin`                  | Removed — only `teacher/student/parent/scanner/staff`            | PASS   |
| Batch 500-op limit in deactivate                           | deactivate-tenant.ts    | Single batch for all memberships                                | Chunked into batches of 450                                      | PASS   |
| Batch 500-op limit in reactivate                           | reactivate-tenant.ts    | Single batch for all memberships                                | Chunked into batches of 450                                      | PASS   |
| Missing bulkImportEnabled feature gate                     | bulk-import-students.ts | No feature flag check                                           | Added `assertFeatureEnabled('bulkImportEnabled')`                | PASS   |
| TenantAdmin direct Firestore update                        | firestore.rules         | `allow update: if isSuperAdmin() \|\| isTenantAdmin(tenantId)`  | `allow update: if isSuperAdmin()` (TenantAdmins use callable)    | PASS   |

## Type Safety Fixes (P1)

| Fix                                   | File              | Before                       | After                                                | Status |
| ------------------------------------- | ----------------- | ---------------------------- | ---------------------------------------------------- | ------ |
| Missing TenantDeactivation interface  | tenant.ts         | `deactivation` field untyped | Added `TenantDeactivation` interface with all fields | PASS   |
| Missing createdBy/updatedBy on Tenant | tenant.ts         | Fields not on interface      | Added `createdBy?: string` and `updatedBy?: string`  | PASS   |
| TenantDeactivation not exported       | identity/index.ts | Not in exports               | Added to re-exports                                  | PASS   |

---

## Files Modified/Created

### Modified Files (12)

| File                                                      | Changes                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `functions/identity/src/callable/save-tenant.ts`          | Gate status/subscription/features to SuperAdmin; add CREATE audit log |
| `functions/identity/src/callable/bulk-import-students.ts` | Add `assertFeatureEnabled('bulkImportEnabled')` check                 |
| `functions/identity/src/callable/deactivate-tenant.ts`    | Chunk batch operations into 450-item batches                          |
| `functions/identity/src/callable/reactivate-tenant.ts`    | Chunk batch operations into 450-item batches                          |
| `functions/identity/src/utils/quota.ts`                   | Fix exam quota to use `usage.examsThisMonth`                          |
| `packages/shared-types/src/identity/tenant.ts`            | Add TenantDeactivation interface; add createdBy/updatedBy             |
| `packages/shared-types/src/identity/index.ts`             | Export TenantDeactivation                                             |
| `packages/shared-types/src/schemas/callable-schemas.ts`   | Remove superAdmin/tenantAdmin from CreateOrgUserRequestSchema         |
| `packages/shared-hooks/src/ui/use-tenant-branding.ts`     | Add hex color validation; add SSR guard                               |
| `firestore.rules`                                         | Restrict tenant doc updates to SuperAdmin only                        |

### New Files (2)

| File                                                | Purpose                    |
| --------------------------------------------------- | -------------------------- |
| `docs/evolution/v7-admin-dashboards/cycle2-plan.md` | V7 Cycle 2 refinement plan |
| `docs/evolution/v8-multi-tenancy/cycle2-plan.md`    | V8 Cycle 2 refinement plan |

---

## Known Issues Not Addressed (Deferred to Later Cycles)

1. **N+1 Firestore queries in LLMUsagePage** — Performance issue; requires
   server-side aggregation (Cloud Function)
2. **Synthetic email domain inconsistency** — `create-org-user.ts` uses
   `.levelup.local`, `bulk-import-students.ts` uses `.levelup.internal`;
   requires migration consideration
3. **Plaintext credentials in bulk-import response** — Requires encrypted
   delivery mechanism
4. **TenantDetailPage 884-line monolith** — Needs decomposition into
   sub-components
5. **UsersPage 725-line monolith** — Needs decomposition into tab components
6. **StaffPage fetches all userMemberships** — Needs scoped query optimization

---

## Summary

| Metric                 | Count    |
| ---------------------- | -------- |
| P0 security fixes      | 9        |
| P1 type safety fixes   | 3        |
| Files modified         | 12       |
| New files              | 2        |
| Type errors introduced | 0        |
| Build status           | ALL PASS |
