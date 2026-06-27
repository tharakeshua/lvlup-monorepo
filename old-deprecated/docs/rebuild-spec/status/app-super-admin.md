# Status Report: `apps/super-admin`

**Scope:** Platform-level control plane for the auto-levelup multi-tenant
learning + autograding platform. Provisioning tenants, cross-tenant management,
billing/cost monitoring, platform analytics, feature flags, global presets,
system health, announcements. **Date:** 2026-06-19 **Reference docs:**
`docs/SUPER-ADMIN-AUDIT-REPORT.md` (dated 2026-03-01, 38 findings),
`requirements/super-admin/requirements.md` (v1.0, 2026-03-22)

---

## 1. What Exists & How It's Architected

### 1.1 Stack

- Vite + React 18 + TypeScript SPA. `package.json` declares
  `@levelup/super-admin`.
- Routing: `react-router-dom` v7, fully lazy-loaded pages (`src/App.tsx:10-21`),
  `Suspense` + `PageLoader`, per-route `RouteErrorBoundary`.
- Data: `@tanstack/react-query` v5 for all reads; all query keys namespaced
  `["platform", ...]`.
- State/auth: shared `useAuthStore` from `@levelup/shared-stores`
  (`src/App.tsx:3`, `src/main.tsx`).
- UI: entirely from `@levelup/shared-ui` (AppShell, AppSidebar, StatCard, Table,
  Dialog, Form, etc.) + `recharts` for charts + `lucide-react` icons + `sonner`
  toasts.
- PWA: `public/sw.js`, `manifest.json`, `offline.html`, `SWUpdateNotification`
  in layout.
- Tests: Playwright E2E under `e2e/` (auth, dashboard, tenant-management,
  responsive); **no unit tests** (`package.json:12` is a stub echo).

### 1.2 Routing & navigation (`src/App.tsx`, `src/layouts/AppLayout.tsx`)

Authenticated routes wrapped by `RequireAuth` → `AppLayout`: | Route | Page file
| Capability | |---|---|---| | `/` | `DashboardPage.tsx` | Platform KPIs,
growth, charts, activity feed | | `/tenants` | `TenantsPage.tsx` | Tenant list +
create dialog | | `/tenants/:tenantId` | `TenantDetailPage.tsx` | Tenant
detail + 6 detail cards/dialogs | | `/analytics` | `UserAnalyticsPage.tsx` |
Cross-tenant user stats | | `/feature-flags` | `FeatureFlagsPage.tsx` |
Per-tenant feature toggles | | `/presets` | `GlobalPresetsPage.tsx` | Global
evaluation rubric presets | | `/llm-usage` | `LLMUsagePage.tsx` | Platform-wide
AI cost/usage | | `/system` | `SystemHealthPage.tsx` | Live health probes +
30-day uptime | | `/settings` | `SettingsPage.tsx` | Platform config, default
features, maintenance mode | | `/announcements` | `AnnouncementsPage.tsx` |
Platform announcements CRUD | | `/users` | `GlobalUsersPage.tsx` | Cross-tenant
user search |

Sidebar nav grouped Overview / Platform / System (`AppLayout.tsx:75-151`); route
prefetch on hover (`usePrefetch` + `SA_PREFETCH_MAP`), breadcrumb resolvers,
mobile bottom-nav (4 items).

### 1.3 Auth/authorization (`src/guards/RequireAuth.tsx`)

Defense-in-depth applied (audit fixes C1/C2 landed): denies unless
`firebaseUser` exists **and** Firestore `user.isSuperAdmin === true` **and** the
Firebase ID-token custom claim `role === "superAdmin"`
(`RequireAuth.tsx:21-22,48`). `LoginPage.tsx` handles email/password login.

### 1.4 Data access pattern (mixed — important)

Two distinct access styles coexist:

