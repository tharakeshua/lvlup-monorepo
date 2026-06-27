# UX Audit: Student-Web App

**Date:** 2026-03-09 **Auditor:** AI UX Audit Agent **App:** `apps/student-web`
(React + Vite + TypeScript + Tailwind + shadcn/ui + Firebase) **Scope:**
Complete student experience — auth, dashboard, learning flows, tests, practice,
analytics, achievements, navigation, error/loading/empty states, responsiveness,
accessibility, micro-interactions

---

## Executive Summary

The student-web app is a well-structured, feature-rich learning platform with
two distinct user paths: **B2B school students** and **B2C consumer learners**.
The codebase demonstrates strong engineering fundamentals — lazy loading, error
boundaries, PWA support, real-time data, accessibility considerations, and
consistent use of shared UI components. However, several UX friction points and
gaps reduce the overall experience quality.

### Top 5 Critical Issues

| #   | Issue                                                                                                                                                        | Severity | Impact                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| 1   | **No loading skeleton on DashboardPage while `summaryLoading` is true** — the entire dashboard renders nothing (blank screen) until summary loads            | Critical | First impression; students see a blank page after login                       |
| 2   | **TimedTestPage is a 500+ line monolith with complex state** — cognitive overload for students, and high risk of rendering bugs in the most high-stakes flow | Critical | Test-taking experience is fragile; any rendering issue = test failure anxiety |
| 3   | **No password reset / "forgot password" flow** on any login form                                                                                             | Critical | Students locked out of their accounts permanently                             |
| 4   | **Consumer route `/profile` conflicts with B2B route `/profile`** — both RequireAuth wrappers match, leading to unpredictable routing                        | High     | Consumer profile may never render; B2B profile may render for consumer users  |
| 5   | **No "unsaved changes" guard on test navigation** — students can accidentally leave a timed test with back/forward browser navigation                        | High     | Loss of test progress, potential failed submissions                           |

---

## Detailed Findings by Flow/Area

### 1. Authentication Flow

#### 1.1 No Password Reset Flow

- **Severity:** Critical
- **Current behavior:** Login forms (SchoolCredentialsForm, ConsumerLoginForm)
  have email+password fields but no "Forgot Password?" link or reset mechanism.
  Students who forget their password are completely locked out.
- **Recommended improvement:** Add a "Forgot Password?" link that triggers
  Firebase's `sendPasswordResetEmail()`. Show a toast confirmation. For school
  students, direct them to contact their school admin.

#### 1.2 No Password Strength Indicator on Signup

- **Severity:** Medium
- **Current behavior:** ConsumerSignupForm accepts any password without
  validation beyond HTML `required`. No minimum length, strength indicator, or
  confirm-password field.
- **Recommended improvement:** Add client-side password validation (min 8 chars,
  at least 1 number), a password strength indicator, and a confirm-password
  field. Display inline validation errors.

#### 1.3 Consumer Signup — No Email Verification

- **Severity:** Medium
- **Current behavior:** Consumer signup creates the account immediately and
  navigates to `/consumer`. No email verification step.
- **Recommended improvement:** Send a verification email post-signup. Optionally
  show a "Verify your email" banner on the dashboard until confirmed.

#### 1.4 Google Sign-In Button Missing Icon

- **Severity:** Low
- **Current behavior:** The "Sign in with Google" button in ConsumerLoginForm
  has no Google logo/icon — just text. This reduces trust and recognition.
- **Recommended improvement:** Add the Google "G" logo SVG to the button for
  instant visual recognition.

#### 1.5 Auth State — No "Return to" After School Login

- **Severity:** Low
- **Current behavior:** SchoolCredentialsForm uses `location.state.from` to
  redirect after login, which works. However, ConsumerLoginForm always redirects
  to `/consumer`, ignoring the `from` state.
- **Recommended improvement:** Respect `location.state.from` in consumer login
  too, so users return to their intended destination.

