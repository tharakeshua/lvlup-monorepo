# Super-Admin Design Surface Audit

**Date:** 2026-07-19  
**Scope:** Platform-level screens only (super-admin-\* + cross-tenant + global +
platform + system + tenant screens)  
**Method:** Functional coverage — route/page exists with equivalent
functionality (not pixel fidelity)  
**Totals: 1 missing · 7 partial · 4 implemented · 12 surfaces audited**

---

## MISSING (1)

| Screen                | Spec File                                        | App File | Reason                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `super-admin-billing` | `prototypes/admin/super-admin-billing.card.html` | —        | No billing page route or implementation found in app routing. Spec describes subscription details, quota caps, cost ledger, daily cost trend chart, and per-tenant usage table. None exist. |

---

## PARTIAL (7)

| Screen                      | Spec File                                              | App File                                           | Gaps                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cross-tenant-global-users` | `prototypes/admin/cross-tenant-global-users.card.html` | `apps/super-admin/src/pages/GlobalUsersPage.tsx`   | Core search/results table works; missing elevated scope banner, row actions menu (impersonate / open-in-tenant / disable / reset), action modals, toast notifications, and pagination UI                                                                                                  |
| `feature-flags`             | `prototypes/admin/feature-flags.card.html`             | `apps/super-admin/src/pages/FeatureFlagsPage.tsx`  | Card-based editing and adoption overview present; missing matrix table view (spec's lg+ default), view toggle, plan-gated lock indicators, high-impact disable confirmation dialog, and success toast notifications                                                                       |
| `platform-analytics`        | `prototypes/admin/platform-analytics.card.html`        | `apps/super-admin/src/pages/UserAnalyticsPage.tsx` | KPI cards and per-tenant table exist; missing trend charts (signups area chart + active-users/retention line chart), delta/trend indicators on KPI cards, and search/filter on per-tenant table                                                                                           |
| `super-admin-announcements` | `prototypes/admin/super-admin-announcements.card.html` | `apps/super-admin/src/pages/AnnouncementsPage.tsx` | Core CRUD + status-tabbed table + compose modal implemented; missing platform scope context banner, audience/tenant targeting in modal, publish scheduling (only expiry), and publish/archive confirmation dialogs                                                                        |
| `super-admin-settings`      | `prototypes/admin/super-admin-settings.card.html`      | `apps/super-admin/src/pages/SettingsPage.tsx`      | Platform announcements, feature flag toggles, maintenance mode, and admin account sections present; missing AI Configuration card, Platform Contact & Branding card (support email/name/logo), Provisioning Defaults card (default plan, max tenants), and unsaved-changes warning banner |
| `App-SuperAdmin-shell`      | `app/web-super-admin/App-SuperAdmin.card.html`         | `apps/super-admin/src/layouts/AppLayout.tsx`       | Header chrome and all routes except billing present; missing `/billing` nav item; nav group structure differs (spec: Overview/Platform/Control/Broadcast/Config vs app: Overview/Platform/System)                                                                                         |
| `tenant-provisioning`       | `prototypes/admin/tenant-provisioning.card.html`       | `apps/super-admin/src/pages/TenantsPage.tsx`       | Core list/search/filter/pagination/create-tenant flow implemented; missing KPI strip header (Total/Active/Trial/Suspended counts) and platform maintenance alert banner                                                                                                                   |

---

## IMPLEMENTED (4)

| Screen              | Spec File                                      | App File                                           | Notes                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global-presets`    | `prototypes/admin/global-presets.card.html`    | `apps/super-admin/src/pages/GlobalPresetsPage.tsx` | All CRUD, dimension editing, display settings, empty/error states present; rubric weight bar chart is a visual trade-off (app uses chips), not a functional gap                                                       |
| `platform-overview` | `prototypes/admin/platform-overview.card.html` | `apps/super-admin/src/pages/DashboardPage.tsx`     | KPI cards, growth metrics, distribution charts, activity feed, recent tenants list, quick actions, error alerts, loading states, and sign-out confirmation all covered                                                |
| `system-health`     | `prototypes/admin/system-health.card.html`     | `apps/super-admin/src/pages/SystemHealthPage.tsx`  | Service probes, 30-day uptime history, platform metrics, overall status banner, refresh controls, and loading/error/data state variants all present                                                                   |
| `tenant-detail`     | `prototypes/admin/tenant-detail.card.html`     | `apps/super-admin/src/pages/TenantDetailPage.tsx`  | All sections implemented: profile header + KPI strip, subscription card, contact info, features display, settings (AI key/model/locale), lifecycle (activate/deactivate dialogs), data export, and filtered audit log |

---

## Summary by App Page

| App Page                | Design Screen                               | Verdict        |
| ----------------------- | ------------------------------------------- | -------------- |
| `DashboardPage.tsx`     | platform-overview                           | ✅ implemented |
| `TenantsPage.tsx`       | tenant-provisioning                         | ⚠️ partial     |
| `TenantDetailPage.tsx`  | tenant-detail                               | ✅ implemented |
| `GlobalUsersPage.tsx`   | cross-tenant-global-users                   | ⚠️ partial     |
| `FeatureFlagsPage.tsx`  | feature-flags                               | ⚠️ partial     |
| `GlobalPresetsPage.tsx` | global-presets                              | ✅ implemented |
| `UserAnalyticsPage.tsx` | platform-analytics                          | ⚠️ partial     |
| `LLMUsagePage.tsx`      | _(not audited — no matching spec in scope)_ | —              |
| `AnnouncementsPage.tsx` | super-admin-announcements                   | ⚠️ partial     |
| `SettingsPage.tsx`      | super-admin-settings                        | ⚠️ partial     |
| `SystemHealthPage.tsx`  | system-health                               | ✅ implemented |
| `LoginPage.tsx`         | _(no spec in scope)_                        | —              |
| `AppLayout.tsx`         | App-SuperAdmin-shell                        | ⚠️ partial     |
| _(no page)_             | super-admin-billing                         | ❌ missing     |

---

## Top Priority Gaps

1. **super-admin-billing** — entire surface unbuilt; blocks
   subscription/quota/cost visibility
2. **super-admin-settings** — 3 full spec sections absent (AI config, branding,
   provisioning defaults)
3. **cross-tenant-global-users** — impersonation and cross-tenant user actions
   entirely missing
4. **platform-analytics** — trend charts and KPI deltas absent; reduces
   analytical value significantly
5. **App-SuperAdmin-shell** — missing billing nav entry (follows from #1) + nav
   grouping restructure needed
