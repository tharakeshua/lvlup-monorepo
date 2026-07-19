# Mobile-Student Design Surface Audit

**vs. lvlup-full-design-system prototypes/student/_ + consumer/marketplace
subset of prototypes/spaces/_**

**Date:** 2026-07-19  
**Scope:** 31 screens audited (27 student prototypes + 4 consumer/marketplace
from spaces)  
**Verdict key:** `missing` = no equivalent route/screen, `partial` = some
functionality present, `implemented` = all major functional surfaces covered

---

## Summary

| Verdict     | Count  |
| ----------- | ------ |
| Missing     | 1      |
| Partial     | 23     |
| Implemented | 7      |
| **Total**   | **31** |

**Note on app-shell:** The design system's `learner-app-shell.card.html`
specifies a full B2B responsive desktop shell (sidebar, topbar, ⌘K command
palette, notifications bell, breadcrumbs) with md/lg breakpoints. The
mobile-student app is intentionally a mobile-only (sm) application — this is
expected architectural divergence, not a feature gap in the mobile app itself.
The shell verdict is `missing` because no equivalent nav chrome (desktop-scale
sidebar/topbar) exists, but the bottom tabbar is the mobile equivalent.

---

## MISSING (1)

| Screen                        | Reason                                                                                                                                                                                                          | App File                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `learner-app-shell.card.html` | Design specifies full B2B responsive desktop shell (sidebar/topbar/⌘K/notifications/breadcrumbs) with md/lg breakpoints; app implements mobile-only (sm) bottom tabbar with 3 tabs only — no desktop nav chrome | `src/app/learner/_layout.tsx` |

---

## PARTIAL (23)

| Screen                                  | Missing from app                                                                                                                                                                                                          | App File                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `achievements.card.html`                | Level strip (level badge + XP meter + streak flame) and celebratory unlock animations absent                                                                                                                              | `src/screens/progress/AchievementsScreen.tsx`        |
| `goals.card.html`                       | Study history (heatmap + session timeline), week-strip due-date filtering, completed goals accordion, and "Due this week" stat tile missing                                                                               | `src/screens/progress/GoalsScreen.tsx`               |
| `gamification-xp-streaks.card.html`     | "Recent Points" activity list replaced with Recent Achievements + Active Goals; celebration burst animations not implemented                                                                                              | `src/screens/progress/GamificationRewardsScreen.tsx` |
| `student-home-dashboard.card.html`      | Missing insights recommendations section, recent results list (3 items w/ grade pills), coming-up section (upcoming exams), and strength/growth analysis chips                                                            | `src/screens/home/HomeScreen.tsx`                    |
| `consumer-dashboard.card.html`          | 3-card plan/invested summary strip absent (replaced with generic stat tiles); no low-connectivity fallback state                                                                                                          | `src/screens/home/ConsumerDashboardScreen.tsx`       |
| `learner-authentication.card.html`      | B2B school-code flow, tenant resolution chip, mode toggle (Personal vs School Code), Google sign-in, forgot password, signup, password visibility toggle all absent                                                       | `src/app/auth/login.tsx`                             |
| `practice-mode.card.html`               | Difficulty filter control missing; minimal "no-timer/no-penalty" messaging vs design spec                                                                                                                                 | `src/screens/learn/PracticeModeScreen.tsx`           |
| `space-detail-learning-track.card.html` | Reviews section (aggregate rating, write-review textarea, other reviews list) entirely absent                                                                                                                             | `src/screens/learn/SpaceDetailScreen.tsx`            |
| `spaces-list.card.html`                 | Type badge (Learning/Practice/Assessment/Hybrid), difficulty chip, card description text, and "last opened" footer detail missing from list cards                                                                         | `src/screens/learn/SpacesListScreen.tsx`             |
| `profile.card.html`                     | Role/school switcher dropdown absent (design shows multi-school switching)                                                                                                                                                | `src/screens/profile/ProfileScreen.tsx`              |
| `settings.card.html`                    | "Install app" CTA section (conditional PWA install spark button) absent                                                                                                                                                   | `src/screens/profile/SettingsScreen.tsx`             |
| `consumer-profile.card.html`            | Purchase receipts table/list (core B2C feature), sign-out/delete-account modals, school code entry modal absent                                                                                                           | `src/screens/profile/ConsumerProfileScreen.tsx`      |
| `ai-tutor-chat.card.html`               | No floating minimised-pill panel overlay; sessions not in a dedicated rail; no post-session insight cards ("What we touched / What clicked / Where to revisit"); no moderation/rate-limit alerts; no timed-test gating UI | `src/screens/profile/AiTutorChatScreen.tsx`          |
| `progress-analytics.card.html`          | Trend charts (accuracy/completion 4w/12w/all time ranges), subject mastery table, and "Suggested for you" insights list absent; at-risk guidance is simplified                                                            | `src/screens/progress/ProgressAnalyticsScreen.tsx`   |
| `timed-test-landing.card.html`          | Full gate banner scenarios (scheduled/closed/cooldown/exhausted/locked states with specific alerts) not implemented; adaptive note chip absent                                                                            | `src/screens/tests/TimedTestLandingScreen.tsx`       |
| `test-session-analytics.card.html`      | Attempt-comparison selector (side-by-side delta cards) missing; "next focus" section simplified; locked-state flow not visible                                                                                            | `src/screens/tests/TestSessionAnalyticsScreen.tsx`   |
| `test-results-review.card.html`         | Celebration burst animation, tutor chat drawer, and detailed difficulty progression visualization (height-based dot chart) absent                                                                                         | `src/screens/tests/TestResultsReviewScreen.tsx`      |
| `exam-results-view.card.html`           | Print/download PDF actions absent; permission-gated and partial-grading state handling missing                                                                                                                            | `src/screens/tests/ExamResultsViewScreen.tsx`        |
| `checkout.card.html`                    | Multi-item cart management absent (single-space only); missing clear/remove modals, toast host, purchase confirmation modal, offline/partial-success/stale-price states, mobile sticky bar pattern                        | `src/screens/profile/CheckoutScreen.tsx`             |
| `store-browse.card.html`                | Sort options dropdown, difficulty filter chips, mobile filter sheet drawer, "owned" badge for already-purchased spaces, and per-card enrolled state absent                                                                | `src/screens/profile/StoreBrowseScreen.tsx`          |
| `store-space-detail.card.html`          | Review form (submit/edit review), rating distribution bar chart, review pagination, celebration burst on enrollment, and "in cart" state absent                                                                           | `src/screens/profile/StoreSpaceDetailScreen.tsx`     |
| `b2c-store-browse.card.html`            | Price filter, sort options, grid/list toggle, featured section, pagination, tenant-gated state variant, and list-view card layout absent                                                                                  | `src/screens/profile/StoreBrowseScreen.tsx`          |
| `space-reviews-ratings.card.html`       | Rating aggregate panel, compose/edit review flows, filtering, sorting, helpful voting, and per-review actions absent (only review list display implemented)                                                               | `src/screens/profile/StoreSpaceDetailScreen.tsx`     |