---

### 2. Dashboard (B2B Student)

#### 2.1 Blank Screen During Summary Load

- **Severity:** Critical
- **Current behavior:** When `summary` is `null` and `summaryLoading` is `true`,
  the Dashboard renders `null` (line 346: `summaryLoading ? null`). The user
  sees the header and nothing else — no skeleton, no spinner.
- **Recommended improvement:** Show skeleton cards matching the summary grid
  layout when `summaryLoading` is true. Use the existing `Skeleton` component
  from shared-ui.

#### 2.2 "Resume Learning" Always Shows First Space

- **Severity:** Medium
- **Current behavior:** The "Resume Learning" card always shows
  `recentSpaces[0]`, which is the first space from the spaces list — not
  necessarily the most recently active one. Spaces are not sorted by
  last-interaction.
- **Recommended improvement:** Track and sort by `lastAccessedAt` timestamp.
  Show the space the student was most recently working on.

#### 2.3 Logout Button Prominent on Dashboard

- **Severity:** Low
- **Current behavior:** A "Sign Out" button with icon is displayed in the
  dashboard header, using equal visual weight to the welcome message. This is
  atypical for student apps — logout is usually buried in settings/profile.
- **Recommended improvement:** Remove the logout button from the dashboard
  header. It already exists in Settings page. A single logout location reduces
  accidental logouts.

#### 2.4 No Visual Differentiation for At-Risk Status

- **Severity:** Medium
- **Current behavior:** The `AtRiskBadge` component shows at-risk status inline
  in Quick Stats, but there's no prominent banner or visual callout when a
  student is flagged. Students may not notice.
- **Recommended improvement:** When `isAtRisk` is true, show a dismissible alert
  banner at the top of the dashboard with specific, actionable suggestions
  (e.g., "You haven't completed any spaces this week. Try starting with [Space
  Name]").

---

### 3. Spaces & Learning Content

#### 3.1 StoryPointViewerPage — Filter UX on Mobile

- **Severity:** Medium
- **Current behavior:** The StoryPointViewerPage has 4 filter dropdowns (search,
  type, difficulty, completion) and a clear-filters button. On mobile, these
  stack vertically and take up significant screen real estate before any content
  is visible.
- **Recommended improvement:** Collapse filters behind a "Filters" button/sheet
  on mobile. Show active filter count as a badge.

#### 3.2 No Keyboard Navigation for Section Sidebar

- **Severity:** Medium
- **Current behavior:** The desktop sidebar for sections uses `<Button>`
  elements (good), but there are no keyboard shortcuts to jump between sections.
  Heavy mouse dependency.
- **Recommended improvement:** Add keyboard shortcuts (e.g., `[` and `]` to
  navigate sections) or at minimum ensure tab order is logical.

#### 3.3 SpaceViewerPage — "Resume" Button Context

- **Severity:** Low
- **Current behavior:** The "Resume" button navigates to the first incomplete
  story point, but doesn't tell the user where it leads. Students may feel
  disoriented after clicking.
- **Recommended improvement:** Show the target story point name in the Resume
  button tooltip or subtitle (e.g., "Resume: Chapter 3 - Fractions").

#### 3.4 No Confirmation Before Leaving Learning Content

- **Severity:** Low
- **Current behavior:** When a student navigates away from StoryPointViewerPage
  mid-progress, there's no confirmation prompt.
- **Recommended improvement:** For content with in-progress evaluations, show a
  `beforeunload` warning or in-app confirmation (already implemented in
  PracticeModePage — replicate pattern).

---

### 4. Timed Tests (TimedTestPage)

#### 4.1 Component Complexity / Fragility

- **Severity:** Critical
- **Current behavior:** TimedTestPage is a single 500+ line component managing
  landing view, active test, results view, adaptive testing, section navigation,
  answer persistence, countdown timer, auto-submit, and celebration animations.
  This is the highest-stakes flow in the app.
