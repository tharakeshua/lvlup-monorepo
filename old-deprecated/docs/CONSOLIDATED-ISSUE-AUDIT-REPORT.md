# Consolidated Issue Audit Report — LevelUp + AutoGrade Unified Platform

**Date:** 2026-03-01 **Scope:** All 5 apps + shared packages + Cloud Functions +
Firestore Rules **Reference:**
`docs/unified-design-plan/UNIFIED-ARCHITECTURE-BLUEPRINT.md` v1.1

---

## Executive Summary

| Area                         | Issues  | Critical | High    | Medium  | Low    |
| ---------------------------- | ------- | -------- | ------- | ------- | ------ |
| **admin-web** (TenantAdmin)  | 51      | 8        | 17      | 16      | 10     |
| **teacher-web** (Teacher)    | 38      | 8        | —       | 17      | 13     |
| **student-web** (Student)    | 38      | 5        | 8       | 12      | 13     |
| **parent-web** (Parent)      | 24      | 3        | 8       | 9       | 4      |
| **super-admin** (SuperAdmin) | 38      | 7        | 11      | 12      | 8      |
| **Backend/Shared Packages**  | 126     | 12       | 56      | 46      | 12     |
| **TOTAL**                    | **315** | **43**   | **100** | **112** | **60** |

**Overall Risk Level: HIGH** — While core infrastructure (stores, AI services,
generic CRUD) is solid, the platform has critical blockers across all layers:
disabled Cloud Function triggers break the grading pipeline, security rules
allow unauthenticated reads, most UI mutation buttons are non-functional stubs,
and display names show raw Firebase UIDs throughout.

---

## Top 20 Critical Fixes (Must-Do Before Any User Testing)

### Platform-Breaking (Grading Pipeline Down)

| #   | Area                | Issue                                                                                                         | Impact                                                                                           |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Cloud Functions** | AutoGrade pipeline triggers (`onSubmissionUpdated`, `onQuestionSubmissionUpdated`) are disabled/commented out | **Entire automated grading pipeline is broken** — submissions stuck in "scouting" status forever |
| 2   | **Cloud Functions** | Identity triggers (`onUserCreated`, `onUserDeleted`) are disabled                                             | New user signups don't get `/users/{uid}` documents — downstream queries fail                    |
| 3   | **Cloud Functions** | Zero LLM call logging across 5 AI functions                                                                   | Cost tracking reports always show $0, no audit trail for AI operations                           |
| 4   | **Cloud Functions** | Missing identity callables: `createOrgUser`, `switchActiveTenant`, `joinTenant`                               | Multi-tenant user management is non-functional                                                   |

### Security Vulnerabilities

| #   | Area                | Issue                                                                                                                       | Impact                                                                           |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 5   | **Firestore Rules** | `/tenants/{tenantId}` read allows `if true`                                                                                 | **Unauthenticated access to all tenant data**                                    |
| 6   | **Firestore Rules** | `/tenantCodes/{code}` read allows `if true`                                                                                 | Anyone can enumerate all school codes                                            |
| 7   | **super-admin**     | Auth guard allows access when user doc is missing (`user && !user.isSuperAdmin` instead of `!user \|\| !user.isSuperAdmin`) | Any authenticated user without a Firestore user doc gets full super-admin access |
| 8   | **super-admin**     | Tenant delete only removes parent doc — orphans ALL subcollections                                                          | Massive data integrity issue — orphaned students, exams, submissions             |

### Non-Functional UI (Dead Buttons)

| #   | Area            | Issue                                                                                                         | Impact                                                             |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 9   | **admin-web**   | Settings page is entirely read-only — no save handlers on any field                                           | TenantAdmins cannot configure their school                         |
| 10  | **admin-web**   | "Set Key" / "Update Key" / "Remove" API key buttons have no onClick handlers                                  | No tenant can configure Gemini AI — all AI features non-functional |
| 11  | **admin-web**   | Evaluation settings "Edit" button has no onClick handler                                                      | RELMS feedback configuration impossible                            |
| 12  | **super-admin** | Settings page has no save/persist functionality + useState anti-pattern (state never syncs with fetched data) | Global platform settings are local-only — lost on refresh          |