- **Direct Firestore reads** from the client SDK for most list/detail views:
  `getDocs(collection(db,"tenants"))` in
  TenantsPage/Dashboard/UserAnalytics/FeatureFlags/LLMUsage/SystemHealth;
  `getDoc(doc(db,"tenants",id))` in TenantDetail; `platformActivityLog` queries
  in Dashboard + TenantAuditLogCard; `evaluationSettings` in GlobalPresets;
  `platform/config` doc read/write in SettingsPage.
- **Cloud Function callables** (via `@levelup/shared-services`) for all
  mutations and a few reads: `callSaveTenant`, `callDeactivateTenant`,
  `callReactivateTenant`, `callExportTenantData`,
  `callSaveGlobalEvaluationPreset`, `callSearchUsers`, `callSaveAnnouncement`,
  `callListAnnouncements`, `callGetPlatformSummary`.

The callables are implemented in `functions/identity/src/callable/*` (exported
in `functions/identity/src/index.ts`) — except `getPlatformSummary` which lives
in `functions/analytics/src/callable/get-summary.ts`. All identity callables run
in region `asia-south1`, gate on `getUser(uid).isSuperAdmin` (or
`assertTenantAdminOrSuperAdmin`), enforce rate limits via `enforceRateLimit`,
and write audit trails via `logTenantAction` + `writePlatformActivity`.

### 1.5 Notable backend flows

- **Tenant create** (`save-tenant.ts:27-163`): SuperAdmin-only, transactional —
  derives `tenantCode` from shortName/name (uppercase, alnum, 12 chars),
  reserves uniqueness via `/tenantCodes/{code}`, seeds default
  `features`/`settings`/`usage`/`stats`, creates a `tenantAdmin`
  `userMembership` for the caller, sets the caller's custom claims to
  `tenantAdmin`, optionally stores Gemini key in Secret Manager
  (`tenant-{id}-gemini`), and logs `tenant_created`.
- **Tenant update** (`save-tenant.ts:164-256`): privilege-gated — only
  SuperAdmin can change `status`/`subscription`/`features`; uses dotted
  field-path partial updates.
- **Deactivate / reactivate** (`DeleteTenantDialog`/`TenantLifecycleCard` →
  `callDeactivateTenant`/`callReactivateTenant`): suspend/restore all
  memberships; **delete is intentionally soft** (audit C3 fixed — "Delete" UI
  actually deactivates).
- **Export** (`export-tenant-data.ts`): reads selected subcollections, writes
  JSON/CSV to Cloud Storage `exports/{tenantId}/...`, returns 1-hour signed URL.
- **Search users** (`search-users.ts`): SuperAdmin-only email/displayName prefix
  search across `/users`, joins active `userMemberships`.
- **System health** (`SystemHealthPage.tsx`): client runs live probes (Firestore
  read latency, Auth, Functions reachability via `callSaveTenant({data:{}})`,
  AI-config presence), writes a daily snapshot to
  `platformHealthSnapshots/{date}`, and reads 30-day history + 24h error count
  via `callGetPlatformSummary({scope:"health"})`.

---

## 2. Entities / Schemas / Collections / APIs / Routes

### 2.1 Domain types (source of truth: `packages/shared-types/src`)

- `Tenant` and sub-types `TenantSubscription`, `TenantFeatures`,
  `TenantSettings`, `TenantStats`, `TenantUsage`, `TenantBranding`,
  `TenantDeactivation`, `TenantAddress`, `TenantPlan`, `TenantStatus` —
  `identity/tenant.ts`.
- Tenant-code reservation: `identity/tenant-code.ts`.
- `EvaluationSettings`, `EvaluationDimension` — used by GlobalPresets (autograde
  domain).
- `DailyCostSummary` (with `byPurpose`, `budgetLimitUsd`) — used by LLMUsage.
- `PlatformActivityLog` — dashboard activity feed + tenant audit log.
- `SearchUsersResponse`, `SaveAnnouncementRequest`/`ListAnnouncementsResponse`,
  `HealthSummaryResponse`, `SaveResponse`, `ExportTenantDataResponse` —
  `callable-types.ts` (HealthSummaryResponse at `callable-types.ts:480`).