- **Recommended improvement:** Decompose into sub-components: `TestLanding`,
  `ActiveTestView`, `TestResults`, `TestHeader`. Extract hooks like
  `useTestNavigation`, `useAnswerPersistence`. Critical path deserves the most
  modular, testable code.

#### 4.2 Browser Navigation During Active Test

- **Severity:** High
- **Current behavior:** No `beforeunload` handler is registered during an active
  timed test (unlike PracticeModePage which does). Students can accidentally
  navigate away using browser back/forward buttons, losing their progress.
- **Recommended improvement:** Add `beforeunload` listener when
  `view === 'test'`. Also intercept React Router navigation with a
  `Prompt`/`useBlocker` guard.

#### 4.3 Auto-Submit Notification Placement

- **Severity:** Medium
- **Current behavior:** When time runs out, the test auto-submits and shows a
  notice. However, the `autoSubmitNotice` state is set but its rendering
  location in the results view may not be immediately visible — the student
  could see results without realizing it was auto-submitted.
- **Recommended improvement:** Show a prominent alert banner at the top of
  results: "This test was auto-submitted when time ran out. Some answers may be
  incomplete."

#### 4.4 Save Status Indicator — Insufficient Feedback

- **Severity:** Medium
- **Current behavior:** Answer saves show a subtle status text
  (saving/saved/error). In a high-stress test scenario, students need stronger
  reassurance.
- **Recommended improvement:** Use a persistent status indicator in the test
  header (e.g., a small green dot for "saved", spinning for "saving", red for
  "error with retry").

#### 4.5 Question Navigator — Mobile Usability

- **Severity:** Medium
- **Current behavior:** The question navigator is in a `Sheet` (slide-over) on
  mobile, which requires explicit opening. During a timed test, students need
  quick access to navigate between questions.
- **Recommended improvement:** On mobile, show a compact horizontal scrolling
  question number bar at the top of the test (always visible), in addition to
  the full sheet navigator.

---

### 5. Practice Mode

#### 5.1 No "Complete Practice" / Summary View

- **Severity:** Medium
- **Current behavior:** When a student answers all practice questions, nothing
  special happens — the counter shows `N/N solved` but there's no summary, no
  celebration, no next action. The experience just... ends.
- **Recommended improvement:** When all questions are answered, show a
  completion summary with score, retry options, and a link to the next story
  point or back to the space.

#### 5.2 Practice Progress Persistence — Silent Failure

- **Severity:** Medium
- **Current behavior:** `persistToRTDB` catches errors and calls `handleError`,
  but the student has no indication that their practice progress failed to save.
  If they close the tab, progress is lost.
- **Recommended improvement:** Show a persistent "Save failed" indicator with a
  manual retry button.

---

### 6. Results & Analytics

#### 6.1 ExamResultPage — No Link from Dashboard

- **Severity:** Medium
- **Current behavior:** The ExamResultPage exists at `/exams/:examId/results`,
  but the dashboard's "Recent Exam Results" section only shows exam name and
  percentage — no clickable link to view detailed results.
- **Recommended improvement:** Make each exam row in "Recent Exam Results" a
  link to `/exams/${examId}/results`.

#### 6.2 ProgressPage — No Loading State for Summary

- **Severity:** Low
- **Current behavior:** When the progress page loads and `summary` is null (not
  yet loaded, not in error), the "Overall" tab shows a plain text message: "No
  overall progress data yet." This is misleading during the loading phase since
  `spaces` loading is handled but `summary` is not independently.
- **Recommended improvement:** Show skeleton cards while `summary` is loading.
  Only show the "no data yet" message when loading is complete and data is
  genuinely empty.

#### 6.3 TestAnalyticsPage — Bar Chart Not Accessible

- **Severity:** Medium
- **Current behavior:** Score Progression and Time Trend are rendered as
  CSS-styled div bars. No `role`, `aria-label`, or data table alternative.
