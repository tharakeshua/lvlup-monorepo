# Playwright E2E Test Plan: Admin-Web

> **App:** `apps/admin-web` | **Port:** 4568 | **Base URL:**
> `http://localhost:4568` **Existing Tests:** `tests/e2e/admin-web.spec.ts` (116
> tests) **Test Helpers:** `tests/e2e/helpers/auth.ts`,
> `tests/e2e/helpers/selectors.ts`

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Dashboard](#2-dashboard)
3. [Users Management](#3-users-management)
4. [Classes Management](#4-classes-management)
5. [Courses & Spaces](#5-courses--spaces)
6. [Exams Overview](#6-exams-overview)
7. [Spaces Overview](#7-spaces-overview)
8. [Analytics](#8-analytics)
9. [AI Usage & Costs](#9-ai-usage--costs)
10. [Academic Sessions](#10-academic-sessions)
11. [Reports](#11-reports)
12. [Notifications](#12-notifications)
13. [Settings](#13-settings)
14. [Navigation & Layout](#14-navigation--layout)
15. [Error States & Edge Cases](#15-error-states--edge-cases)
16. [Responsive Design](#16-responsive-design)

---

## Test Data & Helpers

| Constant       | Value                            |
| -------------- | -------------------------------- |
| School Code    | `GRN001`                         |
| School Name    | `Greenwood International School` |
| Admin Email    | `admin@greenwood.edu`            |
| Admin Password | `Test@12345`                     |

**Login Helper:** `loginWithSchoolCode(page, schoolCode, email, password)` —
handles two-step school code → credentials flow.

---

## 1. Authentication & Authorization

### 1.1 Login — School Code Step

| #     | Test Name                              | Description                                        | Steps                               | Expected Behavior                                                            | Priority |
| ----- | -------------------------------------- | -------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- | -------- |
| 1.1.1 | Redirect unauthenticated user to login | Unauthenticated users are redirected to `/login`   | Navigate to `/` without session     | Page redirects to `/login`; school code input is visible                     | **P0**   |
| 1.1.2 | Render school code input               | Login page shows the school code step first        | Navigate to `/login`                | Input with id `#schoolCode` and "Continue" button are visible                | **P0**   |
| 1.1.3 | Display school name on valid code      | Entering a valid school code shows the school name | Enter `GRN001` → click Continue     | School name "Greenwood International School" appears; credentials form shows | **P0**   |
| 1.1.4 | Show error on invalid school code      | Invalid code shows error message                   | Enter `INVALID123` → click Continue | Error toast or inline error: "School not found" or similar                   | **P0**   |
| 1.1.5 | Show error on empty school code        | Submitting empty school code shows validation      | Click Continue with empty field     | Validation error prevents submission                                         | **P1**   |

### 1.2 Login — Credentials Step

| #     | Test Name                              | Description                                                 | Steps                                                 | Expected Behavior                                               | Priority |
| ----- | -------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- | -------- |
| 1.2.1 | Show credentials form after valid code | After valid school code, credentials step renders           | Enter valid school code → Continue                    | Email and password inputs visible; Sign In button visible       | **P0**   |
| 1.2.2 | Change button returns to code step     | User can go back to school code step                        | Enter valid code → Continue → click "Change"          | Returns to school code step; school code input is visible again | **P1**   |
| 1.2.3 | Successful admin login                 | Valid credentials lead to dashboard                         | Enter school code → Enter email/password → Sign In    | Redirects to `/`; "School Admin Dashboard" heading visible      | **P0**   |
| 1.2.4 | Wrong password shows error             | Invalid credentials show error                              | Enter valid code → wrong password → Sign In           | Error message: "Invalid email or password" or similar           | **P0**   |
| 1.2.5 | Wrong email shows error                | Non-existent email shows error                              | Enter valid code → non-existent email → Sign In       | Error message displayed                                         | **P1**   |
| 1.2.6 | Password visibility toggle             | Password field can show/hide text                           | Click eye icon on password field                      | Input type toggles between `password` and `text`                | **P2**   |
| 1.2.7 | Redirect to originally requested page  | After login, redirect to the page user originally requested | Navigate to `/settings` while unauthenticated → login | After login, redirects to `/settings` instead of `/`            | **P1**   |

### 1.3 Logout

| #     | Test Name                                   | Description                                      | Steps                                   | Expected Behavior                               | Priority |
| ----- | ------------------------------------------- | ------------------------------------------------ | --------------------------------------- | ----------------------------------------------- | -------- |
| 1.3.1 | Sign out redirects to login                 | Signing out clears session and redirects         | Login → click Sign Out in user dropdown | Redirects to `/login`; school code step visible | **P0**   |
| 1.3.2 | Cannot access protected routes after logout | After logout, protected routes redirect to login | Logout → navigate to `/`                | Redirects to `/login`                           | **P0**   |

### 1.4 Role-Based Access Control

| #     | Test Name                    | Description                                        | Steps                                   | Expected Behavior                                  | Priority |
| ----- | ---------------------------- | -------------------------------------------------- | --------------------------------------- | -------------------------------------------------- | -------- |
| 1.4.1 | Non-admin role denied access | Users without `tenantAdmin` role see access denied | Login as non-admin user (if applicable) | "Access Denied" message shown; no dashboard access | **P1**   |
| 1.4.2 | Tenant admin has full access | Admin role can access all routes                   | Login as admin → navigate to each route | All routes accessible without "Access Denied"      | **P0**   |

---

## 2. Dashboard

### 2.1 Page Load & Layout

| #     | Test Name                      | Description                        | Steps                       | Expected Behavior                            | Priority |
| ----- | ------------------------------ | ---------------------------------- | --------------------------- | -------------------------------------------- | -------- |
| 2.1.1 | Dashboard heading visible      | Main heading renders after login   | Login → arrive at dashboard | "School Admin Dashboard" heading visible     | **P0**   |
| 2.1.2 | Dashboard loads without errors | No console errors or crash on load | Login → check console       | No unhandled errors; page renders completely | **P0**   |

### 2.2 Statistics Score Cards

| #     | Test Name                     | Description                                    | Steps                       | Expected Behavior                                                  | Priority |
| ----- | ----------------------------- | ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------ | -------- |
| 2.2.1 | Total Students card visible   | Student count card renders                     | Login → view dashboard      | Card with "Total Students" label and numeric value visible         | **P0**   |
| 2.2.2 | Total Teachers card visible   | Teacher count card renders                     | Login → view dashboard      | Card with "Total Teachers" label and numeric value visible         | **P0**   |
| 2.2.3 | Total Classes card visible    | Class count card renders                       | Login → view dashboard      | Card with "Total Classes" label and numeric value visible          | **P0**   |
| 2.2.4 | Total Spaces card visible     | Space count card renders                       | Login → view dashboard      | Card with "Total Spaces" label and numeric value visible           | **P1**   |
| 2.2.5 | Total Exams card visible      | Exam count card renders                        | Login → view dashboard      | Card with "Total Exams" label and numeric value visible            | **P1**   |
| 2.2.6 | At-Risk Students card visible | At-risk count card with trend indicator        | Login → view dashboard      | Card with "At-Risk Students" label, count, and trend arrow visible | **P1**   |
| 2.2.7 | Score cards are clickable     | Clicking a card navigates to the relevant page | Click "Total Students" card | Navigates to `/users`                                              | **P2**   |

### 2.3 Charts & Data Sections

| #     | Test Name                       | Description                            | Steps                  | Expected Behavior                                                          | Priority |
| ----- | ------------------------------- | -------------------------------------- | ---------------------- | -------------------------------------------------------------------------- | -------- |
| 2.3.1 | Class Performance chart renders | Bar chart showing exam scores by class | Login → view dashboard | Chart container visible with bars or empty state message                   | **P1**   |
| 2.3.2 | AI Cost Summary section visible | Today's AI spend and call count shown  | Login → view dashboard | "AI Cost Summary" section with "Today's Spend" and "Today's Calls" visible | **P1**   |
| 2.3.3 | Tenant Info card visible        | Tenant details section renders         | Login → view dashboard | Tenant code, subscription plan, status, and contact email visible          | **P1**   |
| 2.3.4 | Features display visible        | Enabled/disabled features shown        | Login → view dashboard | Feature badges or list visible in Tenant Info section                      | **P2**   |

---

## 3. Users Management

### 3.1 Tab Navigation

| #     | Test Name               | Description                     | Steps                | Expected Behavior                                                    | Priority |
| ----- | ----------------------- | ------------------------------- | -------------------- | -------------------------------------------------------------------- | -------- |
| 3.1.1 | Teachers tab is default | Teachers tab active by default  | Navigate to `/users` | "Teachers" tab is active; teacher table/empty state visible          | **P0**   |
| 3.1.2 | Switch to Students tab  | Students tab shows student data | Click "Students" tab | Students table with columns: Name, Email, Roll Number, Class, Status | **P0**   |
| 3.1.3 | Switch to Parents tab   | Parents tab shows parent data   | Click "Parents" tab  | Parents table with linked students info                              | **P0**   |

### 3.2 Teachers Tab

| #     | Test Name                      | Description                                | Steps                                                       | Expected Behavior                                         | Priority |
| ----- | ------------------------------ | ------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------- | -------- |
| 3.2.1 | Add Teacher button visible     | Button to create new teacher exists        | Navigate to `/users` → Teachers tab                         | "Add Teacher" button visible                              | **P0**   |
| 3.2.2 | Add Teacher dialog opens       | Clicking button opens creation dialog      | Click "Add Teacher"                                         | Dialog with name, email, and subject fields visible       | **P0**   |
| 3.2.3 | Add Teacher dialog cancels     | Cancel button closes dialog without action | Open Add Teacher dialog → click Cancel                      | Dialog closes; no new teacher created                     | **P1**   |
| 3.2.4 | Create teacher with valid data | Submitting valid data creates teacher      | Fill name, email, subjects → Submit                         | Teacher appears in table; success toast shown             | **P0**   |
| 3.2.5 | Assign classes to teacher      | Multi-select class assignment works        | Click assign classes on teacher row → select classes → save | Classes shown in teacher row                              | **P1**   |
| 3.2.6 | Edit teacher details           | Edit dialog pre-fills and saves changes    | Click edit on teacher row → modify name → save              | Updated name appears in table                             | **P1**   |
| 3.2.7 | Search filters teachers        | Search input filters teacher list          | Type teacher name in search input                           | Only matching teachers shown in table                     | **P0**   |
| 3.2.8 | Teachers table columns correct | Table has expected column headers          | Navigate to Teachers tab                                    | Columns: Name, Email, Subjects, Class Assignments visible | **P1**   |

### 3.3 Students Tab

| #     | Test Name                      | Description                           | Steps                                               | Expected Behavior                                          | Priority |
| ----- | ------------------------------ | ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- | -------- |
| 3.3.1 | Add Student button visible     | Button to create new student exists   | Click "Students" tab                                | "Add Student" button visible                               | **P0**   |
| 3.3.2 | Add Student dialog opens       | Clicking button opens creation dialog | Click "Add Student"                                 | Dialog with name, email, roll number, class fields visible | **P0**   |
| 3.3.3 | Create student with valid data | Submitting valid data creates student | Fill form → Submit                                  | Student appears in table; success toast shown              | **P0**   |
| 3.3.4 | Bulk Import button visible     | CSV import button shown               | Click "Students" tab                                | "Bulk Import" button visible                               | **P1**   |
| 3.3.5 | Bulk Import dialog opens       | Import dialog with file upload shows  | Click "Bulk Import"                                 | Dialog with CSV upload area and instructions visible       | **P1**   |
| 3.3.6 | Link student to parent         | Parent assignment multi-select works  | Click link parent on student → select parent → save | Parent linked to student                                   | **P1**   |
| 3.3.7 | Search filters students        | Search input filters student list     | Type student name in search                         | Only matching students shown                               | **P0**   |
| 3.3.8 | Students table columns correct | Table has expected column headers     | View Students tab                                   | Columns: Name, Email, Roll Number, Class, Status visible   | **P1**   |

### 3.4 Parents Tab

| #     | Test Name                     | Description                           | Steps                            | Expected Behavior                             | Priority |
| ----- | ----------------------------- | ------------------------------------- | -------------------------------- | --------------------------------------------- | -------- |
| 3.4.1 | Add Parent button visible     | Button to create new parent exists    | Click "Parents" tab              | "Add Parent" button visible                   | **P0**   |
| 3.4.2 | Add Parent dialog opens       | Clicking button opens creation dialog | Click "Add Parent"               | Dialog with name, email, phone fields visible | **P0**   |
| 3.4.3 | Create parent with valid data | Submitting valid data creates parent  | Fill form → Submit               | Parent appears in table; success toast shown  | **P1**   |
| 3.4.4 | View linked students          | Parent row shows linked students      | View parent with linked students | Student names visible in parent row           | **P1**   |
| 3.4.5 | Search filters parents        | Search input filters parent list      | Type parent name in search       | Only matching parents shown                   | **P1**   |

---

## 4. Classes Management

### 4.1 Class Listing

| #     | Test Name                     | Description                               | Steps                  | Expected Behavior                                                                  | Priority |
| ----- | ----------------------------- | ----------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- | -------- |
| 4.1.1 | Classes page heading visible  | Page heading "Classes & Sections" renders | Navigate to `/classes` | Heading text visible                                                               | **P0**   |
| 4.1.2 | Create Class button visible   | Button to create new class exists         | Navigate to `/classes` | "Create Class" button visible                                                      | **P0**   |
| 4.1.3 | Search input visible          | Search field for filtering classes        | Navigate to `/classes` | Search input with placeholder visible                                              | **P0**   |
| 4.1.4 | Grade filter dropdown visible | Grade filter for narrowing class list     | Navigate to `/classes` | Grade filter dropdown visible                                                      | **P1**   |
| 4.1.5 | Classes table renders         | Table or empty state shown                | Navigate to `/classes` | Table with Name, Grade, Section, Teachers, Students, Status columns OR empty state | **P0**   |

### 4.2 Create Class

| #     | Test Name                                      | Description                            | Steps                                   | Expected Behavior                                                  | Priority |
| ----- | ---------------------------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ | -------- |
| 4.2.1 | Create Class dialog opens                      | Dialog with form fields renders        | Click "Create Class"                    | Dialog with Class Name, Grade (1-12), Section (A-F) inputs visible | **P0**   |
| 4.2.2 | Submit button disabled without required fields | Cannot submit empty form               | Open dialog without filling fields      | Submit/Create button is disabled                                   | **P1**   |
| 4.2.3 | Cancel closes dialog                           | Cancel button dismisses dialog         | Open dialog → click Cancel              | Dialog closes; no class created                                    | **P1**   |
| 4.2.4 | Create class with valid data                   | Valid form submission creates class    | Fill name, grade, section → Submit      | Class appears in table; success toast shown                        | **P0**   |
| 4.2.5 | Edit class details                             | Edit dialog opens with pre-filled data | Click edit on class row → modify → save | Updated info appears in table                                      | **P1**   |

### 4.3 Class Operations

| #     | Test Name                    | Description                     | Steps                                          | Expected Behavior                                | Priority |
| ----- | ---------------------------- | ------------------------------- | ---------------------------------------------- | ------------------------------------------------ | -------- |
| 4.3.1 | Assign teachers to class     | Multi-select teacher assignment | Click assign teachers → select teachers → save | Teacher names shown in class row                 | **P1**   |
| 4.3.2 | Assign students to class     | Multi-select student assignment | Click assign students → select students → save | Student count updated in class row               | **P1**   |
| 4.3.3 | Archive class                | Soft delete with confirmation   | Click archive/delete → confirm                 | Class removed from active list or status changes | **P1**   |
| 4.3.4 | Search filters classes       | Search narrows down class list  | Type class name in search                      | Only matching classes shown                      | **P0**   |
| 4.3.5 | Grade filter narrows results | Selecting grade filters table   | Select grade "5" from dropdown                 | Only grade 5 classes shown                       | **P1**   |

---

## 5. Courses & Spaces

### 5.1 Courses Page

| #     | Test Name                     | Description                                    | Steps                            | Expected Behavior                                                                       | Priority |
| ----- | ----------------------------- | ---------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| 5.1.1 | Courses page heading visible  | Page renders with correct heading              | Navigate to `/courses`           | "Courses & Spaces" heading visible                                                      | **P0**   |
| 5.1.2 | Subject overview grid renders | Subject summary cards or empty state           | View `/courses`                  | Grid of subject cards showing subject name, total count, published count OR empty state | **P1**   |
| 5.1.3 | Search courses                | Search by title, subject, or description       | Type search term                 | Filtered course list shown                                                              | **P1**   |
| 5.1.4 | Filter by class               | Class dropdown filters courses                 | Select a class from dropdown     | Only courses for that class shown                                                       | **P1**   |
| 5.1.5 | Filter by status              | Status filter (draft/published/archived) works | Select "published" status filter | Only published courses shown                                                            | **P1**   |
| 5.1.6 | Course card details           | Cards show expected info                       | View course cards                | Title, status badge, type badge, subject, description, class assignments visible        | **P2**   |

---

## 6. Exams Overview

### 6.1 Exam Listing

| #     | Test Name                  | Description                      | Steps                    | Expected Behavior                                                | Priority |
| ----- | -------------------------- | -------------------------------- | ------------------------ | ---------------------------------------------------------------- | -------- |
| 6.1.1 | Exams page heading visible | "Exams Overview" heading renders | Navigate to `/exams`     | Heading and subtitle visible                                     | **P0**   |
| 6.1.2 | Search exams               | Search by title or subject       | Type exam name in search | Filtered exam list shown                                         | **P0**   |
| 6.1.3 | Table columns correct      | Exam table has correct headers   | View exams table         | Columns: Title, Subject, Total Marks, Status, Created By visible | **P1**   |

### 6.2 Status Filtering

| #     | Test Name                      | Description                          | Steps                          | Expected Behavior                                                         | Priority |
| ----- | ------------------------------ | ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------- | -------- |
| 6.2.1 | All status filter (default)    | Shows all exams by default           | Navigate to `/exams`           | "All" filter active; all exams listed                                     | **P0**   |
| 6.2.2 | Filter by Draft                | Draft filter shows only draft exams  | Click "Draft" filter button    | Only draft exams visible                                                  | **P1**   |
| 6.2.3 | Filter by Scheduled            | Scheduled filter works               | Click "Scheduled" filter       | Only scheduled exams visible                                              | **P1**   |
| 6.2.4 | Filter by Active               | Active filter works                  | Click "Active" filter          | Only active exams visible                                                 | **P1**   |
| 6.2.5 | Filter by Completed            | Completed filter works               | Click "Completed" filter       | Only completed exams visible                                              | **P1**   |
| 6.2.6 | Status badges styled correctly | Each status has distinct badge style | View exams with mixed statuses | Draft, Scheduled, Active, Grading, Completed badges have different colors | **P2**   |

---

## 7. Spaces Overview

### 7.1 Spaces Listing

| #     | Test Name                   | Description                          | Steps                     | Expected Behavior                                                                    | Priority |
| ----- | --------------------------- | ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------ | -------- |
| 7.1.1 | Spaces page heading visible | "Spaces Overview" heading renders    | Navigate to `/spaces`     | Heading and subtitle visible                                                         | **P0**   |
| 7.1.2 | Search spaces               | Search by title or subject           | Type space name in search | Filtered cards shown                                                                 | **P0**   |
| 7.1.3 | Card grid renders           | Space cards displayed in grid layout | View `/spaces`            | Cards with title, description, type badge, subject, classes, teachers OR empty state | **P1**   |

### 7.2 Status Filtering

| #     | Test Name              | Description                  | Steps                    | Expected Behavior                                               | Priority |
| ----- | ---------------------- | ---------------------------- | ------------------------ | --------------------------------------------------------------- | -------- |
| 7.2.1 | All filter (default)   | Shows all spaces by default  | Navigate to `/spaces`    | "All" filter active                                             | **P0**   |
| 7.2.2 | Filter by Draft        | Draft filter works           | Click "Draft" filter     | Only draft spaces shown                                         | **P1**   |
| 7.2.3 | Filter by Published    | Published filter works       | Click "Published" filter | Only published spaces shown                                     | **P1**   |
| 7.2.4 | Filter by Archived     | Archived filter works        | Click "Archived" filter  | Only archived spaces shown                                      | **P1**   |
| 7.2.5 | Space card type badges | Type badges render correctly | View space cards         | Learning, Practice, Assessment, Resource, Hybrid badges visible | **P2**   |

---

## 8. Analytics

### 8.1 Overview Statistics

| #     | Test Name                         | Description                   | Steps                    | Expected Behavior                                      | Priority |
| ----- | --------------------------------- | ----------------------------- | ------------------------ | ------------------------------------------------------ | -------- |
| 8.1.1 | Analytics page heading visible    | "Analytics" heading renders   | Navigate to `/analytics` | Heading and subtitle visible                           | **P0**   |
| 8.1.2 | Avg Exam Score card visible       | Percentage score card renders | View `/analytics`        | "Avg Exam Score" card with percentage value            | **P0**   |
| 8.1.3 | Avg Space Completion card visible | Completion rate card renders  | View `/analytics`        | "Avg Space Completion" card with percentage value      | **P1**   |
| 8.1.4 | At-Risk Students card visible     | At-risk count with trend      | View `/analytics`        | "At-Risk Students" card with count and trend indicator | **P1**   |
| 8.1.5 | Total Students card visible       | Student count summary         | View `/analytics`        | "Total Students" card with count                       | **P1**   |

### 8.2 Charts

| #     | Test Name                       | Description                       | Steps                                      | Expected Behavior                                      | Priority |
| ----- | ------------------------------- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------ | -------- |
| 8.2.1 | Class Performance chart renders | Bar chart showing class scores    | View `/analytics`                          | Bar chart container visible with data or empty message | **P1**   |
| 8.2.2 | Space Completion chart renders  | Chart showing completion by class | View `/analytics`                          | Space completion chart visible                         | **P1**   |
| 8.2.3 | At-Risk students chart renders  | Chart showing at-risk by class    | View `/analytics` (if at-risk data exists) | At-risk chart visible or hidden based on data          | **P2**   |

### 8.3 Class Detail View

| #     | Test Name                 | Description                        | Steps                                     | Expected Behavior                               | Priority |
| ----- | ------------------------- | ---------------------------------- | ----------------------------------------- | ----------------------------------------------- | -------- |
| 8.3.1 | Class detail prompt shown | Prompt to select a class displayed | View `/analytics` with no class selected  | "Select a class to view details" prompt visible | **P1**   |
| 8.3.2 | Select class shows detail | Clicking class shows detailed view | Click on a class in the chart or selector | Class detail view with progress ring visible    | **P1**   |

---

## 9. AI Usage & Costs

### 9.1 Monthly Summary

| #     | Test Name                     | Description                        | Steps                   | Expected Behavior                               | Priority |
| ----- | ----------------------------- | ---------------------------------- | ----------------------- | ----------------------------------------------- | -------- |
| 9.1.1 | AI Usage page heading visible | "AI Usage & Costs" heading renders | Navigate to `/ai-usage` | Heading and subtitle visible                    | **P0**   |
| 9.1.2 | Monthly Cost card visible     | USD cost card renders              | View `/ai-usage`        | "Monthly Cost" card with dollar value           | **P0**   |
| 9.1.3 | Total Calls card visible      | API call count card renders        | View `/ai-usage`        | "Total Calls" card with count                   | **P1**   |
| 9.1.4 | Input Tokens card visible     | Token count card renders           | View `/ai-usage`        | "Input Tokens" card with formatted count (K/M)  | **P1**   |
| 9.1.5 | Output Tokens card visible    | Token count card renders           | View `/ai-usage`        | "Output Tokens" card with formatted count (K/M) | **P1**   |

### 9.2 Month Navigation

| #     | Test Name                         | Description                           | Steps                             | Expected Behavior                                     | Priority |
| ----- | --------------------------------- | ------------------------------------- | --------------------------------- | ----------------------------------------------------- | -------- |
| 9.2.1 | Previous month button works       | Navigate to previous month            | Click left arrow / "Previous"     | Month label updates to previous month; data refreshes | **P0**   |
| 9.2.2 | Next month disabled on current    | Cannot navigate beyond current month  | View current month                | "Next" button is disabled                             | **P1**   |
| 9.2.3 | Next month enabled on past months | Can navigate forward after going back | Go to previous month → click next | Returns to current month                              | **P1**   |
| 9.2.4 | Month label displays correctly    | Month range shown in YYYY-MM format   | View `/ai-usage`                  | Current month range displayed correctly               | **P1**   |

### 9.3 Charts & Breakdown

| #     | Test Name                       | Description                                   | Steps                            | Expected Behavior                                                                | Priority |
| ----- | ------------------------------- | --------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- | -------- |
| 9.3.1 | Daily Cost Trend chart renders  | Bar chart with daily costs                    | View `/ai-usage`                 | Chart container visible with bars or empty state                                 | **P1**   |
| 9.3.2 | Cost by Task Type chart renders | Breakdown by task type                        | View `/ai-usage`                 | Chart showing extraction, grading, evaluation, tutoring costs                    | **P1**   |
| 9.3.3 | Daily breakdown table visible   | Detailed table with daily data                | View `/ai-usage`                 | Table with Date, Calls, Input Tokens, Output Tokens, Cost columns OR empty state | **P1**   |
| 9.3.4 | Empty state when no data        | Graceful empty state for months with no usage | Navigate to a month with no data | Empty state message displayed instead of charts                                  | **P2**   |

---

## 10. Academic Sessions

### 10.1 Session Listing

| #      | Test Name                         | Description                   | Steps                                | Expected Behavior                                                         | Priority |
| ------ | --------------------------------- | ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------- | -------- |
| 10.1.1 | Academic Sessions heading visible | Page heading renders          | Navigate to `/academic-sessions`     | "Academic Sessions" heading visible                                       | **P0**   |
| 10.1.2 | New Session button visible        | Create button exists          | View `/academic-sessions`            | "New Session" button visible                                              | **P0**   |
| 10.1.3 | Sessions table or empty state     | Existing sessions listed      | View `/academic-sessions`            | Table with Name, Start Date, End Date, Is Current, Actions OR empty state | **P0**   |
| 10.1.4 | Current session has Active badge  | Active session clearly marked | View sessions with a current session | "Active" badge visible on the current session row                         | **P1**   |

### 10.2 Create Session

| #      | Test Name                      | Description                     | Steps                                    | Expected Behavior                                             | Priority |
| ------ | ------------------------------ | ------------------------------- | ---------------------------------------- | ------------------------------------------------------------- | -------- |
| 10.2.1 | Create Session dialog opens    | Dialog with form fields         | Click "New Session"                      | Dialog with Session Name, Start Date, End Date inputs visible | **P0**   |
| 10.2.2 | Submit disabled without fields | Cannot submit empty form        | Open dialog without filling              | Submit button disabled                                        | **P1**   |
| 10.2.3 | Cancel closes dialog           | Dialog dismisses on cancel      | Open dialog → Cancel                     | Dialog closes; no session created                             | **P1**   |
| 10.2.4 | Create session with valid data | Form submission creates session | Fill name, start date, end date → Submit | Session appears in table; success toast                       | **P0**   |
| 10.2.5 | Edit session details           | Edit dialog opens pre-filled    | Click edit on session → modify → save    | Updated info in table                                         | **P1**   |
| 10.2.6 | Set session as current         | Toggle current session          | Click "Set as Current" on a session      | Session marked as Active; previous current session unmarked   | **P1**   |

---

## 11. Reports

### 11.1 Tab Navigation

| #      | Test Name                       | Description                  | Steps                     | Expected Behavior                       | Priority |
| ------ | ------------------------------- | ---------------------------- | ------------------------- | --------------------------------------- | -------- |
| 11.1.1 | Reports page heading visible    | "Reports" heading renders    | Navigate to `/reports`    | Heading and subtitle visible            | **P0**   |
| 11.1.2 | Exam Reports tab default active | Exam Reports tab shown first | Navigate to `/reports`    | "Exam Reports" tab is active by default | **P0**   |
| 11.1.3 | Switch to Class Reports tab     | Tab switching works          | Click "Class Reports" tab | Class Reports content visible           | **P0**   |

### 11.2 Exam Reports

| #      | Test Name                   | Description                                | Steps                         | Expected Behavior                                                    | Priority |
| ------ | --------------------------- | ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------- | -------- |
| 11.2.1 | Exam reports list visible   | Exams with reportable statuses listed      | View Exam Reports tab         | Exams with grading/completed/results_released status OR empty state  | **P0**   |
| 11.2.2 | Download PDF button visible | Each exam has a PDF download option        | View exam report row          | "Download PDF" or PDF icon button visible                            | **P1**   |
| 11.2.3 | PDF download triggers       | Clicking download initiates PDF generation | Click Download PDF on an exam | PDF generation starts; download initiates or loading indicator shown | **P1**   |

### 11.3 Class Reports

| #      | Test Name                       | Description                      | Steps                         | Expected Behavior                                    | Priority |
| ------ | ------------------------------- | -------------------------------- | ----------------------------- | ---------------------------------------------------- | -------- |
| 11.3.1 | Class reports list visible      | All classes listed for reporting | View Class Reports tab        | Class list with name, grade, section OR empty state  | **P0**   |
| 11.3.2 | Download PDF button visible     | Each class has PDF download      | View class report row         | "Download PDF" or PDF icon button visible            | **P1**   |
| 11.3.3 | PDF download triggers for class | Class PDF generation works       | Click Download PDF on a class | PDF generation starts; download or loading indicator | **P1**   |

---

## 12. Notifications

### 12.1 Notification Bell (Header)

| #      | Test Name                             | Description                              | Steps                           | Expected Behavior                        | Priority |
| ------ | ------------------------------------- | ---------------------------------------- | ------------------------------- | ---------------------------------------- | -------- |
| 12.1.1 | Notification bell visible in header   | Bell icon shows in app header            | Login → view any page           | Notification bell icon visible in header | **P0**   |
| 12.1.2 | Unread count badge shown              | Badge with count when unread exist       | Login with unread notifications | Numeric badge on bell icon               | **P1**   |
| 12.1.3 | Bell click navigates to notifications | Clicking bell goes to notifications page | Click notification bell         | Navigates to `/notifications`            | **P0**   |

### 12.2 Notifications Page

| #      | Test Name                     | Description                             | Steps                                   | Expected Behavior                            | Priority |
| ------ | ----------------------------- | --------------------------------------- | --------------------------------------- | -------------------------------------------- | -------- |
| 12.2.1 | Notifications heading visible | Page heading renders                    | Navigate to `/notifications`            | "Notifications" heading visible              | **P0**   |
| 12.2.2 | All filter option visible     | Filter for all notifications            | View `/notifications`                   | "All" filter button/tab visible              | **P1**   |
| 12.2.3 | Unread filter option visible  | Filter for unread only                  | View `/notifications`                   | "Unread" filter button/tab visible           | **P1**   |
| 12.2.4 | Mark all as read button       | Bulk mark-read action exists            | View `/notifications` with unread items | "Mark all as read" button visible            | **P1**   |
| 12.2.5 | Mark individual as read       | Single notification can be marked read  | Click mark-as-read on a notification    | Notification styling changes to "read" state | **P2**   |
| 12.2.6 | Click notification navigates  | Clicking notification goes to actionUrl | Click a notification with actionUrl     | Navigates to the linked page                 | **P2**   |
| 12.2.7 | Filter by Unread works        | Only unread notifications shown         | Click "Unread" filter                   | Only unread notifications displayed          | **P1**   |
| 12.2.8 | Page loads without errors     | No crash or console errors              | Navigate to `/notifications`            | Page renders without errors                  | **P0**   |

---

## 13. Settings

### 13.1 Tab Navigation

| #      | Test Name                       | Description             | Steps                   | Expected Behavior                 | Priority |
| ------ | ------------------------------- | ----------------------- | ----------------------- | --------------------------------- | -------- |
| 13.1.1 | Settings page heading visible   | Page heading renders    | Navigate to `/settings` | "Settings" heading visible        | **P0**   |
| 13.1.2 | Tenant Settings tab visible     | First tab option shown  | View `/settings`        | "Tenant Settings" tab visible     | **P0**   |
| 13.1.3 | Evaluation Settings tab visible | Second tab option shown | View `/settings`        | "Evaluation Settings" tab visible | **P0**   |
| 13.1.4 | API Keys tab visible            | Third tab option shown  | View `/settings`        | "API Keys" tab visible            | **P0**   |

### 13.2 Tenant Settings

| #      | Test Name                       | Description                | Steps                           | Expected Behavior                                | Priority |
| ------ | ------------------------------- | -------------------------- | ------------------------------- | ------------------------------------------------ | -------- |
| 13.2.1 | School Name input visible       | Editable school name field | View Tenant Settings tab        | "School Name" input with current value           | **P0**   |
| 13.2.2 | Tenant Code visible (read-only) | Tenant code displayed      | View Tenant Settings tab        | Tenant code shown (GRN001)                       | **P1**   |
| 13.2.3 | Contact Email input visible     | Editable email field       | View Tenant Settings tab        | "Contact Email" input with current value         | **P1**   |
| 13.2.4 | Contact Phone input visible     | Editable phone field       | View Tenant Settings tab        | "Contact Phone" input                            | **P1**   |
| 13.2.5 | Subscription plan visible       | Plan info displayed        | View Tenant Settings tab        | Subscription plan information shown              | **P1**   |
| 13.2.6 | Save button updates tenant info | Saving changes persists    | Modify school name → click Save | Success toast; field retains new value on reload | **P1**   |

### 13.3 Evaluation Settings

| #      | Test Name                        | Description                           | Steps                                                | Expected Behavior                                | Priority |
| ------ | -------------------------------- | ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ | -------- |
| 13.3.1 | Evaluation settings list visible | Settings configs or empty state shown | Click "Evaluation Settings" tab                      | List of evaluation configurations OR empty state | **P1**   |
| 13.3.2 | Edit enabled dimensions          | Multi-select for dimensions           | Click edit on evaluation setting → toggle dimensions | Changed dimensions reflected after save          | **P2**   |
| 13.3.3 | Toggle show strengths            | Toggle switch works                   | Toggle "Show Strengths" → save                       | Toggle state persists on reload                  | **P2**   |
| 13.3.4 | Toggle show key takeaway         | Toggle switch works                   | Toggle "Show Key Takeaway" → save                    | Toggle state persists on reload                  | **P2**   |

### 13.4 API Keys

| #      | Test Name                     | Description                    | Steps                            | Expected Behavior                        | Priority |
| ------ | ----------------------------- | ------------------------------ | -------------------------------- | ---------------------------------------- | -------- |
| 13.4.1 | API Keys section visible      | Gemini API Key section renders | Click "API Keys" tab             | "Gemini API Key" section visible         | **P0**   |
| 13.4.2 | Set/Update Key button visible | Action button for API key      | View API Keys tab                | "Set Key" or "Update Key" button visible | **P1**   |
| 13.4.3 | Save API key                  | Key can be saved               | Enter API key → save             | Success toast; key saved                 | **P1**   |
| 13.4.4 | Remove API key                | Key can be removed             | Click remove/clear key → confirm | Key removed; "Set Key" button shown      | **P2**   |

---

## 14. Navigation & Layout

### 14.1 Sidebar Navigation

| #       | Test Name                        | Description                             | Steps                                | Expected Behavior                                                       | Priority |
| ------- | -------------------------------- | --------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | -------- |
| 14.1.1  | Sidebar renders all nav items    | All navigation groups and items visible | Login → view sidebar                 | 4 groups: Overview, Management, Analytics, Configuration with all items | **P0**   |
| 14.1.2  | Dashboard nav link works         | Clicking Dashboard navigates to `/`     | Click "Dashboard" in sidebar         | Navigates to `/`; Dashboard page loads                                  | **P0**   |
| 14.1.3  | Users nav link works             | Users link navigates correctly          | Click "Users" in sidebar             | Navigates to `/users`                                                   | **P0**   |
| 14.1.4  | Classes nav link works           | Classes link navigates correctly        | Click "Classes" in sidebar           | Navigates to `/classes`                                                 | **P0**   |
| 14.1.5  | Exams nav link works             | Exams link navigates correctly          | Click "Exams" in sidebar             | Navigates to `/exams`                                                   | **P0**   |
| 14.1.6  | Spaces nav link works            | Spaces link navigates correctly         | Click "Spaces" in sidebar            | Navigates to `/spaces`                                                  | **P1**   |
| 14.1.7  | Courses nav link works           | Courses link navigates correctly        | Click "Courses" in sidebar           | Navigates to `/courses`                                                 | **P1**   |
| 14.1.8  | Analytics nav link works         | Analytics link navigates correctly      | Click "Analytics" in sidebar         | Navigates to `/analytics`                                               | **P1**   |
| 14.1.9  | Reports nav link works           | Reports link navigates correctly        | Click "Reports" in sidebar           | Navigates to `/reports`                                                 | **P1**   |
| 14.1.10 | AI Usage nav link works          | AI Usage link navigates correctly       | Click "AI Usage" in sidebar          | Navigates to `/ai-usage`                                                | **P1**   |
| 14.1.11 | Academic Sessions nav link works | Sessions link navigates correctly       | Click "Academic Sessions" in sidebar | Navigates to `/academic-sessions`                                       | **P1**   |
| 14.1.12 | Settings nav link works          | Settings link navigates correctly       | Click "Settings" in sidebar          | Navigates to `/settings`                                                | **P1**   |
| 14.1.13 | Active nav item highlighted      | Current route item has active styling   | Navigate to `/users`                 | "Users" item in sidebar has active/highlighted style                    | **P1**   |

### 14.2 Header

| #      | Test Name                   | Description                      | Steps               | Expected Behavior                 | Priority |
| ------ | --------------------------- | -------------------------------- | ------------------- | --------------------------------- | -------- |
| 14.2.1 | Theme toggle button visible | Light/dark mode toggle in header | Login → view header | Theme toggle button visible       | **P1**   |
| 14.2.2 | Theme toggle switches mode  | Clicking toggles dark/light mode | Click theme toggle  | Page theme changes (dark ↔ light) | **P2**   |
| 14.2.3 | User dropdown visible       | User menu in header              | Login → view header | User avatar/name dropdown visible | **P1**   |
| 14.2.4 | User dropdown Sign Out      | Sign out option in dropdown      | Click user dropdown | "Sign Out" option visible         | **P0**   |

### 14.3 Breadcrumbs

| #      | Test Name                   | Description                        | Steps                            | Expected Behavior                       | Priority |
| ------ | --------------------------- | ---------------------------------- | -------------------------------- | --------------------------------------- | -------- |
| 14.3.1 | Breadcrumb renders on pages | Breadcrumb trail shown             | Navigate to `/users`             | Breadcrumb showing current page context | **P1**   |
| 14.3.2 | Breadcrumb navigation works | Clicking breadcrumb link navigates | Click a breadcrumb ancestor link | Navigates to that route                 | **P2**   |

### 14.4 Tenant Switcher

| #      | Test Name                              | Description                         | Steps                                 | Expected Behavior                        | Priority |
| ------ | -------------------------------------- | ----------------------------------- | ------------------------------------- | ---------------------------------------- | -------- |
| 14.4.1 | Tenant switcher visible (multi-tenant) | Switcher shown for multi-org users  | Login as user with multiple tenants   | Tenant switcher dropdown visible         | **P1**   |
| 14.4.2 | Tenant switcher hidden (single tenant) | No switcher for single-org users    | Login as user with single tenant      | No org switcher rendered                 | **P2**   |
| 14.4.3 | Switch tenant reloads data             | Switching tenant refreshes all data | Select different tenant from switcher | Dashboard reloads with new tenant's data | **P1**   |

---

## 15. Error States & Edge Cases

### 15.1 Route Errors

| #      | Test Name                            | Description                           | Steps                                            | Expected Behavior                                          | Priority |
| ------ | ------------------------------------ | ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | -------- |
| 15.1.1 | 404 page for unknown routes          | Unknown route shows not found page    | Navigate to `/nonexistent-page`                  | 404 or "Page Not Found" message displayed                  | **P0**   |
| 15.1.2 | Error boundary catches render errors | App doesn't crash on component errors | Trigger a component error (if possible via mock) | Error boundary fallback UI shown; app doesn't white-screen | **P1**   |

### 15.2 Form Validation

| #      | Test Name                            | Description                       | Steps                                        | Expected Behavior                          | Priority |
| ------ | ------------------------------------ | --------------------------------- | -------------------------------------------- | ------------------------------------------ | -------- |
| 15.2.1 | Login — empty email validation       | Cannot submit without email       | Leave email empty → click Sign In            | Validation error; form not submitted       | **P1**   |
| 15.2.2 | Login — empty password validation    | Cannot submit without password    | Leave password empty → click Sign In         | Validation error; form not submitted       | **P1**   |
| 15.2.3 | Create Class — empty name validation | Class name required               | Open Create Class → leave name empty         | Submit button disabled or validation error | **P1**   |
| 15.2.4 | Create Session — date validation     | End date must be after start date | Set end date before start date → submit      | Validation error shown                     | **P2**   |
| 15.2.5 | Create User — invalid email format   | Email field validates format      | Enter "not-an-email" in email field → submit | Validation error for email format          | **P1**   |

### 15.3 Network & Loading States

| #      | Test Name                      | Description                            | Steps                                           | Expected Behavior                                     | Priority |
| ------ | ------------------------------ | -------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | -------- |
| 15.3.1 | Dashboard skeleton during load | Skeleton loader shown while data loads | Login (observe dashboard initial render)        | DashboardSkeleton visible briefly before data renders | **P2**   |
| 15.3.2 | Table skeleton during load     | Table skeleton shown while fetching    | Navigate to `/users` (observe initial render)   | TableSkeleton visible briefly before data renders     | **P2**   |
| 15.3.3 | Card grid skeleton for spaces  | Card loading placeholders shown        | Navigate to `/spaces` (observe initial render)  | CardGridSkeleton visible briefly                      | **P2**   |
| 15.3.4 | Toast notifications on success | Success toasts appear after actions    | Create a user/class/session                     | Success toast notification appears and auto-dismisses | **P1**   |
| 15.3.5 | Toast notifications on error   | Error toasts appear on failures        | Trigger a failed action (e.g., duplicate email) | Error toast with message appears                      | **P1**   |

### 15.4 Empty States

| #      | Test Name                | Description                        | Steps                                       | Expected Behavior                                       | Priority |
| ------ | ------------------------ | ---------------------------------- | ------------------------------------------- | ------------------------------------------------------- | -------- |
| 15.4.1 | Users page empty state   | Graceful empty state when no users | View Users tab with no data (if applicable) | "No teachers/students/parents found" or similar message | **P1**   |
| 15.4.2 | Exams page empty state   | Empty state when no exams          | View `/exams` with no data                  | Empty state message shown                               | **P1**   |
| 15.4.3 | Spaces page empty state  | Empty state for no spaces          | View `/spaces` with no data                 | "Teachers create spaces" or similar message             | **P1**   |
| 15.4.4 | Reports page empty state | Empty state per tab                | View Reports tabs with no reportable data   | Empty state message per tab                             | **P2**   |
| 15.4.5 | Search no results        | No results message for search      | Search for "zzzznonexistent" on any page    | "No results found" or empty table                       | **P1**   |

---

## 16. Responsive Design

### 16.1 Mobile Viewport (375px)

| #      | Test Name                        | Description                                | Steps                                  | Expected Behavior                                | Priority |
| ------ | -------------------------------- | ------------------------------------------ | -------------------------------------- | ------------------------------------------------ | -------- |
| 16.1.1 | Sidebar collapses on mobile      | Sidebar hidden by default on small screens | Set viewport to 375px → login          | Sidebar collapsed; hamburger/menu button visible | **P1**   |
| 16.1.2 | Sidebar can be toggled on mobile | Menu button opens sidebar                  | Click hamburger/menu button            | Sidebar slides in as overlay                     | **P1**   |
| 16.1.3 | Dashboard cards stack vertically | Score cards responsive on mobile           | Set viewport to 375px → view dashboard | Cards stack in single column                     | **P1**   |
| 16.1.4 | Tables scroll horizontally       | Wide tables scrollable on mobile           | View `/users` at 375px                 | Table has horizontal scroll; content not cut off | **P1**   |
| 16.1.5 | Forms usable on mobile           | Dialogs and forms fit small screens        | Open Create Class dialog at 375px      | Dialog fits screen; all fields accessible        | **P1**   |
| 16.1.6 | Login page usable on mobile      | Login form renders properly                | View `/login` at 375px                 | Form centered and fully visible                  | **P0**   |

### 16.2 Tablet Viewport (768px)

| #      | Test Name                  | Description                    | Steps                                  | Expected Behavior                               | Priority |
| ------ | -------------------------- | ------------------------------ | -------------------------------------- | ----------------------------------------------- | -------- |
| 16.2.1 | Dashboard grid adapts      | Cards use 2-column layout      | Set viewport to 768px → view dashboard | Score cards in 2-column grid                    | **P2**   |
| 16.2.2 | Sidebar behavior on tablet | Sidebar may collapse or remain | Set viewport to 768px → check sidebar  | Sidebar collapsed or narrow; content area wider | **P2**   |
| 16.2.3 | Charts readable on tablet  | Charts resize to fit           | View `/analytics` at 768px             | Charts fit viewport without overflow            | **P2**   |

### 16.3 Dark Mode

| #      | Test Name                        | Description                                | Steps                                        | Expected Behavior                                  | Priority |
| ------ | -------------------------------- | ------------------------------------------ | -------------------------------------------- | -------------------------------------------------- | -------- |
| 16.3.1 | Dark mode renders correctly      | All pages render in dark mode              | Toggle to dark mode → navigate all pages     | No white flashes, proper contrast, text readable   | **P1**   |
| 16.3.2 | Charts visible in dark mode      | Chart colors contrast with dark background | Toggle dark mode → view Analytics / AI Usage | Charts have sufficient contrast and are readable   | **P2**   |
| 16.3.3 | Form inputs visible in dark mode | Input fields have proper styling           | Toggle dark mode → open a dialog with form   | Inputs have visible borders, text, and backgrounds | **P2**   |

---

## Summary

| Category                       | Total Tests | P0     | P1     | P2     |
| ------------------------------ | ----------- | ------ | ------ | ------ |
| Authentication & Authorization | 14          | 8      | 5      | 1      |
| Dashboard                      | 9           | 2      | 5      | 2      |
| Users Management               | 16          | 7      | 8      | 1      |
| Classes Management             | 10          | 4      | 6      | 0      |
| Courses & Spaces               | 6           | 1      | 4      | 1      |
| Exams Overview                 | 6           | 2      | 3      | 1      |
| Spaces Overview                | 5           | 2      | 2      | 1      |
| Analytics                      | 8           | 2      | 5      | 1      |
| AI Usage & Costs               | 9           | 2      | 6      | 1      |
| Academic Sessions              | 6           | 3      | 3      | 0      |
| Reports                        | 6           | 3      | 3      | 0      |
| Notifications                  | 8           | 2      | 4      | 2      |
| Settings                       | 14          | 4      | 7      | 3      |
| Navigation & Layout            | 17          | 3      | 11     | 3      |
| Error States & Edge Cases      | 15          | 1      | 9      | 5      |
| Responsive Design              | 9           | 1      | 5      | 3      |
| **TOTAL**                      | **158**     | **47** | **86** | **25** |

### Priority Definitions

- **P0 (Critical):** Core flows that must always work — login, navigation to
  main pages, primary data display. Block release if failing.
- **P1 (High):** Important features — CRUD operations, filtering, search,
  secondary data views, dark mode. Should be fixed before release.
- **P2 (Low):** Nice-to-have — visual polish, edge cases, skeleton loaders,
  badge styling. Can defer if needed.

### Testing Strategy Notes

1. **Authentication is shared:** Use `loginWithSchoolCode()` helper from
   `tests/e2e/helpers/auth.ts` as a `beforeAll` or `beforeEach` step for all
   authenticated test suites.
2. **Data dependency:** Tests use `.or()` pattern to handle both data-present
   and empty-state scenarios to avoid brittle tests tied to specific seed data.
3. **No destructive writes in CI:** Create/edit/delete tests should use cleanup
   or isolated test data to prevent polluting the shared database.
4. **Sequential execution:** Tests run with `workers: 1` to avoid race
   conditions with shared Firebase state.
5. **Existing coverage:** The current `admin-web.spec.ts` has 116 tests. This
   plan adds ~42 additional scenarios covering responsive design, dark mode,
   deeper CRUD operations, PDF downloads, form validation, and error states.