### Data Display Bugs (UIDs Instead of Names)

| #   | Area          | Issue                                                                                   | Impact                                                    |
| --- | ------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 13  | **admin-web** | Teacher/Student/Parent tables show `uid.slice(0, 16)` instead of `firstName`/`lastName` | Users see unintelligible ID strings everywhere            |
| 14  | **admin-web** | Teacher picker in class assignment shows `t.uid.slice(0, 12)`                           | Admins cannot identify teachers when assigning to classes |
| 15  | **ALL APPS**  | Org switcher shows raw `tenantId` instead of school name (`tenantName: m.tenantId`)     | Multi-org users see cryptic IDs                           |

### Missing Core Pages

| #   | Area            | Issue                                                                      | Impact                                                         |
| --- | --------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 16  | **student-web** | Leaderboard, Tests, Chat Tutor — 3 dead nav links (pages don't exist)      | Students click nav items → blank page                          |
| 17  | **student-web** | No Exam Results detail page (route `/exams/:examId/results` doesn't exist) | Students can't view AutoGrade exam feedback                    |
| 18  | **teacher-web** | No Class Detail page (entire feature missing)                              | Teachers can't view per-class student/content/analytics detail |
| 19  | **teacher-web** | No Agent Config tab in Space Editor                                        | AI evaluators/tutors cannot be configured for spaces           |
| 20  | **student-web** | Practice mode has zero RTDB integration — progress lost on page refresh    | Practice data is ephemeral, violates architecture              |

---

## Per-App Issue Summaries

### admin-web (51 issues)

**Biggest problems:** Almost every write operation is non-functional (settings,
API keys, evaluation settings). UIDs shown instead of names everywhere.
Class-student assignment uses wrong data model (`studentIds` on Class instead of
`Student.classIds[]`). Missing features: teacher permission management, feature
flag toggles, billing/subscription UI, scanner management, cross-system
analytics.

**Full report:** `docs/ADMIN-WEB-AUDIT-REPORT.md`

### teacher-web (38 issues)

**Biggest problems:** Missing Class Detail page (core teacher workflow). No
Agent Config for spaces. No error handling on any async operation (space
create/publish/archive, story point CRUD, item CRUD all fire-and-forget). Direct
Firestore writes bypass server validation. No pagination on any list page. No
confirmation dialogs on destructive actions.

**Full report:** `docs/TEACHER-WEB-AUDIT-REPORT.md`

### student-web (38 issues)

**Biggest problems:** 3 dead navigation links (Leaderboard, Tests, Chat Tutor).
Missing Exam Results page. Timer fallback uses client time (cheating vector).
Practice mode has no RTDB persistence. Audio/Image answers store Blobs that
can't serialize to Cloud Functions. JumbledAnswerer shows correct order by
default. ChatAgentAnswerer's `onSendMessage` never connected — AI never replies.
Consumer routes blocked by B2B auth guard.

**Full report:** `docs/STUDENT-WEB-AUDIT-REPORT.md`

### parent-web (24 issues)

**Biggest problems:** No per-question structured feedback on exam results
(blueprint requirement). Settings preferences not persisted to Firestore. Tenant
switcher shows raw IDs. No improvement recommendations. N+1 Firestore queries
for exam metadata. SpaceProgressPage shows truncated UIDs instead of names. No
route params for child-specific views.

**Full report:** `docs/PARENT-WEB-AUDIT-REPORT.md`

### super-admin (38 issues)

**Biggest problems:** Auth guard security bypass (missing user doc = full
access). Tenant delete orphans data. Tenant edit and feature flag updates bypass
Cloud Functions (no server validation). Settings page completely non-functional.
No subscription management editing. No scanner device management. No AI cost
monitoring. Global presets queries wrong collection name.

**Full report:** `docs/SUPER-ADMIN-AUDIT-REPORT.md`

### Backend & Shared Packages (126 issues)

**Biggest problems:** 4 critical disabled Cloud Function triggers. Zero LLM call
logging. Missing `LLMCallLog` type definition. Teacher/Parent types missing 10/8
fields respectively. Only 51% of expected React Query hooks implemented (36 of
74 missing). Firestore rules allow unauthenticated tenant reads. Missing scanner
role write rules.

**What's solid:** Zustand stores (96%), AI services
(LLMWrapper/SecretManager/CostTracker), generic Firestore/Storage/RTDB services
with proper tenant isolation, auth callables, AutoGrade pipeline architecture.

**Full report:** `docs/BACKEND-SHARED-PACKAGES-AUDIT-REPORT.md`

---

## Cross-Cutting Issues (Affect Multiple Apps)

### 1. Org Switcher Shows Raw IDs (ALL 5 apps)

Every app maps `tenantName: m.tenantId` in the RoleSwitcher — showing raw
Firestore document IDs instead of school names.

### 2. No 404 Routes (ALL 5 apps)

None of the apps have a catch-all `*` route — navigating to invalid URLs shows
blank pages.

### 3. `(import.meta as any)` Type Casting (ALL 5 apps)

All apps bypass Vite's `ImportMetaEnv` type system with `as any` casts. No
`vite-env.d.ts` declarations.

### 4. No React Error Boundaries (ALL 5 apps)

An unhandled error in any component crashes the entire React tree with no
recovery UI.

### 5. No Logout Confirmation (4 of 5 apps)

Accidental clicks immediately sign out with no confirmation.

### 6. No Pagination (ALL apps)

Every list page fetches all documents with no `limit()` or cursor-based
pagination.

### 7. Login Ignores Redirect Location (4 of 5 apps)

After login, apps always navigate to `/` instead of restoring the user's
original deep link.

### 8. Direct Firestore Writes vs Cloud Functions (Inconsistent)

Some mutations go through Cloud Functions (with server validation), others write
directly to Firestore (bypassing validation). No consistent pattern.

---

## Recommended Fix Priority

### Phase 1: Unblock Core Flows (Week 1)

1. Enable disabled Cloud Function triggers (grading pipeline, identity)
2. Fix Firestore rules security (`if true` → `if isAuthenticated()`)
3. Fix super-admin auth guard security bypass
4. Implement admin-web Settings page save handlers (API key, school info,
   evaluation settings)
5. Fix all UID-to-name display bugs across apps
6. Add LLM call logging to all 5 AI functions
7. Implement missing identity callables (`createOrgUser`, `switchActiveTenant`)

### Phase 2: Complete Core Features (Weeks 2-3)

8. Implement student-web missing pages (Leaderboard, Exam Results, Tests)
9. Implement teacher-web Class Detail page
10. Implement teacher-web Agent Config for spaces
11. Add error handling to all async operations (try/catch + user feedback)
12. Implement RTDB integration for practice mode
13. Fix audio/image answer serialization for Cloud Functions
14. Implement parent-web per-question feedback view
15. Fix org switcher to show school names
16. Add 404 routes to all apps

### Phase 3: Polish & Hardening (Weeks 3-4)

17. Add pagination to all list pages
18. Add confirmation dialogs for destructive actions
19. Fix data model mismatches (Class.studentIds, exam status enums)
20. Implement missing React Query hooks (36 hooks)
21. Complete Teacher/Parent type definitions
22. Add React Error Boundaries
23. Fix login redirect location preservation
24. Add missing features: teacher permissions, subscription management, scanner
    management, AI cost monitoring

---

## Individual Report Links

| Report                    | Path                                           |
| ------------------------- | ---------------------------------------------- |
| Admin-Web                 | `docs/ADMIN-WEB-AUDIT-REPORT.md`               |
| Teacher-Web               | `docs/TEACHER-WEB-AUDIT-REPORT.md`             |
| Student-Web               | `docs/STUDENT-WEB-AUDIT-REPORT.md`             |
| Parent-Web                | `docs/PARENT-WEB-AUDIT-REPORT.md`              |
| Super-Admin               | `docs/SUPER-ADMIN-AUDIT-REPORT.md`             |
| Backend & Shared Packages | `docs/BACKEND-SHARED-PACKAGES-AUDIT-REPORT.md` |

---

_Generated by 6 parallel audit workers coordinated by Architect Lead_ _Total
files audited: ~200+ across all apps and packages_