- **Recommended improvement:** Add `role="img"` with `aria-label` describing the
  trend, or provide a data table toggle for screen reader users.

---

### 7. Achievements & Gamification

#### 7.1 Celebration Burst May Fire Unexpectedly

- **Severity:** Low
- **Current behavior:** On AchievementsPage, `CelebrationBurst` fires when
  `earned.length > lastCount` (tracked in sessionStorage). If achievements are
  retroactively added by admin, students see confetti on every visit until they
  exceed the new count.
- **Recommended improvement:** Track by a hash of achievement IDs rather than
  count. Only celebrate genuinely new achievements.

#### 7.2 Achievements — No Progress Toward Locked Achievements

- **Severity:** Medium
- **Current behavior:** Locked achievements show the achievement card in a
  locked/greyed state, but there's no progress indicator showing how close the
  student is to earning it.
- **Recommended improvement:** Where possible, show progress (e.g., "Complete 3
  more spaces to earn this badge" or a mini progress bar on the achievement
  card).

---

### 8. Study Planner

#### 8.1 Study Goals — No Auto-Tracking

- **Severity:** Medium
- **Current behavior:** Study goals track `currentCount` but it never
  auto-increments based on actual student activity. Students must mentally track
  their own progress against goals.
- **Recommended improvement:** Wire goal progress to actual completion data
  (e.g., if goal is "Complete 3 spaces", update `currentCount` when a space is
  completed).

#### 8.2 NewGoalForm — No Error Handling for Firestore Write

- **Severity:** Medium
- **Current behavior:** The `handleSubmit` in NewGoalForm wraps Firestore
  `addDoc` in a try block but has no catch — if the write fails,
  `setSaving(false)` runs (in `finally`) but no error is shown.
- **Recommended improvement:** Add a catch block to display an error message
  using toast or inline alert.

#### 8.3 Calendar — Not Scrollable to Other Weeks

- **Severity:** Low
- **Current behavior:** WeekCalendarStrip shows only the current week (Mon-Sun).
  No way to see past or future weeks.
- **Recommended improvement:** Add left/right arrows to navigate between weeks.

---

### 9. Chat Tutor

#### 9.1 ChatTutorPage — Starting New Conversations

- **Severity:** Medium
- **Current behavior:** The Chat Tutor page only shows previous sessions and
  requires students to "start a conversation from any question." There's no way
  to start a free-form chat from this page.
- **Recommended improvement:** Add a "Start New Chat" button or a text input on
  the Chat Tutor page for open-ended questions not tied to specific items.

#### 9.2 Chat Panel — No Markdown Rendering

- **Severity:** Medium
- **Current behavior:** AI tutor responses are displayed as plain text. If the
  AI responds with code blocks, lists, or formatting, it appears as raw text.
- **Recommended improvement:** Render AI messages with a markdown parser (e.g.,
  `react-markdown`). Support code blocks, bold, lists, and math notation.

#### 9.3 Chat Panel — No Error State

- **Severity:** Medium
- **Current behavior:** If `sendMessage.mutate()` fails, the pending indicator
  disappears but no error is shown. The message is silently lost.
- **Recommended improvement:** Show an error state with the failed message and a
  retry button.

---

### 10. Consumer Flow (B2C)

#### 10.1 Route Conflict: `/profile`

- **Severity:** High
- **Current behavior:** Both B2B routes (under
  `RequireAuth allowedRoles={['student']}`) and Consumer routes (under
  `RequireAuth` with no roles) define `/profile`. React Router will match the
  first one. Consumer users without a student role get redirected to `/consumer`
  before reaching `/profile`, but if they somehow access it, they'll see the
  wrong profile page.
- **Recommended improvement:** Namespace consumer routes clearly. Use
  `/consumer/profile` for consumer profile (already partially done but
  `/profile` in ConsumerLayout nav points to `/profile` not
  `/consumer/profile`).