### 2.2 Firestore collections referenced

- `tenants/{id}` (+ subcollections read by export:
  `students,teachers,classes,exams,submissions`; LLMUsage reads
  `tenants/{id}/dailyCostSummaries`).
- `tenantCodes/{code}` (uniqueness reservation).
- `users/{uid}` (global search + `lastLoginAt` active-user count on dashboard).
- `userMemberships/{uid}_{tenantId}`.
- `evaluationSettings/{id}` (global presets — top-level collection).
- `platformActivityLog/{id}` (audit/activity).
- `platformHealthSnapshots/{date}`.
- `platform/config` (singleton settings doc).

### 2.3 Callable APIs (client wrapper → function)

| Client (`@levelup/shared-services`)              | Function file                                           | Auth                                                                |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `callSaveTenant`                                 | `functions/identity/src/callable/save-tenant.ts`        | SuperAdmin (create) / TenantAdmin+SuperAdmin (update, gated fields) |
| `callDeactivateTenant`                           | `.../deactivate-tenant.ts`                              | SuperAdmin                                                          |
| `callReactivateTenant`                           | `.../reactivate-tenant.ts`                              | SuperAdmin                                                          |
| `callExportTenantData`                           | `.../export-tenant-data.ts`                             | TenantAdmin/SuperAdmin                                              |
| `callSaveGlobalEvaluationPreset`                 | `.../save-global-preset.ts`                             | SuperAdmin                                                          |
| `callSearchUsers`                                | `.../search-users.ts`                                   | SuperAdmin                                                          |
| `callSaveAnnouncement` / `callListAnnouncements` | `.../save-announcement.ts`, `.../list-announcements.ts` | scope=platform → SuperAdmin                                         |
| `callGetPlatformSummary`                         | `functions/analytics/src/callable/get-summary.ts`       | SuperAdmin                                                          |

### 2.4 Security rules (`firestore.rules`)

`isSuperAdmin()` helper at line 10 reads `users/{uid}.isSuperAdmin`. Used to
gate `tenantCodes`, `platform*`, `evaluationSettings`, user delete,
self-elevation block (`!('isSuperAdmin' in request.resource.data) || unchanged`,
line 104-106). Settings page writes `platform/config` directly from client
(allowed only to SuperAdmin via rules).

---

## 3. Strengths Worth Keeping

1. **Clean, consistent page architecture.** Every page follows the same shape: a
   co-located `useXxx` React Query hook, skeleton/error/empty states,
   `PageHeader`, shared-ui primitives. Easy to read and extend.
2. **Defense-in-depth auth guard** combining Firestore flag + custom-claim
   verification (`RequireAuth.tsx`).
3. **Transactional, idempotent tenant provisioning** with code-uniqueness
   reservation and Secret-Manager-backed API keys (`save-tenant.ts`) — a solid
   core to preserve.
4. **Consolidated `saveTenant` endpoint** (one callable handles create +
   update + key storage) reduces surface area.
5. **Soft-delete lifecycle** (deactivate/reactivate with membership suspension)
   instead of destructive deletes — correct for multi-tenant data safety.
6. **Audit trail baked in** (`logTenantAction` + `writePlatformActivity` on
   every mutation; surfaced in dashboard feed + per-tenant audit card).
7. **Server-side privilege gating** of `status`/`subscription`/`features` so a
   tenant admin cannot self-upgrade.
8. **Cost/billing observability** already aggregates per-tenant
   `dailyCostSummaries` with budget % and by-purpose breakdown
   (`LLMUsagePage.tsx`).
9. **Good UX polish**: lazy routes + hover prefetch, breadcrumbs, PWA/offline,
   mobile bottom-nav, dark mode, accessible skip-to-content/route announcer.

---

## 4. Pain Points / Tech Debt / Inconsistencies

