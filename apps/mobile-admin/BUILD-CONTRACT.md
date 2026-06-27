# Mobile Admin Build — Parallel Contract (disjoint lanes)

> NEW Expo app `apps/mobile-admin` (tenant-admin role), built on the PROVEN fat
> SDK by copying `apps/mobile-student` `src/sdk` + `src/components` verbatim.
> Many maestro sessions build `src/screens/*` concurrently without conflict —
> each owns a **disjoint directory subtree** and codes against the **shared
> contracts** below. The coordinator (M-admin-coord) owns the shell (`src/app` +
> `src/lib` + `src/sdk`), integrates, runs the build green, and installs on the
> OnePlus + iOS sim.

## Hard rules

- **Lane = a directory subtree.** NEVER edit outside your lane. `src/app`,
  `src/lib`, `src/sdk` are **coordinator-owned** (the routes + registry contract
  is frozen below); import from them, never edit them. `src/components` +
  `src/theme` are owned by **M-admin-components**.
- **No direct Firestore.** Screens get data ONLY via `@levelup/query` hooks. No
  `firebase/*` imports in screens.
- **Code DEFENSIVELY.** The deployed `lvlup-ff6fa` admin callables are being
  canonicalized + deployed by SDK-coord (GATE-B). Until live, identity/academics
  reads **soft-miss to empty** (`NOT_FOUND`/`UNAUTHENTICATED` → zero state, NOT
  an error — use `lib/query-status` `isHardError`/`isSoftMissError`). Guard
  EVERY nested field (`x?.a ?? x?.b ?? fallback`); never `.toFixed()`/index into
  a possibly-undefined object; response shapes may drift from the TS types
  (price/rating/stats etc.).
- **Branded ids:** route params + `useSession().user.uid` are plain `string`;
  hooks want branded ids from `@levelup/domain`
  (`UserId`/`ClassId`/`TenantId`/…). Cast at the call boundary
  (`uid as UserId`).
- **Styling:** NativeWind v4 classes + the Lyceum theme tokens (already in
  `src/theme` + `tailwind.config.js`). Match look to
  `~/Desktop/lvlup-mobile/Lyceum-Mobile-Staff.html` (admin routes `#/admin/*`) +
  `docs/rebuild-spec/design/build/prototypes/admin/<screen>.card.html`.
  Structure/markup: lift from the prototype cards (desktop tables → stacked
  Card/ListRow rows, hover → tap).
- **Typecheck:**
  `PATH=/opt/homebrew/opt/node@20/bin:$PATH pnpm exec tsc --noEmit` from
  `apps/mobile-admin`. `npx tsc` is a DECOY — do not use it. Your lane must be
  tsc-green before reporting done.
- All sessions Opus 4.8 1M (claude). Report at your gate to M-admin-coord.

## Folder layout (lanes)

```
apps/mobile-admin/src/
  sdk/         [DONE — coordinator]  firebase/api/session/SdkProvider/env (admin autologin set)
  app/         [coordinator]         expo-router tree, admin tab navigator, modals, route files
  lib/         [coordinator]         routes.ts, screens.tsx registry, query-status, ScreenBoundary
  theme/       [LANE: components]    Lyceum tokens (already ported; extend if needed)
  components/  [LANE: components]    Lyceum RN library + admin composites (barrel: src/components/index.ts)
  screens/
    home/      [LANE: home-insights] AdminDashboardScreen
    people/    [LANE: people]        UserManagement / StaffManagement / RolesPermissions / ParentLinking / UserDetail
    academics/ [LANE: academics]     ClassManagement / ClassDetail / SpacesOverview / Courses / ExamsOverview / AcademicSessions
    insights/  [LANE: home-insights] Analytics / Reports / AiUsageCost
    more/      [LANE: more]          MoreMenu / Announcements / Notifications / TenantSettings / DataExport / OnboardingWizard
```

## Screen contract (frozen)

Each screen module = `src/screens/<section>/<Symbol>.tsx` with a **default
export** React component. The registry `src/lib/screens.tsx` already imports
each by exact name + wraps it in `withScreenBoundary`; the router mounts the
wrapped export. **Keep the filename + default export — do not rename.** Replace
the stub body (currently a `makePlaceholder`). Each screen handles: loading
(Skeleton), hard-error (EmptyState), empty (EmptyState), and the populated
state. Navigate via `import { routes } from '../../lib/routes'` + `useRouter()`
— never hand-write paths.

### Symbol → route → hook map

