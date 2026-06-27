# V8: Multi-Tenancy & Business Logic — Cycle 2 Refinement Plan

**Vertical:** V8 | **Cycle:** 2 | **Team:** Platform Engineer **Status:**
Implementation **Depends on:** C1-V8 ✅, C2-V1 (Types) in progress

---

## Audit Findings

### Critical Security (P0)

| Issue                                                                                 | File                            | Fix                                  |
| ------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------ |
| TenantAdmin can self-escalate subscription/features/status                            | save-tenant.ts                  | Gate privileged fields to SuperAdmin |
| Exam quota uses lifetime `stats.totalExams` instead of monthly `usage.examsThisMonth` | quota.ts                        | Use correct counter                  |
| CSS injection via unvalidated branding colors                                         | use-tenant-branding.ts          | Validate hex format                  |
| `superAdmin`/`tenantAdmin` in CreateOrgUserRequestSchema                              | callable-schemas.ts             | Remove from allowed roles            |
| Batch 500-op limit can fail deactivate/reactivate                                     | deactivate/reactivate-tenant.ts | Chunk batches                        |
| Missing audit log on tenant CREATE path                                               | save-tenant.ts                  | Add logTenantAction                  |
| Missing `bulkImportEnabled` feature gate                                              | bulk-import-students.ts         | Add assertFeatureEnabled             |

### Type Safety (P1)

| Issue                                      | File      | Fix           |
| ------------------------------------------ | --------- | ------------- |
| Missing TenantDeactivation interface       | tenant.ts | Add interface |
| Missing createdBy/updatedBy on Tenant type | tenant.ts | Add fields    |

---

## Implementation Scope

### Phase A: Security Hardening (save-tenant.ts)

1. Gate `status`, `subscription`, `features` to SuperAdmin-only on update
2. Add audit log on CREATE path
3. Add email validation on contactEmail

### Phase B: Quota & Feature Gate Fixes

1. Fix exam quota to use `usage.examsThisMonth`
2. Add `bulkImportEnabled` feature gate to bulk-import-students.ts

### Phase C: Batch Safety (deactivate/reactivate)

1. Chunk membership updates into batches of 450 (safety margin below 500)

### Phase D: Frontend Security

1. Validate hex colors in use-tenant-branding.ts

### Phase E: Schema & Type Fixes

1. Remove superAdmin/tenantAdmin from CreateOrgUserRequestSchema
2. Add TenantDeactivation interface
3. Add createdBy/updatedBy to Tenant type

---

## Acceptance Criteria

1. TenantAdmin update rejects status/subscription/features changes with
   'permission-denied'
2. Exam quota correctly uses monthly count from `usage.examsThisMonth`
3. CSS custom properties only accept valid hex colors
4. CreateOrgUser schema rejects superAdmin/tenantAdmin roles
5. Deactivation/reactivation handles tenants with >500 memberships
6. Tenant CREATE path writes audit log
7. Bulk import checks `bulkImportEnabled` feature flag
8. All builds pass with zero errors
