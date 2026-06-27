# admin-web — Brief

`@levelup/admin-web` is the per-tenant **School Admin** portal. Used by
`tenantAdmin` users (school administrators) to manage their own school's users,
classes, exams, learning spaces, AI quota, branding and academic sessions. Every
page is scoped to the admin's current tenant — this is not the cross-tenant
super-admin app.

## Tech stack

React 18 + TypeScript on Vite 5 (SWC), React Router 7, TanStack React Query 5,
Zustand (via `@levelup/shared-stores`), Firebase 11 (Auth + Firestore + callable
Functions), Tailwind 3, `next-themes`, `react-hook-form` + Zod, Sonner toasts,
`lucide-react`. Vite is configured with gzip/brotli compression, terser minify
and manual vendor chunks for react/firebase/react-query/radix.

## Routing overview

All routes sit behind `RequireAuth(allowedRoles=["tenantAdmin"])` plus an
`OnboardingGuard` that redirects unfinished tenants to `/onboarding`. Pages are
lazy-imported with hover-prefetch via `usePrefetch`.

- `/login` (public, school-code → email/password 2-step flow)
- `/` Dashboard, `/onboarding` wizard
- `/users`, `/classes`, `/classes/:classId`, `/staff`, `/announcements`
- `/exams`, `/spaces`, `/courses`
- `/analytics`, `/reports`, `/ai-usage`, `/notifications`
- `/academic-sessions`, `/data-export`, `/settings`

## Main features

- **Dashboard**: tenant stats, class-performance chart, AI cost summary,
  subscription quota cards, feature flags.
- **Users / Classes / Staff**: CRUD + bulk CSV import, class assignment, parent
  linking, teacher permission toggles.
- **Exams / Spaces / Courses overviews**: cross-teacher read-only views with
  search, status filters, sort, pagination.
- **AI Usage**: per-month cost + call breakdown plus a Firestore-backed
  dead-letter queue of failed grading attempts.
- **Settings + Onboarding wizard**: tenant info, branding/logo,
  evaluation-dimension config; the wizard drives first-run setup.

## Auth + data layer

Sign-in (`pages/LoginPage.tsx`) is two-step: `lookupTenantByCode` resolves the
school code, then `loginWithSchoolCode` on `useAuthStore` signs in via Firebase
Auth and selects the matching membership. `main.tsx` calls
`initializeFirebase(...)` from env vars; `App.tsx` boots
`useAuthStore.initialize()` and subscribes the active tenant doc via
`useTenantStore.subscribe(currentTenantId)`. Pages read entities through React
Query hooks in `@levelup/shared-hooks` (`useStudents`, `useExams`, `useClasses`,
`useDailyCostSummaries`, `useNotifications`, …) and mutate via callable wrappers
in `@levelup/shared-services/auth` (`callSaveTenant`, `callCreateOrgUser`,
`callBulkImportStudents`, `callSaveTeacher`, …). A few pages do direct Firestore
reads (Settings evaluation rules, AI Usage DLQ).

## Shared packages

`@levelup/shared-ui`, `@levelup/shared-hooks`, `@levelup/shared-services`,
`@levelup/shared-stores`, `@levelup/shared-utils`, `@levelup/shared-types`, plus
workspace `eslint-config` and `tailwind-config`.

## Notable for new engineers

- All data hooks need `useCurrentTenantId()` — the store owns tenant switching
  via `RoleSwitcher`.
- The app is a PWA: `main.tsx` registers `public/sw.js`, updates surface through
  `SWUpdateNotification`, manifest + offline page live in `public/`.
- Tests are Playwright-only under `apps/admin-web/e2e/` (one spec per feature
  area); no unit tests in this app.