| Lane          | Symbol (file)                         | Route                            | Primary `@levelup/query` hook(s)                                                                     | Prototype card                |
| ------------- | ------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| home-insights | `AdminDashboardScreen` (home/)        | /admin/home                      | `useSpaces`,`useStudents`,`useTeachers`,`useClasses`                                                 | admin-dashboard               |
| people        | `UserManagementScreen` (people/)      | /admin/people                    | `useStudents`,`useTeachers`,`useParents`,`useSearchUsers` (in-screen tabs Students/Teachers/Parents) | user-management               |
| people        | `StaffManagementScreen`               | /admin/people/staff              | `useStaff`,`useSaveStaff`                                                                            | staff-management              |
| people        | `RolesPermissionsScreen`              | /admin/people/roles              | `useStaff`/`useSearchUsers` (memberships+roles)                                                      | memberships-roles-permissions |
| people        | `ParentLinkingScreen`                 | /admin/people/parents            | `useParents`,`useLinkedChildren`,`useSaveParent`                                                     | parent-linking                |
| people        | `UserDetailScreen`                    | /admin/people/user?userId=&kind= | `useStudent`/`useTeacher`/`useParent`                                                                | (detail of user-management)   |
| academics     | `ClassManagementScreen` (academics/)  | /admin/academics                 | `useClasses`,`useSaveClass`                                                                          | class-management              |
| academics     | `ClassDetailScreen`                   | /admin/academics/class?classId=  | `useClass`,`useClassSummary`                                                                         | class-detail                  |
| academics     | `SpacesOverviewScreen`                | /admin/academics/content         | `useSpaces` (⟶ "Continue on web" to author)                                                          | spaces-overview               |
| academics     | `CoursesScreen`                       | /admin/academics/courses         | `useSpaces`/`useStoreSpaces`                                                                         | courses                       |
| academics     | `ExamsOverviewScreen`                 | /admin/academics/exams           | `useExams`,`useExamGradingOverview`                                                                  | exams-overview                |
| academics     | `AcademicSessionsScreen`              | /admin/academics/sessions        | `useAcademicSessions`,`useSaveAcademicSession`,`useRolloverSession`                                  | academic-sessions             |
| home-insights | `AnalyticsScreen` (insights/)         | /admin/insights                  | `useInsights`,`useLearningInsights`,`usePerformanceTrends`                                           | analytics                     |
| home-insights | `ReportsScreen`                       | /admin/insights/reports          | `useInsights`/`useLearningInsights` (report list)                                                    | reports                       |
| home-insights | `AiUsageCostScreen`                   | /admin/insights/ai-usage         | `useCostSummary`                                                                                     | ai-usage-cost                 |
| more          | `MoreMenuScreen` (more/)              | /admin/more                      | `useMe` (account header) + nav menu list                                                             | (menu)                        |
| more          | `AnnouncementsScreen`                 | /admin/more/announcements        | `useAnnouncements`,`useSaveAnnouncement`                                                             | announcements                 |
| more          | `NotificationsScreen`                 | /admin/more/notifications        | `useNotificationCenter`,`useNotifications`                                                           | notifications                 |
| more          | `TenantSettingsScreen`                | /admin/more/settings             | `useTenant`,`useSaveTenant`,`useSaveTenantSettings` (⟶web for asset upload)                          | tenant-settings-branding      |
| more          | `DataExportScreen`                    | /admin/more/data-export          | `useExportTenantData`                                                                                | data-export                   |
| more          | `OnboardingWizardScreen` (root modal) | /onboarding                      | `useCreateOrgUser`,`useBulkImportStudents`/`Teachers` (⟶web heavy)                                   | onboarding-wizard             |

## Components lane (M-admin-components)

The existing barrel `src/components/index.ts` already exports everything screens
need:
`Screen, Card, Button, IconButton, Divider, Icon, Badge, Chip, Pill, Avatar, ProgressBar, ProgressRing, Meter, StatTile, Stat, ListRow, SectionHeader, Skeleton, EmptyState, Tabbar, TopBar, Breadcrumb, Sheet, Drawer, Modal, TextField, SearchField, Tabs, Accordion, Alert, ContentRenderer`.
ADD admin composites (additive only; append to the barrel):
`DataTable`/`MetricCard`/`RosterRow`/`RoleBadge`/`StatusPill`/`SegmentedTabs`/`KpiGrid`/`FilterBar`
matching the prototype-card look (Lyceum tokens, zero raw hex). Stub-first if
needed. You OWN `src/components` + `src/theme` entirely.

## Test accounts (prod lvlup-ff6fa, asia-south1)

- **Primary (autologin set):** `subhang.rocklee@gmail.com` / `Test@12345` — real
  admin of tenant_subhang/SUB001 (sparse rosters: ~3 users; content = 12 real
  Subhang spaces, LIVE today).
- **Rich rosters (for screen dev once callables deploy):**
  `principal@demo.levelup.academy` / `Demo@12345` (DEMO01, ~30 students / 8
  teachers / classes / sessions / announcements / exams). To temporarily test
  against it, set `EXPO_PUBLIC_AUTOLOGIN_*` in `.env` locally — but DO NOT
  commit that change; primary stays subhang.rocklee.

## Coordinator (M-admin-coord)

Owns shell + integration. GATE-0 prod proof done
(`scripts/smoke-admin-prod.mjs`: admin login → `spaceRepo.list` → 12 real
Subhang spaces). Coordinates GATE-B admin-callable deploy with SDK-coord.
Integrates lanes, keeps `pnpm exec tsc` green, ships the OnePlus build
(`expo run:android`, Metro **8083** + `adb reverse`, pkg
`academy.levelup.admin`) + iOS sim proof.
