# Admin-Web Application — Requirements Specification

**Version:** 1.0 **Date:** 2026-03-22 **Application:** `apps/admin-web`
**Audience:** School/Institution Administrators with `tenantAdmin` role

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Tenancy & Onboarding](#2-tenancy--onboarding)
3. [Dashboard](#3-dashboard)
4. [User Management](#4-user-management)
5. [Classes](#5-classes)
6. [Spaces Overview](#6-spaces-overview)
7. [Courses](#7-courses)
8. [Exams Overview](#8-exams-overview)
9. [Academic Sessions](#9-academic-sessions)
10. [Staff & Permissions](#10-staff--permissions)
11. [Announcements](#11-announcements)
12. [Analytics](#12-analytics)
13. [Reports](#13-reports)
14. [Data Export](#14-data-export)
15. [AI Usage & Quota Management](#15-ai-usage--quota-management)
16. [Settings](#16-settings)
17. [Notifications](#17-notifications)
18. [Cross-Cutting Non-Functional Requirements](#18-cross-cutting-non-functional-requirements)

---

## Overview

The Admin-Web application is a school/tenant administration portal for the
Auto-LevelUp platform. It enables tenant administrators to manage their
organization's users, classes, academic sessions, content, and settings. The app
is built with React, Vite, TanStack Query, Zustand, Firebase Auth, and
Firestore.

**Route Structure:**

| Route                | Page                 |
| -------------------- | -------------------- |
| `/login`             | LoginPage            |
| `/onboarding`        | OnboardingWizardPage |
| `/`                  | DashboardPage        |
| `/users`             | UsersPage            |
| `/classes`           | ClassesPage          |
| `/classes/:classId`  | ClassDetailPage      |
| `/spaces`            | SpacesOverviewPage   |
| `/courses`           | CoursesPage          |
| `/exams`             | ExamsOverviewPage    |
| `/academic-sessions` | AcademicSessionPage  |
| `/staff`             | StaffPage            |
| `/announcements`     | AnnouncementsPage    |
| `/analytics`         | AnalyticsPage        |
| `/reports`           | ReportsPage          |
| `/data-export`       | DataExportPage       |
| `/ai-usage`          | AIUsagePage          |
| `/settings`          | SettingsPage         |
| `/notifications`     | NotificationsPage    |

---

## 1. Authentication & Authorization

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                      | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-001 | The system SHALL support a two-step authentication flow: (1) the user enters a school/tenant code which is validated via `lookupTenantByCode()`, (2) the user enters email and password to authenticate via Firebase Auth using `loginWithSchoolCode()`.                                                                                         | Must     |
| FR-002 | The system SHALL restrict access to all routes (except `/login`) to users with the `tenantAdmin` role. The `RequireAuth` guard SHALL verify the user's `currentMembership.role` is included in the `allowedRoles` array and that `currentMembership.tenantId` matches `currentTenantId`. Unauthorized users SHALL see an "Access Denied" screen. | Must     |
| FR-003 | The system SHALL persist authentication state across page reloads by subscribing to Firebase Auth state changes, loading the user document from `/users/{uid}`, fetching memberships, and restoring the active tenant from custom claims.                                                                                                        | Must     |
| FR-004 | The system SHALL allow users with memberships in multiple tenants to switch between them. Switching calls a Cloud Function to update custom claims and refreshes the Firebase token.                                                                                                                                                             | Should   |
| FR-005 | The system SHALL provide a logout action that signs out from Firebase Auth and clears all Zustand state.                                                                                                                                                                                                                                         | Must     |
| FR-006 | Users with the `superAdmin` role SHALL bypass the onboarding guard and access all routes without completing onboarding.                                                                                                                                                                                                                          | Must     |

---

## 2. Tenancy & Onboarding

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                          | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-007 | The system SHALL redirect `tenantAdmin` users to `/onboarding` if `tenant.onboarding.completed !== true`. The guard wraps all protected routes except `/onboarding` itself.                                                                                          | Must     |
| FR-008 | The onboarding wizard Step 1 (School Info) SHALL collect: school name (required), contact email (required), contact phone (optional), and website (optional). On submission, it calls `callSaveTenant()` and records the step in `tenant.onboarding.completedSteps`. | Must     |
| FR-009 | The onboarding wizard Step 2 (Academic Session) SHALL collect: session name (required, e.g., "2026-2027"), start date (optional), end date (optional). On submission, it calls `callSaveAcademicSession()` with `isCurrent: true`.                                   | Must     |
| FR-010 | The onboarding wizard Step 3 (First Class) SHALL collect: class name (required), grade (required), section (optional). On submission, it calls `callSaveClass()`.                                                                                                    | Must     |
| FR-011 | Upon completing all steps, the wizard SHALL set `tenant.onboarding.completed = true`, display the tenant code with a copy button, and provide a "Go to Dashboard" button.                                                                                            | Must     |
| FR-012 | The wizard SHALL allow backward navigation to completed steps and forward progression. A progress stepper SHALL visually indicate the current step and completed steps.                                                                                              | Must     |

---

## 3. Dashboard

### Functional Requirements

| ID     | Requirement                                                                                                                                                    | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-013 | The dashboard SHALL display 6 ScoreCard widgets showing: total students, total teachers, total classes, total spaces, total exams, and at-risk student count.  | Must     |
| FR-014 | The dashboard SHALL display a bar chart showing class-level performance data, sourced from class summaries.                                                    | Should   |
| FR-015 | The dashboard SHALL display a summary of AI-related costs aggregated from daily cost summaries.                                                                | Should   |
| FR-016 | The dashboard SHALL display subscription usage tracking with visual quota progress bars for key resource limits (students, teachers, spaces, exams per month). | Must     |
| FR-017 | The dashboard SHALL display a banner prompting the admin to complete onboarding if `tenant.onboarding.completed` is not true.                                  | Should   |

---

## 4. User Management

### 4.1 Teachers

| ID     | Requirement                                                                                                                                                                                                                                      | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-018 | The UsersPage SHALL display a Teachers tab with a searchable, paginated table showing: name, subjects (as badges), designation, assigned classes (count, clickable), status, and actions. Multi-select checkboxes SHALL support bulk operations. | Must     |
| FR-019 | The system SHALL allow creating teachers via a dialog collecting: firstName, lastName (required), email, phone, password (min 6, max 128 chars), subjects, and designation. Creation calls `callCreateOrgUser()` with role "teacher".            | Must     |
| FR-020 | The system SHALL allow assigning teachers to classes via a clickable cell or dialog. Updates are persisted via `useUpdateTeacher()`.                                                                                                             | Must     |
| FR-021 | The system SHALL support bulk importing teachers via a BulkImportDialog component. Calls `callBulkImportTeachers()`.                                                                                                                             | Should   |
| FR-022 | The system SHALL support setting teacher status to `active` or `archived` via bulk status operations.                                                                                                                                            | Must     |

### 4.2 Students

| ID     | Requirement                                                                                                                                                                                                                                                                                                           | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-023 | The UsersPage SHALL display a Students tab with a searchable, paginated table showing: name, roll number, grade, assigned classes (clickable), linked parents (count with icon, clickable), status, and actions. Multi-select checkboxes SHALL support bulk operations. Selected rows display highlighted background. | Must     |
| FR-024 | The system SHALL allow creating students via a dialog collecting: firstName, lastName (required), email, phone, password, rollNumber, section, grade, admissionNumber, dateOfBirth, and classId. Calls `callCreateOrgUser()` with role "student".                                                                     | Must     |
| FR-025 | The system SHALL allow assigning students to classes via a clickable "Classes" cell that opens an assignment dialog. Updates are persisted via `useUpdateStudent()` modifying `classIds`.                                                                                                                             | Must     |
| FR-026 | The system SHALL allow linking parents to students via a clickable "Parents" cell that opens a link-parent dialog. Updates are persisted via `useUpdateStudent()` modifying `parentIds`.                                                                                                                              | Must     |
| FR-027 | The system SHALL support bulk importing up to 500 students per operation via `callBulkImportStudents()`. Each student record includes: firstName, lastName, rollNumber, email, phone, classId, className, section, parentFirstName, parentLastName, parentEmail, parentPhone.                                         | Should   |
| FR-028 | The system SHALL support setting student status to `active` or `archived` via bulk operations.                                                                                                                                                                                                                        | Must     |

### 4.3 Parents

| ID     | Requirement                                                                                                                                                                | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-029 | The UsersPage SHALL display a Parents tab with a paginated table showing: name, linked children (as name badges resolved from `childStudentIds`), status, and edit action. | Must     |
| FR-030 | The system SHALL allow creating parents via `callSaveParent()` with: firstName, lastName (required), email, phone, password, and childStudentIds.                          | Must     |
| FR-031 | The system SHALL allow editing parent details (name, phone, linked children) via an edit dialog.                                                                           | Must     |

---

## 5. Classes

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                   | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-032 | The ClassesPage SHALL display a searchable, sortable, paginated table with: class name, grade, section, teacher count, student count, status, and actions. Filtering by grade and section SHALL be supported. Multi-select checkboxes enable bulk operations. | Must     |
| FR-033 | The system SHALL allow creating classes via a dialog collecting: name (required), grade (required), section (optional), academicSessionId (optional), and teacherIds (optional). Calls `callSaveClass()`.                                                     | Must     |
| FR-034 | The system SHALL allow editing class details (name, grade, section, teachers) via an edit dialog. Calls `useUpdateClass()`.                                                                                                                                   | Must     |
| FR-035 | The system SHALL support archiving and deleting classes. Bulk status operations (archive/activate) are available via a floating action bar. Status options: `active`, `archived`, `deleted`.                                                                  | Must     |
| FR-036 | The system SHALL allow assigning/removing teachers to/from a class via an assignment dialog.                                                                                                                                                                  | Must     |
| FR-037 | The system SHALL allow assigning/removing students to/from a class via an assignment dialog.                                                                                                                                                                  | Must     |
| FR-038 | The ClassDetailPage (`/classes/:classId`) SHALL display: breadcrumb navigation, 4 quick stat cards (students, teachers, exams, spaces), and a tabbed interface with tabs for enrolled students, assigned teachers, related exams, and related spaces.         | Must     |

---

## 6. Spaces Overview

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-039 | The SpacesOverviewPage SHALL display all learning spaces in a card grid with: search input, status filter buttons (all, draft, published, archived), space metadata per card, and skeleton loading states. | Must     |
| FR-040 | The system SHALL filter spaces by status: `all`, `draft`, `published`, `archived`. Search SHALL filter by space title.                                                                                     | Must     |

---

## 7. Courses

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                    | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-041 | The CoursesPage SHALL display learning spaces grouped by subject with: subject group cards, a filterable list (search, class filter, status filter), and course cards showing metadata (status badge, type, assigned classes). | Must     |

---

## 8. Exams Overview

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-042 | The ExamsOverviewPage SHALL display exams in a sortable, paginated table with: title, subject, total marks, status, created by (teacher name resolved via `useTeachers`), and actions. Search and status filter buttons SHALL be provided. | Must     |
| FR-043 | The system SHALL filter exams by status: `draft`, `question_paper_uploaded`, `question_paper_extracted`, `published`, `grading`, `completed`, `results_released`, `archived`.                                                              | Must     |

---

## 9. Academic Sessions

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-044 | The AcademicSessionPage SHALL display: a current session card, a table of all sessions with date formatting, and create/edit dialogs with date inputs.                                                                                                                                                                                                                                                                                                                                                                                                                 | Must     |
| FR-045 | The system SHALL allow creating academic sessions with: name (required), startDate, endDate, isCurrent flag, and status (`active`/`archived`). Calls `callSaveAcademicSession()`.                                                                                                                                                                                                                                                                                                                                                                                      | Must     |
| FR-046 | The system SHALL allow editing session name, dates, current status, and archive status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Must     |
| FR-047 | The system SHALL support rolling over to a new academic session via the SessionRolloverDialog. The dialog SHALL display the source session and collect: new session name, start date, end date, and 3 cascading options: Copy classes (parent toggle), Copy teacher assignments (child, disabled if copy classes unchecked), Promote students (child, disabled if copy classes unchecked). A live preview shows what will be created. On completion, a summary toast displays counts of classes created, teacher assignments copied, and students promoted/unassigned. | Should   |

---

## 10. Staff & Permissions

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                                      | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-048 | The StaffPage SHALL display a Teachers tab with a searchable list of teachers. Each teacher shows a permission count badge (e.g., "3/8 permissions"). Clicking opens a permission editor dialog with 8 toggleable permissions: canCreateExams, canEditRubrics, canManuallyGrade, canViewAllExams, canCreateSpaces, canManageContent, canViewAnalytics, canConfigureAgents.       | Must     |
| FR-049 | The StaffPage SHALL display a Staff tab listing all administrative staff members. Staff can be searched by name/email. The system supports creating staff via CreateStaffDialog with 6 permission toggles: canManageUsers, canManageClasses, canViewAnalytics, canExportData, canManageSettings, canManageBilling. Staff creation calls `callCreateOrgUser()` with role "staff". | Must     |
| FR-050 | The system SHALL allow editing staff permissions via a dialog. Changes are saved via `callSaveStaff()`. Permission changes invalidate relevant query caches.                                                                                                                                                                                                                     | Must     |

---

## 11. Announcements

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                      | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-051 | The AnnouncementsPage SHALL display: platform-level notices (read-only), and a tabbed view of tenant announcements (all, draft, published, archived) in a table.                                                                 | Must     |
| FR-052 | The system SHALL allow creating and editing announcements via a dialog with: title, body (textarea), expiry date picker, target role checkboxes, and target class checkboxes. Scope is `tenant`. Calls `callSaveAnnouncement()`. | Must     |
| FR-053 | The system SHALL support status transitions: `draft` -> `published` -> `archived`. Publish and archive actions are available as status change buttons.                                                                           | Must     |
| FR-054 | Announcements can be targeted to specific roles (student, teacher, parent) and/or specific classes via `targetRoles` and `targetClassIds` arrays.                                                                                | Should   |

---

## 12. Analytics

### Functional Requirements

| ID     | Requirement                                                                                                                                                               | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-055 | The AnalyticsPage SHALL display overview cards: average exam score, completion rate, at-risk student count, and total students. Data is sourced from `useClassSummaries`. | Must     |
| FR-056 | The page SHALL display multiple charts: exam performance, space completion, and at-risk distribution.                                                                     | Should   |
| FR-057 | Clicking a class SHALL reveal a drill-down section showing top and bottom performers with progress rings and performance metrics.                                         | Should   |

---

## 13. Reports

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                  | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-058 | The ReportsPage SHALL display an "Exam Reports" tab listing completed exams with download buttons. Clicking download calls `callGenerateReport()` with type `exam-result` to generate a PDF. | Must     |
| FR-059 | The ReportsPage SHALL display a "Class Reports" tab listing classes with download buttons. Clicking download calls `callGenerateReport()` with type `class` to generate a PDF.               | Must     |
| FR-060 | Both report tabs SHALL show appropriate empty states when no exams or classes are available.                                                                                                 | Should   |

---

## 14. Data Export

### Functional Requirements

| ID     | Requirement                                                                                                                                      | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-061 | The DataExportPage SHALL allow selecting collections to export: students, teachers, classes, exams, submissions.                                 | Must     |
| FR-062 | The system SHALL support two export formats: CSV and JSON, selectable via radio buttons.                                                         | Must     |
| FR-063 | Clicking export SHALL invoke `callExportTenantData()` which generates downloadable files.                                                        | Must     |
| FR-064 | The page SHALL display export history with expiry tracking and download links. Exports have a limited lifespan before the download links expire. | Should   |

---

## 15. AI Usage & Quota Management

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                          | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-065 | The AIUsagePage SHALL display month-by-month AI usage with month navigation controls. Data is sourced from `useDailyCostSummaries`.                                                                                                                  | Must     |
| FR-066 | The page SHALL display a quota progress bar with color-coded states: primary (<70%), amber warning (70-90%), and red critical (>90%). When `max` is undefined, display "Unlimited".                                                                  | Must     |
| FR-067 | The page SHALL display a cost projection card estimating end-of-month costs based on current usage trends.                                                                                                                                           | Should   |
| FR-068 | The page SHALL display an operation breakdown table showing costs and call counts per AI operation type.                                                                                                                                             | Should   |
| FR-069 | The page SHALL display a chart of daily AI cost trends for the selected month.                                                                                                                                                                       | Should   |
| FR-070 | The page SHALL display a table of failed grading attempts (DLQ) queried from Firestore, showing submission details and failure information.                                                                                                          | Should   |
| FR-071 | The AppLayout SHALL display a dismissible QuotaWarningBanner at the top of all pages when quota thresholds are exceeded. Icons vary by severity: amber (AlertTriangle), red (AlertCircle), expired (Clock). The banner uses `useQuotaStatus()` hook. | Must     |
| FR-072 | The QuotaUsageCard component SHALL display individual resource quotas with: label, current/max values, progress bar with color coding based on usage ratio, and "Unlimited" display when max is undefined.                                           | Must     |

---

## 16. Settings

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                  | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-073 | The SettingsPage SHALL display a "Settings" tab with an editable form for: school name, contact email, contact phone, contact person, website, and address fields. An edit toggle enables/disables the form. The tenant code is displayed with a copy button.                                | Must     |
| FR-074 | The "Evaluation" tab SHALL provide an evaluation settings editor for configuring default grading and evaluation parameters.                                                                                                                                                                  | Must     |
| FR-075 | The "Branding" tab SHALL provide: a color picker for primary and accent colors with live preview, and a LogoUploader component supporting drag-and-drop upload of PNG, JPEG, SVG, or WebP images (max 2MB). Upload uses XMLHttpRequest with progress tracking via signed Cloud Storage URLs. | Should   |
| FR-076 | The "API Keys" tab SHALL display API keys in a masked format and allow managing (adding/updating) Gemini API keys. Keys are stored as `geminiKeyRef` in tenant settings.                                                                                                                     | Must     |
| FR-077 | All settings changes SHALL be saved via `callSaveTenant()` and invalidate the tenant query cache.                                                                                                                                                                                            | Must     |

---

## 17. Notifications

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                               | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-078 | The NotificationsPage SHALL display notifications in a list with: filter tabs (all, unread), read/unread status indicators, and notification content with action links.                                   | Must     |
| FR-079 | The system SHALL support marking individual notifications as read via `markRead()` and marking all as read via `markAllRead()`.                                                                           | Must     |
| FR-080 | The AppLayout header SHALL display a notification bell icon with a real-time unread count badge. The count is sourced from Firebase RTDB subscription at `notifications/{tenantId}/{userId}/unreadCount`. | Must     |
| FR-081 | Clicking a notification SHALL navigate to the relevant action URL embedded in the notification data.                                                                                                      | Should   |

---

## 18. Cross-Cutting Non-Functional Requirements

### Performance

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                           | Priority |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-001 | The system SHALL use TanStack Query with the following stale times: 5 minutes for list queries (classes, students, teachers, parents, spaces, exams, sessions, daily costs, evaluation settings), 30 seconds for detail queries (single entity lookups, progress data), and 1 minute for insights. Retry policy: 1 retry, no refetch on window focus. | Must     |
| NFR-002 | All pages SHALL display skeleton loading placeholders (TableSkeleton, CardGridSkeleton, DashboardSkeleton) while data is being fetched. No blank screens during loading.                                                                                                                                                                              | Must     |
| NFR-003 | All list views (users, classes, exams) SHALL implement client-side pagination with configurable page sizes.                                                                                                                                                                                                                                           | Must     |
| NFR-004 | Notification unread counts SHALL use real-time Firebase RTDB subscriptions. Tenant and user data SHALL use real-time Firestore listeners.                                                                                                                                                                                                             | Must     |

### Security

| ID      | Requirement                                                                                                                                                                                      | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NFR-005 | All routes SHALL be protected by the RequireAuth guard. Only users with `tenantAdmin` role and matching `tenantId` SHALL access admin routes.                                                    | Must     |
| NFR-006 | All Firestore queries SHALL be scoped to `tenants/{tenantId}/`. No cross-tenant data access SHALL be possible from the client.                                                                   | Must     |
| NFR-007 | All mutations (create, update, delete) SHALL be executed via Cloud Functions which validate Zod schemas server-side. Client-side validation is provided for UX but is not the security boundary. | Must     |
| NFR-008 | User passwords SHALL be minimum 6 characters, maximum 128 characters.                                                                                                                            | Must     |
| NFR-009 | API keys SHALL be displayed in masked format in the Settings page.                                                                                                                               | Must     |

### Usability

| ID      | Requirement                                                                                                                                                         | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-010 | The AppLayout SHALL provide: a sidebar navigation on desktop, a bottom navigation bar on mobile (Home, Users, Classes, Analytics, More), and responsive card grids. | Must     |
| NFR-011 | The system SHALL support light and dark themes with system preference detection via a ThemeProvider. A theme toggle SHALL be available in the AppLayout header.     | Should   |
| NFR-012 | All mutation operations (create, update, delete, import) SHALL display success or error toast notifications via the Sonner toast library.                           | Must     |
| NFR-013 | All list views SHALL display meaningful empty state messages with icons when no data is available.                                                                  | Should   |
| NFR-014 | The AppLayout SHALL display route-aware breadcrumbs with human-readable labels for all pages.                                                                       | Should   |
| NFR-015 | Route changes SHALL include animated page transitions via Suspense boundaries.                                                                                      | Should   |

### Scalability

| ID      | Requirement                                                                                                                                                            | Priority |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-016 | The system SHALL support bulk operations: up to 500 students per import, up to 100 items in arrays, bulk status changes on selected entities via floating action bars. | Must     |
| NFR-017 | Entity deletion SHALL use soft deletes (`deleted: true` or status: `archived`) rather than hard deletes from Firestore.                                                | Must     |
| NFR-018 | All mutations SHALL invalidate both list and detail query caches to ensure UI consistency after writes.                                                                | Must     |

### Reliability

| ID      | Requirement                                                                                                                                                                | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-019 | The application SHALL register a service worker for PWA capabilities. An update notification SHALL be shown when a new version is available.                               | Should   |
| NFR-020 | All API calls SHALL handle errors gracefully with toast notifications. Form submissions SHALL disable the submit button while processing to prevent duplicate submissions. | Must     |
| NFR-021 | The system SHALL correctly handle Firestore Timestamp objects in date formatting, including in the SessionRolloverDialog and date display components.                      | Must     |

### Data Model

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                               | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-022 | All entities SHALL follow the status convention: `active` \| `archived` for users and sessions; `draft` \| `published` \| `archived` for content entities (spaces, exams, announcements).                                                                                                                                                                                 | Must     |
| NFR-023 | All tenant-scoped data SHALL reside under `tenants/{tenantId}/` with sub-collections: classes, students, teachers, parents, staff, academicSessions, spaces (with nested storyPoints and items), exams, submissions, spaceProgress, studentProgressSummaries, classProgressSummaries, examAnalytics, evaluationSettings, insights, dailyCostSummaries, and announcements. | Must     |
| NFR-024 | Deleted entities SHALL set `deleted: true` rather than being removed from Firestore, enabling recovery and audit trails.                                                                                                                                                                                                                                                  | Must     |

---

_End of Requirements Specification_
