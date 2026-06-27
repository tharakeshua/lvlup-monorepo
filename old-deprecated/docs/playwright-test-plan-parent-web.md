# Playwright E2E Test Plan: Parent-Web

**App:** `apps/parent-web/` | **Port:** 4571 | **Base URL:**
`http://localhost:4571` **Spec File:** `tests/e2e/parent-web.spec.ts`
**Playwright Config Project:** `parent-web` (Desktop Chrome)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Dashboard](#2-dashboard)
3. [Children Page](#3-children-page)
4. [Child Progress Page](#4-child-progress-page)
5. [Exam Results Page](#5-exam-results-page)
6. [Space Progress Page](#6-space-progress-page)
7. [Notifications Page](#7-notifications-page)
8. [Settings Page](#8-settings-page)
9. [Navigation & Routing](#9-navigation--routing)
10. [Session & Auth Persistence](#10-session--auth-persistence)
11. [Error States & Edge Cases](#11-error-states--edge-cases)
12. [Mobile Responsiveness](#12-mobile-responsiveness)

---

## App Architecture Summary

### Routes

| Route             | Page Component    | Auth Required | Description                                                    |
| ----------------- | ----------------- | ------------- | -------------------------------------------------------------- |
| `/login`          | LoginPage         | No            | Two-step login (school code → credentials)                     |
| `/`               | DashboardPage     | Yes (parent)  | Overview with score cards, quick actions, children list        |
| `/children`       | ChildrenPage      | Yes (parent)  | Detailed child enrollment & progress cards                     |
| `/child-progress` | ChildProgressPage | Yes (parent)  | Per-child detailed progress with charts                        |
| `/results`        | ExamResultsPage   | Yes (parent)  | Searchable exam results with expandable details & PDF download |
| `/progress`       | SpaceProgressPage | Yes (parent)  | Space-level progress grouped by student                        |
| `/notifications`  | NotificationsPage | Yes (parent)  | All/Unread filter, mark read, notification list                |
| `/settings`       | SettingsPage      | Yes (parent)  | Profile (read-only), notification preferences, logout          |
| `*`               | NotFoundPage      | Yes (parent)  | 404 page for unknown routes                                    |

### Key Components

- **LoginPage**: Two-step flow — school code validation → email/password with
  password toggle & forgot password
- **AppLayout**: Sidebar navigation (AppSidebar), NotificationBell in header,
  RoleSwitcher in footer
- **MobileBottomNav**: Fixed bottom nav bar for mobile (Home, Children, Results,
  Alerts)
- **RequireAuth**: Route guard redirecting to `/login` if unauthenticated,
  showing "Access Denied" for wrong roles

### Data Sources (Firebase/Firestore)

- `useLinkedStudents` — fetches student memberships linked to parent
- `useStudentSummaries` — per-student progress summaries (autograde + levelup)
- `useChildSubmissions` — exam submission results for linked children
- `useChildProgress` — space progress records
- `useNotificationPreferences` — email/push/type toggle preferences
- `useNotifications` — notification list with unread filtering

---

## 1. Authentication

### 1.1 Login Page Rendering

| Field           | Value                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `login page renders Parent Portal heading and school code form`                                                                               |
| **Description** | Verify the login page displays the Parent Portal title, school code input, and Continue button                                                |
| **Steps**       | 1. Navigate to `/login` 2. Assert `h1` contains "Parent Portal" 3. Assert `#schoolCode` input is visible 4. Assert Continue button is visible |
| **Expected**    | Page renders with heading "Parent Portal", school code input field, and Continue submit button                                                |
| **Priority**    | P0                                                                                                                                            |
| **Status**      | Implemented                                                                                                                                   |

### 1.2 Unauthenticated Redirect to Login

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `redirects unauthenticated user to /login`                                |
| **Description** | Verify unauthenticated users accessing the root are redirected to login   |
| **Steps**       | 1. Navigate to `/` without authentication 2. Assert URL contains `/login` |
| **Expected**    | URL redirects to `/login`                                                 |
| **Priority**    | P0                                                                        |
| **Status**      | Implemented                                                               |

### 1.3 Protected Routes Redirect

| Field           | Value                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `redirects from all protected routes to /login`                                                                                                      |
| **Description** | Verify all protected routes redirect unauthenticated users                                                                                           |
| **Steps**       | 1. For each route (`/children`, `/child-progress`, `/results`, `/progress`, `/notifications`, `/settings`): navigate and assert redirect to `/login` |
| **Expected**    | All protected routes redirect to `/login` when unauthenticated                                                                                       |
| **Priority**    | P0                                                                                                                                                   |
| **Status**      | Implemented                                                                                                                                          |

### 1.4 School Code Validation — Valid Code

| Field           | Value                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `school code step shows school name after valid code`                                                                                                       |
| **Description** | Entering a valid school code transitions to credentials step showing the school name                                                                        |
| **Steps**       | 1. Navigate to `/login` 2. Fill `#schoolCode` with valid code 3. Click Continue 4. Assert school name is visible 5. Assert email and password inputs appear |
| **Expected**    | School name is displayed, credentials form (email + password) is shown                                                                                      |
| **Priority**    | P0                                                                                                                                                          |
| **Status**      | Implemented                                                                                                                                                 |

### 1.5 School Code Validation — Invalid Code

| Field           | Value                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `invalid school code shows error message`                                                                                          |
| **Description** | Entering an invalid school code displays an error                                                                                  |
| **Steps**       | 1. Navigate to `/login` 2. Fill `#schoolCode` with "INVALID999" 3. Click Continue 4. Assert "Invalid school code" error is visible |
| **Expected**    | Error message "Invalid school code. Please try again." is shown                                                                    |
| **Priority**    | P0                                                                                                                                 |
| **Status**      | Implemented                                                                                                                        |

### 1.6 School Code Validation — Empty Code

| Field           | Value                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `empty school code shows validation error`                                                                                                            |
| **Description** | Submitting empty school code triggers HTML5 or custom validation                                                                                      |
| **Steps**       | 1. Navigate to `/login` 2. Click Continue without entering code 3. Assert validation error appears (HTML5 `:invalid` or "Please enter a school code") |
| **Expected**    | Validation error prevents submission                                                                                                                  |
| **Priority**    | P1                                                                                                                                                    |
| **Status**      | Implemented                                                                                                                                           |

### 1.7 Change School Code Button

| Field           | Value                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `Change button returns to school code step`                                                                                                                             |
| **Description** | Clicking "Change" in credentials step returns to school code entry                                                                                                      |
| **Steps**       | 1. Navigate to `/login` 2. Enter valid school code, click Continue 3. Wait for credentials form 4. Click "Change" button 5. Assert `#schoolCode` input is visible again |
| **Expected**    | User is returned to school code step                                                                                                                                    |
| **Priority**    | P1                                                                                                                                                                      |
| **Status**      | Implemented                                                                                                                                                             |

### 1.8 Successful Login

| Field           | Value                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `successful login navigates to dashboard`                                                                                                                                       |
| **Description** | Valid credentials log the user in and navigate to dashboard                                                                                                                     |
| **Steps**       | 1. Navigate to `/login` 2. Enter school code → Continue 3. Enter valid email and password 4. Click Sign In 5. Assert URL is not `/login` 6. Assert dashboard heading is visible |
| **Expected**    | User is redirected to dashboard with "Parent Dashboard" heading                                                                                                                 |
| **Priority**    | P0                                                                                                                                                                              |
| **Status**      | Implemented                                                                                                                                                                     |

### 1.9 Wrong Password Error

| Field           | Value                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `wrong password shows error message`                                                                                                                    |
| **Description** | Invalid password displays an authentication error                                                                                                       |
| **Steps**       | 1. Navigate to `/login` 2. Enter valid school code → Continue 3. Enter valid email but wrong password 4. Click Sign In 5. Assert error alert is visible |
| **Expected**    | Error message/alert shown with destructive styling                                                                                                      |
| **Priority**    | P0                                                                                                                                                      |
| **Status**      | Implemented                                                                                                                                             |

### 1.10 Sign Out

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Test Name**   | `sign out redirects to login page`                                                       |
| **Description** | Logging out returns user to login page                                                   |
| **Steps**       | 1. Login as parent 2. Click Sign Out (via logout helper) 3. Assert URL contains `/login` |
| **Expected**    | User is redirected to `/login`                                                           |
| **Priority**    | P0                                                                                       |
| **Status**      | Implemented                                                                              |

### 1.11 Password Visibility Toggle

| Field           | Value                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `password show/hide toggle works`                                                                                                                                                                          |
| **Description** | Toggling the eye icon switches password input type between password and text                                                                                                                               |
| **Steps**       | 1. Navigate to `/login`, enter valid school code 2. Assert `#password` has `type="password"` 3. Click the eye icon button 4. Assert `#password` has `type="text"` 5. Click again, assert `type="password"` |
| **Expected**    | Password field toggles visibility; aria-label updates accordingly                                                                                                                                          |
| **Priority**    | P1                                                                                                                                                                                                         |
| **Status**      | Not implemented                                                                                                                                                                                            |

### 1.12 Forgot Password Flow

| Field           | Value                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `forgot password sends reset email or shows error`                                                                                                                  |
| **Description** | Clicking "Forgot password?" with an email triggers a password reset email                                                                                           |
| **Steps**       | 1. Navigate to `/login`, enter school code → Continue 2. Enter email in the email field 3. Click "Forgot password?" link 4. Assert success or error message appears |
| **Expected**    | Message "Password reset email sent. Check your inbox." or error message is shown                                                                                    |
| **Priority**    | P1                                                                                                                                                                  |
| **Status**      | Not implemented                                                                                                                                                     |

### 1.13 Forgot Password Without Email

| Field           | Value                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `forgot password without email shows prompt`                                                                                                                              |
| **Description** | Clicking forgot password without entering an email shows a prompt                                                                                                         |
| **Steps**       | 1. Navigate to `/login`, enter school code → Continue 2. Leave email empty 3. Click "Forgot password?" 4. Assert "Please enter your email address first." message appears |
| **Expected**    | Inline message prompting user to enter email                                                                                                                              |
| **Priority**    | P2                                                                                                                                                                        |
| **Status**      | Not implemented                                                                                                                                                           |

### 1.14 Login Button Loading State

| Field           | Value                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `Sign In button shows loading spinner during authentication`                                                                                                             |
| **Description** | The Sign In button displays a spinner and "Signing in..." text while authenticating                                                                                      |
| **Steps**       | 1. Start login flow with valid credentials 2. Before completion, assert button text is "Signing in..." 3. Assert Loader2 spinner is present 4. Assert button is disabled |
| **Expected**    | Button shows loading state and is disabled during auth                                                                                                                   |
| **Priority**    | P2                                                                                                                                                                       |
| **Status**      | Not implemented                                                                                                                                                          |

---

## 2. Dashboard

### 2.1 Dashboard Heading

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **Test Name**   | `shows Parent Dashboard heading`                                                 |
| **Description** | Dashboard page displays the correct heading                                      |
| **Steps**       | 1. Login as parent 2. Navigate to `/` 3. Assert `h1` contains "Parent Dashboard" |
| **Expected**    | "Parent Dashboard" heading is visible                                            |
| **Priority**    | P0                                                                               |
| **Status**      | Implemented                                                                      |

### 2.2 Welcome Message

| Field           | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| **Test Name**   | `shows welcome message with user name or email`                              |
| **Description** | Dashboard shows personalized welcome message                                 |
| **Steps**       | 1. Login as parent 2. Assert text matching "Welcome back" pattern is visible |
| **Expected**    | Welcome message displays user's name or email                                |
| **Priority**    | P1                                                                           |
| **Status**      | Implemented                                                                  |

### 2.3 Overview Score Cards

| Field           | Value                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `renders four overview score cards`                                                                                                                                                         |
| **Description** | Dashboard shows 4 ScoreCards: Children, Avg Performance, School, Status/At-Risk                                                                                                             |
| **Steps**       | 1. Login as parent 2. Assert "Children" card label is visible 3. Assert "Avg Performance" is visible 4. Assert "School" is visible 5. Assert either "Status" or "At-Risk Alerts" is visible |
| **Expected**    | All four score cards render with labels                                                                                                                                                     |
| **Priority**    | P0                                                                                                                                                                                          |
| **Status**      | Implemented                                                                                                                                                                                 |

### 2.4 Quick Action Links

| Field           | Value                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `renders quick action links for Exam Results, Space Progress, My Children`                                                                     |
| **Description** | Three quick action cards link to their respective pages                                                                                        |
| **Steps**       | 1. Login as parent 2. Assert "Exam Results" link is visible 3. Assert "Space Progress" link is visible 4. Assert "My Children" link is visible |
| **Expected**    | Three quick action link cards are rendered                                                                                                     |
| **Priority**    | P0                                                                                                                                             |
| **Status**      | Implemented                                                                                                                                    |

### 2.5 Quick Action — Exam Results Navigation

| Field           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **Test Name**   | `Exam Results quick action navigates to /results`                                 |
| **Description** | Clicking "Exam Results" quick action card navigates to results page               |
| **Steps**       | 1. Login as parent 2. Click "Exam Results" link 3. Assert URL contains `/results` |
| **Expected**    | Navigation to `/results`                                                          |
| **Priority**    | P0                                                                                |
| **Status**      | Implemented                                                                       |

### 2.6 Quick Action — Space Progress Navigation

| Field           | Value                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `Space Progress quick action navigates to /progress`                                                                                    |
| **Description** | Clicking "Space Progress" quick action card navigates to progress page                                                                  |
| **Steps**       | 1. Login as parent 2. Assert Space Progress link exists with correct href 3. Navigate to `/progress` 4. Assert URL contains `/progress` |
| **Expected**    | Navigation to `/progress`                                                                                                               |
| **Priority**    | P0                                                                                                                                      |
| **Status**      | Implemented                                                                                                                             |

### 2.7 Quick Action — My Children Navigation

| Field           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **Test Name**   | `My Children quick action navigates to /children`                                 |
| **Description** | Clicking "My Children" quick action card navigates to children page               |
| **Steps**       | 1. Login as parent 2. Click "My Children" link 3. Assert URL contains `/children` |
| **Expected**    | Navigation to `/children`                                                         |
| **Priority**    | P0                                                                                |
| **Status**      | Implemented                                                                       |

### 2.8 Children Overview Section

| Field           | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| **Test Name**   | `Children Overview section is visible`                           |
| **Description** | Dashboard shows "Children Overview" section heading              |
| **Steps**       | 1. Login as parent 2. Assert "Children Overview" text is visible |
| **Expected**    | Section heading is rendered                                      |
| **Priority**    | P0                                                               |
| **Status**      | Implemented                                                      |

### 2.9 Linked Children or Empty State

| Field           | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `shows linked children cards or empty state`                                                                                         |
| **Description** | After loading, dashboard shows either child cards or "No linked children" message                                                    |
| **Steps**       | 1. Login as parent 2. Wait for loading to complete 3. Assert either child cards exist OR empty state "No linked children" is visible |
| **Expected**    | Data loads and shows either children or empty state                                                                                  |
| **Priority**    | P0                                                                                                                                   |
| **Status**      | Implemented                                                                                                                          |

### 2.10 View All Link

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **Test Name**   | `View all link navigates to /children`                                         |
| **Description** | "View all" link in Children Overview navigates to children page                |
| **Steps**       | 1. Login as parent 2. Click "View all" link 3. Assert URL contains `/children` |
| **Expected**    | Navigation to `/children`                                                      |
| **Priority**    | P1                                                                             |
| **Status**      | Implemented                                                                    |

### 2.11 Child Card — Student Avatar & Name

| Field           | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card displays student initials avatar and name`                                                                              |
| **Description** | Each child card shows an avatar with initials and the student display name                                                          |
| **Steps**       | 1. Login as parent 2. Wait for children to load 3. If children exist, assert first card has a circular avatar element and name text |
| **Expected**    | Avatar initials and student name visible on child card                                                                              |
| **Priority**    | P1                                                                                                                                  |
| **Status**      | Not implemented                                                                                                                     |

### 2.12 Child Card — Status Badge

| Field           | Value                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card shows status badge (active/inactive)`                                             |
| **Description** | Each child card shows an enrollment status badge                                              |
| **Steps**       | 1. Login as parent 2. Wait for children data 3. Assert badge with "active" or "inactive" text |
| **Expected**    | Status badge is visible with correct variant                                                  |
| **Priority**    | P1                                                                                            |
| **Status**      | Not implemented                                                                               |

### 2.13 Child Card — Progress Ring

| Field           | Value                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card shows ProgressRing with overall score`                                                                                                |
| **Description** | Each child card displays a progress ring with the overall score percentage                                                                        |
| **Steps**       | 1. Login as parent 2. Wait for summary data to load 3. If summaries exist, assert ProgressRing element with aria-label containing "Overall score" |
| **Expected**    | ProgressRing component renders with accessible label                                                                                              |
| **Priority**    | P1                                                                                                                                                |
| **Status**      | Not implemented                                                                                                                                   |

### 2.14 Child Card — Exam & Space Stats

| Field           | Value                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card shows exam, space, and streak statistics`                                                                             |
| **Description** | Each child summary card shows Exams %, Spaces %, and Streak days                                                                  |
| **Steps**       | 1. Login as parent 2. Wait for data 3. If summary exists, assert "Exams:", "Spaces:", "Streak:" labels with percentage/day values |
| **Expected**    | Three stat lines are visible with values                                                                                          |
| **Priority**    | P1                                                                                                                                |
| **Status**      | Not implemented                                                                                                                   |

### 2.15 Child Card — Recent Exam Results

| Field           | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card shows latest exam results when available`                                                                |
| **Description** | If recent exams exist, the card shows up to 2 recent exam titles with color-coded scores                             |
| **Steps**       | 1. Login as parent 2. Wait for data 3. If "Latest Exam Results" heading is visible, assert exam title and percentage |
| **Expected**    | Recent exam entries with title and color-coded percentage                                                            |
| **Priority**    | P2                                                                                                                   |
| **Status**      | Not implemented                                                                                                      |

### 2.16 At-Risk Badge

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `at-risk badge appears for at-risk students`                                                            |
| **Description** | Students flagged as at-risk show an AtRiskBadge component                                               |
| **Steps**       | 1. Login as parent 2. Wait for data 3. If any student is at-risk, assert AtRiskBadge element is visible |
| **Expected**    | At-risk badge with tooltip/reasons is displayed                                                         |
| **Priority**    | P1                                                                                                      |
| **Status**      | Not implemented                                                                                         |

### 2.17 Data Freshness Indicator

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `data freshness indicator shows last update time`                                                                                      |
| **Description** | Dashboard shows "Updated X ago" text with refresh button                                                                               |
| **Steps**       | 1. Login as parent 2. Wait for data 3. Assert "Updated" text is visible 4. Assert refresh button with aria-label "Refresh data" exists |
| **Expected**    | Freshness indicator shows relative time and refresh button                                                                             |
| **Priority**    | P2                                                                                                                                     |
| **Status**      | Not implemented                                                                                                                        |

### 2.18 Data Refresh Button

| Field           | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `clicking refresh button triggers data refetch`                                                                   |
| **Description** | Clicking the refresh icon refetches student summary data                                                          |
| **Steps**       | 1. Login as parent 2. Wait for data 3. Click refresh button (aria-label "Refresh data") 4. Assert no error occurs |
| **Expected**    | Data refreshes without errors                                                                                     |
| **Priority**    | P2                                                                                                                |
| **Status**      | Not implemented                                                                                                   |

### 2.19 Dashboard Sign Out

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `Sign Out button from dashboard logs out`                                                                           |
| **Description** | Sign Out button on dashboard redirects to login                                                                     |
| **Steps**       | 1. Login as parent 2. Click Sign Out button 3. Handle confirmation dialog if present 4. Assert redirect to `/login` |
| **Expected**    | User is logged out and redirected                                                                                   |
| **Priority**    | P0                                                                                                                  |
| **Status**      | Implemented                                                                                                         |

---

## 3. Children Page

### 3.1 Page Heading & Description

| Field           | Value                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `renders page heading and description`                                                                          |
| **Description** | Children page shows "My Children" heading and descriptive text                                                  |
| **Steps**       | 1. Login, navigate to `/children` 2. Assert `h1` contains "My Children" 3. Assert description text is visible   |
| **Expected**    | Heading "My Children" and description "View detailed information about your children's enrollment and progress" |
| **Priority**    | P0                                                                                                              |
| **Status**      | Implemented                                                                                                     |

### 3.2 Children List or Empty State

| Field           | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `shows children list or empty state`                                                                      |
| **Description** | After loading, shows either child cards or "No children linked" empty state                               |
| **Steps**       | 1. Login, navigate to `/children` 2. Wait for skeleton to disappear 3. Assert either cards or empty state |
| **Expected**    | One of: child cards rendered OR "No children linked" message                                              |
| **Priority**    | P0                                                                                                        |
| **Status**      | Implemented                                                                                               |

### 3.3 Empty State — Admin Contact

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `empty state shows admin contact message`                           |
| **Description** | When no children linked, shows helpful admin contact message        |
| **Steps**       | 1. If empty state is shown, assert "Contact your school admin" text |
| **Expected**    | Contact message visible in empty state                              |
| **Priority**    | P1                                                                  |
| **Status**      | Implemented                                                         |

### 3.4 Child Card — Status Badge

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `child card shows status badge`                                           |
| **Description** | Each child card shows active/inactive enrollment badge                    |
| **Steps**       | 1. Wait for data 2. If children exist, assert first card has status badge |
| **Expected**    | Badge with "active" or "inactive" text                                    |
| **Priority**    | P1                                                                        |
| **Status**      | Implemented                                                               |

### 3.5 Child Card — Performance Stats

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card shows performance stats (Exam Average, Space Completion, Streak)`                     |
| **Description** | Each child card displays three stat boxes                                                         |
| **Steps**       | 1. Wait for data 2. If children exist, assert "Exam Average", "Space Completion", "Streak" labels |
| **Expected**    | Three stat boxes with labels and values (percentage or "--")                                      |
| **Priority**    | P0                                                                                                |
| **Status**      | Implemented                                                                                       |

### 3.6 Child Card — Progress Ring

| Field           | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Test Name**   | `child card shows overall score ProgressRing`                                                  |
| **Description** | If summary data exists, a ProgressRing with "Overall" label is shown                           |
| **Steps**       | 1. Wait for data 2. If summary exists, assert ProgressRing with aria-label "Overall score: X%" |
| **Expected**    | ProgressRing visible with accessible score label                                               |
| **Priority**    | P1                                                                                             |
| **Status**      | Not implemented                                                                                |

### 3.7 Child Card — At-Risk Badge

| Field           | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| **Test Name**   | `child card shows AtRiskBadge when student is at risk`                      |
| **Description** | At-risk students display an AtRiskBadge with reasons                        |
| **Steps**       | 1. Wait for data 2. If at-risk student exists, assert AtRiskBadge component |
| **Expected**    | AtRiskBadge renders with reasons tooltip                                    |
| **Priority**    | P1                                                                          |
| **Status**      | Not implemented                                                             |

### 3.8 Child Card — Recent Exam Results

| Field           | Value                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `child card shows up to 3 latest exam results with color-coded scores`                                                                                                                                 |
| **Description** | Recent exams section shows exam title and percentage, colored by performance tier                                                                                                                      |
| **Steps**       | 1. Wait for data 2. If recent exams exist, assert "Latest Exam Results" heading 3. Assert exam entries with title and percentage 4. Assert color coding (success ≥70%, warning ≥40%, destructive <40%) |
| **Expected**    | Up to 3 exam entries with color-coded scores                                                                                                                                                           |
| **Priority**    | P2                                                                                                                                                                                                     |
| **Status**      | Not implemented                                                                                                                                                                                        |

### 3.9 View Full Progress Link

| Field           | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Test Name**   | `View Full Progress link navigates to /child-progress`                                       |
| **Description** | "View Full Progress" action link on child card navigates to child progress page              |
| **Steps**       | 1. Wait for data 2. Click "View Full Progress" link 3. Assert URL contains `/child-progress` |
| **Expected**    | Navigation to `/child-progress`                                                              |
| **Priority**    | P0                                                                                           |
| **Status**      | Implemented                                                                                  |

### 3.10 Exam Results Link

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **Test Name**   | `Exam Results link navigates to /results`                                       |
| **Description** | "Exam Results" action link on child card navigates to results page              |
| **Steps**       | 1. Wait for data 2. Click "Exam Results" link 3. Assert URL contains `/results` |
| **Expected**    | Navigation to `/results`                                                        |
| **Priority**    | P0                                                                              |
| **Status**      | Implemented                                                                     |

### 3.11 Loading Skeleton

| Field           | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `skeleton loading state renders while data is fetching`                                                                              |
| **Description** | While data loads, skeleton placeholders are shown with proper accessibility                                                          |
| **Steps**       | 1. Login, navigate to `/children` 2. Assert skeleton elements or `role="status"` with `aria-label="Loading content"` appears briefly |
| **Expected**    | Skeleton loading state with screen reader text "Loading..."                                                                          |
| **Priority**    | P2                                                                                                                                   |
| **Status**      | Not implemented                                                                                                                      |

---

## 4. Child Progress Page

### 4.1 Page Heading & Description

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `renders page heading and description`                                    |
| **Description** | Shows "Child Progress" heading and descriptive text                       |
| **Steps**       | 1. Login, navigate to `/child-progress` 2. Assert heading and description |
| **Expected**    | Heading "Child Progress" and description visible                          |
| **Priority**    | P0                                                                        |
| **Status**      | Implemented                                                               |

### 4.2 Data or Empty State

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `shows progress data or empty state after loading`                                                      |
| **Description** | After loading, shows score cards with data or empty state message                                       |
| **Steps**       | 1. Wait for loading 2. Assert either "Overall Score" label OR "No linked children" / "No progress data" |
| **Expected**    | One of: progress data or empty state                                                                    |
| **Priority**    | P0                                                                                                      |
| **Status**      | Implemented                                                                                             |

### 4.3 Overview Score Cards

| Field           | Value                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| **Test Name**   | `overview score cards are visible when data is loaded`                                |
| **Description** | Five ScoreCards: Overall Score, Exam Average, Space Completion, Streak, Points Earned |
| **Steps**       | 1. Wait for data 2. If data present, assert all 5 ScoreCard labels                    |
| **Expected**    | Five score cards with respective labels and values                                    |
| **Priority**    | P0                                                                                    |
| **Status**      | Implemented                                                                           |

### 4.4 Child Selector (Multiple Children)

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `child selector appears when multiple children exist`               |
| **Description** | When parent has multiple children, selector buttons appear          |
| **Steps**       | 1. Wait for data 2. Check for selector buttons with avatar initials |
| **Expected**    | Selector buttons appear if multiple children linked                 |
| **Priority**    | P1                                                                  |
| **Status**      | Implemented                                                         |

### 4.5 Child Selector — Switching

| Field           | Value                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `switching child selector updates displayed data`                                                                                                      |
| **Description** | Clicking a different child selector button updates the active state and data                                                                           |
| **Steps**       | 1. Wait for data 2. If multiple children, click second child button 3. Assert second button has `border-primary` class 4. Assert first button does not |
| **Expected**    | Active child changes, UI reflects the switch                                                                                                           |
| **Priority**    | P1                                                                                                                                                     |
| **Status**      | Implemented                                                                                                                                            |

### 4.6 At-Risk Alert Section

| Field           | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `at-risk alert section renders when student is at risk`                                                       |
| **Description** | At-risk students show a destructive-colored alert box with reasons                                            |
| **Steps**       | 1. Wait for data 2. If "At-Risk Alert" heading exists, assert it's visible 3. Assert reasons list is rendered |
| **Expected**    | At-risk alert with destructive styling and reasons                                                            |
| **Priority**    | P1                                                                                                            |
| **Status**      | Implemented                                                                                                   |

### 4.7 Strengths & Areas for Improvement

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **Test Name**   | `strengths and areas for improvement sections render`                          |
| **Description** | Strengths and weakness pills are shown when data is available                  |
| **Steps**       | 1. Wait for data 2. Check for "Strengths" and "Areas for Improvement" headings |
| **Expected**    | Sections render with colored pill badges                                       |
| **Priority**    | P1                                                                             |
| **Status**      | Implemented                                                                    |

### 4.8 Improvement Recommendations

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `improvement recommendations section renders for students with weaknesses`                                                             |
| **Description** | When weakness areas exist, a blue info box with recommendations appears                                                                |
| **Steps**       | 1. Wait for data 2. If "Recommendations for Improvement" heading exists, assert it's visible 3. Assert recommendation items are listed |
| **Expected**    | Info-styled recommendations with contextual advice                                                                                     |
| **Priority**    | P2                                                                                                                                     |
| **Status**      | Not implemented                                                                                                                        |

### 4.9 Exam Scores by Subject Chart

| Field           | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| **Test Name**   | `exam scores by subject chart section renders`                               |
| **Description** | Bar chart showing exam scores broken down by subject                         |
| **Steps**       | 1. Wait for data 2. If "Exam Scores by Subject" exists, assert chart renders |
| **Expected**    | SimpleBarChart component renders with subject data                           |
| **Priority**    | P1                                                                           |
| **Status**      | Implemented                                                                  |

### 4.10 Space Completion by Subject Chart

| Field           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **Test Name**   | `space completion by subject chart section renders`                               |
| **Description** | Bar chart showing space completion broken down by subject                         |
| **Steps**       | 1. Wait for data 2. If "Space Completion by Subject" exists, assert chart renders |
| **Expected**    | SimpleBarChart component renders with space data                                  |
| **Priority**    | P1                                                                                |
| **Status**      | Implemented                                                                       |

### 4.11 Recent Exam Results Section

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Test Name**   | `recent exam results section renders with exam titles and progress bars`                         |
| **Description** | List of recent exams with title, percentage, and color-coded progress bar                        |
| **Steps**       | 1. Wait for data 2. If "Recent Exam Results" heading exists, assert exam entries with percentage |
| **Expected**    | Exam list with progress bars and color-coded scores                                              |
| **Priority**    | P1                                                                                               |
| **Status**      | Implemented                                                                                      |

### 4.12 Recent Activity Section

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **Test Name**   | `recent activity section renders with space activity`                            |
| **Description** | Shows up to 6 recent space learning activities                                   |
| **Steps**       | 1. Wait for data 2. If "Recent Activity" heading exists, assert activity entries |
| **Expected**    | Activity list with space title and action description                            |
| **Priority**    | P1                                                                               |
| **Status**      | Implemented                                                                      |

### 4.13 Exam Completion Count

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Test Name**   | `exam completion count is displayed`                                       |
| **Description** | Shows "X/Y exams completed" text below exam results                        |
| **Steps**       | 1. Wait for data 2. Assert text matching pattern `\d+/\d+ exams completed` |
| **Expected**    | Completion count text is visible                                           |
| **Priority**    | P2                                                                         |
| **Status**      | Implemented                                                                |

### 4.14 Space Accuracy Stat

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| **Test Name**   | `space accuracy and completion stats are displayed`                     |
| **Description** | Shows "X/Y spaces completed                                             | Accuracy: Z%" below activity section |
| **Steps**       | 1. Wait for data 2. Assert text with "spaces completed" and "Accuracy:" |
| **Expected**    | Space completion and accuracy summary visible                           |
| **Priority**    | P2                                                                      |
| **Status**      | Not implemented                                                         |

---

## 5. Exam Results Page

### 5.1 Page Heading & Description

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Test Name**   | `renders page heading and description`                             |
| **Description** | Shows "Exam Results" heading and descriptive text                  |
| **Steps**       | 1. Login, navigate to `/results` 2. Assert heading and description |
| **Expected**    | Heading "Exam Results" and description visible                     |
| **Priority**    | P0                                                                 |
| **Status**      | Implemented                                                        |

### 5.2 Search Input

| Field           | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `search input is visible and functional`                                                                          |
| **Description** | Search input accepts text for filtering results                                                                   |
| **Steps**       | 1. Assert search input with placeholder is visible 2. Type "math" 3. Assert input has value "math" 4. Clear input |
| **Expected**    | Search input is interactive and accepts text                                                                      |
| **Priority**    | P0                                                                                                                |
| **Status**      | Implemented                                                                                                       |

### 5.3 Results List or Empty State

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Test Name**   | `shows results list or empty state after loading`                  |
| **Description** | After loading, shows either result cards or "No results available" |
| **Steps**       | 1. Wait for loading 2. Assert either cards or empty state          |
| **Expected**    | Results cards or empty state message                               |
| **Priority**    | P0                                                                 |
| **Status**      | Implemented                                                        |

### 5.4 Empty State Message

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| **Test Name**   | `empty state shows descriptive message`                                                 |
| **Description** | Empty state shows helpful message about when results will appear                        |
| **Steps**       | 1. If empty state visible, assert "Results will appear here once teachers release them" |
| **Expected**    | Helpful empty state text                                                                |
| **Priority**    | P1                                                                                      |
| **Status**      | Implemented                                                                             |

### 5.5 Search Filtering

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Test Name**   | `search filters result list`                                                                      |
| **Description** | Searching for a non-existent term shows empty results                                             |
| **Steps**       | 1. Wait for results 2. Type "zzznoresultsxxx" 3. Assert no results or empty state 4. Clear search |
| **Expected**    | Results filtered to show no matches                                                               |
| **Priority**    | P0                                                                                                |
| **Status**      | Implemented                                                                                       |

### 5.6 Result Card — Percentage Score

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| **Test Name**   | `exam result card shows percentage score in large font`                             |
| **Description** | Each result shows a bold percentage score (or "--")                                 |
| **Steps**       | 1. Wait for data 2. Assert first result card has large text with percentage or "--" |
| **Expected**    | Score displayed in 2xl font with color coding                                       |
| **Priority**    | P0                                                                                  |
| **Status**      | Implemented                                                                         |

### 5.7 Result Card — Score Bar

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `score bar is visible for results with percentage`                        |
| **Description** | A colored progress bar reflects the exam score                            |
| **Steps**       | 1. Wait for data 2. Assert progress bar element exists within result card |
| **Expected**    | Color-coded progress bar (success ≥70%, warning ≥40%, destructive <40%)   |
| **Priority**    | P1                                                                        |
| **Status**      | Implemented                                                               |

### 5.8 Accordion Expand

| Field           | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `clicking exam card expands details`                                                                          |
| **Description** | Clicking accordion trigger reveals expanded details                                                           |
| **Steps**       | 1. Wait for data 2. Click first result's toggle 3. Assert "Grade", "Questions Graded", "Status" labels appear |
| **Expected**    | Expanded details show grade, questions graded, and status                                                     |
| **Priority**    | P0                                                                                                            |
| **Status**      | Implemented                                                                                                   |

### 5.9 Accordion Collapse

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **Test Name**   | `clicking expanded card again collapses it`                                     |
| **Description** | Toggling the accordion closed hides the expanded details                        |
| **Steps**       | 1. Expand first card 2. Click toggle again 3. Assert expanded content is hidden |
| **Expected**    | Details section collapses                                                       |
| **Priority**    | P1                                                                              |
| **Status**      | Implemented                                                                     |

### 5.10 Expanded Details — Grade & Status

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `expanded exam card shows grade and status`                         |
| **Description** | Expanded section shows Grade, Questions Graded, Status              |
| **Steps**       | 1. Expand a result card 2. Assert all three labels are visible      |
| **Expected**    | Grade (e.g., "A", "B"), Questions Graded count, and pipeline status |
| **Priority**    | P0                                                                  |
| **Status**      | Implemented                                                         |

### 5.11 Download PDF Button

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Test Name**   | `expanded exam card shows Download PDF button`                     |
| **Description** | Expanded details include a "Download PDF" button                   |
| **Steps**       | 1. Expand a result card 2. Assert "Download PDF" button is visible |
| **Expected**    | DownloadPDFButton component renders                                |
| **Priority**    | P1                                                                 |
| **Status**      | Not implemented                                                    |

### 5.12 PDF Download Flow

| Field           | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `clicking Download PDF triggers PDF generation`                                                                   |
| **Description** | Clicking the PDF button initiates exam result PDF generation                                                      |
| **Steps**       | 1. Expand a result card 2. Click "Download PDF" 3. Assert button shows loading state 4. Assert no unhandled error |
| **Expected**    | PDF generation initiates (loading spinner shown, then download or success)                                        |
| **Priority**    | P1                                                                                                                |
| **Status**      | Not implemented                                                                                                   |

### 5.13 Per-Question Feedback

| Field           | Value                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `expanded exam card shows per-question breakdown`                                                                                                |
| **Description** | Expanded details show "Per-Question Breakdown" with individual question scores                                                                   |
| **Steps**       | 1. Expand a result card 2. If "Per-Question Breakdown" heading exists, assert question items 3. Assert each question shows score and status icon |
| **Expected**    | Question-level feedback with score bars, rubric breakdown, strengths/weaknesses                                                                  |
| **Priority**    | P1                                                                                                                                               |
| **Status**      | Not implemented                                                                                                                                  |

### 5.14 Improvement Recommendations (Exam-Level)

| Field           | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `improvement recommendations appear for low-scoring exams`                                                        |
| **Description** | Exams below 70% show improvement recommendations box                                                              |
| **Steps**       | 1. Expand a result with <70% score 2. Assert "Improvement Recommendations" heading 3. Assert recommendation items |
| **Expected**    | Info-styled recommendations for the specific subject                                                              |
| **Priority**    | P2                                                                                                                |
| **Status**      | Not implemented                                                                                                   |

### 5.15 Exam Subject Badge

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Test Name**   | `exam result card shows subject badge when available`                    |
| **Description** | Results with a subject field show a pill badge next to the title         |
| **Steps**       | 1. Wait for data 2. If a result has a subject, assert subject badge text |
| **Expected**    | Rounded subject pill visible next to exam title                          |
| **Priority**    | P2                                                                       |
| **Status**      | Not implemented                                                          |

### 5.16 Student Name & Roll Number

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Test Name**   | `exam result card shows student name and roll number`                |
| **Description** | Each result shows which student it belongs to with their roll number |
| **Steps**       | 1. Wait for data 2. Assert text containing student name and "Roll:"  |
| **Expected**    | Student identification shown on each result                          |
| **Priority**    | P1                                                                   |
| **Status**      | Not implemented                                                      |

---

## 6. Space Progress Page

### 6.1 Page Heading & Description

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `renders page heading and description`                              |
| **Description** | Shows "Space Progress" heading and tracking description             |
| **Steps**       | 1. Login, navigate to `/progress` 2. Assert heading and description |
| **Expected**    | Heading "Space Progress" and description visible                    |
| **Priority**    | P0                                                                  |
| **Status**      | Implemented                                                         |

### 6.2 Data or Empty State

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Test Name**   | `shows progress data or empty state after loading`                                         |
| **Description** | After loading, shows student-grouped progress or empty state                               |
| **Steps**       | 1. Wait for loading 2. Assert either student headings with cards or "No progress data yet" |
| **Expected**    | Progress cards grouped by student or empty state                                           |
| **Priority**    | P0                                                                                         |
| **Status**      | Implemented                                                                                |

### 6.3 Empty State Message

| Field           | Value                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| **Test Name**   | `empty state shows descriptive message`                                               |
| **Description** | Empty state provides helpful context                                                  |
| **Steps**       | 1. If empty state, assert "Progress will appear here as your children start learning" |
| **Expected**    | Helpful empty state text                                                              |
| **Priority**    | P1                                                                                    |
| **Status**      | Implemented                                                                           |

### 6.4 Progress Cards — Percentage & Points

| Field           | Value                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `progress cards show percentage and points`                                                                 |
| **Description** | Each space progress card shows completion percentage and points                                             |
| **Steps**       | 1. Wait for data 2. If cards exist, assert first card has percentage text 3. Assert points format "X/Y pts" |
| **Expected**    | Percentage in large font and points earned/total                                                            |
| **Priority**    | P0                                                                                                          |
| **Status**      | Implemented                                                                                                 |

### 6.5 Progress Cards — Status Badge

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Test Name**   | `progress cards show status badges`                                  |
| **Description** | Each card shows a status badge (not started, in progress, completed) |
| **Steps**       | 1. Wait for data 2. Assert status badge with valid status text       |
| **Expected**    | Badge with one of the valid status values                            |
| **Priority**    | P1                                                                   |
| **Status**      | Implemented                                                          |

### 6.6 Progress Bar

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `progress bar is rendered for each space card`                            |
| **Description** | Each card has a color-coded progress bar                                  |
| **Steps**       | 1. Wait for data 2. Assert `.h-2.w-full.rounded-full` progress bar exists |
| **Expected**    | Green for completed, blue for in-progress                                 |
| **Priority**    | P1                                                                        |
| **Status**      | Implemented                                                               |

### 6.7 Student Section Headings

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `student section heading is shown for each student`                 |
| **Description** | Progress cards are grouped under student name headings              |
| **Steps**       | 1. Wait for data 2. Assert `h2` headings exist for student sections |
| **Expected**    | Student name headings above their space cards                       |
| **Priority**    | P1                                                                  |
| **Status**      | Implemented                                                         |

### 6.8 Story Points Count

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Test Name**   | `story points count is displayed when available`                                                 |
| **Description** | Cards with story point data show completion count                                                |
| **Steps**       | 1. Wait for data 2. If story points text exists, assert pattern `\d+/\d+ story points completed` |
| **Expected**    | Story points completion text                                                                     |
| **Priority**    | P2                                                                                               |
| **Status**      | Implemented                                                                                      |

### 6.9 Space Names Resolution

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **Test Name**   | `space names are resolved from IDs`                                             |
| **Description** | Space cards show resolved names instead of raw IDs                              |
| **Steps**       | 1. Wait for data 2. Assert first card heading does not look like a truncated ID |
| **Expected**    | Human-readable space names when data is available                               |
| **Priority**    | P2                                                                              |
| **Status**      | Not implemented                                                                 |

---

## 7. Notifications Page

### 7.1 Page Heading

| Field           | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| **Test Name**   | `renders Notifications heading`                                               |
| **Description** | Notifications page shows heading containing "Notification"                    |
| **Steps**       | 1. Login, navigate to `/notifications` 2. Assert `h1` contains "notification" |
| **Expected**    | Heading visible                                                               |
| **Priority**    | P0                                                                            |
| **Status**      | Implemented                                                                   |

### 7.2 Filter Options (All / Unread)

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **Test Name**   | `shows All and Unread filter options`                                          |
| **Description** | Filter buttons/tabs for All and Unread notifications                           |
| **Steps**       | 1. Assert "All" button/tab is visible 2. Assert "Unread" button/tab is visible |
| **Expected**    | Both filter options rendered                                                   |
| **Priority**    | P0                                                                             |
| **Status**      | Implemented                                                                    |

### 7.3 Unread Filter

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| **Test Name**   | `switching to Unread filter updates the view`                                           |
| **Description** | Clicking Unread shows only unread notifications                                         |
| **Steps**       | 1. Click "Unread" filter 2. Wait for update 3. Assert content or empty state for unread |
| **Expected**    | View filtered to unread notifications                                                   |
| **Priority**    | P0                                                                                      |
| **Status**      | Implemented                                                                             |

### 7.4 All Filter

| Field           | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| **Test Name**   | `switching back to All filter shows all notifications`            |
| **Description** | Switching from Unread back to All shows complete list             |
| **Steps**       | 1. Click Unread 2. Click All 3. Assert view updates without error |
| **Expected**    | Full notification list restored                                   |
| **Priority**    | P1                                                                |
| **Status**      | Implemented                                                       |

### 7.5 Mark All Read

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Test Name**   | `Mark All Read button is present when notifications exist`         |
| **Description** | A button to mark all notifications as read is available            |
| **Steps**       | 1. Wait for data 2. If mark all button exists, assert it's visible |
| **Expected**    | "Mark all" button visible when notifications exist                 |
| **Priority**    | P1                                                                 |
| **Status**      | Implemented                                                        |

### 7.6 Mark All Read — Functionality

| Field           | Value                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `clicking Mark All Read marks all notifications as read`                                                                                              |
| **Description** | After clicking mark all, unread count should drop to 0                                                                                                |
| **Steps**       | 1. If notifications exist, click "Mark all" button 2. Wait for update 3. Switch to Unread filter 4. Assert either no notifications or count decreased |
| **Expected**    | All notifications marked as read                                                                                                                      |
| **Priority**    | P1                                                                                                                                                    |
| **Status**      | Not implemented                                                                                                                                       |

### 7.7 Notification Click

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Test Name**   | `notification items are clickable`                                   |
| **Description** | Clicking a notification marks it read and navigates to actionUrl     |
| **Steps**       | 1. Wait for data 2. Click first notification item 3. Assert no crash |
| **Expected**    | Notification click handler fires without error                       |
| **Priority**    | P1                                                                   |
| **Status**      | Implemented                                                          |

### 7.8 Notification Click — Navigation

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Test Name**   | `clicking notification with actionUrl navigates to that URL`                                     |
| **Description** | Notifications with an actionUrl should navigate the user to that route                           |
| **Steps**       | 1. If a notification exists with an actionUrl 2. Click it 3. Assert URL changed to the actionUrl |
| **Expected**    | URL changes to notification's action target                                                      |
| **Priority**    | P2                                                                                               |
| **Status**      | Not implemented                                                                                  |

### 7.9 Mark Individual Read

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Test Name**   | `individual notification can be marked as read`                                                   |
| **Description** | Single notification mark-read functionality                                                       |
| **Steps**       | 1. If unread notification exists 2. Trigger mark-read action 3. Assert notification state updates |
| **Expected**    | Single notification marked as read                                                                |
| **Priority**    | P2                                                                                                |
| **Status**      | Not implemented                                                                                   |

---

## 8. Settings Page

### 8.1 Page Heading & Description

| Field           | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| **Test Name**   | `renders Settings heading and description`                                    |
| **Description** | Settings page shows heading and descriptive text                              |
| **Steps**       | 1. Login, navigate to `/settings` 2. Assert heading and description           |
| **Expected**    | Heading "Settings" and description about profile and notification preferences |
| **Priority**    | P0                                                                            |
| **Status**      | Implemented                                                                   |

### 8.2 Profile Section

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `Profile section is visible with user email`                                                                     |
| **Description** | Profile card shows Display Name and Email fields                                                                 |
| **Steps**       | 1. Assert "Profile" heading 2. Assert "Your account information" description 3. Assert email input with @ symbol |
| **Expected**    | Profile card with user information                                                                               |
| **Priority**    | P0                                                                                                               |
| **Status**      | Implemented                                                                                                      |

### 8.3 Display Name Read-Only

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| **Test Name**   | `Display Name field is read-only`                              |
| **Description** | Display Name input has readOnly attribute and bg-muted styling |
| **Steps**       | 1. Find Display Name input 2. Assert readOnly attribute        |
| **Expected**    | Field is not editable                                          |
| **Priority**    | P1                                                             |
| **Status**      | Implemented                                                    |

### 8.4 Email Read-Only

| Field           | Value                                            |
| --------------- | ------------------------------------------------ |
| **Test Name**   | `Email field is read-only`                       |
| **Description** | Email input has readOnly attribute               |
| **Steps**       | 1. Find Email input 2. Assert readOnly attribute |
| **Expected**    | Field is not editable                            |
| **Priority**    | P1                                               |
| **Status**      | Implemented                                      |

### 8.5 Admin Contact Message

| Field           | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| **Test Name**   | `shows contact school admin message`                                          |
| **Description** | Profile section shows message about contacting admin for changes              |
| **Steps**       | 1. Assert "Contact your school admin to update your profile information" text |
| **Expected**    | Instructional text visible                                                    |
| **Priority**    | P1                                                                            |
| **Status**      | Implemented                                                                   |

### 8.6 Notification Preferences Section

| Field           | Value                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `Notification Preferences section is visible`                                                                      |
| **Description** | Card with notification preference toggles                                                                          |
| **Steps**       | 1. Assert "Notification Preferences" heading 2. Assert "Choose how and when you receive notifications" description |
| **Expected**    | Notification preferences card rendered                                                                             |
| **Priority**    | P0                                                                                                                 |
| **Status**      | Implemented                                                                                                        |

### 8.7 Notification Channels

| Field           | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `Notification Channels section has Email and Push toggles`                                                           |
| **Description** | Two channel toggles: Email Notifications, Push Notifications                                                         |
| **Steps**       | 1. Assert "Notification Channels" heading 2. Assert "Email Notifications" label 3. Assert "Push Notifications" label |
| **Expected**    | Both channel toggle rows visible                                                                                     |
| **Priority**    | P0                                                                                                                   |
| **Status**      | Implemented                                                                                                          |

### 8.8 Notification Types

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| **Test Name**   | `Notification Types section has all toggle options`                                  |
| **Description** | Three notification type toggles: Exam Results, Progress Milestones, Teacher Messages |
| **Steps**       | 1. Assert "Notification Types" heading 2. Assert all three type labels               |
| **Expected**    | All type toggles visible with descriptions                                           |
| **Priority**    | P0                                                                                   |
| **Status**      | Implemented                                                                          |

### 8.9 Toggle Interactivity

| Field           | Value                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `notification toggles are interactive`                                                                                   |
| **Description** | Switch components toggle aria-checked state on click                                                                     |
| **Steps**       | 1. Get initial `aria-checked` of first switch 2. Click switch 3. Assert `aria-checked` changed 4. Click again to restore |
| **Expected**    | Switch toggles between true/false                                                                                        |
| **Priority**    | P0                                                                                                                       |
| **Status**      | Implemented                                                                                                              |

### 8.10 Email Notifications Default

| Field           | Value                                            |
| --------------- | ------------------------------------------------ |
| **Test Name**   | `Email Notifications toggle defaults to enabled` |
| **Description** | Default preference has email notifications on    |
| **Steps**       | 1. Assert first switch `aria-checked="true"`     |
| **Expected**    | Email notifications enabled by default           |
| **Priority**    | P1                                               |
| **Status**      | Implemented                                      |

### 8.11 Save Changes Button

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Test Name**   | `Save Changes button appears after toggling a preference`            |
| **Description** | Dirty state triggers Save Changes button to appear                   |
| **Steps**       | 1. Toggle any switch 2. Assert "Save Changes" button becomes visible |
| **Expected**    | Save button appears only when preferences are modified               |
| **Priority**    | P0                                                                   |
| **Status**      | Not implemented                                                      |

### 8.12 Save Preferences

| Field           | Value                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `saving notification preferences shows success toast`                                                                                                        |
| **Description** | Clicking Save Changes saves preferences and shows success toast                                                                                              |
| **Steps**       | 1. Toggle a switch 2. Click "Save Changes" 3. Assert success toast "Preferences saved successfully" appears 4. Assert Save button disappears (isDirty reset) |
| **Expected**    | Preferences saved, toast shown, button hidden                                                                                                                |
| **Priority**    | P0                                                                                                                                                           |
| **Status**      | Not implemented                                                                                                                                              |

### 8.13 Save Preferences Error

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Test Name**   | `failed save shows error toast`                                            |
| **Description** | If save fails, error toast is shown                                        |
| **Steps**       | 1. Mock/simulate save failure 2. Assert "Failed to save preferences" toast |
| **Expected**    | Error toast displayed                                                      |
| **Priority**    | P2                                                                         |
| **Status**      | Not implemented                                                            |

### 8.14 Account Section — Sign Out

| Field           | Value                                                   |
| --------------- | ------------------------------------------------------- |
| **Test Name**   | `Account section has Sign Out button`                   |
| **Description** | Account card contains a LogoutButton                    |
| **Steps**       | 1. Assert "Account" heading 2. Assert "Sign Out" button |
| **Expected**    | Sign Out button visible in Account card                 |
| **Priority**    | P0                                                      |
| **Status**      | Implemented                                             |

### 8.15 Settings Sign Out

| Field           | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Test Name**   | `Sign Out button in settings logs out and redirects`                                      |
| **Description** | Clicking Sign Out logs the user out                                                       |
| **Steps**       | 1. Click Sign Out 2. Handle confirmation dialog if present 3. Assert redirect to `/login` |
| **Expected**    | User logged out, redirected to login                                                      |
| **Priority**    | P0                                                                                        |
| **Status**      | Implemented                                                                               |

### 8.16 Preferences Loading Skeleton

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Test Name**   | `preferences loading skeleton shows while fetching`                                        |
| **Description** | While preferences load, skeleton placeholders appear                                       |
| **Steps**       | 1. Navigate to `/settings` 2. Assert skeleton elements with `role="status"` appear briefly |
| **Expected**    | Skeleton loading state with screen reader text                                             |
| **Priority**    | P2                                                                                         |
| **Status**      | Not implemented                                                                            |

---

## 9. Navigation & Routing

### 9.1 Direct Navigation — All Routes

| Field           | Value                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `navigating directly to each route shows correct page`                                                                                                                                                                                                                |
| **Description** | Each route renders the correct page when accessed directly                                                                                                                                                                                                            |
| **Steps**       | For each route: 1. `page.goto(route)` 2. Assert correct heading. Routes: `/children` → "My Children", `/child-progress` → "Child Progress", `/results` → "Exam Results", `/progress` → "Space Progress", `/notifications` → heading visible, `/settings` → "Settings" |
| **Expected**    | Each route loads its correct page                                                                                                                                                                                                                                     |
| **Priority**    | P0                                                                                                                                                                                                                                                                    |
| **Status**      | Implemented                                                                                                                                                                                                                                                           |

### 9.2 Unknown Route — 404

| Field           | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `unknown route shows 404 or redirects appropriately`                                                         |
| **Description** | Non-existent routes show NotFoundPage or redirect                                                            |
| **Steps**       | 1. Navigate to `/this-route-does-not-exist` 2. Assert either 404 page, login redirect, or dashboard redirect |
| **Expected**    | Appropriate fallback behavior                                                                                |
| **Priority**    | P1                                                                                                           |
| **Status**      | Implemented                                                                                                  |

### 9.3 Sidebar Navigation

| Field           | Value                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `sidebar navigation links work correctly`                                                                                                                             |
| **Description** | Clicking sidebar links navigates to correct pages                                                                                                                     |
| **Steps**       | 1. Login as parent 2. For each sidebar item (Dashboard, Children, Exam Results, Space Progress, Child Progress, Settings): click sidebar link, assert correct heading |
| **Expected**    | Each sidebar link navigates to the correct page                                                                                                                       |
| **Priority**    | P0                                                                                                                                                                    |
| **Status**      | Not implemented                                                                                                                                                       |

### 9.4 Sidebar Active State

| Field           | Value                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `sidebar highlights active route`                                                                                                                              |
| **Description** | Current route's sidebar item has active styling                                                                                                                |
| **Steps**       | 1. Navigate to `/children` 2. Assert "Children" sidebar item has active class 3. Navigate to `/results` 4. Assert "Exam Results" sidebar item has active class |
| **Expected**    | Active route highlighted in sidebar                                                                                                                            |
| **Priority**    | P1                                                                                                                                                             |
| **Status**      | Not implemented                                                                                                                                                |

### 9.5 Sidebar Nav Groups

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `sidebar shows correct nav group labels`                                                                                               |
| **Description** | Sidebar groups: Overview, My Children, Account                                                                                         |
| **Steps**       | 1. Login as parent 2. Assert "Overview" group label (Desktop only) 3. Assert "My Children" group label 4. Assert "Account" group label |
| **Expected**    | Three nav group labels visible                                                                                                         |
| **Priority**    | P2                                                                                                                                     |
| **Status**      | Not implemented                                                                                                                        |

### 9.6 Sidebar Footer — Role Switcher

| Field           | Value                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `sidebar footer shows RoleSwitcher and user info`                                                                       |
| **Description** | Sidebar footer contains RoleSwitcher component and user display name/email                                              |
| **Steps**       | 1. Login as parent 2. Assert user's display name or email in sidebar footer 3. Assert RoleSwitcher component is present |
| **Expected**    | User info and tenant switcher in sidebar footer                                                                         |
| **Priority**    | P2                                                                                                                      |
| **Status**      | Not implemented                                                                                                         |

### 9.7 Notification Bell — Header

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **Test Name**   | `notification bell is visible in header`                                        |
| **Description** | NotificationBell component renders in the app header                            |
| **Steps**       | 1. Login as parent 2. Assert notification bell button/icon is visible in header |
| **Expected**    | Bell icon accessible in header area                                             |
| **Priority**    | P1                                                                              |
| **Status**      | Not implemented                                                                 |

### 9.8 Notification Bell — Unread Count Badge

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| **Test Name**   | `notification bell shows unread count badge when notifications exist`   |
| **Description** | If unread notifications exist, bell shows a count badge                 |
| **Steps**       | 1. Login as parent 2. If unread count > 0, assert badge element on bell |
| **Expected**    | Badge with unread count visible on bell icon                            |
| **Priority**    | P2                                                                      |
| **Status**      | Not implemented                                                         |

### 9.9 Notification Bell — Dropdown

| Field           | Value                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| **Test Name**   | `clicking notification bell opens notification dropdown`                              |
| **Description** | Clicking the bell icon opens a popover/dropdown with notifications                    |
| **Steps**       | 1. Click notification bell 2. Assert dropdown/popover appears with notifications list |
| **Expected**    | Notification dropdown opens                                                           |
| **Priority**    | P1                                                                                    |
| **Status**      | Not implemented                                                                       |

### 9.10 Notification Bell — View All Link

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Test Name**   | `notification dropdown has View All button navigating to /notifications`                 |
| **Description** | Dropdown has a "View All" link that navigates to full notifications page                 |
| **Steps**       | 1. Open notification bell dropdown 2. Click "View All" 3. Assert URL is `/notifications` |
| **Expected**    | Navigation to `/notifications` page                                                      |
| **Priority**    | P2                                                                                       |
| **Status**      | Not implemented                                                                          |

---

## 10. Session & Auth Persistence

### 10.1 Authenticated User on Login Page

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| **Test Name**   | `authenticated user accessing /login redirects to dashboard or stays on login`       |
| **Description** | Already-authenticated users who visit /login should redirect                         |
| **Steps**       | 1. Login as parent 2. Navigate to `/login` 3. Assert URL behavior (redirect or stay) |
| **Expected**    | Depends on app routing — either redirect to dashboard or stay on login               |
| **Priority**    | P1                                                                                   |
| **Status**      | Implemented                                                                          |

### 10.2 Session Persistence Across Refresh

| Field           | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `refreshing the page maintains authentication`                                                                                                     |
| **Description** | After login, refreshing the page should not log the user out                                                                                       |
| **Steps**       | 1. Login as parent 2. Assert dashboard is visible 3. Refresh page (`page.reload()`) 4. Assert dashboard is still visible (not redirected to login) |
| **Expected**    | User remains authenticated after refresh                                                                                                           |
| **Priority**    | P0                                                                                                                                                 |
| **Status**      | Not implemented                                                                                                                                    |

### 10.3 Auth Guard — Role Restriction

| Field           | Value                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `non-parent role shows Access Denied`                                                                                              |
| **Description** | Users with non-parent roles see "Access Denied" instead of dashboard                                                               |
| **Steps**       | 1. Login with a non-parent account (if available) 2. Navigate to `/` 3. Assert "Access Denied" or "You don't have permission" text |
| **Expected**    | Access denied message for wrong role                                                                                               |
| **Priority**    | P1                                                                                                                                 |
| **Status**      | Not implemented                                                                                                                    |

### 10.4 Auth Loading State

| Field           | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| **Test Name**   | `auth loading state shows spinner before redirect`                                 |
| **Description** | While auth initializes, a "Loading..." message is shown                            |
| **Steps**       | 1. Navigate to `/` without cached auth 2. Assert "Loading..." text appears briefly |
| **Expected**    | Loading indicator shown during auth initialization                                 |
| **Priority**    | P2                                                                                 |
| **Status**      | Not implemented                                                                    |

### 10.5 Login Redirect with State

| Field           | Value                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `login redirects back to original route after authentication`                                                             |
| **Description** | After auth redirect to `/login`, successful login returns to originally requested page                                    |
| **Steps**       | 1. Navigate to `/settings` unauthenticated 2. Assert redirect to `/login` 3. Login 4. Assert redirect back to `/settings` |
| **Expected**    | User returned to `/settings` after login                                                                                  |
| **Priority**    | P1                                                                                                                        |
| **Status**      | Not implemented                                                                                                           |

---

## 11. Error States & Edge Cases

### 11.1 Invalid Form Submission — Login

| Field           | Value                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `empty email or password shows validation on login form`                                                                 |
| **Description** | Attempting to submit without email or password triggers validation                                                       |
| **Steps**       | 1. Enter valid school code → Continue 2. Click Sign In without filling fields 3. Assert HTML5 validation or custom error |
| **Expected**    | Required field validation prevents submission                                                                            |
| **Priority**    | P1                                                                                                                       |
| **Status**      | Not implemented                                                                                                          |

### 11.2 Network Error — School Code Lookup

| Field           | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `network error during school code lookup shows error`                                                                                |
| **Description** | If school code lookup fails due to network, error message is shown                                                                   |
| **Steps**       | 1. Simulate network failure (intercept request) 2. Enter school code, click Continue 3. Assert "Failed to look up school code" error |
| **Expected**    | Error message shown                                                                                                                  |
| **Priority**    | P2                                                                                                                                   |
| **Status**      | Not implemented                                                                                                                      |

### 11.3 Inactive School Code

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `inactive school code shows inactive message`                                                                       |
| **Description** | If school tenant is inactive, specific error is shown                                                               |
| **Steps**       | 1. Enter a school code for an inactive tenant 2. Click Continue 3. Assert "This school is currently inactive" error |
| **Expected**    | Inactive school error message                                                                                       |
| **Priority**    | P2                                                                                                                  |
| **Status**      | Not implemented                                                                                                     |

### 11.4 Empty Dashboard — No Data

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `dashboard gracefully handles no data scenario`                                                                                        |
| **Description** | If parent has no linked children, dashboard shows appropriate empty states                                                             |
| **Steps**       | 1. Login as parent with no children 2. Assert score cards show 0 or "--" values 3. Assert "No linked children" empty state in overview |
| **Expected**    | Graceful handling of zero-data state                                                                                                   |
| **Priority**    | P1                                                                                                                                     |
| **Status**      | Not implemented                                                                                                                        |

### 11.5 Long Student Names

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Test Name**   | `long student names are truncated properly`                                                          |
| **Description** | Student names with long text are truncated with ellipsis                                             |
| **Steps**       | 1. If a student has a long name, assert `truncate` CSS class is applied 2. Assert no layout overflow |
| **Expected**    | Names truncated with ellipsis, no layout break                                                       |
| **Priority**    | P2                                                                                                   |
| **Status**      | Not implemented                                                                                      |

---

## 12. Mobile Responsiveness

### 12.1 Mobile Bottom Navigation

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `mobile bottom nav bar is visible on small screens`                                                                                    |
| **Description** | MobileBottomNav component shows fixed bottom nav on mobile viewports                                                                   |
| **Steps**       | 1. Set viewport to mobile (375x667) 2. Login as parent 3. Assert fixed bottom nav is visible with Home, Children, Results, Alerts tabs |
| **Expected**    | Bottom navigation bar with 4 tabs visible on mobile                                                                                    |
| **Priority**    | P0                                                                                                                                     |
| **Status**      | Not implemented                                                                                                                        |

### 12.2 Mobile Bottom Nav — Active Tab

| Field           | Value                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `mobile bottom nav highlights active tab`                                                                                                                      |
| **Description** | Current route's tab is highlighted with primary color                                                                                                          |
| **Steps**       | 1. Set mobile viewport 2. Navigate to `/` 3. Assert "Home" tab has `text-primary` class 4. Navigate to `/children` 5. Assert "Children" tab has `text-primary` |
| **Expected**    | Active tab highlighted                                                                                                                                         |
| **Priority**    | P1                                                                                                                                                             |
| **Status**      | Not implemented                                                                                                                                                |

### 12.3 Mobile Bottom Nav — Navigation

| Field           | Value                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `mobile bottom nav tabs navigate to correct pages`                                                                                                                                      |
| **Description** | Tapping each bottom nav tab navigates to the correct route                                                                                                                              |
| **Steps**       | 1. Set mobile viewport 2. Tap "Children" tab → assert `/children` 3. Tap "Results" tab → assert `/results` 4. Tap "Alerts" tab → assert `/notifications` 5. Tap "Home" tab → assert `/` |
| **Expected**    | Each tab navigates correctly                                                                                                                                                            |
| **Priority**    | P0                                                                                                                                                                                      |
| **Status**      | Not implemented                                                                                                                                                                         |

### 12.4 Mobile Bottom Nav — Notification Badge

| Field           | Value                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `mobile bottom nav Alerts tab shows unread count badge`                                                                   |
| **Description** | When unread notifications exist, Alerts tab shows a badge count                                                           |
| **Steps**       | 1. Set mobile viewport 2. If unread count > 0, assert badge element on Alerts tab 3. Assert badge shows count (max "99+") |
| **Expected**    | Red badge with unread count on Alerts tab                                                                                 |
| **Priority**    | P1                                                                                                                        |
| **Status**      | Not implemented                                                                                                           |

### 12.5 Mobile — Sidebar Hidden

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Test Name**   | `sidebar is hidden on mobile viewports`                              |
| **Description** | Desktop sidebar should be hidden on mobile screens                   |
| **Steps**       | 1. Set mobile viewport 2. Assert sidebar is not visible or collapsed |
| **Expected**    | Sidebar hidden, replaced by bottom nav                               |
| **Priority**    | P1                                                                   |
| **Status**      | Not implemented                                                      |

### 12.6 Mobile — Dashboard Responsive Grid

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Test Name**   | `dashboard score cards stack vertically on mobile`                                               |
| **Description** | 4 score cards should stack in a single column on small screens                                   |
| **Steps**       | 1. Set viewport to mobile 2. Login 3. Assert score cards are in a vertical stack (single column) |
| **Expected**    | Cards stack without horizontal overflow                                                          |
| **Priority**    | P1                                                                                               |
| **Status**      | Not implemented                                                                                  |

### 12.7 Mobile — Login Page Layout

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `login page is properly centered on mobile`                                                             |
| **Description** | Login card is centered and fits within mobile viewport                                                  |
| **Steps**       | 1. Set mobile viewport 2. Navigate to `/login` 3. Assert login card is visible and fits within viewport |
| **Expected**    | Login form properly centered without horizontal scroll                                                  |
| **Priority**    | P1                                                                                                      |
| **Status**      | Not implemented                                                                                         |

### 12.8 Tablet — Child Progress Page

| Field           | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `child progress charts render properly on tablet`                                                              |
| **Description** | Charts and score cards adapt to tablet viewport                                                                |
| **Steps**       | 1. Set viewport to tablet (768x1024) 2. Navigate to `/child-progress` 3. Assert charts render without overflow |
| **Expected**    | Responsive chart layout                                                                                        |
| **Priority**    | P2                                                                                                             |
| **Status**      | Not implemented                                                                                                |

---

## Test Summary

| Category                   | Total Tests | Implemented | Not Implemented |
| -------------------------- | ----------- | ----------- | --------------- |
| Authentication             | 14          | 10          | 4               |
| Dashboard                  | 19          | 12          | 7               |
| Children Page              | 11          | 8           | 3               |
| Child Progress Page        | 14          | 12          | 2               |
| Exam Results Page          | 16          | 10          | 6               |
| Space Progress Page        | 9           | 8           | 1               |
| Notifications Page         | 9           | 6           | 3               |
| Settings Page              | 16          | 12          | 4               |
| Navigation & Routing       | 10          | 2           | 8               |
| Session & Auth Persistence | 5           | 1           | 4               |
| Error States & Edge Cases  | 5           | 0           | 5               |
| Mobile Responsiveness      | 8           | 0           | 8               |
| **Total**                  | **136**     | **81**      | **55**          |

### Priority Distribution

| Priority | Count | Description                                 |
| -------- | ----- | ------------------------------------------- |
| P0       | 46    | Critical — must pass before release         |
| P1       | 58    | Important — should pass in standard testing |
| P2       | 32    | Nice to have — lower risk, can be deferred  |

### Key Implementation Gaps

1. **Mobile responsiveness tests** (8 tests) — No mobile viewport tests exist;
   parents heavily use phones
2. **Sidebar & header navigation tests** (8 tests) — Navigation tested via
   `page.goto()` but not sidebar clicks
3. **Session persistence & auth edge cases** (4 tests) — Refresh persistence,
   role restriction, redirect-with-state untested
4. **PDF download flow** (2 tests) — Download PDF button in exam results not
   tested
5. **Notification preferences save flow** (3 tests) — Save button appearance,
   success/error toasts untested
6. **Error state handling** (5 tests) — Network errors, inactive schools, empty
   data not tested

### Recommended Test Execution Order

1. **P0 Authentication** — Login/logout must work first
2. **P0 Dashboard** — Core landing page functionality
3. **P0 Navigation** — All routes accessible
4. **P0 Children / Exam Results / Space Progress / Settings** — Core page
   features
5. **P1 Data-dependent tests** — Progress, charts, filtering
6. **P0/P1 Mobile** — Parent-focused mobile testing
7. **P2 Edge cases** — Error handling, loading states
