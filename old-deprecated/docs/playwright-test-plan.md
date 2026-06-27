# Playwright E2E Test Plan — LevelUp Platform

> **Generated:** 2026-03-05 **Playwright Config:** `playwright.config.ts` (root)
> **Test Directory:** `tests/e2e/` **Existing Coverage:** Auth, navigation,
> dashboard, and page rendering for all 5 apps

---

## Table of Contents

1. [Test Infrastructure](#1-test-infrastructure)
2. [Student Web (port 4570)](#2-student-web-port-4570)
3. [Teacher Web (port 4569)](#3-teacher-web-port-4569)
4. [Parent Web (port 4571)](#4-parent-web-port-4571)
5. [Admin Web (port 4568)](#5-admin-web-port-4568)
6. [Super Admin (port 4567)](#6-super-admin-port-4567)
7. [Cross-App Integration Tests](#7-cross-app-integration-tests)

---

## 1. Test Infrastructure

### Existing Config (`playwright.config.ts`)

| Setting        | Value             |
| -------------- | ----------------- |
| testDir        | `./tests/e2e`     |
| fullyParallel  | `false`           |
| workers        | `1`               |
| timeout        | `60000ms`         |
| expect.timeout | `15000ms`         |
| retries (CI)   | `2`               |
| screenshot     | `only-on-failure` |
| video          | `on`              |
| trace          | `on-first-retry`  |

### Shared Helpers

| Helper                         | File              | Purpose                                             |
| ------------------------------ | ----------------- | --------------------------------------------------- |
| `loginDirect()`                | `helpers/auth.ts` | Email+password login (super-admin)                  |
| `loginWithSchoolCode()`        | `helpers/auth.ts` | Two-step school code login (admin, teacher, parent) |
| `loginStudentWithRollNumber()` | `helpers/auth.ts` | Student roll number login                           |
| `loginStudentWithEmail()`      | `helpers/auth.ts` | Student email login                                 |
| `loginConsumer()`              | `helpers/auth.ts` | B2C consumer login                                  |
| `logout()`                     | `helpers/auth.ts` | Sign out with dialog confirmation                   |
| `expectDashboard()`            | `helpers/auth.ts` | Assert dashboard heading                            |

### Test Credentials (`helpers/selectors.ts`)

| Role           | Email                        | Notes                 |
| -------------- | ---------------------------- | --------------------- |
| Super Admin    | `superadmin@levelup.app`     | Direct login          |
| Tenant Admin   | `admin@greenwood.edu`        | School code: `GRN001` |
| Teacher 1      | `priya.sharma@greenwood.edu` | School code: `GRN001` |
| Student 1      | `aarav.patel@greenwood.edu`  | School code: `GRN001` |
| Student (Roll) | Roll: `2025001`              | School code: `GRN001` |
| Parent 1       | `suresh.patel@gmail.com`     | School code: `GRN001` |
| Consumer       | `consumer@gmail.test`        | No school code        |

### Priority Definitions

| Priority | Meaning                                   | Test Frequency    |
| -------- | ----------------------------------------- | ----------------- |
| **P0**   | Critical path — app unusable if broken    | Every PR          |
| **P1**   | Core features — major user journey broken | Every PR          |
| **P2**   | Important but non-blocking — degraded UX  | Nightly / Release |
| **P3**   | Polish — visual, edge cases               | Release only      |

---

## 2. Student Web (port 4570)

**File:** `tests/e2e/student-web.spec.ts` **Existing coverage:** Auth (email,
roll number, consumer), navigation, dashboard, spaces, timed tests, practice
mode, results, leaderboard, store, checkout, consumer flows, notifications, chat
tutor

### 2.1 Authentication

| #         | Test Name                                          | Steps                                                                                                                    | Expected                                            | Priority | Status     |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------- | ---------- |
| S-AUTH-01 | Successful login with email                        | Navigate `/login` → Enter school code `GRN001` → Click Continue → Click Email tab → Enter email/password → Click Sign In | Redirects to dashboard, shows "Dashboard" heading   | P0       | **Exists** |
| S-AUTH-02 | Successful login with roll number                  | Navigate `/login` → Enter school code → Click Continue → Roll Number tab → Enter roll/password → Sign In                 | Redirects to dashboard                              | P0       | **Exists** |
| S-AUTH-03 | Invalid school code                                | Enter `XXXXX` → Click Continue                                                                                           | Error shown, stays on code step                     | P0       | **Exists** |
| S-AUTH-04 | Wrong password                                     | Enter valid school code → Enter valid email + wrong password → Sign In                                                   | Error message shown (destructive alert)             | P0       | **Exists** |
| S-AUTH-05 | Empty school code submission                       | Click Continue without entering code                                                                                     | Validation error, stays on step 1                   | P1       | **Exists** |
| S-AUTH-06 | Change button returns to school code step          | Enter school code → Continue → Click Change                                                                              | School code input visible again, email hidden       | P1       | **Exists** |
| S-AUTH-07 | Unauthenticated redirect                           | Navigate to `/` without login                                                                                            | Redirects to `/login`                               | P0       | **Exists** |
| S-AUTH-08 | Sign out                                           | Login → Click Sign Out → Confirm dialog                                                                                  | Redirects to `/login`                               | P0       | **Exists** |
| S-AUTH-09 | Consumer login with email                          | Navigate `/consumer` → Click "Don't have a school code" → Enter consumer email/password → Sign In                        | Shows "My Learning" heading                         | P0       | **Exists** |
| S-AUTH-10 | Consumer signup flow                               | Click "Don't have a school code" → Click Sign Up → Enter name, email, password → Create Account                          | Redirects to consumer dashboard                     | P1       | New        |
| S-AUTH-11 | Consumer Google sign-in button visible             | Navigate to consumer login                                                                                               | Google sign-in button is visible                    | P2       | New        |
| S-AUTH-12 | Session persistence — authenticated user on /login | Login → Navigate to /login                                                                                               | Redirects back to dashboard (already authenticated) | P2       | **Exists** |

### 2.2 B2B Student Dashboard

| #         | Test Name                       | Steps            | Expected                                                                    | Priority | Status     |
| --------- | ------------------------------- | ---------------- | --------------------------------------------------------------------------- | -------- | ---------- |
| S-DASH-01 | Dashboard heading visible       | Login as student | Shows "Dashboard" heading                                                   | P0       | **Exists** |
| S-DASH-02 | Summary stats cards render      | Login            | Shows Overall Score, Avg Exam Score, Space Completion, Current Streak cards | P0       | **Exists** |
| S-DASH-03 | Quick Stats section             | Login            | Shows Total Points, Exams Completed, At-Risk status                         | P1       | **Exists** |
| S-DASH-04 | My Spaces grid renders          | Login            | Shows up to 4 space cards with progress bars                                | P1       | **Exists** |
| S-DASH-05 | Recent Exam Results section     | Login            | Shows up to 3 recent exam results with scores                               | P1       | **Exists** |
| S-DASH-06 | Upcoming Exams section          | Login            | Shows scheduled exams or empty state                                        | P2       | **Exists** |
| S-DASH-07 | Strengths and Weaknesses badges | Login            | Displays strength/weakness subject badges                                   | P2       | **Exists** |
| S-DASH-08 | Recommendations section         | Login            | Shows personalized recommendations or empty state                           | P2       | **Exists** |
| S-DASH-09 | Sign Out button visible         | Login            | Sign Out button is present                                                  | P1       | **Exists** |

### 2.3 Navigation

| #        | Test Name               | Steps                      | Expected                                                  | Priority | Status     |
| -------- | ----------------------- | -------------------------- | --------------------------------------------------------- | -------- | ---------- |
| S-NAV-01 | Sidebar — My Spaces     | Click My Spaces in sidebar | Navigates to `/spaces`, shows "My Spaces" heading         | P0       | **Exists** |
| S-NAV-02 | Sidebar — Tests         | Click Tests                | Navigates to `/tests`, shows "Tests" heading              | P1       | **Exists** |
| S-NAV-03 | Sidebar — Results       | Click Results              | Navigates to `/results`, shows results page               | P0       | **Exists** |
| S-NAV-04 | Sidebar — Leaderboard   | Click Leaderboard          | Navigates to `/leaderboard`, shows "Leaderboard" heading  | P1       | **Exists** |
| S-NAV-05 | Sidebar — Chat Tutor    | Click Chat Tutor           | Navigates to `/chat`, shows Chat Tutor page               | P2       | **Exists** |
| S-NAV-06 | Sidebar — Notifications | Click Notifications bell   | Shows notification panel or navigates to `/notifications` | P1       | **Exists** |
| S-NAV-07 | Unknown route handling  | Navigate to `/nonexistent` | Shows 404 page or redirects to dashboard                  | P2       | **Exists** |

### 2.4 Spaces

| #        | Test Name                             | Steps                                    | Expected                                                               | Priority | Status     |
| -------- | ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- | -------- | ---------- |
| S-SPC-01 | Spaces list page renders              | Navigate to `/spaces`                    | Shows "My Spaces" heading, space cards visible                         | P0       | **Exists** |
| S-SPC-02 | Space card shows progress             | View spaces list                         | Each card shows title, subject, description, progress bar              | P1       | **Exists** |
| S-SPC-03 | Click space navigates to viewer       | Click on a space card                    | URL changes to `/spaces/{spaceId}`, space detail loads                 | P0       | **Exists** |
| S-SPC-04 | Space viewer shows story points       | Navigate to space detail                 | Story points listed with types (standard, test, practice)              | P0       | **Exists** |
| S-SPC-05 | Space overall progress bar            | View space detail                        | Overall progress bar visible in header                                 | P1       | **Exists** |
| S-SPC-06 | Empty spaces state                    | Login as student with no assigned spaces | Shows "No spaces" empty state                                          | P2       | New        |
| S-SPC-07 | Story point type icons                | View space detail                        | Correct icons for each type (BookOpen, Clock, ClipboardList, Dumbbell) | P2       | New        |
| S-SPC-08 | Click story point navigates correctly | Click a standard story point             | Navigates to `/spaces/{id}/story-points/{spId}`                        | P0       | **Exists** |

### 2.5 Story Point Viewer (Reading/Practice)

| #        | Test Name                      | Steps                                  | Expected                                      | Priority | Status     |
| -------- | ------------------------------ | -------------------------------------- | --------------------------------------------- | -------- | ---------- |
| S-SPV-01 | Story point page loads         | Navigate to story point                | Shows sidebar sections + main content         | P0       | **Exists** |
| S-SPV-02 | Section filtering works        | Click section filter button            | Content filters to selected section           | P1       | New        |
| S-SPV-03 | Material content displays      | Navigate to story point with materials | Educational content (text, images) rendered   | P0       | New        |
| S-SPV-04 | Question renders with answerer | Navigate to story point with questions | Question text and answer input visible        | P0       | **Exists** |
| S-SPV-05 | Submit answer — correct        | Answer question correctly → Submit     | Green feedback, checkmark, score shown        | P0       | New        |
| S-SPV-06 | Submit answer — incorrect      | Answer question incorrectly → Submit   | Red feedback, X icon, correct answer shown    | P0       | New        |
| S-SPV-07 | Show correct answers toggle    | Toggle "Show correct answers"          | Correct answers displayed/hidden              | P1       | New        |
| S-SPV-08 | Open Chat Tutor from question  | Click "Open Chat Tutor" on a question  | Chat panel slides open                        | P2       | New        |
| S-SPV-09 | Completion checkmarks persist  | Answer questions → Refresh page        | Previously answered questions show checkmarks | P1       | New        |

### 2.6 Timed Tests

| #         | Test Name                            | Steps                                      | Expected                                                           | Priority | Status     |
| --------- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ | -------- | ---------- |
| S-TEST-01 | Test landing page renders            | Navigate to timed test story point         | Shows title, instructions, duration, questions count, total points | P0       | **Exists** |
| S-TEST-02 | Start test                           | Click "Start Test"                         | Test view loads with timer, question navigator, first question     | P0       | **Exists** |
| S-TEST-03 | Timer countdown visible              | Start test                                 | Timer displays and counts down                                     | P0       | **Exists** |
| S-TEST-04 | Question navigator grid              | Start test                                 | Left sidebar shows numbered buttons for all questions              | P0       | **Exists** |
| S-TEST-05 | Answer and navigate next             | Select MCQ answer → Click "Save & Next"    | Answer saved, moves to next question, navigator updates color      | P0       | **Exists** |
| S-TEST-06 | Navigate with Previous/Next          | Click Previous and Next buttons            | Navigates between questions without losing answers                 | P0       | **Exists** |
| S-TEST-07 | Mark for review                      | Click flag icon / press M                  | Question marked in navigator, toggle works                         | P1       | **Exists** |
| S-TEST-08 | Clear response                       | Answer question → Click "Clear Response"   | Answer removed, navigator reverts to not_answered state            | P1       | **Exists** |
| S-TEST-09 | Submit test confirmation             | Click "Submit Test"                        | Confirmation dialog shows answered/marked/unanswered counts        | P0       | **Exists** |
| S-TEST-10 | Submit test and view results         | Confirm submission                         | Results view: score %, points, pass/fail, per-question breakdown   | P0       | **Exists** |
| S-TEST-11 | Previous attempts list               | View test landing with completed attempts  | Shows attempt #, date, score %, points for each attempt            | P1       | **Exists** |
| S-TEST-12 | Click attempt shows detailed results | Click on a previous attempt                | Shows detailed breakdown for that attempt                          | P1       | **Exists** |
| S-TEST-13 | Topic analysis on results            | Submit test → View results                 | Shows topic breakdown with correct/total per topic                 | P2       | **Exists** |
| S-TEST-14 | Keyboard shortcuts                   | During test, press ← → M                   | Previous, Next, Mark for Review work via keyboard                  | P2       | New        |
| S-TEST-15 | Auto-submit when time expires        | Wait for timer to reach 0 (use short test) | Test auto-submitted, results view shown                            | P1       | New        |

### 2.7 Practice Mode

| #         | Test Name                       | Steps                                       | Expected                                               | Priority | Status     |
| --------- | ------------------------------- | ------------------------------------------- | ------------------------------------------------------ | -------- | ---------- |
| S-PRAC-01 | Practice page renders           | Navigate to practice story point            | Shows Practice icon, title, solved count, progress bar | P0       | **Exists** |
| S-PRAC-02 | Difficulty filter buttons       | Click easy/medium/hard buttons              | Questions filtered by difficulty                       | P1       | **Exists** |
| S-PRAC-03 | Answer question in practice     | Select answer → Submit                      | Evaluation feedback shown (correct/incorrect)          | P0       | **Exists** |
| S-PRAC-04 | Question navigator color coding | Answer some questions correctly/incorrectly | Green = correct, Red = incorrect, Gray = not attempted | P1       | **Exists** |
| S-PRAC-05 | Navigate between questions      | Click Previous/Next                         | Moves between questions, preserves answers             | P0       | **Exists** |
| S-PRAC-06 | Click navigator number          | Click a specific question number            | Jumps to that question                                 | P1       | **Exists** |
| S-PRAC-07 | Unlimited retries               | Answer incorrectly → Try again              | Can re-answer the same question                        | P1       | New        |
| S-PRAC-08 | Progress persists after refresh | Answer questions → Refresh                  | Previous evaluations restored from RTDB                | P1       | New        |

### 2.8 Results / Progress Page

| #        | Test Name                          | Steps                  | Expected                                               | Priority | Status     |
| -------- | ---------------------------------- | ---------------------- | ------------------------------------------------------ | -------- | ---------- |
| S-RES-01 | Progress page renders tabs         | Navigate to `/results` | Shows Overall, Exams, Spaces tabs                      | P0       | **Exists** |
| S-RES-02 | Overall tab — score cards          | View Overall tab       | Shows Overall Score, Avg Exam Score, Space Completion  | P0       | **Exists** |
| S-RES-03 | Overall tab — subject breakdown    | View Overall tab       | Subject progress rings visible                         | P1       | **Exists** |
| S-RES-04 | Exams tab — table renders          | Click Exams tab        | Shows exam results table with name, score, percentage  | P0       | **Exists** |
| S-RES-05 | Exams tab — color coding           | View exam scores       | Green ≥70%, Yellow ≥40%, Red <40%                      | P2       | **Exists** |
| S-RES-06 | Spaces tab — progress cards        | Click Spaces tab       | Shows space progress cards with status badges and bars | P1       | **Exists** |
| S-RES-07 | Click exam row navigates to detail | Click on exam result   | Navigates to `/exams/{examId}/results`                 | P0       | **Exists** |

### 2.9 Exam Result Page

| #         | Test Name                   | Steps                                 | Expected                                             | Priority | Status     |
| --------- | --------------------------- | ------------------------------------- | ---------------------------------------------------- | -------- | ---------- |
| S-ERES-01 | Exam result page renders    | Navigate to `/exams/{examId}/results` | Shows score %, grade badge, total marks              | P0       | **Exists** |
| S-ERES-02 | Per-question breakdown      | View exam result                      | Questions listed with status icons, points, feedback | P0       | **Exists** |
| S-ERES-03 | Evaluation feedback details | Expand question                       | Shows comment, strengths, weaknesses lists           | P1       | **Exists** |
| S-ERES-04 | Download PDF button         | View exam result                      | Download PDF button visible and clickable            | P2       | **Exists** |
| S-ERES-05 | Grade badge color coding    | View score                            | A+/A green, B+/B blue, C+/C orange, D/F red          | P2       | New        |

### 2.10 Leaderboard

| #        | Test Name                | Steps                      | Expected                                               | Priority | Status     |
| -------- | ------------------------ | -------------------------- | ------------------------------------------------------ | -------- | ---------- |
| S-LDR-01 | Leaderboard page renders | Navigate to `/leaderboard` | Shows trophy icon, title, rankings table               | P1       | **Exists** |
| S-LDR-02 | Current user highlighted | View leaderboard           | Current user row has primary background, "(You)" label | P1       | **Exists** |
| S-LDR-03 | Top 3 rank icons         | View leaderboard           | Crown for #1, Medal for #2/#3                          | P2       | **Exists** |
| S-LDR-04 | Space filter dropdown    | Click space filter         | Shows Overall + space-specific options                 | P1       | **Exists** |
| S-LDR-05 | Filter by space          | Select a specific space    | Leaderboard updates to show space-specific rankings    | P1       | **Exists** |
| S-LDR-06 | User's rank badge        | View leaderboard           | Current user's rank shown in header badge              | P2       | **Exists** |

### 2.11 Tests Page

| #        | Test Name                         | Steps                          | Expected                                                        | Priority | Status     |
| -------- | --------------------------------- | ------------------------------ | --------------------------------------------------------------- | -------- | ---------- |
| S-TST-01 | Tests page renders                | Navigate to `/tests`           | Lists available timed tests grouped by space                    | P0       | **Exists** |
| S-TST-02 | Test card shows metadata          | View tests list                | Each card shows title, space, duration, questions, max attempts | P1       | **Exists** |
| S-TST-03 | Click test navigates to test page | Click a test card              | Navigates to `/spaces/{id}/test/{spId}`                         | P0       | **Exists** |
| S-TST-04 | Empty tests state                 | Login as student with no tests | Shows empty state                                               | P2       | New        |

### 2.12 B2C Consumer — Store & Checkout

| #          | Test Name                      | Steps                                            | Expected                                                 | Priority | Status     |
| ---------- | ------------------------------ | ------------------------------------------------ | -------------------------------------------------------- | -------- | ---------- |
| S-STORE-01 | Store page renders             | Login as consumer → Navigate to `/store`         | Shows store heading, search, space cards                 | P0       | **Exists** |
| S-STORE-02 | Search filters spaces          | Type in search box                               | Spaces filtered by title/description                     | P1       | **Exists** |
| S-STORE-03 | Subject filter                 | Select subject from dropdown                     | Spaces filtered by subject                               | P1       | **Exists** |
| S-STORE-04 | Add to cart                    | Click "Add to Cart" on a space                   | Cart count updates, button changes to "Remove from Cart" | P0       | **Exists** |
| S-STORE-05 | Remove from cart               | Click "Remove from Cart"                         | Cart count decrements, button reverts to "Add to Cart"   | P0       | **Exists** |
| S-STORE-06 | Enroll free space              | Click "Enroll Free" on free space                | Space enrolled, button changes to "Continue Learning"    | P0       | **Exists** |
| S-STORE-07 | Continue Learning navigates    | Click "Continue Learning"                        | Navigates to space viewer                                | P1       | **Exists** |
| S-STORE-08 | Store detail page              | Click space title                                | Navigates to `/store/{spaceId}`, shows hero section      | P1       | **Exists** |
| S-STORE-09 | Store detail — content preview | View store detail                                | Shows course content accordion with lessons              | P2       | **Exists** |
| S-STORE-10 | Checkout page renders          | Navigate to `/store/checkout` with items in cart | Shows cart items and order summary                       | P0       | **Exists** |
| S-STORE-11 | Remove item from checkout      | Click remove on cart item                        | Item removed, total updated                              | P1       | **Exists** |
| S-STORE-12 | Complete purchase              | Click "Enroll Now" / "Complete Purchase"         | Success screen with confetti, "Go to My Learning" button | P0       | **Exists** |
| S-STORE-13 | Empty cart state               | Navigate to checkout with empty cart             | Shows empty cart message                                 | P2       | New        |

### 2.13 B2C Consumer — Dashboard & Profile

| #          | Test Name                  | Steps                    | Expected                                                     | Priority | Status     |
| ---------- | -------------------------- | ------------------------ | ------------------------------------------------------------ | -------- | ---------- |
| S-CDASH-01 | Consumer dashboard renders | Login as consumer        | Shows "My Learning" heading, plan badge, enrolled spaces     | P0       | **Exists** |
| S-CDASH-02 | Enrolled spaces grid       | View consumer dashboard  | Shows enrolled space cards with thumbnails and progress      | P0       | **Exists** |
| S-CDASH-03 | Browse store CTA           | Dashboard with no spaces | Shows CTA to browse store                                    | P2       | **Exists** |
| S-CDASH-04 | Profile page renders       | Navigate to `/profile`   | Shows avatar, name, email, plan, enrolled count, total spent | P1       | **Exists** |
| S-CDASH-05 | Purchase history           | View profile             | Shows transaction list or empty state                        | P2       | **Exists** |
| S-CDASH-06 | Join School CTA            | View profile             | Shows link to login with school code                         | P2       | **Exists** |

### 2.14 Chat Tutor

| #         | Test Name               | Steps                                                  | Expected                                              | Priority | Status     |
| --------- | ----------------------- | ------------------------------------------------------ | ----------------------------------------------------- | -------- | ---------- |
| S-CHAT-01 | Chat tutor page renders | Navigate to `/chat`                                    | Shows Chat Tutor heading, session list or empty state | P1       | **Exists** |
| S-CHAT-02 | Empty sessions state    | No previous chat sessions                              | Shows "No chat sessions yet" message with bot icon    | P2       | **Exists** |
| S-CHAT-03 | Open chat from question | In practice mode → Click "Open Chat Tutor" on question | Chat panel slides in                                  | P2       | New        |

### 2.15 Notifications

| #          | Test Name                     | Steps                        | Expected                                         | Priority | Status     |
| ---------- | ----------------------------- | ---------------------------- | ------------------------------------------------ | -------- | ---------- |
| S-NOTIF-01 | Notifications page renders    | Navigate to `/notifications` | Shows Notifications heading with All/Unread tabs | P1       | **Exists** |
| S-NOTIF-02 | Notification bell shows count | View header                  | Bell icon shows unread count badge               | P1       | **Exists** |
| S-NOTIF-03 | Filter unread                 | Click Unread tab             | Shows only unread notifications                  | P2       | **Exists** |
| S-NOTIF-04 | Mark all read                 | Click "Mark all as read"     | All notifications marked as read, count resets   | P2       | New        |

---

## 3. Teacher Web (port 4569)

**File:** `tests/e2e/teacher-web.spec.ts` **Existing coverage:** Auth,
navigation, dashboard, spaces CRUD, exams CRUD, submissions, grading, students,
analytics, settings, notifications

### 3.1 Authentication

| #         | Test Name                                | Steps                                     | Expected                                               | Priority | Status     |
| --------- | ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------ | -------- | ---------- |
| T-AUTH-01 | Login page shows Teacher Portal heading  | Navigate to `/login`                      | Shows "Teacher Portal" h1                              | P0       | **Exists** |
| T-AUTH-02 | School code step renders                 | View login page                           | School code input and Continue button visible          | P0       | **Exists** |
| T-AUTH-03 | Valid school code shows school name      | Enter `GRN001` → Continue                 | School name "Greenwood International School" displayed | P0       | **Exists** |
| T-AUTH-04 | Invalid school code error                | Enter `XXXXX` → Continue                  | Error shown, stays on code step                        | P0       | **Exists** |
| T-AUTH-05 | Successful login                         | Enter valid school code + credentials     | Redirects to dashboard, shows "Teacher Dashboard"      | P0       | **Exists** |
| T-AUTH-06 | Wrong password error                     | Enter valid code + wrong password         | Destructive error shown                                | P0       | **Exists** |
| T-AUTH-07 | Sign out                                 | Login → Sign Out → Confirm                | Redirects to `/login`                                  | P0       | **Exists** |
| T-AUTH-08 | Multi-org teacher — org switcher visible | Login as multi-org teacher                | Org switcher component visible in sidebar              | P1       | **Exists** |
| T-AUTH-09 | Org switcher changes tenant              | Click org switcher → Select different org | Tenant switches, dashboard data reloads                | P1       | **Exists** |
| T-AUTH-10 | Unauthenticated redirect                 | Navigate to `/` without login             | Redirects to `/login`                                  | P0       | **Exists** |

### 3.2 Dashboard

| #         | Test Name                 | Steps             | Expected                                                           | Priority | Status     |
| --------- | ------------------------- | ----------------- | ------------------------------------------------------------------ | -------- | ---------- |
| T-DASH-01 | Dashboard heading visible | Login             | Shows "Teacher Dashboard" heading                                  | P0       | **Exists** |
| T-DASH-02 | Summary stat cards        | View dashboard    | Shows Total Students, Active Exams, Total Spaces, At-Risk Students | P0       | **Exists** |
| T-DASH-03 | Class performance chart   | View dashboard    | Bar chart section visible                                          | P1       | **Exists** |
| T-DASH-04 | At-Risk students card     | View dashboard    | Shows count of at-risk students                                    | P1       | **Exists** |
| T-DASH-05 | Recent Spaces section     | View dashboard    | Shows up to 5 recent spaces                                        | P1       | **Exists** |
| T-DASH-06 | Recent Exams section      | View dashboard    | Shows up to 5 recent exams                                         | P1       | **Exists** |
| T-DASH-07 | Grading Queue section     | View dashboard    | Shows submissions ready for review                                 | P1       | **Exists** |
| T-DASH-08 | Quick actions — New Space | Click "New Space" | Creates space and redirects to editor                              | P1       | **Exists** |
| T-DASH-09 | Quick actions — New Exam  | Click "New Exam"  | Navigates to `/exams/new`                                          | P1       | **Exists** |

### 3.3 Navigation

| #        | Test Name                   | Steps                  | Expected                          | Priority | Status     |
| -------- | --------------------------- | ---------------------- | --------------------------------- | -------- | ---------- |
| T-NAV-01 | Sidebar — Spaces            | Click Spaces           | Navigates to `/spaces`            | P0       | **Exists** |
| T-NAV-02 | Sidebar — Exams             | Click Exams            | Navigates to `/exams`             | P0       | **Exists** |
| T-NAV-03 | Sidebar — Students          | Click Students         | Navigates to `/students`          | P1       | **Exists** |
| T-NAV-04 | Sidebar — Class Analytics   | Click Class Analytics  | Navigates to `/analytics/classes` | P1       | **Exists** |
| T-NAV-05 | Sidebar — Exam Analytics    | Click Exam Analytics   | Navigates to `/analytics/exams`   | P1       | **Exists** |
| T-NAV-06 | Sidebar — Space Analytics   | Click Space Analytics  | Navigates to `/analytics/spaces`  | P1       | **Exists** |
| T-NAV-07 | Sidebar — Settings          | Click Settings         | Navigates to `/settings`          | P1       | **Exists** |
| T-NAV-08 | Active sidebar highlighting | Navigate to each route | Correct sidebar item highlighted  | P2       | **Exists** |

### 3.4 Spaces Management

| #        | Test Name                    | Steps                  | Expected                                                          | Priority | Status     |
| -------- | ---------------------------- | ---------------------- | ----------------------------------------------------------------- | -------- | ---------- |
| T-SPC-01 | Spaces list page renders     | Navigate to `/spaces`  | Shows search, status tabs, space grid                             | P0       | **Exists** |
| T-SPC-02 | Create new space             | Click "New Space"      | Cloud function called, redirects to space editor                  | P0       | **Exists** |
| T-SPC-03 | Search spaces                | Type in search box     | Spaces filtered by title                                          | P1       | **Exists** |
| T-SPC-04 | Filter by status — Draft     | Click "Draft" tab      | Only draft spaces shown                                           | P1       | **Exists** |
| T-SPC-05 | Filter by status — Published | Click "Published" tab  | Only published spaces shown                                       | P1       | **Exists** |
| T-SPC-06 | Space card content           | View space card        | Shows title, type badge, subject, story points count, items count | P1       | **Exists** |
| T-SPC-07 | Click space opens editor     | Click on a space card  | Navigates to `/spaces/{id}/edit`                                  | P0       | **Exists** |
| T-SPC-08 | Empty spaces state           | Account with no spaces | Shows empty state with create button                              | P2       | New        |

### 3.5 Space Editor

| #         | Test Name                                    | Steps                                                        | Expected                                       | Priority | Status     |
| --------- | -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- | -------- | ---------- |
| T-SPED-01 | Editor loads with 4 tabs                     | Open space editor                                            | Settings, Content, Rubric, Agents tabs visible | P0       | **Exists** |
| T-SPED-02 | Settings tab — edit title                    | Type new title                                               | Title field updates                            | P0       | **Exists** |
| T-SPED-03 | Settings tab — change type                   | Select different type (learning/practice/assessment)         | Type updates                                   | P1       | **Exists** |
| T-SPED-04 | Settings tab — set subject                   | Enter subject                                                | Subject field updates                          | P1       | **Exists** |
| T-SPED-05 | Settings tab — access type                   | Change access type (class_assigned/tenant_wide/public_store) | Access type updates                            | P1       | New        |
| T-SPED-06 | Settings tab — time limit                    | Set time limit minutes                                       | Field updates                                  | P2       | New        |
| T-SPED-07 | Content tab — add story point                | Click "Add Story Point"                                      | New story point created and listed             | P0       | **Exists** |
| T-SPED-08 | Content tab — edit story point title         | Click edit on story point → Change title → Save              | Title updated                                  | P0       | **Exists** |
| T-SPED-09 | Content tab — delete story point             | Click delete → Confirm                                       | Story point removed from list                  | P1       | **Exists** |
| T-SPED-10 | Content tab — drag-drop reorder story points | Drag story point to new position                             | Order updates, orderIndex persisted            | P1       | New        |
| T-SPED-11 | Content tab — add item to story point        | Expand story point → Click "Add Item"                        | Item creation form opens                       | P0       | **Exists** |
| T-SPED-12 | Content tab — add MCQ question               | Create MCQ with options and correct answer                   | Question saved and listed                      | P0       | **Exists** |
| T-SPED-13 | Content tab — add material                   | Create material (text/video/link)                            | Material saved and listed                      | P1       | New        |
| T-SPED-14 | Content tab — edit item                      | Click edit on item → Modify → Save                           | Item updated                                   | P1       | **Exists** |
| T-SPED-15 | Content tab — delete item                    | Click delete → Confirm                                       | Item removed                                   | P1       | **Exists** |
| T-SPED-16 | Content tab — drag-drop reorder items        | Drag item within story point                                 | Order updates                                  | P2       | New        |
| T-SPED-17 | Rubric tab renders                           | Click Rubric tab                                             | Shows scoring mode options                     | P1       | **Exists** |
| T-SPED-18 | Publish space                                | Click Publish → Confirm                                      | Status changes to published, toast shown       | P0       | **Exists** |
| T-SPED-19 | Archive space                                | Click Archive → Confirm                                      | Status changes to archived                     | P1       | New        |

### 3.6 Exams Management

| #        | Test Name                        | Steps                                                            | Expected                                                      | Priority | Status     |
| -------- | -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- | -------- | ---------- |
| T-EXM-01 | Exams list page renders          | Navigate to `/exams`                                             | Shows search, status tabs, exam list                          | P0       | **Exists** |
| T-EXM-02 | Create exam — Step 1 Metadata    | Click "New Exam" → Enter title, subject, topics, marks, duration | Metadata form validates and enables Next                      | P0       | **Exists** |
| T-EXM-03 | Create exam — Step 2 Upload      | Click Next → Upload question paper image                         | File uploaded, preview shown                                  | P0       | **Exists** |
| T-EXM-04 | Create exam — Step 2 Skip upload | Click Skip                                                       | Moves to review step without upload                           | P1       | **Exists** |
| T-EXM-05 | Create exam — Step 3 Review      | View review step                                                 | All metadata displayed for confirmation                       | P0       | **Exists** |
| T-EXM-06 | Create exam — Step 4 Publish     | Confirm and create                                               | Exam created, redirects to exam detail                        | P0       | **Exists** |
| T-EXM-07 | Exam detail page renders         | Navigate to `/exams/{examId}`                                    | Shows exam details with Overview, Questions, Submissions tabs | P0       | **Exists** |
| T-EXM-08 | Publish exam                     | Click Publish on draft exam                                      | Status changes to published                                   | P0       | **Exists** |
| T-EXM-09 | Filter exams by status           | Click status tabs (Draft/Published/Grading/Completed)            | List filters correctly                                        | P1       | **Exists** |
| T-EXM-10 | Search exams                     | Type in search box                                               | Exams filtered by title                                       | P1       | **Exists** |
| T-EXM-11 | Exam metadata validation         | Submit exam form with missing required fields                    | Validation errors shown                                       | P1       | **Exists** |
| T-EXM-12 | Edit question rubric             | Click Questions tab → Edit rubric on a question                  | Rubric editor opens                                           | P1       | New        |
| T-EXM-13 | Link exam to space               | Click "Link to Space" → Select space                             | Exam linked to space                                          | P2       | New        |

### 3.7 Submissions & Grading

| #        | Test Name                     | Steps                                                   | Expected                                                  | Priority | Status     |
| -------- | ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| T-SUB-01 | Submissions page renders      | Navigate to exam → Submissions tab                      | Shows submission list or upload button                    | P0       | **Exists** |
| T-SUB-02 | Upload answer sheets dialog   | Click "Upload Answer Sheets"                            | Dialog with student name, roll number, class, file upload | P0       | **Exists** |
| T-SUB-03 | Upload answer sheet with file | Fill student info + drag-drop file → Upload             | Submission created with "uploaded" status                 | P0       | **Exists** |
| T-SUB-04 | Pipeline status display       | View submission list                                    | Status icons/colors for each pipeline stage               | P1       | **Exists** |
| T-SUB-05 | Navigate to grading review    | Click on "ready_for_review" submission                  | Navigates to grading review page                          | P0       | **Exists** |
| T-SUB-06 | Grading review page renders   | View grading review                                     | Shows student info, questions with auto-graded scores     | P0       | **Exists** |
| T-SUB-07 | Expand question for details   | Click on question                                       | Shows detailed grading feedback                           | P1       | **Exists** |
| T-SUB-08 | Manual override score         | Click override → Enter new score (+ reason if required) | Score updated                                             | P0       | **Exists** |
| T-SUB-09 | Save all overrides            | Click "Save" after making overrides                     | All overrides persisted                                   | P0       | **Exists** |
| T-SUB-10 | Navigate between submissions  | Click Next/Previous                                     | Moves to adjacent submission                              | P1       | **Exists** |
| T-SUB-11 | Release exam results          | Click "Release Results" on graded exam                  | Status changes to results_released                        | P0       | **Exists** |
| T-SUB-12 | Drag-drop file upload         | Drag file onto upload area                              | File accepted and previewed                               | P2       | New        |

### 3.8 Students Page

| #        | Test Name             | Steps                   | Expected                                                    | Priority | Status     |
| -------- | --------------------- | ----------------------- | ----------------------------------------------------------- | -------- | ---------- |
| T-STU-01 | Students page renders | Navigate to `/students` | Shows student table with search                             | P0       | **Exists** |
| T-STU-02 | Table columns         | View student table      | Shows Name, Roll Number, Grade, Section, Status columns     | P1       | **Exists** |
| T-STU-03 | Search students       | Type in search box      | Students filtered by name, roll number, or admission number | P1       | **Exists** |
| T-STU-04 | Empty state           | No students assigned    | Shows empty state message                                   | P2       | **Exists** |

### 3.9 Analytics

| #        | Test Name                      | Steps                            | Expected                                             | Priority | Status     |
| -------- | ------------------------------ | -------------------------------- | ---------------------------------------------------- | -------- | ---------- |
| T-ANA-01 | Class analytics page renders   | Navigate to `/analytics/classes` | Shows class dropdown, overview cards                 | P1       | **Exists** |
| T-ANA-02 | Select class shows data        | Select a class from dropdown     | Performance data loads for selected class            | P1       | **Exists** |
| T-ANA-03 | Exam analytics page renders    | Navigate to `/analytics/exams`   | Shows exam dropdown selector                         | P1       | **Exists** |
| T-ANA-04 | Select exam shows distribution | Select exam                      | Score distribution chart and question analysis shown | P1       | **Exists** |
| T-ANA-05 | Space analytics page renders   | Navigate to `/analytics/spaces`  | Shows space analytics data                           | P2       | **Exists** |
| T-ANA-06 | Analytics empty state          | No data available                | Shows appropriate empty state                        | P2       | New        |

### 3.10 Settings

| #        | Test Name                      | Steps                             | Expected                  | Priority | Status     |
| -------- | ------------------------------ | --------------------------------- | ------------------------- | -------- | ---------- |
| T-SET-01 | Settings page renders          | Navigate to `/settings`           | Shows evaluation settings | P1       | **Exists** |
| T-SET-02 | Toggle auto-grade              | Toggle Auto Grade switch          | State changes             | P1       | **Exists** |
| T-SET-03 | Toggle require override reason | Toggle switch                     | State changes             | P2       | **Exists** |
| T-SET-04 | Toggle auto-release results    | Toggle switch                     | State changes             | P2       | **Exists** |
| T-SET-05 | Change AI strictness           | Select different strictness level | Dropdown updates          | P2       | **Exists** |

---

## 4. Parent Web (port 4571)

**File:** `tests/e2e/parent-web.spec.ts` **Existing coverage:** Auth, dashboard,
children, child-progress, exam results, space progress, notifications, settings,
navigation, session

### 4.1 Authentication

| #         | Test Name                           | Steps                                                | Expected                               | Priority | Status     |
| --------- | ----------------------------------- | ---------------------------------------------------- | -------------------------------------- | -------- | ---------- |
| P-AUTH-01 | Redirects unauthenticated to /login | Navigate to `/`                                      | Redirects to `/login`                  | P0       | **Exists** |
| P-AUTH-02 | Protected routes redirect           | Navigate to `/children`, `/results`, `/progress` etc | All redirect to `/login`               | P0       | **Exists** |
| P-AUTH-03 | Login page renders Parent Portal    | View login page                                      | Shows "Parent Portal" heading          | P0       | **Exists** |
| P-AUTH-04 | School code shows school name       | Enter `GRN001` → Continue                            | Shows "Greenwood International School" | P0       | **Exists** |
| P-AUTH-05 | Invalid school code error           | Enter `INVALID999` → Continue                        | Error shown                            | P0       | **Exists** |
| P-AUTH-06 | Empty school code validation        | Click Continue without input                         | Validation prevents submission         | P1       | **Exists** |
| P-AUTH-07 | Change button returns to code step  | Enter code → Continue → Change                       | Back to school code input              | P1       | **Exists** |
| P-AUTH-08 | Successful login                    | Enter valid credentials                              | Navigates to dashboard                 | P0       | **Exists** |
| P-AUTH-09 | Wrong password error                | Enter wrong password                                 | Error shown                            | P0       | **Exists** |
| P-AUTH-10 | Sign out                            | Login → Sign Out → Confirm                           | Redirects to `/login`                  | P0       | **Exists** |

### 4.2 Dashboard

| #         | Test Name                     | Steps                       | Expected                                                | Priority | Status     |
| --------- | ----------------------------- | --------------------------- | ------------------------------------------------------- | -------- | ---------- |
| P-DASH-01 | Dashboard heading             | Login                       | Shows "Parent Dashboard" heading                        | P0       | **Exists** |
| P-DASH-02 | Welcome message               | View dashboard              | "Welcome back" text with user name                      | P1       | **Exists** |
| P-DASH-03 | Overview score cards          | View dashboard              | Children count, Avg Performance, School, At-Risk/Status | P0       | **Exists** |
| P-DASH-04 | Quick action — Exam Results   | Click "Exam Results" link   | Navigates to `/results`                                 | P0       | **Exists** |
| P-DASH-05 | Quick action — Space Progress | Click "Space Progress" link | Navigates to `/progress`                                | P0       | **Exists** |
| P-DASH-06 | Quick action — My Children    | Click "My Children" link    | Navigates to `/children`                                | P0       | **Exists** |
| P-DASH-07 | Children Overview section     | View dashboard              | Shows children cards or empty state                     | P0       | **Exists** |
| P-DASH-08 | View all link                 | Click "View all"            | Navigates to `/children`                                | P1       | **Exists** |

### 4.3 Children Page

| #         | Test Name                      | Steps                              | Expected                                                  | Priority | Status     |
| --------- | ------------------------------ | ---------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| P-CHLD-01 | Page heading and description   | Navigate to `/children`            | "My Children" heading, description text                   | P0       | **Exists** |
| P-CHLD-02 | Children list or empty state   | View page after loading            | Shows child cards or "No children linked"                 | P0       | **Exists** |
| P-CHLD-03 | Child card — performance stats | View child card                    | Shows Exam Average, Space Completion, Streak, School Code | P1       | **Exists** |
| P-CHLD-04 | View Full Progress link        | Click "View Full Progress"         | Navigates to `/child-progress`                            | P0       | **Exists** |
| P-CHLD-05 | Exam Results link              | Click "Exam Results" on child card | Navigates to `/results`                                   | P1       | **Exists** |
| P-CHLD-06 | Empty state admin contact      | No linked children                 | Shows "Contact your school admin" message                 | P2       | **Exists** |

### 4.4 Child Progress Page

| #         | Test Name                    | Steps                         | Expected                                                      | Priority | Status     |
| --------- | ---------------------------- | ----------------------------- | ------------------------------------------------------------- | -------- | ---------- |
| P-PROG-01 | Page heading                 | Navigate to `/child-progress` | Shows "Child Progress" heading                                | P0       | **Exists** |
| P-PROG-02 | Overview stats               | View with data                | Overall Score, Exam Average, Space Completion, Streak, Points | P0       | **Exists** |
| P-PROG-03 | Child selector (multi-child) | Multiple linked children      | Button group for switching children                           | P1       | **Exists** |
| P-PROG-04 | Switch child updates data    | Click different child button  | Data reloads for selected child                               | P1       | **Exists** |
| P-PROG-05 | At-risk alert                | View at-risk child            | Red alert with reasons                                        | P1       | **Exists** |
| P-PROG-06 | Strengths and weaknesses     | View child with data          | Green strength badges, orange weakness badges                 | P2       | **Exists** |
| P-PROG-07 | Subject breakdown charts     | View page                     | Exam Scores by Subject and Space Completion by Subject charts | P2       | **Exists** |
| P-PROG-08 | Recent Exam Results          | View page                     | Exam list with progress bars                                  | P1       | **Exists** |
| P-PROG-09 | Recent Activity              | View page                     | Space activity list                                           | P2       | **Exists** |
| P-PROG-10 | Empty state                  | No linked children            | Shows empty state message                                     | P2       | **Exists** |

### 4.5 Exam Results Page

| #         | Test Name                     | Steps                       | Expected                                                     | Priority | Status     |
| --------- | ----------------------------- | --------------------------- | ------------------------------------------------------------ | -------- | ---------- |
| P-ERES-01 | Page heading                  | Navigate to `/results`      | Shows "Exam Results" heading                                 | P0       | **Exists** |
| P-ERES-02 | Search input functional       | Type in search              | Filters results by student/exam/subject                      | P1       | **Exists** |
| P-ERES-03 | Results list or empty state   | View page                   | Shows result cards or "No results available"                 | P0       | **Exists** |
| P-ERES-04 | Accordion expand              | Click expand on result card | Shows Grade, Questions Graded, Status, per-question feedback | P0       | **Exists** |
| P-ERES-05 | Accordion collapse            | Click again                 | Details hidden                                               | P1       | **Exists** |
| P-ERES-06 | Score percentage color coding | View results                | Green ≥70%, Yellow ≥40%, Red <40%                            | P2       | **Exists** |
| P-ERES-07 | Download PDF button           | Expand result               | Download PDF button visible                                  | P2       | **Exists** |
| P-ERES-08 | Per-question rubric breakdown | Expand with feedback        | Shows rubric criteria and points                             | P2       | **Exists** |
| P-ERES-09 | Improvement recommendations   | Low-scoring result          | Shows recommendations when score < 70%                       | P2       | New        |
| P-ERES-10 | Search filters results        | Type nonexistent term       | Shows empty/filtered results                                 | P1       | **Exists** |

### 4.6 Space Progress Page

| #         | Test Name                    | Steps                   | Expected                                      | Priority | Status     |
| --------- | ---------------------------- | ----------------------- | --------------------------------------------- | -------- | ---------- |
| P-SPPR-01 | Page heading                 | Navigate to `/progress` | Shows "Space Progress" heading                | P0       | **Exists** |
| P-SPPR-02 | Progress data or empty state | View page               | Shows space cards or "No progress data yet"   | P0       | **Exists** |
| P-SPPR-03 | Progress card — percentage   | View card with data     | Large percentage display                      | P1       | **Exists** |
| P-SPPR-04 | Progress card — status badge | View card               | Shows not_started/in_progress/completed badge | P1       | **Exists** |
| P-SPPR-05 | Progress bar colors          | View cards              | Blue for in_progress, Green for completed     | P2       | **Exists** |
| P-SPPR-06 | Student section heading      | Multiple children       | Shows student name as section heading         | P1       | **Exists** |
| P-SPPR-07 | Story points summary         | View card               | Shows X/Y story points completed              | P2       | **Exists** |

### 4.7 Notifications

| #          | Test Name            | Steps                        | Expected                              | Priority | Status     |
| ---------- | -------------------- | ---------------------------- | ------------------------------------- | -------- | ---------- |
| P-NOTIF-01 | Page renders         | Navigate to `/notifications` | Shows heading with All/Unread filters | P1       | **Exists** |
| P-NOTIF-02 | Filter by Unread     | Click Unread tab             | Shows only unread notifications       | P1       | **Exists** |
| P-NOTIF-03 | Switch back to All   | Click All after Unread       | Shows all notifications               | P2       | **Exists** |
| P-NOTIF-04 | Mark All Read button | Notifications present        | Button visible and clickable          | P2       | **Exists** |

### 4.8 Settings

| #        | Test Name                          | Steps                             | Expected                                                    | Priority | Status     |
| -------- | ---------------------------------- | --------------------------------- | ----------------------------------------------------------- | -------- | ---------- |
| P-SET-01 | Page heading                       | Navigate to `/settings`           | Shows "Settings" heading                                    | P0       | **Exists** |
| P-SET-02 | Profile section — read-only fields | View profile                      | Display Name and Email shown (read-only)                    | P1       | **Exists** |
| P-SET-03 | Contact admin message              | View profile                      | "Contact your school admin" text visible                    | P2       | **Exists** |
| P-SET-04 | Notification channels              | View preferences                  | Email and Push notification toggles                         | P1       | **Exists** |
| P-SET-05 | Notification types                 | View preferences                  | Exam Results, Progress Milestones, Teacher Messages toggles | P1       | **Exists** |
| P-SET-06 | Toggle interactivity               | Toggle a notification switch      | State changes (aria-checked toggles)                        | P1       | **Exists** |
| P-SET-07 | Save button appears on change      | Toggle a switch                   | "Save Changes" button appears                               | P1       | New        |
| P-SET-08 | Sign out from settings             | Click Sign Out in Account section | Logs out and redirects                                      | P1       | **Exists** |

### 4.9 Navigation

| #        | Test Name                   | Steps                      | Expected                       | Priority | Status     |
| -------- | --------------------------- | -------------------------- | ------------------------------ | -------- | ---------- |
| P-NAV-01 | Navigate to /children       | Direct URL                 | Shows "My Children" heading    | P0       | **Exists** |
| P-NAV-02 | Navigate to /child-progress | Direct URL                 | Shows "Child Progress" heading | P0       | **Exists** |
| P-NAV-03 | Navigate to /results        | Direct URL                 | Shows "Exam Results" heading   | P0       | **Exists** |
| P-NAV-04 | Navigate to /progress       | Direct URL                 | Shows "Space Progress" heading | P0       | **Exists** |
| P-NAV-05 | Navigate to /notifications  | Direct URL                 | Shows notifications page       | P1       | **Exists** |
| P-NAV-06 | Navigate to /settings       | Direct URL                 | Shows "Settings" heading       | P1       | **Exists** |
| P-NAV-07 | Unknown route handling      | Navigate to `/nonexistent` | 404 or redirect to dashboard   | P2       | **Exists** |

---

## 5. Admin Web (port 4568)

**File:** `tests/e2e/admin-web.spec.ts` **Existing coverage:** Auth, dashboard,
navigation (all 11 routes), users CRUD, classes, courses, spaces, exams,
analytics, AI usage, academic sessions, reports, notifications, settings

### 5.1 Authentication

| #         | Test Name                           | Steps                              | Expected                            | Priority | Status     |
| --------- | ----------------------------------- | ---------------------------------- | ----------------------------------- | -------- | ---------- |
| A-AUTH-01 | Redirects unauthenticated to /login | Navigate to `/`                    | Redirects to `/login`               | P0       | **Exists** |
| A-AUTH-02 | School code step renders            | View login page                    | School code input + Continue button | P0       | **Exists** |
| A-AUTH-03 | School code shows school name       | Enter `GRN001` → Continue          | Shows school name                   | P0       | **Exists** |
| A-AUTH-04 | Invalid school code error           | Enter `XXXXX` → Continue           | Error shown, stays on code step     | P0       | **Exists** |
| A-AUTH-05 | Credentials step appears            | Valid school code → Continue       | Email + password fields appear      | P0       | **Exists** |
| A-AUTH-06 | Change button                       | On credentials step → Click Change | Returns to school code step         | P1       | **Exists** |
| A-AUTH-07 | Wrong password error                | Enter wrong password → Sign In     | Error shown                         | P0       | **Exists** |
| A-AUTH-08 | Successful login                    | Valid credentials → Sign In        | Shows "School Admin Dashboard"      | P0       | **Exists** |
| A-AUTH-09 | Sign out                            | Login → Sign Out → Confirm         | Redirects to `/login`               | P0       | **Exists** |

### 5.2 Dashboard

| #         | Test Name                      | Steps                   | Expected                                                                             | Priority | Status     |
| --------- | ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------ | -------- | ---------- |
| A-DASH-01 | Heading visible                | Login                   | Shows "School Admin Dashboard"                                                       | P0       | **Exists** |
| A-DASH-02 | Score cards render             | View dashboard          | Total Students, Total Teachers, Classes, Total Spaces, Total Exams, At-Risk Students | P0       | **Exists** |
| A-DASH-03 | Tenant Info section            | View dashboard          | Shows Tenant Info with Tenant Code                                                   | P1       | **Exists** |
| A-DASH-04 | AI Cost Summary                | View dashboard          | Shows AI Cost Summary with Today's Spend                                             | P1       | **Exists** |
| A-DASH-05 | No org switcher for single org | Single-membership admin | "Select org" not visible                                                             | P2       | **Exists** |

### 5.3 Navigation

| #        | Test Name                    | Steps                            | Expected                           | Priority | Status     |
| -------- | ---------------------------- | -------------------------------- | ---------------------------------- | -------- | ---------- |
| A-NAV-01 | Users → User Management      | Navigate to `/users`             | Shows "User Management" heading    | P0       | **Exists** |
| A-NAV-02 | Classes → Classes & Sections | Navigate to `/classes`           | Shows "Classes & Sections" heading | P0       | **Exists** |
| A-NAV-03 | Courses → Courses & Spaces   | Navigate to `/courses`           | Shows "Courses & Spaces" heading   | P0       | **Exists** |
| A-NAV-04 | Spaces → Spaces Overview     | Navigate to `/spaces`            | Shows "Spaces Overview" heading    | P0       | **Exists** |
| A-NAV-05 | Exams → Exams Overview       | Navigate to `/exams`             | Shows "Exams Overview" heading     | P0       | **Exists** |
| A-NAV-06 | Analytics → Analytics        | Navigate to `/analytics`         | Shows "Analytics" heading          | P0       | **Exists** |
| A-NAV-07 | AI Usage → AI Usage & Costs  | Navigate to `/ai-usage`          | Shows "AI Usage & Costs" heading   | P1       | **Exists** |
| A-NAV-08 | Academic Sessions            | Navigate to `/academic-sessions` | Shows "Academic Sessions" heading  | P1       | **Exists** |
| A-NAV-09 | Reports                      | Navigate to `/reports`           | Shows "Reports" heading            | P1       | **Exists** |
| A-NAV-10 | Notifications                | Navigate to `/notifications`     | Shows "Notifications" heading      | P1       | **Exists** |
| A-NAV-11 | Settings                     | Navigate to `/settings`          | Shows "Settings" heading           | P1       | **Exists** |

### 5.4 Users Management

| #        | Test Name                                      | Steps                                                 | Expected                                        | Priority | Status     |
| -------- | ---------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- | -------- | ---------- |
| A-USR-01 | Teachers tab visible                           | Navigate to `/users`                                  | Teachers tab active by default                  | P0       | **Exists** |
| A-USR-02 | Students tab                                   | Click Students tab                                    | Tab switches, shows student columns             | P0       | **Exists** |
| A-USR-03 | Parents tab                                    | Click Parents tab                                     | Tab switches, shows parent columns              | P0       | **Exists** |
| A-USR-04 | Search input                                   | View Users page                                       | Search input visible                            | P1       | **Exists** |
| A-USR-05 | Add Teacher button                             | Teachers tab                                          | "Add Teacher" button visible                    | P0       | **Exists** |
| A-USR-06 | Add Teacher dialog opens                       | Click "Add Teacher"                                   | Dialog with First Name, Last Name, Email fields | P0       | **Exists** |
| A-USR-07 | Create button disabled without required fields | Open dialog without filling                           | Create button disabled                          | P1       | **Exists** |
| A-USR-08 | Cancel dialog                                  | Open dialog → Click Cancel                            | Dialog closes                                   | P1       | **Exists** |
| A-USR-09 | Teachers table columns                         | View teachers table                                   | Name, Subjects, Status columns                  | P1       | **Exists** |
| A-USR-10 | Students table columns                         | Click Students tab                                    | Roll Number, Grade columns                      | P1       | **Exists** |
| A-USR-11 | Add Student button + dialog                    | Students tab → "Add Student"                          | Dialog opens with Roll Number field             | P0       | **Exists** |
| A-USR-12 | Bulk Import button                             | Students tab                                          | "Bulk Import" button visible                    | P1       | **Exists** |
| A-USR-13 | Add Parent button                              | Parents tab                                           | "Add Parent" button visible                     | P1       | **Exists** |
| A-USR-14 | Parents table — Linked Children column         | View parents table                                    | "Linked Children" column visible                | P1       | **Exists** |
| A-USR-15 | Search filters teachers                        | Type nonexistent name                                 | Filtered results or empty state                 | P1       | **Exists** |
| A-USR-16 | Create teacher end-to-end                      | Fill all required fields → Create                     | Teacher created, dialog closes, list refreshes  | P0       | New        |
| A-USR-17 | Create student end-to-end                      | Fill student details → Create                         | Student created, list refreshes                 | P0       | New        |
| A-USR-18 | Bulk import dialog — CSV upload                | Click Bulk Import → Upload CSV file                   | Rows parsed and validated                       | P1       | New        |
| A-USR-19 | Assign class to teacher                        | Click pencil on teacher → Select class → Save         | Class assignment persisted                      | P1       | New        |
| A-USR-20 | Link parent to student                         | Students tab → Click link icon → Select parent → Save | Parent linked                                   | P1       | New        |

### 5.5 Classes Management

| #        | Test Name                                      | Steps                                         | Expected                               | Priority | Status     |
| -------- | ---------------------------------------------- | --------------------------------------------- | -------------------------------------- | -------- | ---------- |
| A-CLS-01 | Create Class button                            | Navigate to `/classes`                        | "Create Class" button visible          | P0       | **Exists** |
| A-CLS-02 | Create Class dialog                            | Click "Create Class"                          | Dialog with Class Name, Grade, Section | P0       | **Exists** |
| A-CLS-03 | Create button disabled without required fields | Open dialog                                   | Create button disabled                 | P1       | **Exists** |
| A-CLS-04 | Cancel dialog                                  | Open → Cancel                                 | Dialog closes                          | P1       | **Exists** |
| A-CLS-05 | Classes table columns                          | View table                                    | Name, Grade, Section, Status columns   | P1       | **Exists** |
| A-CLS-06 | Search classes                                 | Type in search box                            | Filters by name/grade/section          | P1       | **Exists** |
| A-CLS-07 | Grade filter dropdown                          | Click grade filter                            | Shows grade options                    | P1       | **Exists** |
| A-CLS-08 | Create class end-to-end                        | Fill name + grade + section → Create          | Class created, list refreshes          | P0       | New        |
| A-CLS-09 | Assign teachers to class                       | Click teachers count → Select teachers → Save | Teachers assigned                      | P1       | New        |
| A-CLS-10 | Assign students to class                       | Click students count → Select students → Save | Students assigned                      | P1       | New        |
| A-CLS-11 | Archive class                                  | Click archive → Confirm                       | Class archived                         | P2       | New        |

### 5.6 Spaces & Exams Overview

| #        | Test Name           | Steps                    | Expected                                                      | Priority | Status     |
| -------- | ------------------- | ------------------------ | ------------------------------------------------------------- | -------- | ---------- |
| A-SPC-01 | Spaces page renders | Navigate to `/spaces`    | Search, status filter buttons (all/draft/published/archived)  | P0       | **Exists** |
| A-SPC-02 | Filter by published | Click "published" button | Shows only published spaces                                   | P1       | **Exists** |
| A-SPC-03 | Search spaces       | Type search term         | Filters by name                                               | P1       | **Exists** |
| A-EXM-01 | Exams page renders  | Navigate to `/exams`     | Search, status buttons (all/draft/scheduled/active/completed) | P0       | **Exists** |
| A-EXM-02 | Exams table headers | View table               | Title, Subject, Status columns                                | P1       | **Exists** |
| A-EXM-03 | Filter by draft     | Click "draft" button     | Filters to draft exams                                        | P1       | **Exists** |
| A-EXM-04 | Search exams        | Type search term         | Filters by title                                              | P1       | **Exists** |

### 5.7 Analytics & AI Usage

| #        | Test Name                      | Steps                       | Expected                                                               | Priority | Status     |
| -------- | ------------------------------ | --------------------------- | ---------------------------------------------------------------------- | -------- | ---------- |
| A-ANA-01 | Analytics page renders         | Navigate to `/analytics`    | Shows subtitle, score cards                                            | P0       | **Exists** |
| A-ANA-02 | Score cards visible            | View analytics              | Avg Exam Score, Avg Space Completion, At-Risk Students, Total Students | P0       | **Exists** |
| A-ANA-03 | Class Detail section           | View analytics              | Shows "Class Detail" with "Select a class" prompt                      | P1       | **Exists** |
| A-AI-01  | AI Usage page renders          | Navigate to `/ai-usage`     | Shows Monthly Cost, Total Calls, Input/Output Tokens                   | P1       | **Exists** |
| A-AI-02  | Month navigation               | Click previous month button | Month label changes                                                    | P1       | **Exists** |
| A-AI-03  | Next month disabled on current | View current month          | Next button disabled                                                   | P2       | **Exists** |
| A-AI-04  | Daily breakdown or empty state | View page                   | Shows table or "No AI usage data"                                      | P2       | **Exists** |

### 5.8 Academic Sessions

| #        | Test Name                             | Steps                            | Expected                                  | Priority | Status     |
| -------- | ------------------------------------- | -------------------------------- | ----------------------------------------- | -------- | ---------- |
| A-SES-01 | New Session button                    | Navigate to `/academic-sessions` | "New Session" button visible              | P0       | **Exists** |
| A-SES-02 | Create Session dialog                 | Click "New Session"              | Session Name, Start Date, End Date fields | P0       | **Exists** |
| A-SES-03 | Create button disabled without fields | Open dialog                      | Create disabled                           | P1       | **Exists** |
| A-SES-04 | Cancel dialog                         | Open → Cancel                    | Dialog closes                             | P1       | **Exists** |
| A-SES-05 | Sessions table or empty state         | View page                        | Shows sessions or empty state             | P1       | **Exists** |
| A-SES-06 | Current session Active badge          | View with current session        | Shows "Active" badge                      | P2       | **Exists** |
| A-SES-07 | Create session end-to-end             | Fill fields → Create             | Session created, list refreshes           | P0       | New        |
| A-SES-08 | Edit session                          | Click edit → Modify → Save       | Session updated                           | P1       | New        |
| A-SES-09 | Set as current session                | Click "Set as Current"           | Session marked as current                 | P1       | New        |

### 5.9 Reports

| #        | Test Name                | Steps                                 | Expected                               | Priority | Status     |
| -------- | ------------------------ | ------------------------------------- | -------------------------------------- | -------- | ---------- |
| A-RPT-01 | Reports page renders     | Navigate to `/reports`                | Exam Reports and Class Reports tabs    | P0       | **Exists** |
| A-RPT-02 | Exam Reports default tab | View page                             | Exam Reports tab active                | P1       | **Exists** |
| A-RPT-03 | Switch to Class Reports  | Click "Class Reports"                 | Class content loads                    | P1       | **Exists** |
| A-RPT-04 | Exam reports content     | View Exam Reports tab                 | PDF buttons or "No exams with results" | P1       | **Exists** |
| A-RPT-05 | Generate exam PDF        | Click PDF button (if data exists)     | PDF download initiated                 | P1       | New        |
| A-RPT-06 | Generate class PDF       | Click PDF button on Class Reports tab | PDF download initiated                 | P2       | New        |

### 5.10 Notifications & Settings

| #          | Test Name               | Steps                        | Expected                                                         | Priority | Status     |
| ---------- | ----------------------- | ---------------------------- | ---------------------------------------------------------------- | -------- | ---------- |
| A-NOTIF-01 | Notifications heading   | Navigate to `/notifications` | Shows "Notifications" heading                                    | P1       | **Exists** |
| A-NOTIF-02 | All/Unread filters      | View page                    | All and Unread tab options visible                               | P1       | **Exists** |
| A-SET-01   | Settings heading        | Navigate to `/settings`      | Shows "Settings" heading                                         | P1       | **Exists** |
| A-SET-02   | Tenant Settings tab     | Click "Tenant Settings"      | Shows School Information, School Name, Tenant Code, Subscription | P0       | **Exists** |
| A-SET-03   | Evaluation Settings tab | Click "Evaluation Settings"  | Shows configuration content                                      | P1       | **Exists** |
| A-SET-04   | API Keys tab            | Click "API Keys"             | Shows Gemini API Key section, Set/Update Key button              | P1       | **Exists** |
| A-SET-05   | Update school info      | Edit School Name → Save      | Toast success, name updated                                      | P0       | New        |
| A-SET-06   | Manage API key          | Set/update API key           | Key set/updated                                                  | P1       | New        |

---

## 6. Super Admin (port 4567)

**File:** `tests/e2e/super-admin.spec.ts` **Existing coverage:** Auth,
dashboard, navigation (all routes), tenants CRUD, tenant detail, user analytics,
feature flags, global presets, system health, settings

### 6.1 Authentication

| #          | Test Name                       | Steps                                         | Expected                                | Priority | Status     |
| ---------- | ------------------------------- | --------------------------------------------- | --------------------------------------- | -------- | ---------- |
| SA-AUTH-01 | Redirects to /login             | Navigate to `/`                               | Redirects to `/login`                   | P0       | **Exists** |
| SA-AUTH-02 | Login page shows email/password | View login page                               | Email + password inputs, no school code | P0       | **Exists** |
| SA-AUTH-03 | Successful login                | Enter superadmin credentials → Sign In        | Shows "Super Admin Dashboard"           | P0       | **Exists** |
| SA-AUTH-04 | Invalid credentials error       | Enter wrong password                          | Error shown                             | P0       | **Exists** |
| SA-AUTH-05 | Sign out                        | Login → Sign Out                              | Redirects to `/login`                   | P0       | **Exists** |
| SA-AUTH-06 | Protected routes require auth   | Navigate to any protected route without login | Redirects to `/login`                   | P0       | **Exists** |

### 6.2 Dashboard

| #          | Test Name              | Steps                   | Expected                                              | Priority | Status     |
| ---------- | ---------------------- | ----------------------- | ----------------------------------------------------- | -------- | ---------- |
| SA-DASH-01 | Dashboard heading      | Login                   | Shows "Super Admin Dashboard"                         | P0       | **Exists** |
| SA-DASH-02 | Stat cards             | View dashboard          | Total Tenants, Total Users, Total Exams, Total Spaces | P0       | **Exists** |
| SA-DASH-03 | Active/Trial breakdown | View Total Tenants card | Shows active and trial counts                         | P1       | **Exists** |
| SA-DASH-04 | Recent Tenants section | View dashboard          | Top 5 recent tenants with status badges               | P1       | **Exists** |
| SA-DASH-05 | Logout button          | View dashboard          | Logout button visible in header                       | P0       | **Exists** |

### 6.3 Navigation

| #         | Test Name                | Steps                | Expected                      | Priority | Status     |
| --------- | ------------------------ | -------------------- | ----------------------------- | -------- | ---------- |
| SA-NAV-01 | Sidebar — Tenants        | Click Tenants        | Navigates to `/tenants`       | P0       | **Exists** |
| SA-NAV-02 | Sidebar — User Analytics | Click User Analytics | Navigates to `/analytics`     | P1       | **Exists** |
| SA-NAV-03 | Sidebar — Feature Flags  | Click Feature Flags  | Navigates to `/feature-flags` | P1       | **Exists** |
| SA-NAV-04 | Sidebar — Global Presets | Click Global Presets | Navigates to `/presets`       | P1       | **Exists** |
| SA-NAV-05 | Sidebar — System Health  | Click System Health  | Navigates to `/system`        | P1       | **Exists** |
| SA-NAV-06 | Sidebar — Settings       | Click Settings       | Navigates to `/settings`      | P1       | **Exists** |

### 6.4 Tenants Management

| #         | Test Name                | Steps                            | Expected                                                  | Priority | Status     |
| --------- | ------------------------ | -------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| SA-TNT-01 | Tenants page renders     | Navigate to `/tenants`           | Search input, status filters, table                       | P0       | **Exists** |
| SA-TNT-02 | Search tenants           | Type search term                 | Filters by name/code/email                                | P1       | **Exists** |
| SA-TNT-03 | Status filter — Active   | Click "active" button            | Shows only active tenants                                 | P1       | **Exists** |
| SA-TNT-04 | Status filter — Trial    | Click "trial" button             | Shows only trial tenants                                  | P1       | **Exists** |
| SA-TNT-05 | Create Tenant button     | View page                        | "Create Tenant" button visible                            | P0       | **Exists** |
| SA-TNT-06 | Create Tenant dialog     | Click "Create Tenant"            | Dialog with name, code, email, plan fields                | P0       | **Exists** |
| SA-TNT-07 | Tenant code validation   | Enter invalid characters in code | Validation error (uppercase letters/numbers/hyphens only) | P1       | **Exists** |
| SA-TNT-08 | Table columns            | View table                       | Name, Code, Plan, Users, Status, Actions                  | P0       | **Exists** |
| SA-TNT-09 | View tenant detail       | Click "View" on a tenant row     | Navigates to `/tenants/{id}`                              | P0       | **Exists** |
| SA-TNT-10 | Create tenant end-to-end | Fill all fields → Create         | Tenant created, list refreshes, toast shown               | P0       | New        |
| SA-TNT-11 | Empty tenants state      | Filter with no results           | Shows empty state with icon                               | P2       | **Exists** |

### 6.5 Tenant Detail

| #         | Test Name                | Steps                             | Expected                                 | Priority | Status     |
| --------- | ------------------------ | --------------------------------- | ---------------------------------------- | -------- | ---------- |
| SA-TND-01 | Detail page renders      | Navigate to `/tenants/{id}`       | Tenant name, code, status badge, stats   | P0       | **Exists** |
| SA-TND-02 | Stats grid               | View detail                       | Students, Teachers, Exams, Spaces counts | P0       | **Exists** |
| SA-TND-03 | Subscription card        | View detail                       | Plan, max limits, expiry date            | P1       | **Exists** |
| SA-TND-04 | Contact card             | View detail                       | Email, phone, contact person, website    | P1       | **Exists** |
| SA-TND-05 | Features card            | View detail                       | Feature flags with status dots           | P1       | **Exists** |
| SA-TND-06 | Settings card            | View detail                       | Gemini key, AI model, timezone, locale   | P2       | **Exists** |
| SA-TND-07 | Edit tenant dialog       | Click Edit → Modify fields → Save | Tenant updated, toast shown              | P0       | **Exists** |
| SA-TND-08 | Edit subscription dialog | Click "Edit Plan" → Modify → Save | Subscription updated                     | P1       | **Exists** |
| SA-TND-09 | Delete tenant            | Click Delete → Confirm            | Tenant deleted, redirects to `/tenants`  | P0       | **Exists** |
| SA-TND-10 | Back link                | Click back link                   | Returns to `/tenants`                    | P2       | **Exists** |
| SA-TND-11 | Not found state          | Navigate to nonexistent tenant ID | Shows empty state with link back         | P2       | New        |

### 6.6 User Analytics

| #        | Test Name             | Steps                    | Expected                                                 | Priority | Status     |
| -------- | --------------------- | ------------------------ | -------------------------------------------------------- | -------- | ---------- |
| SA-UA-01 | Page renders          | Navigate to `/analytics` | Stat cards, Users by Plan, Users by Tenant               | P0       | **Exists** |
| SA-UA-02 | Stat cards            | View page                | Total Users, Students, Teachers, Active Tenants          | P0       | **Exists** |
| SA-UA-03 | Users by Plan chart   | View page                | Shows trial/basic/premium/enterprise distribution        | P1       | **Exists** |
| SA-UA-04 | Users by Tenant table | View page                | Columns: Tenant, Code, Students, Teachers, Total, Status | P1       | **Exists** |

### 6.7 Feature Flags

| #        | Test Name                 | Steps                              | Expected                                                 | Priority | Status     |
| -------- | ------------------------- | ---------------------------------- | -------------------------------------------------------- | -------- | ---------- |
| SA-FF-01 | Page renders              | Navigate to `/feature-flags`       | Flag overview summary, tenant cards                      | P0       | **Exists** |
| SA-FF-02 | Flag summary card         | View page                          | Each flag with X/Y enabled count                         | P1       | **Exists** |
| SA-FF-03 | Search tenants            | Type in search                     | Filters tenant cards by name/code                        | P1       | **Exists** |
| SA-FF-04 | Toggle flag               | Click a flag button on tenant card | Visual state changes (green/muted), pending changes ring | P0       | **Exists** |
| SA-FF-05 | Save changes              | Toggle flag → Click "Save Changes" | Changes persisted, "Saved" confirmation shown for 2s     | P0       | **Exists** |
| SA-FF-06 | Pending changes indicator | Toggle without saving              | Ring-2 border on card                                    | P1       | **Exists** |
| SA-FF-07 | Multiple flag toggles     | Toggle several flags → Save        | All changes saved at once                                | P1       | New        |

### 6.8 Global Presets

| #        | Test Name                | Steps                                   | Expected                                                    | Priority | Status     |
| -------- | ------------------------ | --------------------------------------- | ----------------------------------------------------------- | -------- | ---------- |
| SA-GP-01 | Page renders             | Navigate to `/presets`                  | Preset cards or empty state                                 | P0       | **Exists** |
| SA-GP-02 | Create preset button     | View page                               | "Create Preset" button visible                              | P0       | **Exists** |
| SA-GP-03 | Create preset dialog     | Click "Create Preset"                   | Form with name, description, settings, dimensions           | P0       | **Exists** |
| SA-GP-04 | Preset card content      | View existing preset                    | Name, badges (Default/Public), dimensions, display settings | P1       | **Exists** |
| SA-GP-05 | Create preset end-to-end | Fill name + configure dimensions → Save | Preset created, list refreshes                              | P0       | **Exists** |
| SA-GP-06 | Edit preset              | Click Edit → Modify → Save              | Preset updated                                              | P1       | **Exists** |
| SA-GP-07 | Delete preset            | Click Delete → Confirm                  | Preset deleted, list refreshes                              | P1       | **Exists** |
| SA-GP-08 | Dimension toggles        | Toggle dimension on/off                 | Visual state changes                                        | P1       | New        |
| SA-GP-09 | Dimension weight input   | Change weight value (1-5)               | Weight updates                                              | P2       | New        |

### 6.9 System Health

| #        | Test Name             | Steps                 | Expected                                                     | Priority | Status     |
| -------- | --------------------- | --------------------- | ------------------------------------------------------------ | -------- | ---------- |
| SA-SH-01 | Page renders          | Navigate to `/system` | Overall status banner, service cards, metrics                | P0       | **Exists** |
| SA-SH-02 | Overall status banner | View page             | Shows status label and last checked time                     | P0       | **Exists** |
| SA-SH-03 | Service cards         | View page             | Firebase Auth, Firestore, Cloud Functions, AI Pipeline cards | P0       | **Exists** |
| SA-SH-04 | Service status badges | View cards            | Each shows operational/degraded/down status                  | P1       | **Exists** |
| SA-SH-05 | Latency display       | View Firestore card   | Shows latency in ms                                          | P2       | **Exists** |
| SA-SH-06 | Platform metrics      | View page             | Avg Response Time, Total Users, Active Tenants, Error Rate   | P1       | **Exists** |
| SA-SH-07 | Refresh button        | Click Refresh         | Shows "Checking..." with spinner, then updates               | P1       | **Exists** |

### 6.10 Settings

| #         | Test Name                      | Steps                   | Expected                                                   | Priority | Status     |
| --------- | ------------------------------ | ----------------------- | ---------------------------------------------------------- | -------- | ---------- |
| SA-SET-01 | Page renders                   | Navigate to `/settings` | Announcement, Features, System Config, Admin Account cards | P0       | **Exists** |
| SA-SET-02 | Platform Announcement textarea | View settings           | Textarea for announcement text                             | P1       | **Exists** |
| SA-SET-03 | Default Features toggles       | View settings           | Auto Grade, Learning Spaces, AI Grading, etc. toggles      | P0       | **Exists** |
| SA-SET-04 | Maintenance Mode toggle        | View System Config      | Maintenance Mode toggle visible                            | P0       | **Exists** |
| SA-SET-05 | Admin Account info             | View settings           | Current user name/email, Sign Out button                   | P1       | **Exists** |
| SA-SET-06 | Save button dirty state        | Toggle a feature        | Save button becomes enabled                                | P1       | **Exists** |
| SA-SET-07 | Save settings                  | Toggle feature → Save   | Toast "Settings saved successfully"                        | P0       | **Exists** |
| SA-SET-08 | Toggle maintenance mode        | Turn on → Save          | Maintenance mode enabled                                   | P0       | New        |

---

## 7. Cross-App Integration Tests

These tests verify end-to-end flows that span multiple apps.

| #        | Test Name                                  | Apps                    | Steps                                                                                | Expected                                 | Priority |
| -------- | ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | -------- |
| X-INT-01 | Teacher creates exam → Student takes it    | teacher + student       | Teacher creates and publishes exam → Student sees it in tests → Takes test → Submits | Student sees exam, can take test         | P0       |
| X-INT-02 | Teacher grades → Student sees results      | teacher + student       | Teacher reviews submission → Releases results → Student checks results page          | Results visible to student with feedback | P0       |
| X-INT-03 | Teacher grades → Parent sees results       | teacher + parent        | Teacher releases exam results → Parent views `/results`                              | Parent sees child's released results     | P0       |
| X-INT-04 | Admin creates user → User can login        | admin + teacher/student | Admin creates teacher/student → New user logs in                                     | New user reaches dashboard               | P1       |
| X-INT-05 | Super admin creates tenant → Admin logs in | super-admin + admin     | Super admin creates tenant with admin email → Admin logs in with school code         | Admin reaches dashboard for new tenant   | P1       |
| X-INT-06 | Teacher publishes space → Student sees it  | teacher + student       | Teacher creates and publishes space → Student checks My Spaces                       | Space appears in student's list          | P0       |
| X-INT-07 | Feature flag toggle → App behavior         | super-admin + any app   | Super admin disables feature for tenant → Affected app no longer shows feature       | Feature hidden/disabled in tenant app    | P2       |

---

## Appendix A: Test Data Requirements

### Pre-seeded Data (Firebase)

| Data                             | Collection                                        | Required For                  |
| -------------------------------- | ------------------------------------------------- | ----------------------------- |
| School "Greenwood International" | `tenants/GRN001`                                  | All school-code-based logins  |
| Super Admin user                 | `users/` with `isSuperAdmin: true`                | Super admin tests             |
| Tenant Admin user                | `userMemberships/` with `role: tenantAdmin`       | Admin web tests               |
| Teacher users (4)                | `userMemberships/` with `role: teacher`           | Teacher web tests             |
| Student users (2+)               | `userMemberships/` with `role: student`           | Student web tests             |
| Parent users (2)                 | `userMemberships/` with `role: parent`            | Parent web tests              |
| Consumer user                    | `users/` with consumer profile                    | Consumer B2C tests            |
| Classes (2+)                     | `tenants/GRN001/classes`                          | Class-related tests           |
| Spaces (2+, published)           | `tenants/GRN001/spaces` with story points + items | Space viewer, practice, tests |
| Exams (2+, results_released)     | `tenants/GRN001/exams`                            | Results tests                 |
| Submissions (graded)             | `tenants/GRN001/submissions`                      | Grading review tests          |
| Student progress                 | `tenants/GRN001/spaceProgress`                    | Progress tracking tests       |
| Leaderboard data                 | RTDB `leaderboards/`                              | Leaderboard tests             |

### Runtime Test Data

| Action              | Created By        | Cleaned Up         |
| ------------------- | ----------------- | ------------------ |
| Create space        | Teacher tests     | Manual / teardown  |
| Create exam         | Teacher tests     | Manual / teardown  |
| Upload answer sheet | Teacher tests     | Manual / teardown  |
| Create tenant       | Super admin tests | Delete in test     |
| Create class        | Admin tests       | Manual / teardown  |
| Create user         | Admin tests       | Manual / teardown  |
| Cart items          | Consumer tests    | Clear cart in test |

---

## Appendix B: Coverage Summary

### Existing Tests (tests/e2e/)

| App         | Spec File              | Test Count | Coverage Areas                                                                                                                       |
| ----------- | ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| student-web | `student-web.spec.ts`  | ~80        | Auth, dashboard, spaces, tests, practice, results, leaderboard, store, consumer, notifications, chat                                 |
| student-web | `item-testing.spec.ts` | ~40        | Space viewer, question types, practice mode, timed tests                                                                             |
| student-web | `debug-spaces.spec.ts` | 1          | Debug utility                                                                                                                        |
| teacher-web | `teacher-web.spec.ts`  | ~75        | Auth, dashboard, navigation, spaces, exams, submissions, grading, students, analytics, settings                                      |
| parent-web  | `parent-web.spec.ts`   | ~65        | Auth, dashboard, children, progress, results, notifications, settings, navigation                                                    |
| admin-web   | `admin-web.spec.ts`    | ~80        | Auth, dashboard, navigation, users, classes, courses, spaces, exams, analytics, AI usage, sessions, reports, notifications, settings |
| super-admin | `super-admin.spec.ts`  | ~70        | Auth, dashboard, navigation, tenants, detail, analytics, feature flags, presets, system health, settings                             |

### Gaps to Fill (New Tests Needed)

| Category                                     | Count | Priority |
| -------------------------------------------- | ----- | -------- |
| End-to-end CRUD operations (create + verify) | ~15   | P0-P1    |
| Cross-app integration                        | 7     | P0-P1    |
| Drag-drop interactions                       | 3     | P1-P2    |
| Keyboard shortcuts                           | 2     | P2       |
| Auto-submit on timeout                       | 1     | P1       |
| Consumer signup flow                         | 1     | P1       |
| PDF generation                               | 2     | P1-P2    |
| Save button dirty state                      | 2     | P1       |
| Empty/edge states                            | ~5    | P2       |

### Recommended Test Execution Order

1. **super-admin.spec.ts** — Platform setup (tenants, flags, presets)
2. **admin-web.spec.ts** — School setup (users, classes, sessions)
3. **teacher-web.spec.ts** — Content creation (spaces, exams, grading)
4. **student-web.spec.ts** — Student learning (spaces, tests, results)
5. **parent-web.spec.ts** — Parent monitoring (progress, results)
