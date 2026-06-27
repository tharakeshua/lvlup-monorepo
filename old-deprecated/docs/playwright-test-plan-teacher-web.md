# Playwright E2E Test Plan: Teacher-Web

> **App:** teacher-web | **Port:** 4569 | **Base URL:** `http://localhost:4569`
> **Test File:** `/tests/e2e/teacher-web.spec.ts` **Existing Coverage:** 118
> tests across 13 suites **Config:** `/playwright.config.ts` (root, project:
> `teacher-web`)

---

## Table of Contents

1. [Test Infrastructure](#1-test-infrastructure)
2. [Authentication](#2-authentication)
3. [Dashboard](#3-dashboard)
4. [Navigation & Layout](#4-navigation--layout)
5. [Space Management](#5-space-management)
6. [Exam Management](#6-exam-management)
7. [Submissions & Grading](#7-submissions--grading)
8. [Student Management](#8-student-management)
9. [Analytics](#9-analytics)
10. [Settings](#10-settings)
11. [Notifications](#11-notifications)
12. [Error States & Edge Cases](#12-error-states--edge-cases)
13. [Responsive & Mobile](#13-responsive--mobile)
14. [Accessibility](#14-accessibility)

---

## 1. Test Infrastructure

### Helpers & Fixtures

| File                   | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `helpers/auth.ts`      | `loginWithSchoolCode()`, `logout()`, `expectDashboard()` |
| `helpers/selectors.ts` | `CREDENTIALS`, `SCHOOL_CODE`, `SELECTORS`                |

### Test Credentials

| User               | Email                        | Password     |
| ------------------ | ---------------------------- | ------------ |
| Teacher 1 (Priya)  | `priya.sharma@greenwood.edu` | `Test@12345` |
| Teacher 2 (Rajesh) | `rajesh.kumar@greenwood.edu` | `Test@12345` |
| Teacher 3 (Anita)  | `anita.desai@greenwood.edu`  | `Test@12345` |
| Teacher 4 (Vikram) | `vikram.singh@greenwood.edu` | `Test@12345` |

**School Code:** `GRN001` (Greenwood International School)

### Conventions

- **Status:** `EXISTS` = already implemented, `NEW` = to be added
- **Priority:** `P0` = critical path, `P1` = high value, `P2` = nice to have
- Each test includes: Name, Description, Steps, Expected Behavior, Priority

---

## 2. Authentication

### 2.1 School Code Entry

| #     | Test Name                                                   | Description                                     | Steps                                                  | Expected Behavior                                                                 | Priority | Status |
| ----- | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | -------- | ------ |
| 2.1.1 | `should show school code input on login page`               | Verify login page renders with school code form | 1. Navigate to `/login`                                | School code input (`#schoolCode`) and Continue button visible                     | P0       | EXISTS |
| 2.1.2 | `should show error for invalid school code`                 | Invalid codes are rejected                      | 1. Go to `/login` 2. Enter `INVALID` 3. Click Continue | Error message displayed (destructive alert)                                       | P0       | EXISTS |
| 2.1.3 | `should show error for empty school code`                   | Empty submission prevented                      | 1. Go to `/login` 2. Click Continue without input      | Validation error shown                                                            | P0       | EXISTS |
| 2.1.4 | `should accept valid school code and show credentials form` | Valid code transitions to step 2                | 1. Go to `/login` 2. Enter `GRN001` 3. Click Continue  | School name "Greenwood International School" shown, email/password fields visible | P0       | EXISTS |
| 2.1.5 | `should show school name after valid code`                  | Confirm school name display                     | 1. Enter valid school code                             | School name displayed in UI                                                       | P1       | EXISTS |

### 2.2 Teacher Login

| #     | Test Name                                       | Description               | Steps                                                                          | Expected Behavior                                                 | Priority | Status |
| ----- | ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------- | ------ |
| 2.2.1 | `should login teacher with valid credentials`   | Full login flow           | 1. Enter school code `GRN001` 2. Enter teacher email/password 3. Click Sign In | Redirect to dashboard, `h1:has-text("Teacher Dashboard")` visible | P0       | EXISTS |
| 2.2.2 | `should show error for wrong password`          | Invalid password rejected | 1. Enter valid school code 2. Enter wrong password 3. Click Sign In            | Error alert shown, remain on login page                           | P0       | EXISTS |
| 2.2.3 | `should show error for non-existent email`      | Unknown user rejected     | 1. Enter valid school code 2. Enter unregistered email 3. Click Sign In        | Error alert shown                                                 | P0       | EXISTS |
| 2.2.4 | `should toggle password visibility`             | Password show/hide works  | 1. Enter password 2. Click eye icon                                            | Input type toggles between `password` and `text`                  | P1       | EXISTS |
| 2.2.5 | `should persist session after page refresh`     | Session stays active      | 1. Login as teacher 2. Refresh page                                            | Still on dashboard, not redirected to login                       | P0       | NEW    |
| 2.2.6 | `should redirect unauthenticated user to login` | Route protection works    | 1. Navigate to `/spaces` without login                                         | Redirected to `/login`                                            | P0       | EXISTS |

### 2.3 Logout

| #     | Test Name                              | Description              | Steps                                        | Expected Behavior                       | Priority | Status |
| ----- | -------------------------------------- | ------------------------ | -------------------------------------------- | --------------------------------------- | -------- | ------ |
| 2.3.1 | `should logout teacher successfully`   | Logout with confirmation | 1. Login 2. Click Sign Out 3. Confirm dialog | Redirected to `/login`, session cleared | P0       | EXISTS |
| 2.3.2 | `should not allow access after logout` | Post-logout protection   | 1. Logout 2. Navigate to `/spaces`           | Redirected to `/login`                  | P0       | NEW    |

### 2.4 Multi-Org Teacher

| #     | Test Name                                      | Description           | Steps                                                 | Expected Behavior                      | Priority | Status        |
| ----- | ---------------------------------------------- | --------------------- | ----------------------------------------------------- | -------------------------------------- | -------- | ------------- |
| 2.4.1 | `should show org picker for multi-org teacher` | Org selection dialog  | 1. Login as multi-org teacher                         | Org picker dialog with available orgs  | P1       | EXISTS (skip) |
| 2.4.2 | `should switch between organizations`          | Org switching         | 1. Login 2. Open org switcher 3. Select different org | Dashboard reloads with new org context | P1       | EXISTS (skip) |
| 2.4.3 | `should display correct org name after switch` | Org context confirmed | 1. Switch org                                         | Sidebar shows correct school name      | P1       | EXISTS (skip) |

---

## 3. Dashboard

### 3.1 Dashboard Content

| #     | Test Name                                       | Description           | Steps                       | Expected Behavior                          | Priority | Status |
| ----- | ----------------------------------------------- | --------------------- | --------------------------- | ------------------------------------------ | -------- | ------ |
| 3.1.1 | `should display dashboard heading`              | Page title renders    | 1. Login 2. Navigate to `/` | `h1:has-text("Teacher Dashboard")` visible | P0       | EXISTS |
| 3.1.2 | `should show welcome message with teacher name` | Personalized greeting | 1. Login                    | `text=Welcome back` visible                | P0       | EXISTS |
| 3.1.3 | `should display Total Students stat card`       | Stats card present    | 1. Login                    | Score card with "Total Students" visible   | P0       | EXISTS |
| 3.1.4 | `should display Active Exams stat card`         | Stats card present    | 1. Login                    | Score card with "Active Exams" visible     | P0       | EXISTS |
| 3.1.5 | `should display Total Spaces stat card`         | Stats card present    | 1. Login                    | Score card with "Total Spaces" visible     | P0       | EXISTS |
| 3.1.6 | `should display At-Risk Students stat card`     | Stats card present    | 1. Login                    | Score card with "At-Risk Students" visible | P0       | EXISTS |

### 3.2 Dashboard Sections

| #     | Test Name                                | Description         | Steps    | Expected Behavior                                            | Priority | Status |
| ----- | ---------------------------------------- | ------------------- | -------- | ------------------------------------------------------------ | -------- | ------ |
| 3.2.1 | `should display class performance chart` | Bar chart renders   | 1. Login | "Class Performance" section with chart or empty state        | P1       | EXISTS |
| 3.2.2 | `should display recent spaces section`   | Quick access spaces | 1. Login | "Recent Spaces" heading with space cards or empty state      | P1       | EXISTS |
| 3.2.3 | `should display recent exams section`    | Quick access exams  | 1. Login | "Recent Exams" heading with exam entries or empty state      | P1       | EXISTS |
| 3.2.4 | `should display grading queue section`   | Pending reviews     | 1. Login | "Grading Queue" heading with submissions or empty state      | P1       | NEW    |
| 3.2.5 | `should display at-risk students alert`  | At-risk overview    | 1. Login | "At-Risk Students" section with class details or empty state | P1       | NEW    |

### 3.3 Dashboard Navigation

| #     | Test Name                                       | Description         | Steps                                  | Expected Behavior                   | Priority | Status |
| ----- | ----------------------------------------------- | ------------------- | -------------------------------------- | ----------------------------------- | -------- | ------ |
| 3.3.1 | `should navigate to space from recent spaces`   | Click-through works | 1. Click space card in "Recent Spaces" | Navigate to `/spaces/:id/edit`      | P1       | NEW    |
| 3.3.2 | `should navigate to exam from recent exams`     | Click-through works | 1. Click exam in "Recent Exams"        | Navigate to `/exams/:id`            | P1       | NEW    |
| 3.3.3 | `should navigate to grading from grading queue` | Click-through works | 1. Click submission in "Grading Queue" | Navigate to submission grading page | P1       | NEW    |

---

## 4. Navigation & Layout

### 4.1 Sidebar Navigation

| #     | Test Name                                         | Description        | Steps                                 | Expected Behavior                           | Priority | Status |
| ----- | ------------------------------------------------- | ------------------ | ------------------------------------- | ------------------------------------------- | -------- | ------ |
| 4.1.1 | `should navigate to Spaces from sidebar`          | Sidebar link works | 1. Click "Spaces" in sidebar          | URL changes to `/spaces`, page loads        | P0       | EXISTS |
| 4.1.2 | `should navigate to Exams from sidebar`           | Sidebar link works | 1. Click "Exams" in sidebar           | URL changes to `/exams`, page loads         | P0       | EXISTS |
| 4.1.3 | `should navigate to Students from sidebar`        | Sidebar link works | 1. Click "Students" in sidebar        | URL changes to `/students`, page loads      | P0       | EXISTS |
| 4.1.4 | `should navigate to Settings from sidebar`        | Sidebar link works | 1. Click "Settings" in sidebar        | URL changes to `/settings`, page loads      | P0       | EXISTS |
| 4.1.5 | `should navigate to Notifications from sidebar`   | Sidebar link works | 1. Click "Notifications" in sidebar   | URL changes to `/notifications`, page loads | P0       | EXISTS |
| 4.1.6 | `should navigate to Class Analytics from sidebar` | Analytics link     | 1. Click "Class Analytics" in sidebar | URL changes to `/analytics/classes`         | P1       | NEW    |
| 4.1.7 | `should navigate to Exam Analytics from sidebar`  | Analytics link     | 1. Click "Exam Analytics" in sidebar  | URL changes to `/analytics/exams`           | P1       | NEW    |
| 4.1.8 | `should navigate to Space Analytics from sidebar` | Analytics link     | 1. Click "Space Analytics" in sidebar | URL changes to `/analytics/spaces`          | P1       | NEW    |
| 4.1.9 | `should highlight active sidebar item`            | Active state shown | 1. Navigate to `/spaces`              | "Spaces" sidebar item is highlighted/active | P2       | NEW    |

### 4.2 Breadcrumb Navigation

| #     | Test Name                                 | Description      | Steps                                           | Expected Behavior                                    | Priority | Status |
| ----- | ----------------------------------------- | ---------------- | ----------------------------------------------- | ---------------------------------------------------- | -------- | ------ |
| 4.2.1 | `should show breadcrumbs on space editor` | Breadcrumb trail | 1. Navigate to space editor                     | Breadcrumb: Spaces > {Space Title}                   | P1       | NEW    |
| 4.2.2 | `should show breadcrumbs on exam detail`  | Breadcrumb trail | 1. Navigate to exam detail                      | Breadcrumb: Exams > {Exam Title}                     | P1       | NEW    |
| 4.2.3 | `should navigate back via breadcrumb`     | Breadcrumb click | 1. On space editor 2. Click "Spaces" breadcrumb | Navigate back to `/spaces`                           | P1       | NEW    |
| 4.2.4 | `should show breadcrumbs on grading page` | Deep breadcrumb  | 1. Navigate to grading review                   | Breadcrumb: Exams > {Exam} > Submissions > {Student} | P2       | NEW    |

### 4.3 Route Transitions

| #     | Test Name                             | Description        | Steps                                             | Expected Behavior          | Priority | Status |
| ----- | ------------------------------------- | ------------------ | ------------------------------------------------- | -------------------------- | -------- | ------ |
| 4.3.1 | `should handle browser back button`   | Browser nav works  | 1. Go to Spaces 2. Click a space 3. Press back    | Return to Spaces list      | P1       | NEW    |
| 4.3.2 | `should handle direct URL navigation` | Deep linking works | 1. Login 2. Navigate directly to `/exams` via URL | Exams page loads correctly | P1       | NEW    |

---

## 5. Space Management

### 5.1 Space List Page

| #     | Test Name                                       | Description          | Steps                    | Expected Behavior                                                            | Priority | Status |
| ----- | ----------------------------------------------- | -------------------- | ------------------------ | ---------------------------------------------------------------------------- | -------- | ------ |
| 5.1.1 | `should display spaces page heading`            | Page renders         | 1. Navigate to `/spaces` | `h1:has-text("Spaces")` visible                                              | P0       | EXISTS |
| 5.1.2 | `should show New Space button`                  | Create CTA present   | 1. Navigate to `/spaces` | "New Space" button visible                                                   | P0       | EXISTS |
| 5.1.3 | `should search spaces by name`                  | Search works         | 1. Type in search input  | Spaces filtered by search term                                               | P0       | EXISTS |
| 5.1.4 | `should filter by All status tab`               | Filter tab works     | 1. Click "All" tab       | All spaces shown                                                             | P0       | EXISTS |
| 5.1.5 | `should filter by Draft status tab`             | Filter tab works     | 1. Click "Draft" tab     | Only draft spaces shown                                                      | P0       | EXISTS |
| 5.1.6 | `should filter by Published status tab`         | Filter tab works     | 1. Click "Published" tab | Only published spaces shown                                                  | P0       | EXISTS |
| 5.1.7 | `should filter by Archived status tab`          | Filter tab works     | 1. Click "Archived" tab  | Only archived spaces shown                                                   | P0       | EXISTS |
| 5.1.8 | `should show space cards with details`          | Card content correct | 1. View space grid       | Each card shows title, description, type, subject, labels, story point count | P1       | EXISTS |
| 5.1.9 | `should navigate to space editor on card click` | Card is clickable    | 1. Click a space card    | Navigate to `/spaces/:id/edit`                                               | P1       | EXISTS |

### 5.2 Create New Space

| #     | Test Name                                      | Description         | Steps                                  | Expected Behavior                     | Priority | Status |
| ----- | ---------------------------------------------- | ------------------- | -------------------------------------- | ------------------------------------- | -------- | ------ |
| 5.2.1 | `should create a new space`                    | Space creation flow | 1. Click "New Space" 2. Confirm dialog | New space created, navigate to editor | P0       | NEW    |
| 5.2.2 | `should show new space in list after creation` | List updates        | 1. Create space 2. Go back to list     | New space appears in grid             | P1       | NEW    |

### 5.3 Space Editor — Settings Tab

| #     | Test Name                                    | Description            | Steps                                                       | Expected Behavior                    | Priority | Status |
| ----- | -------------------------------------------- | ---------------------- | ----------------------------------------------------------- | ------------------------------------ | -------- | ------ |
| 5.3.1 | `should load space editor with settings tab` | Editor renders         | 1. Navigate to `/spaces/:id/edit`                           | Settings tab active with form fields | P0       | NEW    |
| 5.3.2 | `should edit space title`                    | Title editable         | 1. Change title input 2. Save                               | Title updated, persisted on refresh  | P0       | NEW    |
| 5.3.3 | `should edit space description`              | Description editable   | 1. Change description 2. Save                               | Description updated                  | P1       | NEW    |
| 5.3.4 | `should select space type`                   | Type dropdown works    | 1. Select type from dropdown                                | Type updated                         | P1       | NEW    |
| 5.3.5 | `should select space subject`                | Subject dropdown works | 1. Select subject from dropdown                             | Subject updated                      | P1       | NEW    |
| 5.3.6 | `should set access type`                     | Access control         | 1. Select "Class Assigned" / "Tenant Wide" / "Public Store" | Access type saved                    | P1       | NEW    |
| 5.3.7 | `should configure assessment defaults`       | Assessment settings    | 1. Set time limit, retakes, show answers toggles            | Settings persisted                   | P1       | NEW    |

### 5.4 Space Editor — Content Tab

| #      | Test Name                                       | Description          | Steps                                                                            | Expected Behavior                     | Priority | Status |
| ------ | ----------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | -------- | ------ |
| 5.4.1  | `should switch to Content tab`                  | Tab navigation       | 1. Click "Content" tab                                                           | Content panel shown with story points | P0       | NEW    |
| 5.4.2  | `should add a new story point`                  | Story point creation | 1. Click "Add Story Point" button                                                | New story point appears in list       | P0       | NEW    |
| 5.4.3  | `should expand story point to see items`        | Accordion works      | 1. Click story point header                                                      | Items list expands with add button    | P1       | NEW    |
| 5.4.4  | `should add a MCQ question to story point`      | Add question         | 1. Expand story point 2. Click "Add Question" 3. Select MCQ 4. Fill form 5. Save | Question item added to story point    | P0       | NEW    |
| 5.4.5  | `should add a text question to story point`     | Add text question    | 1. Add Question → Text type 2. Fill form 3. Save                                 | Text question item added              | P1       | NEW    |
| 5.4.6  | `should add a material item to story point`     | Add material         | 1. Click "Add Material" 2. Select type 3. Fill content 4. Save                   | Material item added to story point    | P1       | NEW    |
| 5.4.7  | `should edit an existing item`                  | Item editing         | 1. Click edit on existing item 2. Modify fields 3. Save                          | Item updated                          | P1       | NEW    |
| 5.4.8  | `should delete an item with confirmation`       | Item deletion        | 1. Click delete on item 2. Confirm dialog                                        | Item removed from list                | P1       | NEW    |
| 5.4.9  | `should delete a story point with confirmation` | Story point deletion | 1. Click delete on story point 2. Confirm                                        | Story point and its items removed     | P1       | NEW    |
| 5.4.10 | `should reorder story points via drag-and-drop` | DnD reordering       | 1. Drag story point A above B                                                    | Order updated, persisted              | P1       | NEW    |
| 5.4.11 | `should edit story point title`                 | Inline editing       | 1. Click story point edit 2. Change title 3. Save                                | Title updated                         | P2       | NEW    |

### 5.5 Space Editor — Rubric Tab

| #     | Test Name                                   | Description       | Steps                                                 | Expected Behavior                | Priority | Status |
| ----- | ------------------------------------------- | ----------------- | ----------------------------------------------------- | -------------------------------- | -------- | ------ |
| 5.5.1 | `should switch to Rubric tab`               | Tab navigation    | 1. Click "Rubric" tab                                 | Rubric editor panel visible      | P1       | NEW    |
| 5.5.2 | `should select Criteria Based scoring mode` | Mode selection    | 1. Select "Criteria Based"                            | Criteria editor form shown       | P1       | NEW    |
| 5.5.3 | `should add rubric criteria`                | Criteria creation | 1. Click "Add Criteria" 2. Enter name, levels, scores | Criteria row added               | P1       | NEW    |
| 5.5.4 | `should select Holistic scoring mode`       | Mode switch       | 1. Select "Holistic"                                  | Single score guidance form shown | P1       | NEW    |
| 5.5.5 | `should set passing percentage`             | Shared setting    | 1. Enter passing percentage                           | Value saved                      | P2       | NEW    |

### 5.6 Space Lifecycle

| #     | Test Name                            | Description       | Steps                                                  | Expected Behavior                                      | Priority | Status |
| ----- | ------------------------------------ | ----------------- | ------------------------------------------------------ | ------------------------------------------------------ | -------- | ------ |
| 5.6.1 | `should publish a draft space`       | Status transition | 1. On draft space editor 2. Click "Publish" 3. Confirm | Status changes to Published                            | P0       | NEW    |
| 5.6.2 | `should unpublish a published space` | Status transition | 1. On published space 2. Click "Unpublish" 3. Confirm  | Status changes to Draft                                | P1       | NEW    |
| 5.6.3 | `should archive a space`             | Status transition | 1. Click "Archive" 2. Confirm dialog                   | Status changes to Archived, appears under Archived tab | P1       | NEW    |

---

## 6. Exam Management

### 6.1 Exam List Page

| #     | Test Name                                 | Description        | Steps                    | Expected Behavior                                                 | Priority | Status |
| ----- | ----------------------------------------- | ------------------ | ------------------------ | ----------------------------------------------------------------- | -------- | ------ |
| 6.1.1 | `should display exams page heading`       | Page renders       | 1. Navigate to `/exams`  | `h1:has-text("Exams")` visible                                    | P0       | EXISTS |
| 6.1.2 | `should show New Exam link`               | Create CTA present | 1. Navigate to `/exams`  | `a[href="/exams/new"]` visible                                    | P0       | EXISTS |
| 6.1.3 | `should search exams by name`             | Search works       | 1. Type in search input  | Exams filtered by search term                                     | P0       | EXISTS |
| 6.1.4 | `should filter by All status tab`         | Filter works       | 1. Click "All" tab       | All exams shown                                                   | P0       | EXISTS |
| 6.1.5 | `should filter by Draft status tab`       | Filter works       | 1. Click "Draft" tab     | Only draft exams shown                                            | P1       | EXISTS |
| 6.1.6 | `should filter by Published status tab`   | Filter works       | 1. Click "Published" tab | Only published exams shown                                        | P1       | EXISTS |
| 6.1.7 | `should filter by Grading status tab`     | Filter works       | 1. Click "Grading" tab   | Only grading exams shown                                          | P1       | EXISTS |
| 6.1.8 | `should show exam cards with stats`       | Card content       | 1. View exam list        | Each card shows title, subject, marks, duration, submission count | P1       | NEW    |
| 6.1.9 | `should navigate to exam detail on click` | Card clickable     | 1. Click exam card       | Navigate to `/exams/:id`                                          | P1       | NEW    |

### 6.2 Exam Create Wizard

| #      | Test Name                                      | Description        | Steps                                               | Expected Behavior                                                           | Priority | Status |
| ------ | ---------------------------------------------- | ------------------ | --------------------------------------------------- | --------------------------------------------------------------------------- | -------- | ------ |
| 6.2.1  | `should display 4-step stepper`                | Wizard renders     | 1. Navigate to `/exams/new`                         | Stepper with Metadata, Upload, Review, Publish steps visible                | P0       | EXISTS |
| 6.2.2  | `should show metadata form on step 1`          | First step content | 1. On step 1                                        | Title, Subject, Topics, Total Marks, Passing Marks, Duration fields visible | P0       | EXISTS |
| 6.2.3  | `should validate required metadata fields`     | Form validation    | 1. Click Next without filling required fields       | Validation errors shown for empty required fields                           | P0       | EXISTS |
| 6.2.4  | `should fill metadata and advance to step 2`   | Form submission    | 1. Fill all metadata fields 2. Click Next           | Advance to Upload step                                                      | P0       | EXISTS |
| 6.2.5  | `should show file upload area on step 2`       | Upload UI          | 1. On step 2                                        | Drag-drop upload zone visible                                               | P0       | EXISTS |
| 6.2.6  | `should upload question paper image`           | File upload        | 1. Upload an image file                             | File shown in upload list, preview displayed                                | P0       | NEW    |
| 6.2.7  | `should upload question paper PDF`             | PDF upload         | 1. Upload a PDF file                                | File shown in upload list                                                   | P1       | NEW    |
| 6.2.8  | `should skip upload and continue`              | Optional upload    | 1. Click "Skip" on step 2                           | Advance to step 3 without files                                             | P1       | EXISTS |
| 6.2.9  | `should display review summary on step 3`      | Review content     | 1. On step 3                                        | All entered metadata displayed for review                                   | P0       | EXISTS |
| 6.2.10 | `should navigate back from review to metadata` | Back navigation    | 1. On step 3 2. Click Back                          | Return to step 1 with data preserved                                        | P1       | EXISTS |
| 6.2.11 | `should create exam on step 4`                 | Exam creation      | 1. Complete all steps 2. Click Create/Publish       | Exam created, navigate to exam detail page                                  | P0       | NEW    |
| 6.2.12 | `should select linked space`                   | Space linking      | 1. On metadata step 2. Select a space from dropdown | Space linked to exam                                                        | P1       | NEW    |
| 6.2.13 | `should select class assignments`              | Class selection    | 1. On metadata step 2. Select class IDs             | Classes assigned to exam                                                    | P1       | NEW    |

### 6.3 Exam Detail Page

| #      | Test Name                                      | Description       | Steps                                                              | Expected Behavior                                          | Priority | Status |
| ------ | ---------------------------------------------- | ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | -------- | ------ |
| 6.3.1  | `should display exam detail page`              | Page renders      | 1. Navigate to `/exams/:id`                                        | Exam title, status badge, subject, marks, duration visible | P0       | EXISTS |
| 6.3.2  | `should show Questions tab`                    | Tab navigation    | 1. Click "Questions" tab                                           | Questions list with question text, marks, type             | P0       | EXISTS |
| 6.3.3  | `should show Submissions tab`                  | Tab navigation    | 1. Click "Submissions" tab                                         | Recent submissions list or empty state                     | P0       | EXISTS |
| 6.3.4  | `should show Settings tab`                     | Tab navigation    | 1. Click "Settings" tab                                            | Grading config and linked space info                       | P0       | EXISTS |
| 6.3.5  | `should display exam stats cards`              | Stats rendering   | 1. View exam detail                                                | Total Submissions, Graded, Avg Score %, Pass Rate cards    | P1       | NEW    |
| 6.3.6  | `should navigate back to exams list`           | Back navigation   | 1. Click back button/breadcrumb                                    | Navigate to `/exams`                                       | P1       | EXISTS |
| 6.3.7  | `should show 404 for non-existent exam`        | Error handling    | 1. Navigate to `/exams/nonexistent`                                | Not found state displayed                                  | P1       | EXISTS |
| 6.3.8  | `should publish a draft exam`                  | Status transition | 1. On draft exam 2. Click "Publish"                                | Exam status changes to Published                           | P0       | NEW    |
| 6.3.9  | `should release exam results`                  | Result release    | 1. On completed exam 2. Click "Release Results"                    | Results released, badge shown                              | P0       | NEW    |
| 6.3.10 | `should edit question rubric from detail page` | Rubric editing    | 1. Click rubric edit on a question 2. Edit rubric in sheet 3. Save | Rubric updated for that question                           | P1       | NEW    |
| 6.3.11 | `should link exam to a space`                  | Space linking     | 1. Click "Link Space" 2. Select space from dialog 3. Confirm       | Space linked, title shown on detail page                   | P1       | NEW    |

---

## 7. Submissions & Grading

### 7.1 Submissions Page

| #     | Test Name                                        | Description          | Steps                                                                                   | Expected Behavior                                                                                              | Priority | Status |
| ----- | ------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 7.1.1 | `should display submissions page`                | Page renders         | 1. Navigate to `/exams/:id/submissions`                                                 | Submissions heading with upload section and list                                                               | P0       | NEW    |
| 7.1.2 | `should show upload form for answer sheets`      | Upload UI present    | 1. On submissions page                                                                  | Student name, roll number, class ID inputs, and file drop zone visible                                         | P0       | NEW    |
| 7.1.3 | `should upload student answer sheet`             | File upload flow     | 1. Fill student name, roll number 2. Select class 3. Upload answer sheet file 4. Submit | Submission created, appears in list with "uploaded" status                                                     | P0       | NEW    |
| 7.1.4 | `should display submission list with status`     | List rendering       | 1. View submission list                                                                 | Each submission shows student name, roll number, class, pipeline status, score                                 | P0       | NEW    |
| 7.1.5 | `should show pipeline status icons`              | Status visualization | 1. View submissions                                                                     | Status icons colored by stage: uploaded, ocr_processing, scouting, grading, ready_for_review, reviewed, failed | P1       | NEW    |
| 7.1.6 | `should navigate to grading review`              | Click-through        | 1. Click a submission row                                                               | Navigate to `/exams/:examId/submissions/:submissionId`                                                         | P0       | NEW    |
| 7.1.7 | `should release results for reviewed submission` | Result release       | 1. Click "Release Results" on reviewed submission                                       | "Results Released" badge appears                                                                               | P1       | NEW    |
| 7.1.8 | `should validate upload form fields`             | Form validation      | 1. Submit upload form with missing student name                                         | Validation error shown                                                                                         | P1       | NEW    |

### 7.2 Grading Review Page

| #      | Test Name                                       | Description         | Steps                                                     | Expected Behavior                                                              | Priority | Status |
| ------ | ----------------------------------------------- | ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ------ |
| 7.2.1  | `should display grading review page`            | Page renders        | 1. Navigate to grading review                             | Student name, roll number, pipeline status, summary cards visible              | P0       | NEW    |
| 7.2.2  | `should show total score and percentage`        | Summary cards       | 1. View grading review                                    | Total score, percentage, grade, questions graded count                         | P0       | NEW    |
| 7.2.3  | `should show expandable question list`          | Question accordion  | 1. View question list                                     | Questions with number, text, marks; expandable to show details                 | P0       | NEW    |
| 7.2.4  | `should expand question to show student answer` | Answer display      | 1. Expand a question                                      | Student answer images visible with lightbox zoom capability                    | P0       | NEW    |
| 7.2.5  | `should show AI evaluation details`             | AI grading display  | 1. Expand graded question                                 | AI score, confidence, strengths, weaknesses, rubric breakdown, summary visible | P0       | NEW    |
| 7.2.6  | `should override AI score manually`             | Manual override     | 1. Enter override score 2. Enter reason 3. Click Override | Override saved, original and override scores displayed                         | P0       | NEW    |
| 7.2.7  | `should validate override score range`          | Override validation | 1. Enter score > max marks                                | Validation error or clamping                                                   | P1       | NEW    |
| 7.2.8  | `should navigate to next submission`            | Submission nav      | 1. Click "Next" button                                    | Navigate to next submission in list                                            | P1       | NEW    |
| 7.2.9  | `should navigate to previous submission`        | Submission nav      | 1. Click "Previous" button                                | Navigate to previous submission                                                | P1       | NEW    |
| 7.2.10 | `should approve all graded questions`           | Bulk approve        | 1. Click "Approve All"                                    | All graded questions marked as reviewed                                        | P1       | NEW    |
| 7.2.11 | `should show answer image in lightbox`          | Image zoom          | 1. Click answer image                                     | Full-size lightbox overlay opens                                               | P2       | NEW    |
| 7.2.12 | `should show rubric breakdown table`            | Rubric display      | 1. Expand graded question                                 | Table with criterion name, awarded score, max score                            | P2       | NEW    |

---

## 8. Student Management

### 8.1 Students Page

| #     | Test Name                                     | Description       | Steps                          | Expected Behavior                                                | Priority | Status |
| ----- | --------------------------------------------- | ----------------- | ------------------------------ | ---------------------------------------------------------------- | -------- | ------ |
| 8.1.1 | `should display students page heading`        | Page renders      | 1. Navigate to `/students`     | `h1:has-text("Students")` visible                                | P0       | EXISTS |
| 8.1.2 | `should show search input`                    | Search UI present | 1. On students page            | Search input with placeholder visible                            | P0       | EXISTS |
| 8.1.3 | `should display student table or empty state` | Data display      | 1. View students page          | Table with students OR "No students" empty state                 | P0       | EXISTS |
| 8.1.4 | `should show table columns`                   | Column headers    | 1. View student table          | Name, Roll Number, Admission No., Grade, Section, Status columns | P0       | EXISTS |
| 8.1.5 | `should search students by name`              | Name search       | 1. Type student name in search | Table filtered to matching students                              | P0       | EXISTS |
| 8.1.6 | `should search students by roll number`       | Roll search       | 1. Type roll number in search  | Table filtered to matching students                              | P1       | EXISTS |
| 8.1.7 | `should clear search and show all students`   | Search clear      | 1. Clear search input          | All students displayed again                                     | P1       | EXISTS |

---

## 9. Analytics

### 9.1 Class Analytics Page

| #     | Test Name                                        | Description       | Steps                               | Expected Behavior                                             | Priority | Status |
| ----- | ------------------------------------------------ | ----------------- | ----------------------------------- | ------------------------------------------------------------- | -------- | ------ |
| 9.1.1 | `should display class analytics heading`         | Page renders      | 1. Navigate to `/analytics/classes` | Heading and subtitle visible                                  | P0       | EXISTS |
| 9.1.2 | `should show class selector dropdown`            | Selector UI       | 1. On class analytics               | Dropdown to select a class                                    | P0       | EXISTS |
| 9.1.3 | `should display stats after selecting class`     | Data loads        | 1. Select a class                   | Students, Avg Exam Score, Avg Space Completion, At-Risk cards | P0       | EXISTS |
| 9.1.4 | `should show AutoGrade section`                  | Section rendering | 1. Select class with exam data      | Progress ring, exam completion rate, top/bottom performers    | P1       | EXISTS |
| 9.1.5 | `should show LevelUp section`                    | Section rendering | 1. Select class with space data     | Progress ring, active rate, top point earners                 | P1       | EXISTS |
| 9.1.6 | `should show empty state for class without data` | Empty handling    | 1. Select class with no data        | Appropriate empty state message                               | P1       | EXISTS |

### 9.2 Exam Analytics Page

| #     | Test Name                                   | Description     | Steps                             | Expected Behavior                                                    | Priority | Status |
| ----- | ------------------------------------------- | --------------- | --------------------------------- | -------------------------------------------------------------------- | -------- | ------ |
| 9.2.1 | `should display exam analytics heading`     | Page renders    | 1. Navigate to `/analytics/exams` | Heading and subtitle visible                                         | P0       | EXISTS |
| 9.2.2 | `should show exam selector dropdown`        | Selector UI     | 1. On exam analytics              | Dropdown to select a graded exam                                     | P0       | EXISTS |
| 9.2.3 | `should display stats after selecting exam` | Data loads      | 1. Select an exam                 | Total Submissions, Avg Score, Pass Rate, Median Score cards          | P0       | EXISTS |
| 9.2.4 | `should show grade distribution chart`      | Chart rendering | 1. Select exam with results       | Bar chart showing score bucket distribution                          | P1       | EXISTS |
| 9.2.5 | `should show per-question analysis table`   | Table rendering | 1. Select exam                    | Question number, avg score, avg %, difficulty badge, common mistakes | P1       | EXISTS |
| 9.2.6 | `should show topic performance chart`       | Chart rendering | 1. Select exam with topics        | Bar chart of avg % per topic                                         | P2       | EXISTS |

### 9.3 Space Analytics Page

| #     | Test Name                                    | Description       | Steps                              | Expected Behavior                                                      | Priority | Status |
| ----- | -------------------------------------------- | ----------------- | ---------------------------------- | ---------------------------------------------------------------------- | -------- | ------ |
| 9.3.1 | `should display space analytics heading`     | Page renders      | 1. Navigate to `/analytics/spaces` | Heading visible                                                        | P0       | NEW    |
| 9.3.2 | `should show space selector dropdown`        | Selector UI       | 1. On space analytics              | Dropdown to select a published space                                   | P0       | NEW    |
| 9.3.3 | `should display stats after selecting space` | Data loads        | 1. Select a space                  | Total Students, Completed, Avg Completion %, Avg Engagement Time cards | P1       | NEW    |
| 9.3.4 | `should show completion overview`            | Section rendering | 1. Select space                    | Progress ring with space details                                       | P1       | NEW    |
| 9.3.5 | `should show engagement metrics`             | Section rendering | 1. Select space                    | Progress ring, student counts, avg time                                | P2       | NEW    |

### 9.4 Class Detail Page

| #     | Test Name                                  | Description    | Steps                              | Expected Behavior                                  | Priority | Status |
| ----- | ------------------------------------------ | -------------- | ---------------------------------- | -------------------------------------------------- | -------- | ------ |
| 9.4.1 | `should display class detail page`         | Page renders   | 1. Navigate to `/classes/:classId` | Class name heading with tabs                       | P0       | NEW    |
| 9.4.2 | `should show Overview tab with stats`      | Default tab    | 1. View class detail               | Student count, spaces, exams, avg exam score cards | P0       | NEW    |
| 9.4.3 | `should show Spaces tab`                   | Tab navigation | 1. Click "Spaces" tab              | Grid of class spaces                               | P1       | NEW    |
| 9.4.4 | `should show Exams tab`                    | Tab navigation | 1. Click "Exams" tab               | Table of class exams with status                   | P1       | NEW    |
| 9.4.5 | `should show Students tab`                 | Tab navigation | 1. Click "Students" tab            | Table of class students                            | P1       | NEW    |
| 9.4.6 | `should show Analytics tab`                | Tab navigation | 1. Click "Analytics" tab           | AutoGrade and LevelUp analytics sections           | P1       | NEW    |
| 9.4.7 | `should navigate to space from spaces tab` | Click-through  | 1. Click space card in Spaces tab  | Navigate to space editor                           | P2       | NEW    |
| 9.4.8 | `should navigate to exam from exams tab`   | Click-through  | 1. Click exam in Exams tab         | Navigate to exam detail                            | P2       | NEW    |

---

## 10. Settings

### 10.1 Evaluation Settings

| #      | Test Name                                 | Description        | Steps                                       | Expected Behavior                            | Priority | Status |
| ------ | ----------------------------------------- | ------------------ | ------------------------------------------- | -------------------------------------------- | -------- | ------ |
| 10.1.1 | `should display settings page heading`    | Page renders       | 1. Navigate to `/settings`                  | `h1:has-text("Settings")` visible            | P0       | EXISTS |
| 10.1.2 | `should show Evaluation Settings section` | Section render     | 1. On settings                              | `h2:has-text("Evaluation Settings")` visible | P0       | EXISTS |
| 10.1.3 | `should toggle Auto Grade`                | Toggle interaction | 1. Click Auto Grade toggle                  | Toggle state changes                         | P0       | EXISTS |
| 10.1.4 | `should toggle Require Override Reason`   | Toggle interaction | 1. Click Override Reason toggle             | Toggle state changes                         | P0       | EXISTS |
| 10.1.5 | `should toggle Auto-release Results`      | Toggle interaction | 1. Click Auto-release toggle                | Toggle state changes                         | P0       | EXISTS |
| 10.1.6 | `should change AI Strictness dropdown`    | Dropdown works     | 1. Select "Lenient" / "Moderate" / "Strict" | Dropdown value updates                       | P0       | EXISTS |
| 10.1.7 | `should save settings`                    | Persist settings   | 1. Change settings 2. Click Save            | Success toast, settings persisted on refresh | P0       | EXISTS |
| 10.1.8 | `should show Save button`                 | Button present     | 1. On settings                              | Save button visible                          | P0       | EXISTS |

---

## 11. Notifications

### 11.1 Notification Bell (Header)

| #      | Test Name                                    | Description        | Steps                        | Expected Behavior                                       | Priority | Status |
| ------ | -------------------------------------------- | ------------------ | ---------------------------- | ------------------------------------------------------- | -------- | ------ |
| 11.1.1 | `should show notification bell in header`    | Bell icon          | 1. On any page               | Notification bell icon visible in header                | P1       | NEW    |
| 11.1.2 | `should show unread count badge`             | Unread indicator   | 1. With unread notifications | Badge with count visible on bell icon                   | P1       | NEW    |
| 11.1.3 | `should navigate to notification action URL` | Click notification | 1. Click a notification      | Navigate to the notification's action URL, mark as read | P1       | NEW    |

### 11.2 Notifications Page

| #      | Test Name                                 | Description    | Steps                                 | Expected Behavior                                     | Priority | Status |
| ------ | ----------------------------------------- | -------------- | ------------------------------------- | ----------------------------------------------------- | -------- | ------ |
| 11.2.1 | `should display notifications page`       | Page renders   | 1. Navigate to `/notifications`       | Notifications page visible                            | P0       | EXISTS |
| 11.2.2 | `should show notification list`           | List rendering | 1. On notifications page              | Notification items with content and timestamps        | P0       | EXISTS |
| 11.2.3 | `should filter by All / Unread tabs`      | Filter tabs    | 1. Click "All" 2. Click "Unread"      | List filters accordingly                              | P1       | EXISTS |
| 11.2.4 | `should mark single notification as read` | Mark read      | 1. Click mark-as-read on notification | Notification marked as read                           | P1       | EXISTS |
| 11.2.5 | `should mark all notifications as read`   | Bulk mark read | 1. Click "Mark All as Read"           | All notifications marked as read, unread count resets | P1       | NEW    |

---

## 12. Error States & Edge Cases

### 12.1 Form Validation

| #      | Test Name                                          | Description        | Steps                                            | Expected Behavior                                     | Priority | Status |
| ------ | -------------------------------------------------- | ------------------ | ------------------------------------------------ | ----------------------------------------------------- | -------- | ------ |
| 12.1.1 | `should validate exam create form — missing title` | Required field     | 1. Leave title empty 2. Click Next               | Error message for title field                         | P0       | EXISTS |
| 12.1.2 | `should validate exam create form — invalid marks` | Numeric validation | 1. Enter negative marks 2. Click Next            | Error message for marks field                         | P1       | NEW    |
| 12.1.3 | `should validate space settings — empty title`     | Required field     | 1. Clear space title 2. Save                     | Error or prevent save                                 | P1       | NEW    |
| 12.1.4 | `should validate grading override — empty reason`  | Required field     | 1. Enter override score without reason 2. Submit | Error if override reason required (setting dependent) | P1       | NEW    |
| 12.1.5 | `should validate upload — unsupported file type`   | File validation    | 1. Upload a .txt file as answer sheet            | Error message for unsupported file type               | P2       | NEW    |

### 12.2 Network & Loading States

| #      | Test Name                                      | Description   | Steps                                     | Expected Behavior                                             | Priority | Status |
| ------ | ---------------------------------------------- | ------------- | ----------------------------------------- | ------------------------------------------------------------- | -------- | ------ |
| 12.2.1 | `should show loading skeletons on dashboard`   | Loading state | 1. Login (during data fetch)              | Skeleton loaders (`.animate-pulse`) visible before data loads | P1       | NEW    |
| 12.2.2 | `should show loading state on spaces list`     | Loading state | 1. Navigate to `/spaces`                  | Skeleton or spinner while loading                             | P1       | NEW    |
| 12.2.3 | `should show empty state when no exams exist`  | Empty state   | 1. Teacher with no exams views `/exams`   | "No exams yet" or similar empty state                         | P1       | NEW    |
| 12.2.4 | `should show empty state when no spaces exist` | Empty state   | 1. Teacher with no spaces views `/spaces` | Appropriate empty state UI                                    | P1       | NEW    |

### 12.3 404 & Route Errors

| #      | Test Name                                  | Description  | Steps                                               | Expected Behavior                 | Priority | Status |
| ------ | ------------------------------------------ | ------------ | --------------------------------------------------- | --------------------------------- | -------- | ------ |
| 12.3.1 | `should handle non-existent exam ID`       | 404 handling | 1. Navigate to `/exams/nonexistent-id`              | Not found state or error message  | P1       | EXISTS |
| 12.3.2 | `should handle non-existent space ID`      | 404 handling | 1. Navigate to `/spaces/nonexistent-id/edit`        | Not found state or error message  | P1       | NEW    |
| 12.3.3 | `should handle non-existent submission ID` | 404 handling | 1. Navigate to `/exams/:id/submissions/nonexistent` | Not found state or error message  | P2       | NEW    |
| 12.3.4 | `should handle unknown route`              | Catch-all    | 1. Navigate to `/unknown-page`                      | Redirect to dashboard or 404 page | P2       | NEW    |

---

## 13. Responsive & Mobile

### 13.1 Mobile Layout (320px–768px)

| #      | Test Name                                    | Description        | Steps                                 | Expected Behavior                             | Priority | Status |
| ------ | -------------------------------------------- | ------------------ | ------------------------------------- | --------------------------------------------- | -------- | ------ |
| 13.1.1 | `should collapse sidebar on mobile`          | Responsive sidebar | 1. Set viewport to 375×667            | Sidebar hidden, hamburger menu visible        | P1       | NEW    |
| 13.1.2 | `should open sidebar via hamburger menu`     | Mobile nav         | 1. Mobile viewport 2. Click hamburger | Sidebar opens as overlay                      | P1       | NEW    |
| 13.1.3 | `should close sidebar on nav click (mobile)` | Auto-close         | 1. Open sidebar 2. Click nav item     | Sidebar closes, page navigates                | P1       | NEW    |
| 13.1.4 | `should display login form on mobile`        | Mobile login       | 1. Mobile viewport 2. Go to `/login`  | Login form usable and properly styled         | P0       | NEW    |
| 13.1.5 | `should display dashboard on mobile`         | Mobile dashboard   | 1. Mobile viewport 2. Login           | Dashboard stats and sections stack vertically | P1       | NEW    |
| 13.1.6 | `should display spaces grid on mobile`       | Mobile grid        | 1. Mobile viewport 2. Go to `/spaces` | Single-column space card layout               | P2       | NEW    |

### 13.2 Tablet Layout (768px–1024px)

| #      | Test Name                                   | Description      | Steps                       | Expected Behavior                 | Priority | Status |
| ------ | ------------------------------------------- | ---------------- | --------------------------- | --------------------------------- | -------- | ------ |
| 13.2.1 | `should show 2-column space grid on tablet` | Responsive grid  | 1. Set viewport to 1024×768 | Spaces grid shows 2 columns       | P2       | NEW    |
| 13.2.2 | `should handle sidebar on tablet`           | Sidebar behavior | 1. Tablet viewport          | Sidebar collapsed or overlay mode | P2       | NEW    |

---

## 14. Accessibility

### 14.1 Keyboard Navigation

| #      | Test Name                                  | Description     | Steps                                                  | Expected Behavior                                                | Priority | Status |
| ------ | ------------------------------------------ | --------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | -------- | ------ |
| 14.1.1 | `should navigate login form with keyboard` | Tab order       | 1. Tab through login form                              | Focus moves: school code → continue → email → password → sign in | P1       | NEW    |
| 14.1.2 | `should navigate sidebar with keyboard`    | Keyboard nav    | 1. Tab to sidebar 2. Arrow key through items           | Focus moves between sidebar links                                | P2       | NEW    |
| 14.1.3 | `should open/close dialogs with keyboard`  | Dialog a11y     | 1. Tab to action button 2. Press Enter 3. Press Escape | Dialog opens on Enter, closes on Escape                          | P2       | NEW    |
| 14.1.4 | `should submit forms with Enter key`       | Form submission | 1. Fill login form 2. Press Enter                      | Form submits                                                     | P2       | NEW    |

### 14.2 Screen Reader Support

| #      | Test Name                                        | Description       | Steps                                                     | Expected Behavior                                    | Priority | Status |
| ------ | ------------------------------------------------ | ----------------- | --------------------------------------------------------- | ---------------------------------------------------- | -------- | ------ |
| 14.2.1 | `should have proper heading hierarchy`           | Semantic HTML     | 1. Scan page headings                                     | h1 → h2 → h3 in correct order, no skipped levels     | P2       | NEW    |
| 14.2.2 | `should have ARIA labels on icon-only buttons`   | ARIA labels       | 1. Check icon buttons (notification bell, sidebar toggle) | `aria-label` present on interactive elements         | P2       | NEW    |
| 14.2.3 | `should have form labels associated with inputs` | Label association | 1. Check login form, settings form                        | All inputs have associated `<label>` or `aria-label` | P2       | NEW    |

---

## Test Priority Summary

| Priority  | Count    | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| **P0**    | ~55      | Critical path — login, dashboard, core CRUD, navigation          |
| **P1**    | ~70      | High value — analytics, grading details, form validation, mobile |
| **P2**    | ~25      | Nice to have — accessibility, edge cases, breadcrumbs            |
| **Total** | **~150** | Full test scenarios                                              |

### Coverage by Status

| Status     | Count | Description                                  |
| ---------- | ----- | -------------------------------------------- |
| **EXISTS** | ~60   | Already implemented in `teacher-web.spec.ts` |
| **NEW**    | ~90   | To be implemented                            |

---

## Implementation Recommendations

### Phase 1 — Core CRUD (P0, NEW)

1. Space creation and editor basics (5.2, 5.3)
2. Exam creation end-to-end (6.2.6, 6.2.11)
3. Submission upload and listing (7.1)
4. Exam publish and result release (6.3.8, 6.3.9)
5. Session persistence (2.2.5)

### Phase 2 — Grading & Content (P0–P1, NEW)

1. Grading review page full workflow (7.2)
2. Space editor content tab — story points, items, DnD (5.4)
3. Space lifecycle — publish, unpublish, archive (5.6)
4. Dashboard navigation click-throughs (3.3)

### Phase 3 — Analytics & Polish (P1, NEW)

1. Space analytics page (9.3)
2. Class detail page with all tabs (9.4)
3. Sidebar analytics links (4.1.6–4.1.8)
4. Breadcrumb navigation (4.2)
5. Notification bell in header (11.1)

### Phase 4 — Responsive & Accessibility (P1–P2, NEW)

1. Mobile sidebar behavior (13.1)
2. Mobile layout for core pages (13.1.4–13.1.6)
3. Keyboard navigation (14.1)
4. ARIA labels and heading hierarchy (14.2)

### Phase 5 — Error States & Edge Cases (P1–P2, NEW)

1. Form validation edge cases (12.1)
2. Loading and empty states (12.2)
3. 404 handling for all entity types (12.3)
4. Route transitions and browser back (4.3)

---

## Test Data Requirements

| Data Type                         | Required For                  | Seeding Method                |
| --------------------------------- | ----------------------------- | ----------------------------- |
| Teacher user (Priya)              | All tests                     | Pre-seeded in Firebase        |
| School code (GRN001)              | Login tests                   | Pre-seeded tenant             |
| Spaces (draft + published)        | Space list, editor, analytics | Pre-seeded or created in test |
| Exams (all statuses)              | Exam list, detail, analytics  | Pre-seeded or created in test |
| Submissions (all pipeline stages) | Submissions, grading          | Pre-seeded                    |
| Students                          | Student list, class detail    | Pre-seeded                    |
| Classes with summaries            | Dashboard, class analytics    | Pre-seeded                    |
| Notifications                     | Notification tests            | Pre-seeded or triggered       |

---

## File Structure

```
tests/e2e/
├── teacher-web.spec.ts          # Main test file (extend existing)
├── helpers/
│   ├── auth.ts                  # Login helpers (existing)
│   └── selectors.ts             # Selectors & credentials (existing)
└── docs/
    └── teacher-web-playwright-analysis.md  # Existing analysis doc
```

All new tests should be added to the existing `teacher-web.spec.ts` file
following the established patterns (describe blocks, beforeEach login,
conditional assertions for data-dependent tests).
