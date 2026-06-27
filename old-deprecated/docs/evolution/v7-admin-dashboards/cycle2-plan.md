# V7: Admin Dashboards — Cycle 2 Refinement Plan

**Vertical:** V7 | **Cycle:** 2 | **Team:** Platform Engineer **Status:**
Implementation **Depends on:** C1-V7 ✅, C1-V8 ✅, C2-V1 (Types) in progress

---

## Audit Findings

### Super Admin (apps/super-admin/)

| Priority | Issue                                                                 | File                  | Fix                               |
| -------- | --------------------------------------------------------------------- | --------------------- | --------------------------------- |
| P0 Bug   | `useMemo`/`usePagination` called after early return (Rules of Hooks)  | UserAnalyticsPage.tsx | Move hooks above early return     |
| P0 Bug   | LLM month-end hardcoded to day 31 (incorrect for Feb/Apr/Jun/Sep/Nov) | LLMUsagePage.tsx      | Use proper last-day-of-month calc |
| P1 UX    | No confirmation dialog before tenant deactivation                     | TenantDetailPage.tsx  | Add AlertDialog                   |
| P1 Type  | Status type casts missing 'deactivated' across all pages              | Multiple              | Fix all status casts              |
| P2 A11y  | Filter pills missing aria-pressed; progress bars missing ARIA         | Multiple              | Add ARIA attributes               |
| P2 DX    | 884-line TenantDetailPage monolith                                    | TenantDetailPage.tsx  | Extract sub-components            |

### Admin Web (apps/admin-web/)

| Priority | Issue                                                           | File                     | Fix                         |
| -------- | --------------------------------------------------------------- | ------------------------ | --------------------------- |
| P1 UX    | usePagination doesn't reset currentPage on filter/search change | usePagination.ts         | Add useEffect to reset page |
| P1 Nav   | Missing breadcrumb labels for /staff and /onboarding            | AppBreadcrumb.tsx        | Add route labels            |
| P1 UX    | OnboardingWizard skip doesn't mark steps; no resume on refresh  | OnboardingWizardPage.tsx | Fix skip + add resume logic |
| P2 A11y  | Icon buttons across pages lack aria-labels                      | Multiple                 | Add aria-labels             |

---

## Implementation Scope

### Phase A: Critical Bug Fixes (super-admin)

1. Fix UserAnalyticsPage hooks ordering
2. Fix LLMUsagePage month-end calculation
3. Fix status type casts across all pages

### Phase B: UX Improvements (super-admin)

1. Add deactivation confirmation dialog to TenantDetailPage

### Phase C: Admin-Web Fixes

1. Fix usePagination page reset
2. Add missing breadcrumb labels
3. Fix OnboardingWizard skip/resume behavior

---

## Acceptance Criteria

1. UserAnalyticsPage renders without Rules of Hooks violation
2. LLM month navigation correctly handles months with fewer than 31 days
3. All status type references include 'deactivated'
4. Tenant deactivation requires confirmation dialog
5. Pagination resets to page 1 when filters/search change
6. Breadcrumbs show correct labels for /staff and /onboarding
7. Both apps build with zero errors
