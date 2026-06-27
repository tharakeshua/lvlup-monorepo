# Parent-Web Application — Requirements Specification

**Version:** 1.0 **Date:** 2026-03-22 **Application:** `apps/parent-web`
**Port:** 4571 **Stack:** React 18, Vite, Firebase, TanStack React Query,
Zustand, Tailwind CSS, Radix UI

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Navigation & Layout](#2-navigation--layout)
3. [Dashboard](#3-dashboard)
4. [Child Management & Selection](#4-child-management--selection)
5. [Child Progress & Analytics](#5-child-progress--analytics)
6. [Child Comparison](#6-child-comparison)
7. [Space Progress](#7-space-progress)
8. [Exam Results](#8-exam-results)
9. [Performance Alerts](#9-performance-alerts)
10. [Notifications](#10-notifications)
11. [Settings](#11-settings)
12. [Data Architecture](#12-data-architecture)
13. [Cross-Cutting Non-Functional Requirements](#13-cross-cutting-non-functional-requirements)

---

## 1. Authentication & Authorization

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                    | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-001 | The system SHALL present a two-step login flow. In step 1, the parent enters a school code (tenant code). The system validates the code against the `tenants` collection and, on success, advances to step 2.                                  | Must     |
| FR-002 | In step 2, the parent enters email and password. The system SHALL authenticate via Firebase Auth (`signInWithEmailAndPassword`). On success, the user is redirected to the Dashboard or the originally requested page (`location.state.from`). | Must     |
| FR-003 | The login page SHALL provide a "Forgot Password?" link that triggers Firebase `sendPasswordResetEmail` for the entered email address within the validated tenant context.                                                                      | Must     |
| FR-004 | All authenticated routes SHALL be protected by `RequireAuth` with `allowedRoles={["parent"]}`. Users without a `parent` role membership are shown an "Access Denied" message. Unauthenticated users are redirected to `/login`.                | Must     |
| FR-005 | Parents with memberships in multiple tenants SHALL be able to switch between tenants using the `RoleSwitcher` component in the sidebar. The `currentTenantId` from `useAuthStore` scopes all data queries.                                     | Must     |
| FR-006 | On app mount, the system SHALL call `useAuthStore.initialize()` to set up the Firebase Auth state listener. When `currentTenantId` changes, the system subscribes to tenant data via `useTenantStore.subscribe()`.                             | Must     |
| FR-007 | The Settings page SHALL provide a logout action that signs the user out of Firebase Auth and redirects to `/login`.                                                                                                                            | Must     |

---

## 2. Navigation & Layout

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                     | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-008 | Authenticated pages SHALL render within `AppShell` containing an `AppSidebar` with three nav groups: **Overview** (Dashboard), **My Children** (Children, Exam Results, Space Progress, Child Progress, Alerts, Compare Children), and **Account** (Notifications with unread badge, Settings). | Must     |
| FR-009 | On mobile viewports, the app SHALL display a `MobileBottomNav` with four items: Home, Children, Results, Alerts (with unread badge).                                                                                                                                                            | Must     |
| FR-010 | The layout SHALL prefetch page chunks on link hover using `usePrefetch` with a route-to-import map for all 9 authenticated pages, enabling near-instant navigation.                                                                                                                             | Should   |
| FR-011 | The app SHALL use `PageTransition` for animated route changes, `RouteAnnouncer` for screen reader announcements, and `SkipToContent` for keyboard navigation.                                                                                                                                   | Must     |
| FR-012 | The layout SHALL apply tenant-specific branding (colors, CSS custom properties) via the `useTenantBranding` hook.                                                                                                                                                                               | Should   |

---

## 3. Dashboard

### Functional Requirements

| ID     | Requirement                                                                                                                                                                     | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-013 | The Dashboard SHALL display summary cards showing: total number of linked children, average performance score (across all children), school code, and number of at-risk alerts. | Must     |
| FR-014 | The Dashboard SHALL provide quick-action navigation links to Results, Progress, and Children pages.                                                                             | Should   |
| FR-015 | The Dashboard SHALL render a card for each linked child showing: child name and initials avatar, performance score, recent exam results count, and current streak.              | Must     |

---

## 4. Child Management & Selection

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                                                                     | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-016 | The Children page (`/children`) SHALL display all linked children with detailed cards including: initials avatar, name, enrollment status, at-risk badge (when applicable), performance metrics (exam average, space completion percentage, streak), most recent exam results summary, and action buttons ("View Full Progress" navigating to `/child-progress`, "View Exam Results" navigating to `/results`). | Must     |
| FR-017 | The system SHALL resolve linked students using the `useLinkedStudents` hook, which queries the `userMemberships` collection filtered by `tenantId`, `parentId`, and `role === "student"`.                                                                                                                                                                                                                       | Must     |
| FR-018 | Student display names SHALL be resolved via the `useStudentNames` hook, which reads from the `users` collection. Fallback chain: `displayName` > `email` > UID prefix.                                                                                                                                                                                                                                          | Must     |
| FR-019 | The Child Progress page SHALL provide tab-based child selection when multiple children are linked, allowing the parent to switch between children's data.                                                                                                                                                                                                                                                       | Should   |

---

## 5. Child Progress & Analytics

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                                             | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-020 | The Child Progress page (`/child-progress`) SHALL display for the selected child: overall score, exam average, space completion percentage, streak, total points, at-risk alert banner (if applicable), strength and weakness areas, and improvement recommendations.                                                                                                                   | Must     |
| FR-021 | The Child Progress page SHALL include a `PerformanceTrendsChart` component that renders an SVG-based mini line chart of scores over time, supports time range filters (7 Days, 30 Days, 90 Days, All Time; default: 30 Days), sources data from `usePerformanceTrends` hook (queries `submissions` collection), and shows date range labels and tooltips with date, score, and subject. | Must     |
| FR-022 | The Child Progress page SHALL display per-subject performance breakdown charts showing relative scores across enrolled subjects.                                                                                                                                                                                                                                                        | Should   |
| FR-023 | The Child Progress page SHALL show a list of recent activities including exam submissions and space progress updates.                                                                                                                                                                                                                                                                   | Should   |
| FR-024 | The system SHALL fetch aggregated progress data from `studentProgressSummaries/{studentId}` documents via the `useStudentProgressSummary` hook, providing pre-computed metrics (overall score, exam averages, streaks, at-risk status).                                                                                                                                                 | Must     |

---

## 6. Child Comparison

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-025 | The Child Comparison page (`/compare`) SHALL display all linked children in a side-by-side comparison layout with individual cards showing progress rings for each child, and a metric comparison table covering: overall score, exam average, space completion, streak, and points, with best performer highlighting per metric. | Must     |
| FR-026 | The page SHALL include an overall score comparison bar chart visualizing relative performance across children.                                                                                                                                                                                                                    | Should   |
| FR-027 | Comparison data SHALL be fetched using the `useStudentSummaries` hook, which issues parallel queries for all child `studentProgressSummaries` documents via `useQueries`.                                                                                                                                                         | Must     |

---

## 7. Space Progress

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                          | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-028 | The Space Progress page (`/progress`) SHALL display learning space progress organized by student, showing for each space: space title (resolved via `useSpaceNames` hook), status (completed / in-progress / not-started), completion percentage with progress bar, points earned, and story point completion count. | Must     |
| FR-029 | Space progress data SHALL be fetched using the `useChildProgress` hook, which queries the `spaceProgress` collection with `where("userId", "in", batch)` supporting batches of 30 student IDs.                                                                                                                       | Must     |
| FR-030 | The system SHALL support aggregated overall progress via the `useProgress` hook (no `spaceId`), which sums `pointsEarned` and `totalPoints` across all space progress documents for a student.                                                                                                                       | Must     |

---

## 8. Exam Results

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-031 | The Exam Results page (`/results`) SHALL display all released exam submissions for linked children with: search functionality (filter by exam title or subject), exam title, subject, student name, date, grade, and total score. | Must     |
| FR-032 | Each exam result SHALL be expandable via accordion to show: per-question breakdown with individual feedback, rubric scoring details, strengths and weaknesses analysis, mistake classification, and summary statistics.           | Must     |
| FR-033 | Only submissions where `resultsReleased === true` SHALL be displayed to parents.                                                                                                                                                  | Must     |
| FR-034 | Detailed question-level data SHALL be fetched via the `useQuestionSubmissions` hook from the `submissions/{submissionId}/questionSubmissions` subcollection.                                                                      | Must     |
| FR-035 | Exam titles and subjects SHALL be resolved via batch queries to the `exams` collection, with fallback to individual document fetches on batch failure.                                                                            | Must     |
| FR-036 | Each exam result SHALL display AI-generated improvement recommendations when available in the submission data.                                                                                                                    | Should   |

---

## 9. Performance Alerts

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                           | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-037 | The Performance Alerts page (`/alerts`) SHALL display alert sections grouped by child, with alerts derived from: at-risk status (danger level, from `studentProgressSummary.atRisk`), low exam scores (warning level, scores below threshold), low streak (info level, streak below threshold), and low space completion (warning level, completion below threshold). | Must     |
| FR-038 | Alerts SHALL be color-coded by severity: Danger (red) for at-risk detection, Warning (amber) for low exam scores and low space completion, Info (blue) for low streak.                                                                                                                                                                                                | Must     |
| FR-039 | At-risk status SHALL be sourced from pre-computed `studentProgressSummaries` documents, which are updated by backend scheduled functions (nightly at-risk detection).                                                                                                                                                                                                 | Must     |

---

## 10. Notifications

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                         | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-040 | The Notifications page (`/notifications`) SHALL display all notifications for the current user using the shared `NotificationsPageUI` component with: notification list with read/unread filtering, mark individual as read, mark all as read, and navigation to action URLs on notification click. | Must     |
| FR-041 | The app header SHALL display a `NotificationBell` with live unread count badge, sourced from the `useUnreadCount` hook.                                                                                                                                                                             | Must     |
| FR-042 | The system SHALL support notifications for: exam results released, progress milestones achieved, and teacher messages.                                                                                                                                                                              | Must     |

---

## 11. Settings

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                              | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-043 | The Settings page (`/settings`) SHALL display the parent's profile information: display name (editable) and email (read-only).                                                                                                                                                                                                                                                                                                           | Must     |
| FR-044 | The Settings page SHALL allow toggling notification preferences: email notifications (on/off), push notifications (on/off), exam results notifications (on/off), progress milestones notifications (on/off), and teacher messages notifications (on/off). Preferences SHALL be persisted to `tenants/{tenantId}/notificationPreferences/{userId}` via `useSaveNotificationPreferences` hook with merge semantics. Defaults: all enabled. | Must     |
| FR-045 | The Settings page SHALL provide account actions including logout.                                                                                                                                                                                                                                                                                                                                                                        | Must     |

---

## 12. Data Architecture

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-046 | The parent-web app SHALL read from the following Firestore collections (all scoped to `tenants/{tenantId}/`): `userMemberships` (resolve linked children), `studentProgressSummaries/{studentId}` (pre-computed per-student metrics), `spaceProgress` (per-student per-space completion data), `submissions` (exam submissions filtered by resultsReleased), `submissions/{id}/questionSubmissions` (per-question grading details), `exams` (exam metadata), `spaces` (space metadata), `notificationPreferences/{userId}` (per-user notification settings), `users` (root, user display names), and `tenants` (root, tenant metadata and branding). | Must     |
| FR-047 | Parent entities SHALL be created/updated via `SaveParentRequestSchema` with: `tenantId` (required), `childStudentIds` (array, max limit), `status` (active or archived), `firstName`, `lastName`, `email`, `phone`, `password` (for initial creation, min 6 chars), and `uid` (Firebase Auth UID).                                                                                                                                                                                                                                                                                                                                                   | Must     |

---

## 13. Cross-Cutting Non-Functional Requirements

### Performance

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                        | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-001 | All page components SHALL be lazy-loaded via `React.lazy()` with a shared `PageLoader` fallback, ensuring the initial bundle contains only the login page and shell.                                                                                                                                                                               | Must     |
| NFR-002 | The build SHALL split vendor dependencies into separate chunks: `vendor-react` (React, ReactDOM, React Router), `vendor-firebase` (Firebase SDK), `vendor-query` (TanStack React Query), and `vendor-radix` (Radix UI components).                                                                                                                 | Must     |
| NFR-003 | Production builds SHALL generate both gzip and Brotli compressed assets (threshold: 1KB).                                                                                                                                                                                                                                                          | Should   |
| NFR-004 | Data queries SHALL use TanStack React Query with the following stale times: student names, tenant names, space names (10 minutes); parent list, notification preferences, performance trends (5 minutes); submissions, space progress (1 minute); student progress summaries (30 seconds). Global default: retry once, no refetch on window focus. | Must     |
| NFR-005 | Hooks fetching data for multiple students SHALL batch Firestore `where("in")` queries in groups of 30 (Firestore limit) to avoid query failures.                                                                                                                                                                                                   | Must     |
| NFR-013 | Production builds SHALL target ES2020 with CSS code splitting enabled, source maps enabled, console/debugger statements dropped via Terser, chunk size warning limit of 800KB, and asset file naming with content hashes for cache busting.                                                                                                        | Should   |

### PWA Support

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                       | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-006 | The application SHALL register a service worker in production, check for updates hourly, display `SWUpdateNotification` when a new version is available, auto-reload on service worker controller change, display `PWAInstallBanner` for eligible devices, display `OfflineBanner` when offline, and include a `manifest.json` with app metadata. | Should   |

### Reliability & Error Handling

| ID       | Requirement                                                                      | Priority |
| -------- | -------------------------------------------------------------------------------- | -------- |
| NFR-007  | Each route SHALL be wrapped in `RouteErrorBoundary` for graceful error recovery. | Must     |
| NFR-007a | The root app SHALL be wrapped in a global `ErrorBoundary`.                       | Must     |
| NFR-007b | Firebase batch query failures SHALL fall back to individual document fetches.    | Must     |

### Monitoring

| ID      | Requirement                                                                                 | Priority |
| ------- | ------------------------------------------------------------------------------------------- | -------- |
| NFR-008 | The application SHALL report Web Vitals (FCP, LCP, CLS, FID, TTFB) via `reportWebVitals()`. | Should   |

### Accessibility

| ID       | Requirement                                                                              | Priority |
| -------- | ---------------------------------------------------------------------------------------- | -------- |
| NFR-009  | The application SHALL provide `SkipToContent` for keyboard users.                        | Must     |
| NFR-009a | The application SHALL use `RouteAnnouncer` for screen reader route change announcements. | Must     |
| NFR-009b | The application SHALL include `aria-label` attributes on chart SVG elements.             | Must     |
| NFR-009c | The application SHALL use semantic HTML and `aria-hidden` on decorative icons.           | Must     |

### Theme & Responsive Design

| ID      | Requirement                                                                                                                                                    | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-010 | The application SHALL support system, light, and dark themes via `next-themes` with `ThemeToggle` in the header.                                               | Should   |
| NFR-011 | The application SHALL be responsive with: desktop sidebar navigation, mobile bottom navigation bar with 4 primary items, and adaptive card layouts throughout. | Must     |

### Configuration & Security

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                                            | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-012 | The application SHALL source Firebase configuration from Vite environment variables (`VITE_FIREBASE_*`), supporting per-environment deployment.                                                                                                                                                                                                                                        | Must     |
| NFR-014 | The email field on profile SHALL be read-only (cannot be changed client-side). Password reset SHALL flow through Firebase Auth (no client-side password handling). All data queries SHALL be scoped to the authenticated user's `tenantId`. Parents SHALL only view data for children linked via `userMemberships`. Firebase preconnect hints SHALL be used for faster auth handshake. | Must     |

---

_End of Requirements Specification_