---

## IMPLEMENTED (7)

| Screen                            | Notes                                                                                                                                                               | App File                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `leaderboard.card.html`           | Standing hero, scope tabs with live indicator, ranked list, self-row pinning all present; scope options differ slightly (app has "By Topic" vs design's "My Class") | `src/screens/progress/LeaderboardScreen.tsx`     |
| `notifications.card.html`         | Full list with read/unread status, grouped notifications, "Mark all read", per-row action menu, all notification types, empty/loading/error states                  | `src/screens/profile/NotificationsScreen.tsx`    |
| `learning-content-view.card.html` | Item navigator with status indicators, attempt submission, feedback display, history, tutor access, materials, all question types, full state handling              | `src/screens/learn/ContentViewerScreen.tsx`      |
| `tests-list.card.html`            | Filters, status badges, attempts/scores, empty states, resume affordance, answer key lock, written exams entry all present                                          | `src/screens/tests/TestsListScreen.tsx`          |
| `timed-test-runner.card.html`     | 5-status navigator, server timer, mark/save/submit/exit flows, answer key seal, low-time warnings, submit and exit modals                                           | `src/screens/tests/TimedTestRunnerScreen.tsx`    |
| `b2c-store-detail.card.html`      | Hero (cover, title, metadata), curriculum preview (locked state), description, review list with ratings badge                                                       | `src/screens/profile/StoreSpaceDetailScreen.tsx` |
| `space-purchase.card.html`        | Order summary, payment method selection, tax/total calculation, error handling, and success state all present                                                       | `src/screens/profile/CheckoutScreen.tsx`         |

---

## Cross-cutting gaps (appear in multiple screens)

1. **Celebration/animation moments** — Design specifies burst animations on
   achievements unlock, level-up, pass, enrollment success; none are present in
   the mobile app (achievements, gamification, test-results-review,
   store-space-detail).
2. **Trend / chart visualisations** — Progress analytics,
   test-session-analytics, and test-results-review all show bar/line charts in
   the design; mobile app omits these entirely.
3. **B2B school-code auth** — Login screen only supports B2C personal sign-in;
   school-code → tenant resolution flow is entirely absent.
4. **Role/tenant switching** — Profile and app-shell both show multi-school/role
   switching; the mobile app has no equivalent.
5. **Review & ratings flows** — Space detail (student), store space detail, and
   b2c-store-browse all include review submission/editing/voting; the mobile app
   only shows review lists without write capability.
6. **Desktop nav chrome** — Sidebar, topbar, breadcrumbs, ⌘K command palette are
   web-only patterns; expected absent in mobile, but the design system has no
   dedicated mobile app-shell spec to target instead.
