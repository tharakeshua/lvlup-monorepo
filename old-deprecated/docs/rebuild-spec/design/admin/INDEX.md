# Admin Area — Design Spec Index ("Lyceum")

> Conforms to [00-FOUNDATION](../00-FOUNDATION.md). Compose every screen from
> the tokens and components defined there — do not invent new colors, fonts,
> spacing, or variants.

The **Admin area** covers two distinct surfaces, both **web-first** and both
written in the **serious / precise** register of the Lyceum direction (warm
paper neutrals, deep indigo primary, mono numerics; the marigold "spark" stays
reserved — admin chrome is calm and credible, not playful):

1. **Tenant-Admin Console** — the day-to-day operational console for a
   `tenantAdmin`, scoped to a single tenant: users, classes, staff, exams,
   spaces, analytics, billing-of-AI-cost, settings.
2. **Super-Admin Control Plane** — the cross-tenant platform plane for a
   platform operator: provisioning tenants, global users, feature flags, LLM
   cost, system health.

Both share the same
[AppShell](../00-FOUNDATION.md#5-core-component-inventory-compose-screens-from-these)
(sidebar + topbar), `DataTable`-heavy layouts, and the Lyceum token set — they
differ in scope (one tenant vs. all tenants) and in the data they can reach.

---

## Tenant-Admin Console

Role: `tenantAdmin` (scoped to one tenant). Grouped by `AppSidebar` nav groups.

### Overview

| Screen            | Route         | Purpose                                                              | Spec                                        |
| ----------------- | ------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| Admin Dashboard   | `/`           | Tenant home — KPIs, at-risk students, recent activity, quick actions | [admin-dashboard](./admin-dashboard.md)     |
| Onboarding Wizard | `/onboarding` | First-run tenant setup — branding, sessions, first users/classes     | [onboarding-wizard](./onboarding-wizard.md) |

### Management

| Screen                           | Route                                     | Purpose                                              | Spec                                                                |
| -------------------------------- | ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| User Management                  | `/users`                                  | Manage students / teachers / parents                 | [user-management](./user-management.md)                             |
| Parent–Student Linking           | `/users` (Parents tab) + linking flow     | Link parent accounts to their students               | [parent-linking](./parent-linking.md)                               |
| Class Management                 | `/classes`                                | Class list, create/archive classes                   | [class-management](./class-management.md)                           |
| Class Detail                     | `/classes/:classId`                       | Roster, teachers, spaces, exams for one class        | [class-detail](./class-detail.md)                                   |
| Staff Management                 | `/staff`                                  | Invite/manage teachers & staff, assign roles         | [staff-management](./staff-management.md)                           |
| Memberships, Roles & Permissions | cross-cutting (staff/users role surfaces) | Membership model, role assignment, permission matrix | [memberships-roles-permissions](./memberships-roles-permissions.md) |
| Exams Overview                   | `/exams`                                  | Tenant-wide exam catalog, status, scheduling         | [exams-overview](./exams-overview.md)                               |
| Learning Spaces Overview         | `/spaces`                                 | Tenant-wide spaces, publish state, ownership         | [spaces-overview](./spaces-overview.md)                             |
| Courses                          | `/courses`                                | Course catalog spanning spaces/classes               | [courses](./courses.md)                                             |
| Academic Sessions & Rollover     | `/academic-sessions`                      | Term setup, year rollover, archival                  | [academic-sessions](./academic-sessions.md)                         |

### Analytics

| Screen                   | Route        | Purpose                                                | Spec                                |
| ------------------------ | ------------ | ------------------------------------------------------ | ----------------------------------- |
| AI Usage & Cost (Tenant) | `/ai-usage`  | Tenant AI consumption, cost, budget vs. quota          | [ai-usage-cost](./ai-usage-cost.md) |
| Analytics (Tenant)       | `/analytics` | Cohort/engagement/mastery analytics, insights, at-risk | [analytics](./analytics.md)         |
| Reports                  | `/reports`   | Generated/exportable reports                           | [reports](./reports.md)             |

### Configuration

| Screen                     | Route            | Purpose                                   | Spec                                                      |
| -------------------------- | ---------------- | ----------------------------------------- | --------------------------------------------------------- |
| Announcements (Tenant)     | `/announcements` | Author/schedule tenant-wide announcements | [announcements](./announcements.md)                       |
| Notifications Inbox        | `/notifications` | Incoming notifications for the admin      | [notifications](./notifications.md)                       |
| Tenant Settings & Branding | `/settings`      | Tenant profile, branding, defaults        | [tenant-settings-branding](./tenant-settings-branding.md) |
| Data Export                | `/data-export`   | Export tenant data (GDPR / backup)        | [data-export](./data-export.md)                           |

---

## Super-Admin Control Plane

Role: platform super-admin (cross-tenant). The sidebar mirrors the tenant
console structure but every surface is platform-scoped.

| Screen                      | Route                                            | Purpose                                                       | Spec                                                        |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Platform Overview           | `/`                                              | Super-admin dashboard — tenants, platform KPIs, health glance | [platform-overview](./platform-overview.md)                 |
| Tenant Provisioning         | `/tenants`                                       | Tenants list + create/provision new tenant                    | [tenant-provisioning](./tenant-provisioning.md)             |
| Tenant Detail               | `/tenants/:tenantId`                             | Cross-tenant management of one tenant                         | [tenant-detail](./tenant-detail.md)                         |
| Billing & Subscriptions     | `/tenants/:tenantId` (subscription) + cost views | Plans, subscriptions, platform cost views                     | [super-admin-billing](./super-admin-billing.md)             |
| Global Users                | `/users`                                         | Users across all tenants                                      | [cross-tenant-global-users](./cross-tenant-global-users.md) |
| Platform Analytics          | `/analytics`                                     | Cross-tenant user/usage analytics                             | [platform-analytics](./platform-analytics.md)               |
| Feature Flags               | `/feature-flags`                                 | Per-tenant feature toggles                                    | [feature-flags](./feature-flags.md)                         |
| Global Evaluation Presets   | `/presets`                                       | Platform-wide grading/evaluation presets                      | [global-presets](./global-presets.md)                       |
| LLM Usage & Cost (Platform) | `/llm-usage`                                     | Cross-tenant LLM consumption & spend                          | [llm-usage](./llm-usage.md)                                 |
| System Health               | `/system`                                        | Service status, jobs, error rates                             | [system-health](./system-health.md)                         |
| Platform Settings           | `/settings`                                      | Global platform configuration                                 | [super-admin-settings](./super-admin-settings.md)           |
| Platform Announcements      | `/announcements`                                 | Broadcast announcements to all tenants                        | [super-admin-announcements](./super-admin-announcements.md) |

---

## Cross-cutting concerns

These rules thread through multiple specs. Each spec must surface the ones
relevant to it (per FOUNDATION §7.8 "Domain rules surfaced").

| Concern                         | What it means                                                                                                                                                          | Primary specs                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant isolation**            | Tenant-admin data is hard-scoped to one tenant; super-admin must always show _which_ tenant a row belongs to and never leak cross-tenant data into the tenant console. | [admin-dashboard](./admin-dashboard.md), [user-management](./user-management.md), [data-export](./data-export.md), [tenant-detail](./tenant-detail.md), [cross-tenant-global-users](./cross-tenant-global-users.md)         |
| **RBAC / memberships**          | Membership = (user, tenant, role). Roles gate every screen and action; permission-gated UI variations per FOUNDATION §7.5.                                             | [memberships-roles-permissions](./memberships-roles-permissions.md), [staff-management](./staff-management.md), [user-management](./user-management.md), [parent-linking](./parent-linking.md)                              |
| **Audit logging**               | Destructive/sensitive admin actions (role change, archival, export, provisioning, flag flips) are logged and shown in activity/audit views.                            | [tenant-detail](./tenant-detail.md), [feature-flags](./feature-flags.md), [data-export](./data-export.md), [academic-sessions](./academic-sessions.md), [memberships-roles-permissions](./memberships-roles-permissions.md) |
| **Quota / cost budgets**        | AI/LLM spend is metered against per-tenant quotas; budgets surface as Stat/ProgressBar + warning/error status when near/over limit.                                    | [ai-usage-cost](./ai-usage-cost.md), [llm-usage](./llm-usage.md), [super-admin-billing](./super-admin-billing.md), [admin-dashboard](./admin-dashboard.md)                                                                  |
| **Multi-tenant role switching** | Topbar tenant switcher + `RoleSwitcher`; super-admin "enter tenant" / impersonate context, with a persistent banner indicating active scope.                           | [tenant-detail](./tenant-detail.md), [platform-overview](./platform-overview.md), [cross-tenant-global-users](./cross-tenant-global-users.md)                                                                               |

---

## Shared components

Admin screens compose almost entirely from FOUNDATION §5. The recurring set:

**Core / navigation**

- `AppShell` + `Sidebar` (role-driven nav) + `Topbar` (tenant switcher, search,
  notifications, profile) — every screen.
- `Breadcrumb` on all detail routes; `CommandPalette` (⌘K) for jump-to
  navigation.
- `RoleSwitcher` — super-admin scope/impersonation and merged-role contexts.

**Data**

- `DataTable` (sort/filter/paginate/select) — the workhorse of users, classes,
  staff, exams, spaces, tenants, global users, feature flags.
- `Card` / `Panel` / `Section` + `Stat`/`KPI` + `ProgressBar`/`ProgressRing` —
  dashboards, cost/quota, analytics.
- `DefinitionList`, `Timeline` (activity/audit), `Pagination`,
  `Avatar`/`AvatarGroup`, `Badge`, `Chip/Tag`, `EmptyState`, `Skeleton`.

**Feedback**

- `ConfirmDialog` — every destructive/sensitive action (archive, delete, role
  change, export, provision, flag flip).
- `Toast` (sonner), `InlineAlert`/`Banner` (quota warnings, scope banners),
  `LoadingOverlay`, `FormFieldError`.

**Domain components (cross-app §5)**

- `ConfidenceBadge` + `GradePill` — exams overview, analytics, reports
  (assessment status surfaced read-only).
- `SpaceCard` + `StoryPointTrack`/`StoryPointNode` mastery states — spaces
  overview, courses, class detail.
- `InsightCard` + `AtRiskBadge` — admin dashboard, analytics, platform
  analytics.
- `XPMeter` / `StreakFlame` / `LevelBadge` / `LeaderboardRow` — appear read-only
  in analytics/engagement views (spark accent is the one place admin chrome
  warms up).
- `SubmissionCard`, `RubricBreakdown` — referenced from exam/report drill-downs.

**Forms** (onboarding, settings, provisioning, announcements, presets): `Input`,
`Textarea`, `Select`, `Combobox`, `Switch`, `Checkbox`, `DatePicker`, `FileDrop`
(branding/logo upload), `Button` (primary/secondary/ghost/**danger** for
destructive admin actions).

> Web↔mobile: the Admin area is **web-first**. Where a mobile view is needed,
> `DataTable` rows collapse to stacked `Card`s and `⌘K`/hover affordances are
> dropped (FOUNDATION §6).
