# Student-Web Design Surface Audit

**Audited against:** `lvlup-full-design-system/prototypes/student/*.card.html`
(27 screens) + consumer/marketplace subset of `prototypes/spaces/` (4 screens:
b2c-store-browse, b2c-store-detail, space-purchase, space-reviews-ratings) +
`app/web-student/App-Student.card.html` (1 shell spec) = **32 screens total**

**Method:** Functional coverage — "implemented" = route covers same functional
surface, "partial" = some sections/functionality missing, "missing" = no
equivalent route/page exists.

**Summary:** 1 missing · 27 partial · 4 implemented

---

## Missing (1)

| Screen       | File                  | Reason                                                                                                                                                                                                                                                               |
| ------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests-list` | `pages/TestsPage.tsx` | Implements card list only; lacks table layout, status badges (available/in_progress/scheduled/cooldown/completed/closed/locked), filter chips, sort controls, attempt counters, grade pills, window dates, cooldown timers, and why-not-available tooltips from spec |

---

## Partial (27)

| Screen                                                | File                                               | What's Missing                                                                                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `achievements`                                        | `pages/AchievementsPage.tsx`                       | Detail modal/popover per badge, locked-badge progress tracking, rarity/tier icons, empty-state variants                                                                                              |
| `ai-tutor-chat`                                       | `pages/ChatTutorPage.tsx`                          | Full-page two-column layout (sessions rail + conversation), thread rendering with proper turn bubbles, streaming animation states, error/retry handling                                              |
| `checkout`                                            | `pages/CheckoutPage.tsx`                           | Toast/undo on remove, edge states (partial success, offline, stale price, permission-gated), loading skeleton, mobile sticky bar                                                                     |
| `consumer-dashboard`                                  | `pages/ConsumerDashboardPage.tsx`                  | Continue-learning banner, space card progress rings, stat animations, error/partial load states, command palette (⌘K)                                                                                |
| `consumer-profile`                                    | `pages/ConsumerProfilePage.tsx`                    | Purchase history table UI (sorting, copy btn, open links), delete account action, loading/empty/error state variants                                                                                 |
| `exam-results-view`                                   | `pages/ExamResultPage.tsx`                         | Grade ring animation, scanned answer crop + lightbox zoom, 3-part feedback structure (issue/why/fix), accordion Q review, rubric breakdown, insight card, download PDF, state variants               |
| `gamification-xp-streaks`                             | `pages/DashboardPage.tsx` + `AchievementsPage.tsx` | Unified gamification surface (split across two pages), tier progression track, recent XP points history, XP progress bar visualization                                                               |
| `goals`                                               | `pages/StudyPlannerPage.tsx`                       | Study history heatmap (8-week), session timeline, edit/delete modals, secondary states (error/saving/permission)                                                                                     |
| `leaderboard`                                         | `pages/LeaderboardPage.tsx`                        | Scope tabs (Overall / My Class / By Space), live indicator                                                                                                                                           |
| `learner-authentication`                              | `pages/LoginPage.tsx`                              | Two-column editorial split layout, hero section ("Welcome back"), full state gallery (resolving, network error)                                                                                      |
| `learning-content-view`                               | `pages/StoryPointViewerPage.tsx`                   | Appshell layout integration, XP meter widget, story-point track carousel visualization, image lightbox modal                                                                                         |
| `notifications` (partial-but-near-complete)           | `pages/NotificationsPage.tsx`                      | _(near-implemented — all features wired; UI delegated to shared-ui component)_                                                                                                                       |
| `practice-mode`                                       | `pages/PracticeModePage.tsx`                       | Offline/cache state alert, difficulty-set completion toast                                                                                                                                           |
| `profile`                                             | `pages/ProfilePage.tsx`                            | School details section with switcher, account basics section (display name/email/member-since), edit profile modal, state variants                                                                   |
| `progress-analytics`                                  | `pages/ProgressPage.tsx`                           | Trend charts (accuracy + completion over time with range toggles), comprehensive mastery grid (subject × exam avg × space completion), strengths/growth insights cards, next-step at-risk detection  |
| `settings`                                            | `pages/SettingsPage.tsx`                           | Account management section (password reset), install app CTA, dirty-state save bar, error/loading states, B2C variant controls                                                                       |
| `space-detail-learning-track` → see Implemented below | `pages/SpaceViewerPage.tsx`                        | —                                                                                                                                                                                                    |
| `spaces-list`                                         | `pages/SpacesListPage.tsx`                         | "Last opened" timestamps, sort options (recently active/progress/A-Z), B2C empty state with Browse Store CTA, detailed ratings display                                                               |
| `store-browse` (student/prototypes)                   | `pages/StoreListPage.tsx`                          | Difficulty filter chips, quick-filter chip row, star ratings on cards, toast notifications, mobile filter drawer, featured section                                                                   |
| `store-space-detail` (student/prototypes)             | `pages/StoreDetailPage.tsx`                        | Two-column layout with sticky buy aside, rich HTML description, "What's inside" syllabus with lesson list, detailed ratings + reviews section, "What you get" checklist, celebration burst animation |
| `student-home-dashboard`                              | `pages/DashboardPage.tsx`                          | Insight cards with specific recommendations, command palette (⌘K), celebration animations on load                                                                                                    |
| `test-results-review`                                 | `pages/ExamResultPage.tsx`                         | Breakdown grids (difficulty/Bloom's/section/topic), difficulty progression chart, confidence badges, tutor chat drawer, answer-key-lock seal, celebration burst, rich rubric breakdown UI            |
| `test-session-analytics`                              | `pages/TestAnalyticsPage.tsx`                      | Delta tags on topic performance, passing line on score chart, next-focus insight cards with AI recommendations                                                                                       |
| `timed-test-landing`                                  | `pages/TimedTestPage.tsx`                          | Answer key lock reassurance component, "Before you begin" guidelines panel, at-a-glance stat styling, startup error toast                                                                            |
| `timed-test-runner`                                   | `pages/TimedTestPage.tsx`                          | True focus-mode shell (appshell still visible), low-time warning UI (≤5 min / ≤1 min states), auto-submit notice pre-rendering                                                                       |
| `b2c-store-browse` (spaces/prototypes)                | `pages/StoreListPage.tsx`                          | Featured section above All Spaces grid                                                                                                                                                               |
| `b2c-store-detail` (spaces/prototypes)                | `pages/StoreDetailPage.tsx`                        | Curriculum preview with story-point nodes, "What you'll get" features list, reviews section                                                                                                          |
| `space-purchase` (spaces/prototypes)                  | `pages/CheckoutPage.tsx`                           | Payment method selection UI, multi-state demo scenarios, sticky payment column, idempotency display, trust badges                                                                                    |
| `space-reviews-ratings` (spaces/prototypes)           | `components/spaces/SpaceReviewSection.tsx`         | Sort/filter controls, rating distribution bars, helpful votes system, verified learner badges, character counter, load-more pagination, anonymous gating state                                       |

---

## Implemented (4)

| Screen                        | File                          | Notes                                                                                                                                                                      |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learner-app-shell`           | `layouts/AppLayout.tsx`       | Complete: sidebar nav, topbar, responsive variants (mobile bottom nav), state banners, notifications, role switcher                                                        |
| `notifications`               | `pages/NotificationsPage.tsx` | All required features wired (filter, mark read/all, pagination); UI rendering in shared-ui component                                                                       |
| `space-detail-learning-track` | `pages/SpaceViewerPage.tsx`   | Complete: hero/progress/XP meter, 3-tab layout (Contents/Overview/Insights), learning-path spine, node cards, insight cards, review section, completion celebration modal  |
| `App-Student shell`           | `layouts/AppLayout.tsx`       | Sidebar nav + topbar (theme toggle + notifications) + main content area; uses shadcn SidebarProvider rather than spec's `.appframe` classes but achieves functional parity |

---

_Generated 2026-07-19 via parallel Haiku agent audit (16 agents, 32 screens)._