#### 10.2 Store — "Load More" is a Navigation Link

- **Severity:** Medium
- **Current behavior:** The "Load more spaces" button at the bottom of
  StoreListPage is a `<Link to="/store?after=${data.lastId}">` — this triggers a
  full page navigation and re-render rather than appending results.
- **Recommended improvement:** Implement infinite scroll or a "Load More" button
  that fetches the next page and appends to the existing list without
  navigation.

#### 10.3 Checkout — Sequential Purchase Processing

- **Severity:** Medium
- **Current behavior:** Cart items are purchased sequentially in a `for` loop.
  If one fails, the user sees partial success with some errors. The UX for this
  mixed state is confusing.
- **Recommended improvement:** Process purchases in parallel with
  `Promise.allSettled()`. Show clear per-item success/failure indicators. Allow
  retrying individual failed items.

#### 10.4 ConsumerDashboardPage — Less Feature-Rich

- **Severity:** Low
- **Current behavior:** Consumer dashboard is basic compared to B2B: no progress
  tracking, no streak, no achievements, no recommendations. Just enrolled spaces
  and stats.
- **Recommended improvement:** Add space-level progress bars to enrolled space
  cards. Show learning streak if available.

---

### 11. Navigation & Layout

#### 11.1 ConsumerLayout Missing OfflineBanner

- **Severity:** Low
- **Current behavior:** AppLayout (B2B) includes `<OfflineBanner />` but
  ConsumerLayout does not. Consumer users won't see offline warnings.
- **Recommended improvement:** Add `<OfflineBanner />` to ConsumerLayout.

#### 11.2 Mobile Bottom Nav — No Active Indicator Animation

- **Severity:** Low
- **Current behavior:** Mobile bottom nav items use `isActive` state for
  highlighting, but there's no transition animation when switching tabs.
- **Recommended improvement:** Add a sliding underline or pill indicator that
  animates between active tabs.

#### 11.3 Sidebar — No Search

- **Severity:** Low
- **Current behavior:** The sidebar has static nav groups. With 10+ nav items,
  finding a specific page requires scanning the full list.
- **Recommended improvement:** Add a quick-search / command palette (Cmd+K) that
  allows students to jump to any page, space, or test instantly.

---

### 12. Forms & Input

#### 12.1 QuestionAnswerer — Submit Button Not a `<Button>` Component

- **Severity:** Low
- **Current behavior:** The "Submit Answer" button in QuestionAnswerer is a raw
  `<button>` with inline Tailwind classes, not the shared `<Button>` component.
  Same for "Try Again" and "Ask AI Tutor."
- **Recommended improvement:** Replace with `<Button>` from shared-ui for
  consistent styling, loading states, and focus management.

#### 12.2 Review Form — No Character Limit

- **Severity:** Low
- **Current behavior:** SpaceReviewSection's textarea has no `maxLength` or
  character counter. Students could submit extremely long reviews.
- **Recommended improvement:** Add a `maxLength={500}` and character counter.

---

### 13. Loading & Error States

#### 13.1 Consistent Skeleton Usage — Good

- **Severity:** N/A (Positive)
- **Current behavior:** Nearly all pages implement skeleton loading states using
  the shared `Skeleton` component. This is excellent and consistent.
- **Note:** Keep this pattern as-is. Exception noted in Dashboard (finding 2.1).

#### 13.2 Error Boundary Coverage — Good

- **Severity:** N/A (Positive)
- **Current behavior:** Every route in App.tsx is wrapped in
  `<RouteErrorBoundary>`. A `SectionErrorBoundary` class component is available
  for section-level recovery. This is thorough.

#### 13.3 Empty States — Mostly Good, Some Plain Text

- **Severity:** Low
- **Current behavior:** Most pages use the `<EmptyState>` component with icons
  and descriptions. However, some pages (StoryPointViewerPage line 384,
  ChatTutorPage, TestsPage) fall back to plain `<p>` text for empty states.