1. **Split-brain data access (the biggest issue).** Reads bypass the API layer
   and hit Firestore directly from the browser; mutations go through callables.
   This means:
   - Business/aggregation logic lives in the client (Dashboard computes growth,
     engagement, plan distribution in-browser; LLMUsage fans out N+1 reads — one
     `dailyCostSummaries` query **per tenant** in `Promise.all`,
     `LLMUsagePage.tsx:82-95`). Does not scale past a few dozen tenants.
   - The same aggregation cannot be reused by future React Native apps — it is
     React/Firestore-SDK coupled.
   - Each page re-fetches the full `tenants` collection independently
     (Dashboard, Tenants, UserAnalytics, FeatureFlags, LLMUsage, SystemHealth
     all `getDocs(collection("tenants"))`).
2. **No real-time delete / data lifecycle.** "Delete" is a relabeled deactivate
   (`DeleteTenantDialog`). There is no hard-delete / GDPR purge path; orphaned
   subcollections would accumulate if true deletion were ever needed (the
   original audit C3 was "fixed" by removing delete, not by building a recursive
   delete function).
3. **Feature-flag drift / duplicated source of truth.** The flag catalog is
   hardcoded in three places with divergent lists: `FeatureFlagsPage.tsx:26-36`
   (9 flags incl. `scannerAppEnabled`, `apiAccessEnabled`),
   `SettingsPage.tsx:64-72` (7 flags), and `TenantFeatures` type
   (`tenant.ts:34-44`). No single registry; adding a flag requires editing all
   three.
4. **Settings page writes `platform/config` straight from the client**
   (`SettingsPage.tsx:96-108`) — inconsistent with the "mutations via callable"
   rule everywhere else; `maintenanceMode`/`defaultFeatures`/`announcement` have
   no server validation or audit log, and `defaultFeatures` here is never
   actually consumed by `save-tenant.ts` (it hardcodes its own defaults at
   `save-tenant.ts:81-91`).
5. **Two announcement systems.** `SettingsPage` has a single free-text "Platform
   Announcement" string in `platform/config`, while `AnnouncementsPage` is a
   full draft/publish/archive CRUD via `callSaveAnnouncement`. Overlapping
   concepts, unclear which is authoritative.
6. **Missing composite indexes.** `TenantAuditLogCard` queries
   `platformActivityLog` with `where(tenantId)+where(action)+orderBy(createdAt)`
   (`TenantAuditLogCard.tsx:69-74`) but `firestore.indexes.json` has **no**
   `platformActivityLog` index — filtered queries will throw at runtime until an
   index is hand-created.
