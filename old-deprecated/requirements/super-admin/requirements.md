# Super-Admin Application — Requirements Specification

**Version:** 1.0 **Date:** 2026-03-22 **Application:** `apps/super-admin`
**Audience:** Platform operators with `isSuperAdmin` privileges

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Dashboard & Overview](#2-dashboard--overview)
3. [Tenant Management](#3-tenant-management)
4. [User Management & Global Search](#4-user-management--global-search)
5. [User Analytics](#5-user-analytics)
6. [Feature Flag Management](#6-feature-flag-management)
7. [Global Evaluation Presets](#7-global-evaluation-presets)
8. [LLM Usage & Cost Monitoring](#8-llm-usage--cost-monitoring)
9. [System Health Monitoring](#9-system-health-monitoring)
10. [Announcements](#10-announcements)
11. [Settings](#11-settings)
12. [Cross-Cutting Non-Functional Requirements](#12-cross-cutting-non-functional-requirements)

---

## 1. Authentication & Authorization

### Functional Requirements

| ID     | Requirement                                                                                                                                                                    | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-001 | The system SHALL provide an email/password login form for super-admin users.                                                                                                   | Must     |
| FR-002 | The system SHALL validate that the authenticated user has `isSuperAdmin: true` in their Firestore `/users/{uid}` document before granting access.                              | Must     |
| FR-003 | The system SHALL verify Firebase custom claims contain `role: "superAdmin"` as a defense-in-depth check in addition to the Firestore flag.                                     | Must     |
| FR-004 | The system SHALL redirect unauthenticated users to `/login` and preserve the intended destination for post-login redirect.                                                     | Must     |
| FR-005 | The system SHALL display an "Access Denied — Super admin privileges required" screen with a logout button if the user is authenticated but lacks super-admin privileges.       | Must     |
| FR-006 | The system SHALL display user-friendly error messages for common authentication failures (wrong password, user not found, too many attempts, account disabled, network error). | Must     |
| FR-007 | The system SHALL persist authentication state across browser sessions via Firebase Auth SDK (localStorage/IndexedDB).                                                          | Must     |
| FR-008 | The system SHALL provide a logout action accessible from the sidebar and the settings page.                                                                                    | Must     |
| FR-009 | The system SHALL maintain a real-time Firestore listener on `/users/{uid}` to keep the auth store in sync with server-side user state changes.                                 | Should   |
| FR-010 | The system SHALL support automatic and manual Firebase token refresh, including refreshing custom claims.                                                                      | Should   |

---

## 2. Dashboard & Overview

### Functional Requirements

| ID     | Requirement                                                                                                                                       | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-011 | The dashboard SHALL display a personalized greeting with the super-admin's display name.                                                          | Should   |
| FR-012 | The dashboard SHALL show summary stat cards for: total tenants, total users, total exams, and total spaces across the platform.                   | Must     |
| FR-013 | The dashboard SHALL show growth metric cards for: new tenants (recent period), active users in the last 7 days, and engagement rate.              | Should   |
| FR-014 | The dashboard SHALL render a bar chart of the top 8 tenants ranked by user count.                                                                 | Should   |
| FR-015 | The dashboard SHALL render a donut/pie chart showing user distribution by subscription plan.                                                      | Should   |
| FR-016 | The dashboard SHALL display a recent activity feed showing the 10 latest platform activity log entries with action labels, actor, and timestamps. | Must     |
| FR-017 | The dashboard SHALL list the 5 most recently created tenants with user counts and status badges.                                                  | Should   |
| FR-018 | The dashboard SHALL provide quick-action buttons to navigate to: Create Tenant, System Health, and Settings.                                      | Should   |
| FR-019 | Clicking a tenant in the recent tenants list SHALL navigate to that tenant's detail page.                                                         | Must     |

---

## 3. Tenant Management

### 3.1 Tenant Listing (TenantsPage)

| ID     | Requirement                                                                                                                                           | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-020 | The system SHALL display a paginated, sortable table of all tenants with columns: Name (with email), Code, Plan, User Count, Status, and View action. | Must     |
| FR-021 | The system SHALL support filtering tenants by status: all, active, trial, suspended, expired.                                                         | Must     |
| FR-022 | The system SHALL support searching tenants by name, code, or email.                                                                                   | Must     |
| FR-023 | The system SHALL provide a "Create Tenant" button that opens a creation dialog.                                                                       | Must     |

### 3.2 Tenant Creation

| ID     | Requirement                                                                                                                                                            | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-024 | The create tenant dialog SHALL require: Organization Name (text), Tenant Code (uppercase alphanumeric + hyphens, auto-uppercased), Contact Email (valid email format). | Must     |
| FR-025 | The create tenant dialog SHALL accept optional fields: Contact Person (text).                                                                                          | Should   |
| FR-026 | The create tenant dialog SHALL require selection of a subscription plan: trial, basic, premium, or enterprise.                                                         | Must     |
| FR-027 | On successful creation, the system SHALL display a toast notification and the new tenant SHALL appear in the list.                                                     | Must     |
| FR-028 | Tenant creation SHALL invoke the `saveTenant` Cloud Function and log a `tenant_created` entry in the platform activity log.                                            | Must     |

### 3.3 Tenant Detail (TenantDetailPage)

| ID     | Requirement                                                                                                                                                                                                          | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-029 | The tenant detail page SHALL display the tenant name, status badge, and back-navigation link.                                                                                                                        | Must     |
| FR-030 | The tenant detail page SHALL show stat cards for: Students, Teachers, Exams, and Spaces counts.                                                                                                                      | Must     |
| FR-031 | The tenant detail page SHALL display contact information: email, phone, contact person, and website.                                                                                                                 | Must     |
| FR-032 | The tenant detail page SHALL show a features grid indicating which features are enabled/disabled for the tenant (autoGrade, levelUp, aiChat, aiGrading, analytics, parentPortal, bulkImport, scannerApp, apiAccess). | Must     |
| FR-033 | The tenant detail page SHALL display settings: Gemini API key status, AI model, timezone, and locale.                                                                                                                | Should   |
| FR-034 | The tenant detail page SHALL provide Edit and Delete action buttons.                                                                                                                                                 | Must     |

### 3.4 Tenant Editing (EditTenantDialog)

| ID     | Requirement                                                                                                                                                                                    | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-035 | The edit dialog SHALL allow modification of: Name, Contact Email (validated), Contact Phone, Contact Person, Website (URL-validated), and Status (active/trial/suspended/expired/deactivated). | Must     |
| FR-036 | The edit dialog SHALL use Zod schema validation with react-hook-form.                                                                                                                          | Must     |
| FR-037 | On successful update, the system SHALL display a toast, invalidate cached queries, and close the dialog.                                                                                       | Must     |

### 3.5 Tenant Deletion (DeleteTenantDialog)

| ID     | Requirement                                                                                               | Priority |
| ------ | --------------------------------------------------------------------------------------------------------- | -------- |
| FR-038 | The delete dialog SHALL require the user to type the exact tenant code as confirmation before proceeding. | Must     |
| FR-039 | The delete dialog SHALL display a warning showing the number of affected users (students + teachers).     | Must     |
| FR-040 | The delete action SHALL deactivate the tenant (not permanently delete) by invoking `deactivateTenant`.    | Must     |
| FR-041 | On successful deactivation via the delete dialog, the system SHALL redirect to the tenants list.          | Must     |

### 3.6 Tenant Subscription (TenantSubscriptionCard)

| ID     | Requirement                                                                                                                                                                                   | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-042 | The subscription card SHALL display: current plan, max students, max teachers, max spaces, max exams per month, and expiration date.                                                          | Must     |
| FR-043 | The "Edit Plan" button SHALL open a dialog allowing modification of: Plan (trial/basic/premium/enterprise), Max Students, Max Teachers, Max Spaces, Max Exams Per Month, and Expiration Date. | Must     |
| FR-044 | Subscription updates SHALL validate via Zod schema (plan required, numeric limits optional).                                                                                                  | Must     |

### 3.7 Tenant Lifecycle (TenantLifecycleCard)

| ID     | Requirement                                                                                                                      | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-045 | The lifecycle card SHALL display the current tenant status.                                                                      | Must     |
| FR-046 | For active/trial tenants, the card SHALL show a "Deactivate Tenant" button with an alert dialog requiring confirmation.          | Must     |
| FR-047 | Deactivation SHALL invoke `deactivateTenant`, which sets tenant status to `deactivated` and suspends all user memberships.       | Must     |
| FR-048 | The success toast after deactivation SHALL report the number of memberships suspended.                                           | Should   |
| FR-049 | For deactivated tenants, the card SHALL show a "Reactivate Tenant" button.                                                       | Must     |
| FR-050 | Reactivation SHALL invoke `reactivateTenant`, which restores the tenant's previous status and reactivates suspended memberships. | Must     |
| FR-051 | The success toast after reactivation SHALL report the number of memberships reactivated.                                         | Should   |

### 3.8 Tenant Data Export (TenantDataExportCard)

| ID     | Requirement                                                                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-052 | The data export card SHALL allow selection of one or more collections to export: students, teachers, classes, exams, submissions. | Must     |
| FR-053 | The data export card SHALL allow selection of export format: CSV or JSON.                                                         | Must     |
| FR-054 | At least one collection MUST be selected before the export button is enabled.                                                     | Must     |
| FR-055 | Export SHALL invoke `exportTenantData` and return a signed download URL with a 1-hour expiry.                                     | Must     |
| FR-056 | The success toast SHALL report the total record count, and a download link SHALL be displayed.                                    | Must     |

### 3.9 Tenant Audit Log (TenantAuditLogCard)

| ID     | Requirement                                                                                                                                                       | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-057 | The audit log card SHALL display a timeline of platform activity log entries filtered by the current tenant ID.                                                   | Must     |
| FR-058 | Each audit entry SHALL show: action label, action badge, actor email, metadata (display name, role if available), and timestamp.                                  | Must     |
| FR-059 | The audit log SHALL support filtering by action type (tenant_created, tenant_updated, tenant_deactivated, tenant_reactivated, user_created, users_bulk_imported). | Must     |
| FR-060 | The audit log SHALL paginate entries, showing 20 per page.                                                                                                        | Should   |

---

## 4. User Management & Global Search

### Functional Requirements

| ID     | Requirement                                                                                                                                    | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-061 | The Global Users page SHALL provide a search input to find users by email or name across all tenants.                                          | Must     |
| FR-062 | Search SHALL be debounced (300ms delay) and require at least 1 character.                                                                      | Should   |
| FR-063 | Search results SHALL be displayed in a table with columns: Name, Email, Roles/Tenants (membership badges), Last Login, and Super Admin status. | Must     |
| FR-064 | Search SHALL return a maximum of 20 results per query.                                                                                         | Should   |
| FR-065 | Each membership badge SHALL display the user's role and tenant code.                                                                           | Must     |
| FR-066 | Super-admin users SHALL be visually distinguished with a status badge.                                                                         | Should   |
| FR-067 | Clicking a user's tenant membership SHALL navigate to the corresponding tenant detail page.                                                    | Should   |

---

## 5. User Analytics

### Functional Requirements

| ID     | Requirement                                                                                                                                              | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-068 | The User Analytics page SHALL display summary stat cards: Total Users, Students, Teachers, and Active Tenants.                                           | Must     |
| FR-069 | The page SHALL show a "Users by Subscription Plan" breakdown with progress bars.                                                                         | Should   |
| FR-070 | The page SHALL display a per-tenant breakdown table with columns: Tenant Name, Tenant Code, Student Count, Teacher Count, Total Users, and Status badge. | Must     |
| FR-071 | The per-tenant table SHALL support pagination with configurable page size.                                                                               | Should   |

---

## 6. Feature Flag Management

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                                 | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-072 | The Feature Flags page SHALL display an overview grid showing the adoption percentage for each feature flag across all tenants.                                                                             | Must     |
| FR-073 | The system SHALL support 9 feature flags: autoGradeEnabled, levelUpEnabled, scannerAppEnabled, aiChatEnabled, aiGradingEnabled, analyticsEnabled, parentPortalEnabled, bulkImportEnabled, apiAccessEnabled. | Must     |
| FR-074 | The page SHALL display a searchable list of tenants (by name or code) with toggle switches for each feature flag.                                                                                           | Must     |
| FR-075 | The page SHALL track pending (unsaved) changes per tenant and display a visual indicator.                                                                                                                   | Should   |
| FR-076 | A "Save Changes" button SHALL appear only when modifications exist for a tenant, and saving SHALL persist changes and show a success indicator.                                                             | Must     |
| FR-077 | The tenant list SHALL support pagination.                                                                                                                                                                   | Should   |

---

## 7. Global Evaluation Presets

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                          | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-078 | The Global Presets page SHALL display all global evaluation presets as cards showing: name, description, default/public badges, enabled dimensions with weights, and display settings indicators.    | Must     |
| FR-079 | The page SHALL provide a "Create Preset" button opening a creation dialog.                                                                                                                           | Must     |
| FR-080 | The create/edit dialog SHALL include fields: Name (required), Description (optional), isDefault (checkbox), isPublic (checkbox).                                                                     | Must     |
| FR-081 | The dialog SHALL include 3 display setting checkboxes: Show Strengths, Show Key Takeaway, Prioritize by Importance.                                                                                  | Must     |
| FR-082 | The dialog SHALL allow configuration of 6 evaluation dimensions (Clarity, Accuracy, Depth, Grammar, Relevance, Critical Thinking) with individual enable/disable toggles and weight selectors (1-5). | Must     |
| FR-083 | Preset creation and editing SHALL invoke `saveGlobalEvaluationPreset` with Zod schema validation.                                                                                                    | Must     |
| FR-084 | Preset deletion SHALL require confirmation via a dialog and invoke `saveGlobalEvaluationPreset` with `delete: true`.                                                                                 | Must     |

---

## 8. LLM Usage & Cost Monitoring

### Functional Requirements

| ID     | Requirement                                                                                                                                                | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-085 | The LLM Usage page SHALL display a month selector with previous/next navigation (disabling future months).                                                 | Must     |
| FR-086 | The page SHALL show summary stat cards for the selected month: Monthly Cost (USD), Total API Calls, Input Tokens, and Output Tokens.                       | Must     |
| FR-087 | The page SHALL render a bar chart showing the daily cost trend for the selected month.                                                                     | Should   |
| FR-088 | The page SHALL show a cost breakdown by task type/purpose with progress bars.                                                                              | Should   |
| FR-089 | The page SHALL display a per-tenant usage table with columns: Tenant Name/Code, API Call Count, Total Cost, Budget Limit, and Budget Usage (progress bar). | Must     |
| FR-090 | Budget usage indicators SHALL use color coding: green (<80%), amber (80-99%), red (>=100%).                                                                | Should   |
| FR-091 | The per-tenant table SHALL support pagination.                                                                                                             | Should   |
| FR-092 | Data SHALL be sourced from `/tenants/{tenantId}/dailyCostSummaries/{date}` aggregated across all tenants.                                                  | Must     |

---

## 9. System Health Monitoring

### Functional Requirements

| ID     | Requirement                                                                                                                                                          | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-093 | The System Health page SHALL display an overall platform status banner: Operational, Degraded, or Down.                                                              | Must     |
| FR-094 | The page SHALL show individual service status cards for: Firebase Auth, Firestore, Cloud Functions, and AI Pipeline — each with a status indicator and latency (ms). | Must     |
| FR-095 | Status indicators SHALL use: green checkmark (Operational), yellow warning triangle (Degraded), red X (Down).                                                        | Must     |
| FR-096 | The page SHALL display a 30-day uptime history visualization with color-coded bars and tooltips.                                                                     | Should   |
| FR-097 | The page SHALL show platform metrics: Average Response Time, Total Users, and Errors in the last 24 hours.                                                           | Should   |
| FR-098 | The page SHALL provide a manual "Refresh" button to trigger a new health check.                                                                                      | Must     |
| FR-099 | Each health check SHALL probe live services (Auth, Firestore, Functions, AI Pipeline) and record a snapshot to `/healthSnapshots`.                                   | Must     |
| FR-100 | The health check SHALL aggregate tenant statistics (total users, active tenants).                                                                                    | Should   |

---

## 10. Announcements

### Functional Requirements

| ID     | Requirement                                                                                                                                                | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-101 | The Announcements page SHALL display a table of platform-wide announcements with columns: Title, Status, Author, Created Date, Expiry Date, and Actions.   | Must     |
| FR-102 | The page SHALL support filtering by status tabs: All, Draft, Published, Archived.                                                                          | Must     |
| FR-103 | The page SHALL provide a "New Announcement" button opening a creation dialog.                                                                              | Must     |
| FR-104 | The create/edit dialog SHALL include: Title (required, max 200 chars), Body (required, textarea, max 5000 chars), and Expiry Date (optional, date picker). | Must     |
| FR-105 | New announcements SHALL be saved with status `draft`.                                                                                                      | Must     |
| FR-106 | Draft announcements SHALL have a "Publish" action that transitions status to `published`.                                                                  | Must     |
| FR-107 | Published announcements SHALL have an "Archive" action that transitions status to `archived`.                                                              | Must     |
| FR-108 | Announcements SHALL support deletion with a confirmation dialog.                                                                                           | Must     |
| FR-109 | Only draft announcements SHALL be editable.                                                                                                                | Should   |
| FR-110 | Announcement CRUD SHALL invoke `saveAnnouncement` / `listAnnouncements` Cloud Functions.                                                                   | Must     |
| FR-111 | The table SHALL paginate at 20 items per page.                                                                                                             | Should   |

---

## 11. Settings

### Functional Requirements

| ID     | Requirement                                                                                                                                                                                  | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-112 | The Settings page SHALL display a Platform Announcement card with a textarea for editing the global announcement message.                                                                    | Must     |
| FR-113 | The Settings page SHALL show toggles for 7 default features applied to new tenants: autoGrade, levelUp, aiGrading, aiChat, analytics, parentPortal, bulkImport.                              | Must     |
| FR-114 | The Settings page SHALL display a System Configuration section with a Maintenance Mode toggle (requiring confirmation dialog) and read-only fields for Default Plan and Max Tenants Allowed. | Must     |
| FR-115 | The Settings page SHALL display the current admin account information (display name, email) and a Logout button.                                                                             | Must     |
| FR-116 | The save button SHALL only be enabled when form values have been modified (dirty state tracking).                                                                                            | Should   |
| FR-117 | Settings changes SHALL be persisted to Firestore (platform config document).                                                                                                                 | Must     |

---

## 12. Cross-Cutting Non-Functional Requirements

### Performance

| ID      | Requirement                                                                                                                                  | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-001 | All pages SHALL be lazy-loaded (code-split) with React Suspense to minimize initial bundle size.                                             | Must     |
| NFR-002 | Navigation links SHALL prefetch page chunks on hover for near-instant page transitions.                                                      | Should   |
| NFR-003 | Search inputs SHALL be debounced (300ms minimum) to avoid excessive API calls.                                                               | Must     |
| NFR-004 | React Query SHALL cache API responses with a stale time of 5 minutes for tenant/user data and 30 seconds for real-time data (notifications). | Should   |
| NFR-005 | The application SHALL display skeleton loaders during data fetching to prevent layout shift.                                                 | Should   |
| NFR-006 | Paginated lists SHALL limit page sizes to prevent loading excessive data (max 100 items per page).                                           | Must     |

### Security

| ID      | Requirement                                                                                                                                                                          | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NFR-007 | All routes except `/login` SHALL be protected by the `RequireAuth` guard requiring dual verification: Firestore `isSuperAdmin` flag AND Firebase custom claims `role: "superAdmin"`. | Must     |
| NFR-008 | All Cloud Function calls SHALL validate the caller has super-admin privileges server-side (not relying solely on client-side checks).                                                | Must     |
| NFR-009 | The application SHALL NOT store or display sensitive credentials (e.g., Gemini API keys) in plaintext — only show whether a key is set.                                              | Must     |
| NFR-010 | Tenant deletion/deactivation SHALL require explicit confirmation (typing tenant code) to prevent accidental data loss.                                                               | Must     |
| NFR-011 | Exported data download URLs SHALL be signed and expire within 1 hour.                                                                                                                | Must     |
| NFR-012 | Firebase Auth tokens SHALL be refreshed automatically; custom claims SHALL be re-verified on each page guard check.                                                                  | Should   |
| NFR-013 | The application SHALL not expose tenant data across boundaries — each query SHALL be scoped appropriately.                                                                           | Must     |

### Accessibility

| ID      | Requirement                                                                                                                           | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-014 | The application SHALL include a "skip to content" link for keyboard navigation.                                                       | Must     |
| NFR-015 | The application SHALL include a route announcer for screen readers to announce page transitions.                                      | Must     |
| NFR-016 | All interactive elements SHALL be keyboard-accessible and include appropriate ARIA labels.                                            | Must     |
| NFR-017 | Status indicators (operational/degraded/down, budget usage) SHALL not rely solely on color — they SHALL include icons or text labels. | Must     |
| NFR-018 | Form validation errors SHALL be associated with their respective inputs using `aria-describedby` or equivalent.                       | Should   |

### Responsive Design

| ID      | Requirement                                                                                                                                                | Priority |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-019 | The application SHALL use a collapsible sidebar layout: visible on desktop, hidden on mobile with a hamburger toggle.                                      | Must     |
| NFR-020 | On mobile screens, a bottom navigation bar SHALL provide quick access to: Home, Tenants, System, and Settings.                                             | Should   |
| NFR-021 | The AuthLayout (login page) SHALL use a two-column layout on desktop (branding + form) and a single-column layout on mobile (form only, with mobile logo). | Should   |
| NFR-022 | Data tables SHALL be horizontally scrollable on small screens.                                                                                             | Must     |
| NFR-023 | Charts and visualizations SHALL resize responsively to fit their container.                                                                                | Should   |

### Reliability & Error Handling

| ID      | Requirement                                                                                                           | Priority |
| ------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-024 | All pages SHALL display error alerts with a "Retry" button when data fetching fails.                                  | Must     |
| NFR-025 | Mutations SHALL provide feedback via toast notifications (success or error).                                          | Must     |
| NFR-026 | Each route SHALL be wrapped in an error boundary to prevent full-app crashes from isolated component errors.          | Should   |
| NFR-027 | The application SHALL register a service worker for PWA support with updates checked every 60 minutes.                | Should   |
| NFR-028 | Firebase emulator support SHALL be available via the `VITE_USE_EMULATORS` environment variable for local development. | Should   |

### Auditability

| ID      | Requirement                                                                                                                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NFR-029 | All tenant lifecycle actions (create, update, deactivate, reactivate) SHALL be logged to the `/platformActivityLog` collection with actor UID, actor email, tenant ID, action type, metadata, and timestamp. | Must     |
| NFR-030 | User creation and bulk import events SHALL be logged to the platform activity log.                                                                                                                           | Must     |
| NFR-031 | Audit log entries SHALL be queryable by tenant ID and filterable by action type.                                                                                                                             | Must     |

### Internationalization & Configuration

| ID      | Requirement                                                                           | Priority |
| ------- | ------------------------------------------------------------------------------------- | -------- |
| NFR-032 | Timestamps SHALL be formatted in a human-readable locale-appropriate format.          | Should   |
| NFR-033 | The application SHALL support light and dark themes via a theme toggle in the header. | Should   |
| NFR-034 | Cloud Functions SHALL be invoked in the `asia-south1` region.                         | Must     |

---

## Data Model Summary

| Entity             | Firestore Path                             | Key Fields                                                                            |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Tenant             | `/tenants/{tenantId}`                      | name, tenantCode, status, plan, features, settings, stats, subscription, deactivation |
| User               | `/users/{uid}`                             | displayName, email, isSuperAdmin, status                                              |
| Membership         | `/userMemberships/{uid}_{tenantId}`        | role, status, tenantCode, joinSource                                                  |
| Announcement       | `/announcements/{id}`                      | title, body, status (draft/published/archived), scope, expiresAt                      |
| LLM Call Log       | `/tenants/{tid}/llmCallLogs/{id}`          | model, tokens, costUSD, latencyMs, status                                             |
| Daily Cost Summary | `/tenants/{tid}/dailyCostSummaries/{date}` | totalCalls, totalCostUsd, byPurpose, byModel                                          |
| Health Snapshot    | `/healthSnapshots/{id}`                    | status, services, checkedAt                                                           |
| Activity Log       | `/platformActivityLog/{id}`                | action, actorUid, actorEmail, tenantId, metadata                                      |

---

## API / Cloud Functions Summary

| Function                     | Request                          | Response                              | Used By                                 |
| ---------------------------- | -------------------------------- | ------------------------------------- | --------------------------------------- |
| `saveTenant`                 | id?, data (partial tenant)       | {id, created}                         | TenantsPage, EditTenantDialog           |
| `deactivateTenant`           | tenantId, reason?                | {success, membershipsSuspended}       | TenantLifecycleCard, DeleteTenantDialog |
| `reactivateTenant`           | tenantId                         | {success, membershipsReactivated}     | TenantLifecycleCard                     |
| `exportTenantData`           | tenantId, format, collections[]  | {downloadUrl, expiresAt, recordCount} | TenantDataExportCard                    |
| `saveAnnouncement`           | id?, data, delete?               | {id, created?, deleted?}              | AnnouncementsPage                       |
| `listAnnouncements`          | scope?, status?, limit?, cursor? | {announcements[], nextCursor?}        | AnnouncementsPage                       |
| `saveGlobalEvaluationPreset` | id?, data, delete?               | {id, created?, deleted?}              | GlobalPresetsPage                       |
| `searchUsers`                | query, limit?                    | {users[]}                             | GlobalUsersPage                         |

---

_End of Requirements Specification_