- **Recommended improvement:** Use the shared `<EmptyState>` component
  consistently across all empty states.

---

### 14. Accessibility

#### 14.1 Good Accessibility Practices — Noted

- **Severity:** N/A (Positive)
- `role="alert"` on error messages (RequireAuth, NetworkStatusBanner)
- `aria-live="polite"` on FeedbackPanel
- `role="timer"` with `aria-live` on CountdownTimer (threshold-based
  announcements)
- `role="progressbar"` with proper `aria-value*` on ProgressBar
- `role="navigation"` on QuestionNavigator
- `aria-label` on buttons, lists, and landmark regions
- `SkipToContent` component in both layouts
- `RouteAnnouncer` for screen reader route change announcements
- Adequate keyboard focus management on form elements

#### 14.2 Color-Only Status Indicators

- **Severity:** Medium
- **Current behavior:** QuestionNavigator uses color-only differentiation for
  question statuses (green=answered, red=not answered, etc.). While symbols are
  added as overlays, they are tiny (8px) and positioned as superscripts.
- **Recommended improvement:** Make symbols larger or add a more prominent
  visual pattern (border style, icon) to each status. The color+symbol approach
  is acceptable but could be more robust.

#### 14.3 Missing `alt` Text on Space Thumbnails

- **Severity:** Low
- **Current behavior:** In SpacesListPage and ConsumerDashboardPage, space
  thumbnail images use `alt=""` (decorative) even though they provide context
  about the space content.
- **Recommended improvement:** Use meaningful alt text: `alt={space.title}` or
  `alt={`Thumbnail for ${space.title}`}`.

#### 14.4 Focus Management After Modal Actions

- **Severity:** Low
- **Current behavior:** After submitting a review, creating a goal, or
  completing checkout, focus is not explicitly returned to a logical element.
- **Recommended improvement:** After dialog/sheet close, return focus to the
  trigger element using `useRef`.

---

### 15. Responsiveness

#### 15.1 Good Responsive Patterns — Noted

- Grid layouts use `md:grid-cols-2 lg:grid-cols-3` breakpoints consistently
- Mobile section picker in StoryPointViewerPage (`lg:hidden` /
  `hidden lg:block`)
- Mobile bottom nav with `MobileBottomNav` component
- `truncate` and `line-clamp` used on text elements
- Skeleton counts adapt appropriately

#### 15.2 StoryPointViewerPage — Sidebar Disappears on Tablet

- **Severity:** Low
- **Current behavior:** Section sidebar shows at `lg:block` (1024px+). On
  tablets (768-1024px), there's no section navigation visible — the mobile
  dropdown is `lg:hidden` so it shows, but the layout shifts abruptly.
- **Recommended improvement:** Consider showing the sidebar at `md` breakpoint
  (768px) or using a collapsible sidebar pattern.

#### 15.3 Test Timer — Small on Mobile

- **Severity:** Low
- **Current behavior:** CountdownTimer renders at normal text size. On small
  mobile screens during a timed test, the timer may not be immediately visible
  without scrolling.
- **Recommended improvement:** Make the timer sticky at the top of the viewport
  during active tests.

---

### 16. Micro-Interactions & Polish

#### 16.1 Good Animations — Noted

- `FadeIn`, `AnimatedCard`, `AnimatedList`, `AnimatedListItem`, `CountUp`,
  `Pressable` components provide pleasant motion
- `CelebrationBurst` for space completion and new achievements
- `PageTransition` for route changes
- ProgressBar has optional `animate` prop

#### 16.2 Missing Loading State on Answer Submission

- **Severity:** Medium
- **Current behavior:** When submitting an answer in QuestionAnswerer,
  `evaluateAnswer.mutateAsync` is called but the Submit button shows no loading
  state (no spinner, no disabled state during API call).
- **Recommended improvement:** Pass `evaluateAnswer.isPending` to disable the
  submit button and show a loading spinner.