7. **Pagination is client-side only.** `usePagination`/`useSort` paginate
   already-fully-loaded arrays. Audit log "pagination" is fake
   (`TenantAuditLogCard.tsx:79-80` comment admits no cursors; just "showing
   first 20"). Search is `limit(20)` with no next-page.
8. **Timestamp handling duplicated & fragile.** Multiple ad-hoc
   `formatTimestamp`/`{seconds, toDate}` shims (DashboardPage, GlobalUsersPage,
   AnnouncementsPage, TenantAuditLogCard, TenantSubscriptionCard) instead of one
   shared util. Casts like `tenant.subscription.expiresAt.seconds` assume a
   shape.
9. **System health is client-driven and noisy.** Health "probe" for Functions
   calls `callSaveTenant({data:{}})` (`SystemHealthPage.tsx:112`) — a mutation
   endpoint used as a ping; it relies on error-code heuristics and writes a
   snapshot on every manual refresh from the browser. Should be a scheduled
   server-side health check.
10. **Status enum mismatch.** `EditTenantDialog` status select omits
    `deactivated` (`EditTenantDialog.tsx:119-124`) though it is a valid
    `TenantStatus`; `subscriptionSchema` includes `free` plan but the create
    form and `TenantPlan` usage elsewhere don't expose it consistently.
11. **No billing/invoicing despite "billing/cost" mandate.**
    `TenantSubscription` has
    `billingCycle`/`billingEmail`/`currentPeriodStart/End`/`cancelAtPeriodEnd`
    fields, but there is no UI to set them and no payment-provider integration
    (Razorpay MCP exists in env but unused). "Billing" today = cost
    observability only.
12. **No tests of substance.** Unit test script is a stub; only E2E exists.
13. **Type erosion at the read boundary.** Direct reads cast with `as Tenant` /
    `as PlatformActivityLog` with no runtime validation, so schema drift fails
    silently in the UI.

---

## 5. Recommendations for a Fresh Rebuild

Keep the core concepts (tenant provisioning, soft lifecycle, feature flags, cost
monitoring, global presets, audit trail, defense-in-depth auth) but restructure
around a **common API layer** so web + future React Native clients share logic.

### 5.1 Introduce a versioned platform API layer (highest priority)

- Move **all** platform reads behind callables/HTTP endpoints (e.g.
  `getPlatformOverview`, `listTenants`, `getTenant`, `listPlatformActivity`,
  `getLlmUsage`, `getUserAnalytics`). Do server-side aggregation once (Dashboard
  KPIs, growth, plan distribution, LLM cost rollups) instead of fanning out from
  the browser. This kills the N+1 in `LLMUsagePage` and the duplicated
  full-collection scans.
- Define request/response with shared Zod schemas in `shared-types` so the same
  contract is consumed by web and RN. Validate responses at the client boundary
  (no more `as Tenant`).
- Keep callables thin; put aggregation behind scheduled jobs that materialize
  `platformStats` / `platformDailyRollup` docs the API can read cheaply
  (analytics functions already do daily cost aggregation — extend that pattern).

### 5.2 Single feature-flag registry

- Create one canonical flag definition (key, label, description, default,
  plan-gating) in `shared-types`, generated/consumed by `TenantFeatures`,
  FeatureFlagsPage, SettingsPage defaults, and `save-tenant.ts` seeding. Add a
  `saveTenantFeatures` callable rather than the generic
  `callSaveTenant({features})`.

### 5.3 Consolidate settings & announcements

- One announcements system (the CRUD one); drop the free-text string in
  `platform/config`. Route `platform/config` writes through a
  `savePlatformConfig` callable with validation + audit logging + a real
  `maintenanceMode` enforcement hook the other apps honor.

### 5.4 Real pagination & search

- Cursor-based pagination in the API (return `nextCursor`); replace
  `usePagination` client slicing for large collections (tenants, users,
  activity). Wire the `platformActivityLog` composite indexes into
  `firestore.indexes.json` before shipping the audit filter.

### 5.5 Proper lifecycle & deletion

- Keep soft-deactivate as default. Add a `deleteTenant` callable that
  recursively purges subcollections + memberships + tenantCode + secrets, behind
  an explicit "hard delete" confirmation, for GDPR/offboarding.

### 5.6 Server-side health & true billing

- Replace browser-driven probes with a scheduled `platformHealthCheck` writing
  `platformHealthSnapshots`; the page just reads. Stop using `saveTenant` as a
  ping.
- Build out subscription/billing UI using the existing `TenantSubscription`
  fields; integrate the payment provider (Razorpay) for real invoicing if
  monetization is in scope, or clearly scope "billing" as cost-tracking only.

### 5.7 Shared utilities & RN-readiness

- One `formatTimestamp`/timestamp-coercion util in `shared-utils`; one
  `useTenants`-style data hook in `shared-hooks` consuming the new API so RN
  reuses it.
- Centralize the super-admin auth check (Firestore flag + claim) in
  `shared-stores`/`shared-hooks` so all platform clients share it.

### 5.8 Tests

- Add unit/integration tests for the aggregation callables (where the logic now
  lives) and contract tests on the Zod schemas; keep the existing Playwright
  E2E.

---

_File generated for the rebuild-spec status pass. Cross-referenced against
`docs/SUPER-ADMIN-AUDIT-REPORT.md` (original critical findings C1/C2 verified
fixed in `RequireAuth.tsx`; C3 addressed by removing hard-delete; the
create/edit-via-Cloud-Function split (C4/C5) is now consistent for mutations,
but the broader read-side direct-Firestore coupling remains the dominant debt)._
