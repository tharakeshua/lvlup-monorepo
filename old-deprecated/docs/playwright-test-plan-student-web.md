# Playwright E2E Test Plan — Student Web

> **Generated:** 2026-03-05 **App:** `apps/student-web/` (port 4570) **Spec
> File:** `tests/e2e/student-web.spec.ts` **Playwright Config:**
> `playwright.config.ts` (root)

---

## Table of Contents

1. [Test Infrastructure](#1-test-infrastructure)
2. [Authentication (B2B + B2C)](#2-authentication)
3. [B2B Student Dashboard](#3-b2b-student-dashboard)
4. [Navigation](#4-navigation)
5. [Spaces List & Viewer](#5-spaces-list--viewer)
6. [Story Point Viewer (Reading/Practice)](#6-story-point-viewer)
7. [Timed Tests](#7-timed-tests)
8. [Practice Mode](#8-practice-mode)
9. [Results / Progress Page](#9-results--progress-page)
10. [Exam Result Detail](#10-exam-result-detail)
11. [Leaderboard](#11-leaderboard)
12. [Tests Page](#12-tests-page)
13. [B2C Consumer — Store & Checkout](#13-b2c-consumer--store--checkout)
14. [B2C Consumer — Dashboard & Profile](#14-b2c-consumer--dashboard--profile)
15. [Chat Tutor](#15-chat-tutor)
16. [Notifications](#16-notifications)
17. [Loading, Error & Empty States](#17-loading-error--empty-states)
18. [Responsive Behavior](#18-responsive-behavior)
19. [Accessibility](#19-accessibility)
20. [Test Data Requirements](#20-test-data-requirements)

---

## 1. Test Infrastructure

### Playwright Configuration

| Setting        | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Project name   | `student-web`                                                         |
| Base URL       | `http://localhost:4570`                                               |
| Browser        | Desktop Chrome                                                        |
| Test match     | `student-web.spec.ts`, `item-testing.spec.ts`, `debug-spaces.spec.ts` |
| Timeout        | 60,000ms                                                              |
| Expect timeout | 15,000ms                                                              |
| Workers        | 1 (sequential)                                                        |
| Retries (CI)   | 2                                                                     |
| Screenshot     | only-on-failure                                                       |
| Video          | on                                                                    |
| Trace          | on-first-retry                                                        |

### Shared Helpers (`tests/e2e/helpers/`)

| Helper                         | Function  | Purpose                                                    |
| ------------------------------ | --------- | ---------------------------------------------------------- |
| `loginStudentWithEmail()`      | `auth.ts` | B2B login: school code → Email tab → email + password      |
| `loginStudentWithRollNumber()` | `auth.ts` | B2B login: school code → Roll Number tab → roll + password |
| `loginConsumer()`              | `auth.ts` | B2C login: email + password (no school code)               |
| `logout()`                     | `auth.ts` | Click Sign Out → Confirm dialog → Wait for /login          |
| `expectDashboard()`            | `auth.ts` | Assert dashboard heading text                              |
| `enterSchoolCode()`            | `auth.ts` | Fill school code → Click Continue                          |

### Test Credentials (`helpers/selectors.ts`)

| Identity              | Email / Roll                | Password       | School Code |
| --------------------- | --------------------------- | -------------- | ----------- |
| Student 1 (email)     | `aarav.patel@greenwood.edu` | `Test@12345`   | `GRN001`    |
| Student 2 (email)     | `diya.gupta@greenwood.edu`  | `Test@12345`   | `GRN001`    |
| Student (roll number) | Roll: `2025001`             | `Test@12345`   | `GRN001`    |
| Consumer (B2C)        | `consumer@gmail.test`       | `Consumer123!` | N/A         |

### Priority Definitions

| Level  | Meaning                                  | When to Run       |
| ------ | ---------------------------------------- | ----------------- |
| **P0** | Critical path — app unusable if broken   | Every PR, CI gate |
| **P1** | Core feature — major user journey broken | Every PR          |
| **P2** | Important — degraded UX, non-blocking    | Nightly / Release |
| **P3** | Polish — visual details, edge cases      | Release only      |

### Existing Test Coverage Summary

The `student-web.spec.ts` file already contains ~80 tests covering auth,
dashboard, spaces, tests, practice, results, leaderboard, store, consumer,
notifications, and chat. `item-testing.spec.ts` has ~40 tests for space viewer
question types and test interactions. This plan identifies **both existing tests
and gaps** to fill.

---

## 2. Authentication

### 2.1 B2B School Login (Two-Step)

**Flow:** `/login` → Enter school code → Continue → Enter credentials
(email/roll number + password) → Sign In → Dashboard

| #         | Test Name                                | Description                         | Steps                                                                                             | Expected Behavior                                                                                          | Priority | Status     |
| --------- | ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| S-AUTH-01 | Login page renders school code step      | Verify initial login page structure | Navigate to `/login`                                                                              | School code input `#schoolCode` visible, "Continue" button visible, "Student Portal" or heading text shown | P0       | **Exists** |
| S-AUTH-02 | Valid school code shows school name      | Validate school code lookup         | Enter `GRN001` → Click Continue                                                                   | School name "Greenwood International School" appears, credential inputs become visible                     | P0       | **Exists** |
| S-AUTH-03 | Invalid school code shows error          | Test error handling for bad codes   | Enter `XXXXX` → Click Continue                                                                    | Destructive error alert visible, stays on school code step, email input NOT visible                        | P0       | **Exists** |
| S-AUTH-04 | Empty school code prevented              | Form validation                     | Click Continue without entering code                                                              | HTML5 validation or custom error prevents submission                                                       | P1       | **Exists** |
| S-AUTH-05 | Change button returns to school code     | Step navigation                     | Enter valid code → Continue → Click "Change"                                                      | School code input reappears, credential inputs hidden                                                      | P1       | **Exists** |
| S-AUTH-06 | Successful login with email              | Full email login flow               | Enter school code → Continue → Click "Email" tab → Enter email + password → Sign In               | Redirects away from `/login`, dashboard heading "Dashboard" visible                                        | P0       | **Exists** |
| S-AUTH-07 | Successful login with roll number        | Full roll number login flow         | Enter school code → Continue → Roll Number tab active → Enter roll `2025001` + password → Sign In | Redirects to dashboard                                                                                     | P0       | **Exists** |
| S-AUTH-08 | Wrong password shows error               | Credential validation               | Enter valid school code + valid email + wrong password → Sign In                                  | Destructive error alert visible                                                                            | P0       | **Exists** |
| S-AUTH-09 | Unauthenticated user redirected          | Route guard check                   | Navigate to `/` without logging in                                                                | Redirected to `/login`                                                                                     | P0       | **Exists** |
| S-AUTH-10 | Unauthenticated user on protected routes | Guard on all routes                 | Navigate to `/spaces`, `/results`, `/leaderboard` etc without login                               | All redirect to `/login`                                                                                   | P0       | **Exists** |
| S-AUTH-11 | Sign out redirects to login              | Logout flow                         | Login → Click "Sign Out" button → Confirm in dialog                                               | Redirects to `/login`                                                                                      | P0       | **Exists** |
| S-AUTH-12 | Authenticated user on /login redirected  | No double-login                     | Login → Navigate to `/login`                                                                      | Redirects back to dashboard or stays (app-dependent)                                                       | P2       | **Exists** |

### 2.2 B2C Consumer Login

**Flow:** `/login` → Click "Don't have a school code" → Enter email + password →
Sign In → `/consumer`

| #         | Test Name                               | Description     | Steps                                                                                                | Expected Behavior                                                               | Priority | Status     |
| --------- | --------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------- |
| S-AUTH-20 | Consumer login link visible             | B2C entry point | Navigate to `/login`                                                                                 | "Don't have a school code" button visible                                       | P0       | **Exists** |
| S-AUTH-21 | Consumer login form renders             | B2C form shown  | Click "Don't have a school code"                                                                     | Consumer email `#consumerEmail` and password `#consumerPassword` inputs visible | P0       | **Exists** |
| S-AUTH-22 | Successful consumer login               | Full B2C login  | Enter consumer email + password → Sign In                                                            | Shows "My Learning" heading at `/consumer`                                      | P0       | **Exists** |
| S-AUTH-23 | Consumer signup flow                    | New B2C account | Click "Don't have a school code" → Navigate to signup → Enter name, email, password → Create Account | Account created, redirects to consumer dashboard                                | P1       | **New**    |
| S-AUTH-24 | Consumer Google sign-in button          | OAuth option    | View consumer login form                                                                             | Google sign-in button is visible and clickable                                  | P2       | **New**    |
| S-AUTH-25 | Consumer login with invalid credentials | Error handling  | Enter wrong consumer credentials → Sign In                                                           | Error message shown                                                             | P1       | **New**    |

---

## 3. B2B Student Dashboard

**Route:** `/` (requires student role)

| #         | Test Name                  | Description               | Steps                 | Expected Behavior                                                                | Priority | Status     |
| --------- | -------------------------- | ------------------------- | --------------------- | -------------------------------------------------------------------------------- | -------- | ---------- |
| S-DASH-01 | Dashboard heading visible  | Page loads correctly      | Login as student      | h1 contains "Dashboard"                                                          | P0       | **Exists** |
| S-DASH-02 | Summary stat cards render  | Key metrics shown         | View dashboard        | 4 cards visible: Overall Score, Avg Exam Score, Space Completion, Current Streak | P0       | **Exists** |
| S-DASH-03 | Quick Stats section        | Additional metrics        | View dashboard        | Total Points, Exams Completed, At-Risk Status shown                              | P1       | **Exists** |
| S-DASH-04 | Strengths badges visible   | Subject analysis          | View dashboard        | Green strength subject badges displayed (or empty if none)                       | P2       | **Exists** |
| S-DASH-05 | Weaknesses badges visible  | Subject analysis          | View dashboard        | Orange/red weakness subject badges displayed (or empty if none)                  | P2       | **Exists** |
| S-DASH-06 | My Spaces grid             | Recent spaces             | View dashboard        | Up to 4 space cards with title, subject, progress bar                            | P1       | **Exists** |
| S-DASH-07 | Space card click navigates | Navigation from dashboard | Click on a space card | Navigates to `/spaces/{spaceId}`                                                 | P1       | **Exists** |
| S-DASH-08 | Recent Exam Results        | Latest exam scores        | View dashboard        | Up to 3 recent exam entries with name, score, percentage                         | P1       | **Exists** |
| S-DASH-09 | Upcoming Exams section     | Scheduled exams           | View dashboard        | Shows upcoming exams or empty state message                                      | P2       | **Exists** |
| S-DASH-10 | Recommendations section    | Personalized tips         | View dashboard        | Shows recommendations based on weak areas or empty state                         | P2       | **Exists** |
| S-DASH-11 | Sign Out button visible    | Auth action               | View dashboard        | Sign Out button present in header/sidebar                                        | P1       | **Exists** |
| S-DASH-12 | Streak flame icon          | Gamification element      | View streak card      | Flame icon and streak day count visible                                          | P2       | **New**    |

---

## 4. Navigation

| #        | Test Name                      | Description         | Steps                              | Expected Behavior                                          | Priority | Status     |
| -------- | ------------------------------ | ------------------- | ---------------------------------- | ---------------------------------------------------------- | -------- | ---------- |
| S-NAV-01 | Sidebar — Dashboard            | Home navigation     | Click Dashboard in sidebar         | Navigates to `/`, shows "Dashboard" heading                | P0       | **Exists** |
| S-NAV-02 | Sidebar — My Spaces            | Spaces list         | Click "My Spaces" in sidebar       | Navigates to `/spaces`, shows "My Spaces" heading          | P0       | **Exists** |
| S-NAV-03 | Sidebar — Tests                | Tests list          | Click "Tests" in sidebar           | Navigates to `/tests`, shows appropriate heading           | P1       | **Exists** |
| S-NAV-04 | Sidebar — Results              | Progress page       | Click "Results" in sidebar         | Navigates to `/results`, shows progress tabs               | P0       | **Exists** |
| S-NAV-05 | Sidebar — Leaderboard          | Rankings            | Click "Leaderboard"                | Navigates to `/leaderboard`, shows trophy icon and heading | P1       | **Exists** |
| S-NAV-06 | Sidebar — Chat Tutor           | AI chat             | Click "Chat Tutor"                 | Navigates to `/chat`, shows Chat Tutor page                | P2       | **Exists** |
| S-NAV-07 | Notification bell in header    | Notification access | View header                        | Bell icon visible with unread count badge                  | P1       | **Exists** |
| S-NAV-08 | Theme toggle                   | Dark/light mode     | Click theme toggle in header       | Theme switches between light and dark                      | P2       | **New**    |
| S-NAV-09 | Unknown route — 404            | Error handling      | Navigate to `/this-does-not-exist` | Shows 404 page or redirects to dashboard/login             | P2       | **Exists** |
| S-NAV-10 | Active sidebar highlighting    | Visual feedback     | Navigate to `/spaces`              | "My Spaces" sidebar item highlighted as active             | P2       | **New**    |
| S-NAV-11 | Consumer sidebar — My Learning | B2C navigation      | Login as consumer → Check sidebar  | "My Learning" link visible                                 | P1       | **Exists** |
| S-NAV-12 | Consumer sidebar — Space Store | B2C navigation      | Login as consumer → Check sidebar  | "Space Store" link visible                                 | P1       | **Exists** |
| S-NAV-13 | Consumer sidebar — Cart count  | Dynamic badge       | Add item to cart → Check sidebar   | Cart sidebar item shows item count                         | P1       | **Exists** |

---

## 5. Spaces List & Viewer

### 5.1 Spaces List (`/spaces`)

| #        | Test Name                       | Description        | Steps                                      | Expected Behavior                                                        | Priority | Status     |
| -------- | ------------------------------- | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------ | -------- | ---------- |
| S-SPC-01 | Spaces list page renders        | Page loads         | Navigate to `/spaces`                      | "My Spaces" heading, space cards in grid                                 | P0       | **Exists** |
| S-SPC-02 | Space card content              | Card displays data | View space card                            | Shows title, subject, description, stats (sections, items), progress bar | P1       | **Exists** |
| S-SPC-03 | Space card progress bar         | Visual progress    | View space with progress                   | Progress bar shows correct percentage with color                         | P1       | **Exists** |
| S-SPC-04 | Click space navigates to viewer | Navigation         | Click on space card                        | URL changes to `/spaces/{spaceId}`, space detail page loads              | P0       | **Exists** |
| S-SPC-05 | Empty spaces state              | No assigned spaces | Login as student with no class assignments | Shows empty state icon and message                                       | P2       | **New**    |
| S-SPC-06 | Loading skeleton                | Async loading      | Navigate to `/spaces` quickly              | Skeleton loader cards visible before real data loads                     | P2       | **New**    |

### 5.2 Space Viewer (`/spaces/:spaceId`)

| #        | Test Name                       | Description            | Steps                                | Expected Behavior                                                                    | Priority | Status     |
| -------- | ------------------------------- | ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ | -------- | ---------- |
| S-SPV-01 | Space viewer page loads         | Page structure         | Navigate to space detail             | Breadcrumb, space title, overall progress bar, story points list                     | P0       | **Exists** |
| S-SPV-02 | Overall progress bar            | Visual progress        | View space with some completion      | Progress bar shows correct % in header area                                          | P1       | **Exists** |
| S-SPV-03 | Story points listed             | Content structure      | View space                           | All story points listed with title, type, items count, points                        | P0       | **Exists** |
| S-SPV-04 | Story point type icons          | Visual differentiation | View mixed-type space                | Standard=BookOpen, Timed Test=Clock, Test=ClipboardList, Practice=Dumbbell, Quiz=Zap | P2       | **New**    |
| S-SPV-05 | Story point — completed badge   | Status display         | View completed story point           | Shows green "Completed" badge                                                        | P1       | **Exists** |
| S-SPV-06 | Story point — Start Test button | Test entry point       | View timed test story point          | "Start Test" or similar CTA button visible                                           | P0       | **Exists** |
| S-SPV-07 | Story point — progress bar      | Partial completion     | View partially completed story point | Progress bar with correct percentage                                                 | P1       | **Exists** |
| S-SPV-08 | Click standard story point      | Navigation             | Click on a standard story point      | Navigates to `/spaces/{id}/story-points/{spId}`                                      | P0       | **Exists** |
| S-SPV-09 | Click test story point          | Navigation             | Click test story point               | Navigates to `/spaces/{id}/test/{spId}`                                              | P0       | **Exists** |
| S-SPV-10 | Click practice story point      | Navigation             | Click practice story point           | Navigates to `/spaces/{id}/practice/{spId}`                                          | P0       | **Exists** |
| S-SPV-11 | Story point duration display    | Timed test metadata    | View timed test story point          | Shows duration (e.g., "30 min")                                                      | P2       | **New**    |
| S-SPV-12 | Story point difficulty level    | Metadata display       | View story point with difficulty     | Shows easy/medium/hard indicator                                                     | P2       | **New**    |

---

## 6. Story Point Viewer

**Route:** `/spaces/:spaceId/story-points/:storyPointId`

| #         | Test Name                           | Description            | Steps                                  | Expected Behavior                                                  | Priority | Status     |
| --------- | ----------------------------------- | ---------------------- | -------------------------------------- | ------------------------------------------------------------------ | -------- | ---------- |
| S-STPV-01 | Page loads with sidebar and content | Layout                 | Navigate to story point                | Left sidebar sections + main content area visible                  | P0       | **Exists** |
| S-STPV-02 | Section filtering                   | Content filtering      | Click a section filter button          | Content filtered to show only that section's items                 | P1       | **New**    |
| S-STPV-03 | Material content renders            | Educational content    | Navigate to story point with materials | Text/image content displayed correctly                             | P0       | **New**    |
| S-STPV-04 | MCQ question renders                | Question answering     | View MCQ question item                 | Question text, 4 options (radio buttons), submit button visible    | P0       | **Exists** |
| S-STPV-05 | MCQ — correct answer                | Answer evaluation      | Select correct option → Submit         | Green feedback, checkmark icon, score shown, evaluation positive   | P0       | **Exists** |
| S-STPV-06 | MCQ — incorrect answer              | Answer evaluation      | Select wrong option → Submit           | Red feedback, X icon, correct answer revealed, evaluation negative | P0       | **Exists** |
| S-STPV-07 | True/False question                 | Question type support  | View True/False question               | Two options (True/False), submit button                            | P0       | **Exists** |
| S-STPV-08 | Numerical question                  | Question type support  | View numerical question                | Number input field, submit button                                  | P1       | **Exists** |
| S-STPV-09 | Text answer question                | Question type support  | View short text question               | Text input field, submit button                                    | P1       | **Exists** |
| S-STPV-10 | Paragraph answer question           | Question type support  | View paragraph question                | Textarea input, submit button                                      | P1       | **Exists** |
| S-STPV-11 | Fill-in-the-blanks question         | Question type support  | View fill-blanks question              | Blank fields in context, submit button                             | P1       | **Exists** |
| S-STPV-12 | Matching question                   | Question type support  | View matching question                 | Two columns for matching pairs                                     | P2       | **Exists** |
| S-STPV-13 | Show correct answers toggle         | Learning aid           | Toggle "Show correct answers"          | Correct answers displayed/hidden for all questions                 | P1       | **New**    |
| S-STPV-14 | Open Chat Tutor button              | AI tutoring            | View a question item                   | "Open Chat Tutor" button visible on question                       | P2       | **New**    |
| S-STPV-15 | Chat Tutor panel opens              | Slide-over interaction | Click "Open Chat Tutor" on question    | Chat panel slides in from the right                                | P2       | **New**    |
| S-STPV-16 | Completion checkmarks persist       | Progress tracking      | Answer questions → Refresh page        | Previously answered questions still show checkmarks                | P1       | **New**    |
| S-STPV-17 | Evaluation feedback display         | Learning feedback      | Submit answer → View feedback          | Shows feedback text, strengths list, weaknesses list               | P1       | **New**    |

---

## 7. Timed Tests

**Route:** `/spaces/:spaceId/test/:storyPointId` **Views:** Landing → Active
Test → Results

### 7.1 Test Landing

| #       | Test Name                   | Description       | Steps                             | Expected Behavior                                                                           | Priority | Status     |
| ------- | --------------------------- | ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------- | -------- | ---------- |
| S-TT-01 | Landing page renders        | Test info display | Navigate to timed test            | Shows title, instructions, duration, questions count, total points, max attempts, passing % | P0       | **Exists** |
| S-TT-02 | Start Test button visible   | CTA               | View landing                      | "Start Test" button visible and clickable                                                   | P0       | **Exists** |
| S-TT-03 | Previous attempts listed    | History           | View test with prior attempts     | Shows attempt #, date, score %, points for each                                             | P1       | **Exists** |
| S-TT-04 | Click attempt shows results | Historical review | Click on a previous attempt entry | Shows detailed breakdown for that specific attempt                                          | P1       | **Exists** |
| S-TT-05 | Max attempts enforcement    | Limit check       | View test with all attempts used  | Start Test button disabled or shows "Max attempts reached"                                  | P1       | **New**    |

### 7.2 Active Test Session

| #       | Test Name                      | Description          | Steps                                       | Expected Behavior                                                                       | Priority | Status     |
| ------- | ------------------------------ | -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | -------- | ---------- |
| S-TT-10 | Test starts — UI layout        | Full test interface  | Click "Start Test"                          | Left sidebar (QuestionNavigator), center (question), top timer bar visible              | P0       | **Exists** |
| S-TT-11 | Timer countdown running        | Time tracking        | Start test                                  | Timer displays remaining time and actively counts down                                  | P0       | **Exists** |
| S-TT-12 | Question navigator grid        | Status tracking      | Start test                                  | Numbered buttons for all questions visible in left sidebar                              | P0       | **Exists** |
| S-TT-13 | Question X of N display        | Progress indicator   | Start test                                  | Shows "Question 1 of N" in timer bar                                                    | P1       | **Exists** |
| S-TT-14 | Answer MCQ and Save & Next     | Core test flow       | Select answer → Click "Save & Next"         | Answer saved, navigates to next question, navigator updates (answered color)            | P0       | **Exists** |
| S-TT-15 | Previous button                | Question navigation  | On question 2+ → Click Previous             | Navigates to previous question, answer preserved                                        | P0       | **Exists** |
| S-TT-16 | Next button                    | Question navigation  | Click Next                                  | Navigates to next question                                                              | P0       | **Exists** |
| S-TT-17 | Mark for Review                | Flagging             | Click flag icon or press M                  | Question marked in navigator (visual change), toggle works on/off                       | P1       | **Exists** |
| S-TT-18 | Clear Response                 | Answer removal       | Answer question → Click "Clear Response"    | Answer removed, navigator status reverts to not_answered                                | P1       | **Exists** |
| S-TT-19 | Navigator color coding         | Status visualization | Answer some questions, mark some, skip some | Gray=not visited, Light gray=visited but not answered, Colored=answered, Special=marked | P1       | **Exists** |
| S-TT-20 | Click navigator number         | Direct jump          | Click question number 5 in navigator        | Jumps directly to question 5                                                            | P1       | **Exists** |
| S-TT-21 | Keyboard shortcut — ← Previous | Accessibility        | Press left arrow key                        | Navigates to previous question                                                          | P2       | **New**    |
| S-TT-22 | Keyboard shortcut — → Next     | Accessibility        | Press right arrow key                       | Navigates to next question                                                              | P2       | **New**    |
| S-TT-23 | Keyboard shortcut — M Mark     | Accessibility        | Press M key                                 | Toggles mark for review on current question                                             | P2       | **New**    |

### 7.3 Test Submission

| #       | Test Name                        | Description         | Steps                                               | Expected Behavior                                                          | Priority | Status     |
| ------- | -------------------------------- | ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- | -------- | ---------- |
| S-TT-30 | Submit button opens confirmation | Submission flow     | Click "Submit Test"                                 | Confirmation dialog showing answered count, marked count, unanswered count | P0       | **Exists** |
| S-TT-31 | Confirm submission               | Complete submission | In confirmation dialog → Confirm                    | Test submitted, results view loads                                         | P0       | **Exists** |
| S-TT-32 | Cancel submission                | Stay in test        | In confirmation dialog → Cancel                     | Dialog closes, returns to test                                             | P1       | **New**    |
| S-TT-33 | Auto-submit on timeout           | Time enforcement    | Wait for timer to reach 0 (use short-duration test) | Test auto-submitted, results view shown, "Auto-submitted" badge visible    | P1       | **New**    |

### 7.4 Test Results View

| #       | Test Name                    | Description          | Steps                        | Expected Behavior                                                                 | Priority | Status     |
| ------- | ---------------------------- | -------------------- | ---------------------------- | --------------------------------------------------------------------------------- | -------- | ---------- |
| S-TT-40 | Results view renders         | Post-test display    | Submit test → View results   | Award icon, Pass/Fail message, score %, points earned/total, answered/total count | P0       | **Exists** |
| S-TT-41 | Pass — gold award icon       | Visual reward        | Submit passing test          | Gold award icon, "Congratulations" or pass message                                | P1       | **Exists** |
| S-TT-42 | Fail — red award icon        | Visual feedback      | Submit failing test          | Red award icon, fail message                                                      | P1       | **Exists** |
| S-TT-43 | Per-question breakdown table | Detailed results     | View results                 | Table with Q#, status (✓ Correct / ✗ Incorrect), points, time spent               | P0       | **Exists** |
| S-TT-44 | Topic analysis section       | Performance by topic | View results with topic data | Shows correct/total per topic with progress bars                                  | P2       | **Exists** |
| S-TT-45 | Back to test info button     | Navigation           | View results                 | "Back to Test" button navigates to test landing                                   | P1       | **Exists** |
| S-TT-46 | Back to space button         | Navigation           | View results                 | "Back to Space" button navigates to space viewer                                  | P1       | **Exists** |
| S-TT-47 | Attempt number displayed     | Metadata             | View results                 | Shows "Attempt #N" label                                                          | P2       | **Exists** |

---

## 8. Practice Mode

**Route:** `/spaces/:spaceId/practice/:storyPointId`

| #         | Test Name                         | Description     | Steps                                    | Expected Behavior                                                                | Priority | Status     |
| --------- | --------------------------------- | --------------- | ---------------------------------------- | -------------------------------------------------------------------------------- | -------- | ---------- |
| S-PRAC-01 | Practice page renders             | Page structure  | Navigate to practice story point         | Practice icon, title, solved count/total (green badge), progress bar             | P0       | **Exists** |
| S-PRAC-02 | Progress bar shows completion     | Visual progress | View practice page                       | Progress bar shows X/Y solved percentage                                         | P1       | **Exists** |
| S-PRAC-03 | Difficulty filter — Easy          | Filtering       | Click "Easy" button                      | Only easy questions shown in navigator                                           | P1       | **Exists** |
| S-PRAC-04 | Difficulty filter — Medium        | Filtering       | Click "Medium" button                    | Only medium questions shown                                                      | P1       | **Exists** |
| S-PRAC-05 | Difficulty filter — Hard          | Filtering       | Click "Hard" button                      | Only hard questions shown                                                        | P1       | **Exists** |
| S-PRAC-06 | Question navigator — color coding | Status tracking | Answer some correct, some incorrect      | Green=correct, Red=incorrect, Gray=not attempted, Ring=current                   | P1       | **Exists** |
| S-PRAC-07 | Answer question correctly         | Core flow       | Select correct answer → Submit           | Green evaluation feedback, score shown, checkmark icon                           | P0       | **Exists** |
| S-PRAC-08 | Answer question incorrectly       | Core flow       | Select wrong answer → Submit             | Red feedback, X icon, evaluation details shown                                   | P0       | **Exists** |
| S-PRAC-09 | Previous/Next navigation          | Question nav    | Click Previous and Next                  | Moves between questions, answers preserved                                       | P0       | **Exists** |
| S-PRAC-10 | Click navigator number            | Direct jump     | Click specific number in navigator       | Jumps to that question                                                           | P1       | **Exists** |
| S-PRAC-11 | Unlimited retries                 | Re-answer       | Answer incorrectly → Retry same question | Can submit new answer for same question                                          | P1       | **New**    |
| S-PRAC-12 | Progress persists after refresh   | Persistence     | Answer several questions → Refresh page  | Previously answered questions show saved evaluations, navigator colors preserved | P1       | **New**    |
| S-PRAC-13 | Open Chat Tutor from question     | AI help         | Click "Open Chat Tutor" on a question    | Chat panel slides open with question context                                     | P2       | **New**    |
| S-PRAC-14 | Solved count updates              | Counter         | Answer new question correctly            | Solved count badge increments (e.g., "3/10 solved" → "4/10 solved")              | P1       | **New**    |
| S-PRAC-15 | Question status icon              | Visual feedback | View answered question                   | Shows checkmark (correct), X (incorrect), or dash (not attempted)                | P2       | **Exists** |

---

## 9. Results / Progress Page

**Route:** `/results` **Tabs:** Overall | Exams | Spaces

| #        | Test Name                            | Description       | Steps                       | Expected Behavior                                           | Priority | Status     |
| -------- | ------------------------------------ | ----------------- | --------------------------- | ----------------------------------------------------------- | -------- | ---------- |
| S-RES-01 | Progress page renders with tabs      | Page structure    | Navigate to `/results`      | Shows Overall, Exams, Spaces tabs                           | P0       | **Exists** |
| S-RES-02 | Overall tab — score cards            | Key metrics       | View Overall tab            | Overall Score %, Avg Exam Score %, Space Completion % cards | P0       | **Exists** |
| S-RES-03 | Overall tab — subject progress rings | Subject breakdown | View Overall tab            | Circular progress rings for each subject                    | P1       | **Exists** |
| S-RES-04 | Exams tab — table renders            | Exam history      | Click "Exams" tab           | Table with exam name, score, percentage columns             | P0       | **Exists** |
| S-RES-05 | Exams tab — percentage color coding  | Visual feedback   | View exam scores            | Green ≥70%, Yellow 40-69%, Red <40%                         | P2       | **Exists** |
| S-RES-06 | Exams tab — click row navigates      | Drill down        | Click on an exam result row | Navigates to `/exams/{examId}/results`                      | P0       | **Exists** |
| S-RES-07 | Spaces tab — progress cards          | Space tracking    | Click "Spaces" tab          | Space cards with title, status badge, progress bar, points  | P1       | **Exists** |
| S-RES-08 | Spaces tab — status badges           | Status display    | View space cards            | Shows "Not Started" / "In Progress" / "Completed" badge     | P1       | **Exists** |
| S-RES-09 | Spaces tab — sections completed      | Detail metric     | View space card             | Shows sections completed/total count                        | P2       | **Exists** |
| S-RES-10 | Tab switching preserves data         | UX                | Switch between tabs         | Each tab loads correct data, no errors                      | P1       | **New**    |

---

## 10. Exam Result Detail

**Route:** `/exams/:examId/results`

| #         | Test Name                        | Description       | Steps                         | Expected Behavior                                                    | Priority | Status     |
| --------- | -------------------------------- | ----------------- | ----------------------------- | -------------------------------------------------------------------- | -------- | ---------- |
| S-ERES-01 | Exam result page renders         | Page structure    | Navigate to exam result       | Breadcrumb (Results → Exam Title), score %, grade badge, total marks | P0       | **Exists** |
| S-ERES-02 | Grade badge displayed            | Grading           | View result                   | Grade badge (A+, A, B+, B, C+, C, D, F) with color                   | P1       | **Exists** |
| S-ERES-03 | Score percentage — large display | Key metric        | View result                   | Large score percentage text visible                                  | P0       | **Exists** |
| S-ERES-04 | Total marks display              | Score detail      | View result                   | "Score: X/Y" format visible                                          | P1       | **Exists** |
| S-ERES-05 | Graded questions count           | Progress          | View result                   | "Questions Graded: X/Y" visible                                      | P1       | **Exists** |
| S-ERES-06 | Progress bar color coding        | Visual feedback   | View various scores           | Green ≥70%, Orange 40-69%, Red <40%                                  | P2       | **Exists** |
| S-ERES-07 | Per-question breakdown           | Detailed feedback | View result                   | Questions listed with Q#, status icon (✓/✗/−), title, points         | P0       | **Exists** |
| S-ERES-08 | Evaluation feedback per question | AI feedback       | View question with evaluation | Shows summary comment, strengths list, weaknesses list               | P1       | **Exists** |
| S-ERES-09 | Topic analysis — weak topics     | Recommendations   | View result with topic data   | Weak topics (<50% score) highlighted for practice                    | P2       | **Exists** |
| S-ERES-10 | Download PDF button              | Export            | View result                   | "Download PDF" button visible and clickable                          | P2       | **Exists** |
| S-ERES-11 | Back to Results button           | Navigation        | View result                   | Navigates back to `/results`                                         | P1       | **Exists** |
| S-ERES-12 | Grade color coding               | Visual            | View grade badge              | A+/A = green, B+/B = blue, C+/C = orange, D/F = red                  | P2       | **New**    |

---

## 11. Leaderboard

**Route:** `/leaderboard`

| #        | Test Name                   | Description         | Steps                        | Expected Behavior                                                           | Priority | Status     |
| -------- | --------------------------- | ------------------- | ---------------------------- | --------------------------------------------------------------------------- | -------- | ---------- |
| S-LDR-01 | Leaderboard page renders    | Page structure      | Navigate to `/leaderboard`   | Trophy icon, title heading, user's rank badge, rankings table               | P1       | **Exists** |
| S-LDR-02 | Current user highlighted    | Self-identification | View leaderboard             | Current user's row has primary background color, "(You)" label next to name | P1       | **Exists** |
| S-LDR-03 | Rank #1 — Crown icon        | Gamification        | View leaderboard with data   | First place shows crown icon                                                | P2       | **Exists** |
| S-LDR-04 | Rank #2/#3 — Medal icon     | Gamification        | View leaderboard             | Second and third show medal icons                                           | P2       | **Exists** |
| S-LDR-05 | Space filter dropdown       | Filter control      | View leaderboard             | Dropdown with "Overall" + space-specific options                            | P1       | **Exists** |
| S-LDR-06 | Filter by specific space    | Data filtering      | Select a space from dropdown | Rankings update to show space-specific leaderboard                          | P1       | **Exists** |
| S-LDR-07 | User's rank badge in header | Quick rank view     | View leaderboard             | Badge showing "#N" in header area                                           | P2       | **Exists** |
| S-LDR-08 | Points column displayed     | Ranking metric      | View leaderboard table       | Right-aligned total points column                                           | P1       | **Exists** |
| S-LDR-09 | Real-time updates           | Live data           | View leaderboard             | Data loads from RTDB subscription (no manual refresh needed)                | P2       | **New**    |

---

## 12. Tests Page

**Route:** `/tests`

| #        | Test Name              | Description        | Steps                                   | Expected Behavior                                                | Priority | Status     |
| -------- | ---------------------- | ------------------ | --------------------------------------- | ---------------------------------------------------------------- | -------- | ---------- |
| S-TST-01 | Tests page renders     | Page structure     | Navigate to `/tests`                    | Lists available timed tests, grouped by space                    | P0       | **Exists** |
| S-TST-02 | Test card metadata     | Card content       | View test card                          | Shows title, space name, duration, questions count, max attempts | P1       | **Exists** |
| S-TST-03 | Click test navigates   | Navigation         | Click on a test card                    | Navigates to `/spaces/{id}/test/{spId}` (timed test landing)     | P0       | **Exists** |
| S-TST-04 | Empty tests state      | No available tests | Student with no timed test story points | Shows empty state message                                        | P2       | **New**    |
| S-TST-05 | Tests grouped by space | Organization       | View with tests from multiple spaces    | Tests organized under space headings                             | P2       | **New**    |

---

## 13. B2C Consumer — Store & Checkout

### 13.1 Store List (`/store`)

| #          | Test Name                         | Description        | Steps                                         | Expected Behavior                                                   | Priority | Status     |
| ---------- | --------------------------------- | ------------------ | --------------------------------------------- | ------------------------------------------------------------------- | -------- | ---------- |
| S-STORE-01 | Store page renders                | Page structure     | Login as consumer → Navigate to `/store`      | Store heading, search input, space grid                             | P0       | **Exists** |
| S-STORE-02 | Space cards displayed             | Product listing    | View store                                    | Cards with thumbnail, title, description, price, stats              | P0       | **Exists** |
| S-STORE-03 | Search by title                   | Filtering          | Type space title in search                    | Spaces filtered matching search term                                | P1       | **Exists** |
| S-STORE-04 | Search by description             | Filtering          | Type keyword from description                 | Spaces filtered matching keyword                                    | P1       | **Exists** |
| S-STORE-05 | Subject filter dropdown           | Category filter    | Select subject (Math/Science/English/History) | Spaces filtered by subject                                          | P1       | **Exists** |
| S-STORE-06 | Free space — Enroll Free button   | CTA                | View free space                               | "Enroll Free" button visible                                        | P0       | **Exists** |
| S-STORE-07 | Paid space — Add to Cart button   | CTA                | View paid space                               | "Add to Cart" button visible, price displayed                       | P0       | **Exists** |
| S-STORE-08 | Add to cart                       | Cart interaction   | Click "Add to Cart"                           | Button changes to "Remove from Cart", cart count in sidebar updates | P0       | **Exists** |
| S-STORE-09 | Remove from cart                  | Cart interaction   | Click "Remove from Cart"                      | Button reverts to "Add to Cart", cart count decrements              | P0       | **Exists** |
| S-STORE-10 | Enroll free space                 | Instant enrollment | Click "Enroll Free"                           | Space enrolled, button changes to "Continue Learning"               | P0       | **Exists** |
| S-STORE-11 | Continue Learning navigation      | Post-enrollment    | Click "Continue Learning" on enrolled space   | Navigates to consumer space viewer `/consumer/spaces/{id}`          | P1       | **Exists** |
| S-STORE-12 | Labels/tags on space card         | Metadata           | View space with labels                        | Up to 3 label badges shown, "+N" for overflow                       | P2       | **Exists** |
| S-STORE-13 | Student count and lessons display | Social proof       | View space card                               | Shows enrolled student count and lesson count                       | P2       | **Exists** |
| S-STORE-14 | No results for search             | Empty filter       | Search for nonexistent term                   | Shows "No spaces found" empty state                                 | P2       | **New**    |

### 13.2 Store Detail (`/store/:spaceId`)

| #         | Test Name               | Description     | Steps                                          | Expected Behavior                                                      | Priority | Status     |
| --------- | ----------------------- | --------------- | ---------------------------------------------- | ---------------------------------------------------------------------- | -------- | ---------- |
| S-STRD-01 | Detail page renders     | Hero section    | Click space title or navigate to `/store/{id}` | Full-width thumbnail, title, subject badge, labels, description, stats | P1       | **Exists** |
| S-STRD-02 | CTA — not enrolled      | Purchase action | View unenrolled space                          | "Enroll Now" or "Add to Cart" button                                   | P0       | **Exists** |
| S-STRD-03 | CTA — enrolled          | Post-purchase   | View enrolled space                            | "Continue Learning" green button                                       | P1       | **Exists** |
| S-STRD-04 | CTA — in cart           | Cart state      | View space already in cart                     | "Remove from Cart" button                                              | P1       | **Exists** |
| S-STRD-05 | Content preview section | Course contents | View detail page                               | Accordion/list showing lesson #, title, type, estimated minutes        | P2       | **Exists** |
| S-STRD-06 | Stats display           | Space metadata  | View detail                                    | Shows lesson count, enrolled students, type                            | P2       | **Exists** |

### 13.3 Checkout (`/store/checkout`)

| #        | Test Name                   | Description       | Steps                                         | Expected Behavior                                                           | Priority | Status     |
| -------- | --------------------------- | ----------------- | --------------------------------------------- | --------------------------------------------------------------------------- | -------- | ---------- |
| S-CHK-01 | Checkout page renders       | Cart review       | Navigate to `/store/checkout` with items      | Cart items list + order summary sidebar                                     | P0       | **Exists** |
| S-CHK-02 | Cart item details           | Item display      | View checkout                                 | Each item shows thumbnail, title, price                                     | P0       | **Exists** |
| S-CHK-03 | Remove item from checkout   | Cart modification | Click remove on an item                       | Item removed from list, total updated                                       | P1       | **Exists** |
| S-CHK-04 | Clear cart link             | Bulk action       | Click "Clear cart"                            | All items removed                                                           | P1       | **New**    |
| S-CHK-05 | Order summary — total       | Price calculation | View order summary                            | Shows item count, subtotal, and total price                                 | P0       | **Exists** |
| S-CHK-06 | Complete purchase           | Transaction       | Click "Enroll Now" / "Complete Purchase"      | Processing state → Success screen with checkmark and "Enrollment Complete!" | P0       | **Exists** |
| S-CHK-07 | Success — Go to My Learning | Post-purchase nav | On success screen → Click "Go to My Learning" | Navigates to consumer dashboard `/consumer`                                 | P1       | **Exists** |
| S-CHK-08 | Success — Continue Browsing | Post-purchase nav | On success screen → Click "Continue Browsing" | Navigates back to store `/store`                                            | P1       | **Exists** |
| S-CHK-09 | Empty cart checkout         | Edge case         | Navigate to checkout with no cart items       | Shows empty cart message or redirects                                       | P2       | **New**    |
| S-CHK-10 | Free items note             | Price display     | Cart with free items                          | Shows "Free" instead of $0.00                                               | P2       | **New**    |

---

## 14. B2C Consumer — Dashboard & Profile

### 14.1 Consumer Dashboard (`/consumer`)

| #          | Test Name                | Description    | Steps                             | Expected Behavior                                                     | Priority | Status     |
| ---------- | ------------------------ | -------------- | --------------------------------- | --------------------------------------------------------------------- | -------- | ---------- |
| S-CDASH-01 | Dashboard renders        | Page structure | Login as consumer                 | "My Learning" heading, plan badge, enrolled spaces count, total spend | P0       | **Exists** |
| S-CDASH-02 | Plan badge displayed     | Account info   | View dashboard                    | Shows "Free" or "Paid" plan badge                                     | P1       | **Exists** |
| S-CDASH-03 | Enrolled spaces grid     | Content        | View dashboard with enrollments   | Space cards with thumbnails, titles, progress                         | P0       | **Exists** |
| S-CDASH-04 | Click enrolled space     | Navigation     | Click on enrolled space card      | Navigates to space viewer at `/consumer/spaces/{id}`                  | P0       | **Exists** |
| S-CDASH-05 | Empty — Browse store CTA | No enrollments | Dashboard with no enrolled spaces | CTA button to browse Space Store                                      | P2       | **Exists** |
| S-CDASH-06 | Total Spend display      | Billing info   | View dashboard                    | Shows total amount spent                                              | P2       | **Exists** |

### 14.2 Consumer Profile (`/profile`)

| #          | Test Name                            | Description     | Steps                          | Expected Behavior                                         | Priority | Status     |
| ---------- | ------------------------------------ | --------------- | ------------------------------ | --------------------------------------------------------- | -------- | ---------- |
| S-CPROF-01 | Profile page renders                 | Page structure  | Navigate to `/profile`         | Account info card with avatar, name, email                | P1       | **Exists** |
| S-CPROF-02 | Stats grid                           | Account metrics | View profile                   | Plan, Enrolled Spaces count, Total Spent in 3-column grid | P1       | **Exists** |
| S-CPROF-03 | Join School CTA                      | Cross-app link  | View profile                   | School icon + link to login with school code              | P2       | **Exists** |
| S-CPROF-04 | Purchase history — with transactions | Billing         | View profile with purchases    | Transaction list: space title, purchase date, amount      | P2       | **Exists** |
| S-CPROF-05 | Purchase history — empty state       | No purchases    | View profile with no purchases | "No purchases yet" message with link to store             | P2       | **Exists** |

---

## 15. Chat Tutor

**Route:** `/chat`

| #         | Test Name                 | Description      | Steps                            | Expected Behavior                                                     | Priority | Status     |
| --------- | ------------------------- | ---------------- | -------------------------------- | --------------------------------------------------------------------- | -------- | ---------- |
| S-CHAT-01 | Chat Tutor page renders   | Page structure   | Navigate to `/chat`              | MessageCircle icon, "Chat Tutor" heading, description text            | P1       | **Exists** |
| S-CHAT-02 | Session list renders      | Chat history     | View page with previous sessions | Session cards with bot icon, title, last message, message count, date | P1       | **Exists** |
| S-CHAT-03 | Empty sessions state      | No history       | View with no chat sessions       | Bot icon + "No chat sessions yet" message                             | P2       | **Exists** |
| S-CHAT-04 | Active session badge      | Status indicator | View active session card         | "Active" badge visible                                                | P2       | **New**    |
| S-CHAT-05 | Click session opens panel | Interaction      | Click on a chat session card     | ChatTutorPanel opens with conversation history                        | P1       | **New**    |

---

## 16. Notifications

**Route:** `/notifications`

| #          | Test Name                              | Description      | Steps                             | Expected Behavior                                          | Priority | Status     |
| ---------- | -------------------------------------- | ---------------- | --------------------------------- | ---------------------------------------------------------- | -------- | ---------- |
| S-NOTIF-01 | Notifications page renders             | Page structure   | Navigate to `/notifications`      | Notifications heading, All and Unread filter tabs          | P1       | **Exists** |
| S-NOTIF-02 | All tab — shows notifications          | Default view     | View All tab                      | List of all notifications (or empty state)                 | P1       | **Exists** |
| S-NOTIF-03 | Unread tab — filters                   | Filtering        | Click "Unread" tab                | Shows only unread notifications                            | P1       | **Exists** |
| S-NOTIF-04 | Notification bell — unread count       | Header indicator | View header notification bell     | Shows unread count badge when notifications exist          | P1       | **Exists** |
| S-NOTIF-05 | Click notification — navigates         | Action handling  | Click notification with actionUrl | Navigates to the specified URL                             | P2       | **New**    |
| S-NOTIF-06 | Click unread notification — marks read | Auto-read        | Click on unread notification      | Notification marked as read automatically                  | P2       | **New**    |
| S-NOTIF-07 | Mark all as read                       | Bulk action      | Click "Mark all as read" button   | All notifications marked as read, unread count resets to 0 | P2       | **New**    |
| S-NOTIF-08 | Empty state                            | No notifications | View with no notifications        | Shows "No notifications" or similar empty message          | P2       | **New**    |

---

## 17. Loading, Error & Empty States

| #          | Test Name                  | Description         | Steps                                      | Expected Behavior                               | Priority | Status     |
| ---------- | -------------------------- | ------------------- | ------------------------------------------ | ----------------------------------------------- | -------- | ---------- |
| S-STATE-01 | Auth loading spinner       | Init state          | Navigate to any protected route            | Loading spinner while auth initializes (brief)  | P2       | **New**    |
| S-STATE-02 | Spaces list skeleton       | Async loading       | Navigate to `/spaces` (intercept to delay) | Skeleton loader cards visible before data loads | P2       | **New**    |
| S-STATE-03 | Dashboard skeleton         | Async loading       | Login (dashboard loading)                  | Skeleton cards for stat cards and spaces grid   | P2       | **New**    |
| S-STATE-04 | Empty My Spaces            | No assigned content | Student with no class assignments          | Icon + "No spaces available" or similar message | P2       | **New**    |
| S-STATE-05 | Empty leaderboard          | No ranking data     | View leaderboard with no data              | Empty state message                             | P2       | **New**    |
| S-STATE-06 | Empty tests page           | No timed tests      | View `/tests` with no test story points    | Empty state message                             | P2       | **New**    |
| S-STATE-07 | Access denied — wrong role | Role guard          | Non-student user tries B2B route           | "Access Denied" message or redirect to consumer | P1       | **New**    |
| S-STATE-08 | 404 — NotFoundPage         | Invalid route       | Navigate to `/invalid-random-path`         | NotFoundPage component rendered                 | P2       | **Exists** |

---

## 18. Responsive Behavior

| #         | Test Name                        | Description         | Steps                                  | Expected Behavior                                                        | Priority | Status  |
| --------- | -------------------------------- | ------------------- | -------------------------------------- | ------------------------------------------------------------------------ | -------- | ------- |
| S-RESP-01 | Mobile — sidebar collapses       | Mobile layout       | Set viewport to mobile (375px) → Login | Sidebar collapses to hamburger menu                                      | P2       | **New** |
| S-RESP-02 | Mobile — sidebar opens on toggle | Mobile interaction  | Click hamburger menu                   | Sidebar slides in as overlay                                             | P2       | **New** |
| S-RESP-03 | Mobile — dashboard cards stack   | Responsive grid     | View dashboard on mobile               | Stat cards stack vertically instead of 4-column                          | P2       | **New** |
| S-RESP-04 | Mobile — space cards stack       | Responsive grid     | View spaces list on mobile             | Space cards stack to 1 column                                            | P2       | **New** |
| S-RESP-05 | Mobile — timed test usable       | Core flow on mobile | Take a timed test on mobile            | Timer, navigator, and question all accessible (may use different layout) | P1       | **New** |
| S-RESP-06 | Tablet — sidebar visible         | Medium viewport     | Set viewport to tablet (768px)         | Sidebar visible, content area adjusts                                    | P2       | **New** |

---

## 19. Accessibility

| #         | Test Name                         | Description          | Steps                                               | Expected Behavior                                  | Priority | Status  |
| --------- | --------------------------------- | -------------------- | --------------------------------------------------- | -------------------------------------------------- | -------- | ------- |
| S-A11Y-01 | Login — keyboard navigation       | Keyboard access      | Tab through login form fields                       | All fields reachable via Tab, Enter submits form   | P1       | **New** |
| S-A11Y-02 | Sidebar — keyboard navigation     | Keyboard access      | Tab through sidebar links                           | All links focusable and activatable with Enter     | P2       | **New** |
| S-A11Y-03 | MCQ options — keyboard selection  | Interaction          | Tab to MCQ options → Space/Enter to select          | Option selected via keyboard                       | P1       | **New** |
| S-A11Y-04 | Dialog — focus trap               | Modal pattern        | Open Sign Out confirmation dialog                   | Focus trapped within dialog, Escape closes it      | P2       | **New** |
| S-A11Y-05 | Test navigator — keyboard         | Timed test           | Tab to question navigator numbers → Enter to select | Can jump to questions via keyboard                 | P2       | **New** |
| S-A11Y-06 | ARIA labels on buttons            | Screen reader        | Inspect interactive elements                        | All buttons and links have accessible names        | P2       | **New** |
| S-A11Y-07 | Color contrast — score indicators | Visual accessibility | Check score colors against backgrounds              | All color-coded scores meet WCAG AA contrast ratio | P3       | **New** |
| S-A11Y-08 | Heading hierarchy                 | Document structure   | Check all pages                                     | Proper h1 → h2 → h3 hierarchy, no skipped levels   | P3       | **New** |

---

## 20. Test Data Requirements

### Pre-seeded Data (Firebase — Greenwood International School)

| Data                  | Location                                       | Required For                  | Details                                                                |
| --------------------- | ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| School tenant         | `tenants/` with code `GRN001`                  | All B2B logins                | Status: active                                                         |
| Student 1 (Aarav)     | `userMemberships/` role=student                | Email login, core flows       | `aarav.patel@greenwood.edu`, classIds: `['cls_g8_math', 'cls_g8_sci']` |
| Student 2 (Diya)      | `userMemberships/` role=student                | Multi-student tests           | `diya.gupta@greenwood.edu`                                             |
| Student (Roll)        | `userMemberships/` role=student                | Roll number login             | Roll: `2025001`                                                        |
| Consumer user         | `users/` with consumerProfile                  | B2C login, store, checkout    | `consumer@gmail.test`                                                  |
| Published spaces (2+) | `tenants/GRN001/spaces/`                       | Spaces list, viewer, practice | With story points and items                                            |
| Timed test space      | `spaces/` with timed_test storyPoint           | Timed test flow               | Duration, questions, passing % configured                              |
| Practice space        | `spaces/` with practice storyPoint             | Practice mode                 | Questions with difficulty levels                                       |
| Published exams (2+)  | `tenants/GRN001/exams/`                        | Results page, exam detail     | Status: results_released                                               |
| Graded submissions    | `tenants/GRN001/submissions/`                  | Exam result detail            | With questionSubmissions for feedback                                  |
| Student progress      | `tenants/GRN001/spaceProgress/`                | Progress tracking, completion | Per-space progress records                                             |
| Leaderboard data      | RTDB `leaderboards/overall`                    | Leaderboard rankings          | Entries with userId and points                                         |
| Store spaces          | `spaces/` with accessType: public_store        | Store listing, checkout       | Mix of free and paid                                                   |
| Consumer enrollments  | `users/{uid}/consumerProfile/enrolledSpaceIds` | Consumer dashboard            | Links to store spaces                                                  |
| Notifications         | `tenants/GRN001/notifications/`                | Notification tests            | Mix of read and unread                                                 |

### Runtime Test Data (Created During Tests)

| Action                    | Created By                | Cleanup Strategy                    |
| ------------------------- | ------------------------- | ----------------------------------- |
| Test session (timed test) | Start Test flow           | No cleanup needed (historical data) |
| Practice evaluations      | Answer practice questions | Stored in RTDB, no cleanup needed   |
| Cart items                | Add to Cart flow          | Clear cart in afterEach or test     |
| Consumer enrollment       | Enroll Free / Checkout    | No cleanup (permanent)              |
| Notification read status  | Mark as read tests        | No cleanup needed                   |

### Test Isolation Notes

- Tests run sequentially (workers: 1) to avoid Firebase auth conflicts
- Each test logs in fresh via `beforeEach` for clean state
- Cart state is per-session (consumer store), reset on logout
- Timed test creates new attempt each run — tests should be idempotent
- Leaderboard data is real-time from RTDB — tests should not assume specific
  rankings