#### 16.3 No Haptic/Sound Feedback on Correct/Incorrect

- **Severity:** Low
- **Current behavior:** FeedbackPanel shows visual correct/incorrect feedback,
  but there's no sound or haptic feedback. For younger students, multi-sensory
  feedback improves engagement.
- **Recommended improvement:** Optional (settings-controlled) sound effects for
  correct/incorrect answers. Haptic feedback via Vibration API on mobile.

---

## Quick Wins vs Long-Term Improvements

### Quick Wins (< 1 day each)

| #   | Issue                                                                 | Effort |
| --- | --------------------------------------------------------------------- | ------ |
| 1   | Add loading skeleton to DashboardPage when `summaryLoading` is true   | 30 min |
| 2   | Add "Forgot Password?" link to login forms                            | 1 hr   |
| 3   | Add `beforeunload` handler to TimedTestPage during active test        | 30 min |
| 4   | Fix route conflict: rename consumer `/profile` to `/consumer/profile` | 1 hr   |
| 5   | Add Google icon to "Sign in with Google" button                       | 15 min |
| 6   | Replace raw `<button>` elements in QuestionAnswerer with `<Button>`   | 30 min |
| 7   | Add loading spinner to answer submit button                           | 30 min |
| 8   | Add error catch to NewGoalForm's handleSubmit                         | 15 min |
| 9   | Add `OfflineBanner` to ConsumerLayout                                 | 5 min  |
| 10  | Make "Recent Exam Results" rows clickable links                       | 30 min |
| 11  | Use `EmptyState` component consistently across all empty states       | 1 hr   |
| 12  | Add meaningful `alt` text to space thumbnails                         | 30 min |

### Medium-Term (1-3 days each)

| #   | Issue                                                  | Effort  |
| --- | ------------------------------------------------------ | ------- |
| 1   | Practice mode completion summary view                  | 1 day   |
| 2   | Chat tutor markdown rendering                          | 1 day   |
| 3   | Chat tutor error handling with retry                   | 0.5 day |
| 4   | Sticky timer during timed tests on mobile              | 0.5 day |
| 5   | Collapsible filters on mobile for StoryPointViewerPage | 1 day   |
| 6   | Store "Load More" as append instead of navigation      | 1 day   |
| 7   | Password strength indicator on signup                  | 0.5 day |
| 8   | Achievement progress indicators                        | 1 day   |
| 9   | Auto-submit banner in test results                     | 0.5 day |
| 10  | Week navigation in Study Planner calendar              | 0.5 day |

### Long-Term (3+ days each)

| #   | Issue                                                 | Effort   |
| --- | ----------------------------------------------------- | -------- |
| 1   | Decompose TimedTestPage into modular sub-components   | 2-3 days |
| 2   | Auto-tracking for study goals based on real activity  | 3-5 days |
| 3   | Free-form chat tutor (not tied to specific items)     | 3-5 days |
| 4   | Command palette (Cmd+K) for quick navigation          | 2-3 days |
| 5   | "Resume Learning" based on actual last-accessed space | 1-2 days |
| 6   | Email verification flow for consumer signup           | 2 days   |
| 7   | Consumer dashboard feature parity (progress, streaks) | 3-5 days |
| 8   | At-risk student intervention banner                   | 1-2 days |

---

## Summary Statistics

- **Total findings:** 42
- **Critical:** 3
- **High:** 2
- **Medium:** 20
- **Low:** 17
- **Positive observations:** 7 (accessibility, animations, error boundaries,
  loading states, responsiveness, PWA, code splitting)

The student-web app is in a strong position overall. The critical issues are
concentrated in two areas: **authentication gaps** (no password reset) and
**dashboard loading state** (blank screen). The high-priority issues around
**route conflicts** and **test navigation guards** are straightforward fixes.
The medium-severity items are mostly about completing the UX polish and filling
in missing feedback loops.
