# STUDENT (Learner) — Design Specs

The **student area** is Auto-LevelUp's learner-facing app: the warm, encouraging
front door where people actually _learn_. One codebase serves two audiences from
the same screens — **B2B school students** (tenant-scoped, role `student`, with
class-assigned spaces and proctored exams) **and B2C consumer learners**
(self-serve, no tenant membership, served from the synthetic `platform_public`
tenant via `user.consumerProfile`, who buy spaces from a store). The split is
resolved at the data layer (`LearnerContext`), so the UX is identical and the
divergence is which reads/writes back it. The tone here is the **encouraging**
register of Lyceum — greet by name, celebrate momentum, frame setbacks as next
steps — never the precise/administrative register of the staff apps. Every
screen is built on and conforms to the Lyceum foundation
([`../00-FOUNDATION.md`](../00-FOUNDATION.md)): tokens by name (never hex), the
§5 component inventory only, and the §7 11-point spec template.

---

## Three load-bearing domain rules (true on every student screen)

1. **The answer key is NEVER shown to students.** Model answers, rubric
   model-answers, raw AI confidence, and AI cost are staff-only at every step
   (`AnswerKeyLock`). Learners read only a sanitized `ResultSummary`, and only
   once results are server-released (`resultsReleased === true`). This holds in
   practice mode, timed tests, and physical-exam results alike.
2. **The timed-test timer is server-authoritative.** `TimerBar` reflects a clock
   owned by the server, not the device — refreshing, backgrounding, or
   clock-skewing the client cannot buy time; submission and auto-submit are
   server-gated. The pre-start gate (`timed-test-landing`) deliberately shows
   **no** `TimerBar` because nothing is ticking yet.
3. **Gamification gets the ONE celebratory motion moment.** Per FOUNDATION §4,
   XP gain / streak / level-up earns a single spring pop + **marigold spark
   burst**; everything else stays subtle, and the whole system respects
   `prefers-reduced-motion`. The numbers must feel good without lying about the
   totals.

---

## Shell & Auth

The frame the learner lives in, and the door they come through.

| Screen                         | Route                                     | File                                                  | One-line purpose                                                                                                                                                          |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learner App Shell & Navigation | `/` (AppShell wrapper)                    | [learner-app-shell](./learner-app-shell.md)           | The persistent learner frame — role-aware Sidebar/Tabbar nav, Topbar (search, NotificationBell, profile), XP/streak chrome — that hosts every B2B and B2C learner screen. |
| Learner Authentication         | `/login` · `/signup` · `/forgot-password` | [learner-authentication](./learner-authentication.md) | Login/signup for an unauthenticated learner — B2B school-code join vs B2C consumer self-serve — in one mode-switched auth card.                                           |

## Learning & Content

The core learning loop: pick a space, walk the story-point track,
read/watch/drill content.

| Screen                                     | Route                                         | File                                                            | One-line purpose                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student Home Dashboard (B2B)               | `/`                                           | [student-home-dashboard](./student-home-dashboard.md)           | The warm B2B front door — greet by name, surface live momentum (XP, streak, wins), gently flag where support is needed, and route to the single next thing worth doing. |
| My Spaces (List)                           | `/spaces` · `/my-spaces`                      | [spaces-list](./spaces-list.md)                                 | The learner's library of spaces — assigned (B2B) or owned (B2C) — as scannable `SpaceCard`s with progress, ready to resume.                                             |
| Space Detail — Learning Track              | `/spaces/:spaceId`                            | [space-detail-learning-track](./space-detail-learning-track.md) | One space's `StoryPointTrack` — the mastery-stated learning path that routes into content, practice, and timed tests.                                                   |
| Learning Content View (Story Point Viewer) | `/spaces/:spaceId/story-points/:storyPointId` | [learning-content-view](./learning-content-view.md)             | The story-point viewer — `ContentRenderer` (md+KaTeX) for standard/learning material with an item navigator and progress write-back.                                    |
| Practice Mode                              | `/spaces/:spaceId/practice/:storyPointId`     | [practice-mode](./practice-mode.md)                             | Low-stakes, unlimited-retry drilling of a story point — `QuestionCard`/`AnswerInput` with instant feedback and no answer key exposure.                                  |

## Assessment — Tests & Results

The timed-test lifecycle (plan → gate → run → review → analyze) plus
physical-exam results. The server-authoritative timer and answer-key lock are
most load-bearing here.

| Screen                                | Route                                           | File                                                  | One-line purpose                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests (List)                          | `/tests`                                        | [tests-list](./tests-list.md)                         | The learner's calm planning surface for every timed test across spaces — what's open now, upcoming, done, or locked, with attempts left and scores.                               |
| Timed Test — Landing / Pre-start Gate | `/spaces/:spaceId/test/:storyPointId` (gate)    | [timed-test-landing](./timed-test-landing.md)         | The pre-start gate before a timed assessment — rules, attempts, duration, and consent — with no clock ticking yet.                                                                |
| Timed Test — Runner                   | `/spaces/:spaceId/test/:storyPointId` (running) | [timed-test-runner](./timed-test-runner.md)           | The active test surface — `TestRunnerShell` + `QuestionCard`/`AnswerInput` + server-authoritative `TimerBar` + question navigator, with low-time warning and server-gated submit. |
| Timed Test — Results Review           | `/spaces/:spaceId/test/:storyPointId` (results) | [test-results-review](./test-results-review.md)       | The post-submit `ResultSummary` per question — score, server feedback, and confidence — sanitized so no answer key crosses over.                                                  |
| Test Session Analytics (Deep Dive)    | `/spaces/:spaceId/test/:storyPointId/analytics` | [test-session-analytics](./test-session-analytics.md) | Cross-attempt deep dive — how the learner is progressing across attempts and what to study next.                                                                                  |
| Physical Exam Results / AutoGrade     | `/exams/:examId/results`                        | [exam-results-view](./exam-results-view.md)           | The learner's view of a scanned paper-exam result graded by the AutoGrade pipeline — released, sanitized `ResultSummary` only (B2B-only).                                         |

## AI Tutor

| Screen                         | Route                                                     | File                                | One-line purpose                                                                                                                          |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| AI Tutor Chat — Socratic Tutor | `/tutor/:itemId` · `/consumer/tutor` (+ in-context panel) | [ai-tutor-chat](./ai-tutor-chat.md) | The Socratic AI tutor — a `TutorChatBubble` thread (panel + full page) that guides rather than answers, and never reveals the answer key. |

## Progress & Gamification

Momentum, depth, and the lightest social-competitive surfaces — where the one
celebratory motion moment lives.

| Screen                              | Route                                          | File                                                    | One-line purpose                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress & Analytics (Cross-system) | `/progress`                                    | [progress-analytics](./progress-analytics.md)           | The learner's one place for depth — subject mastery, accuracy/completion trends, exam history, strengths/growth, and a supportively-framed at-risk signal with next steps. |
| Gamification — XP, Levels & Streaks | `/progress` (Rewards view) + dashboard widgets | [gamification-xp-streaks](./gamification-xp-streaks.md) | The `XPMeter`/`LevelBadge`/`StreakFlame` momentum surface — level progress, tier, daily streak, and recent points history with the spark-burst celebration.                |
| Achievements Gallery                | `/achievements`                                | [achievements](./achievements.md)                       | The badge gallery — earned wins made to feel like wins, plus exactly how close the next badge is (wires up the previously-unrouted page).                                  |
| Leaderboard (B2B)                   | `/leaderboard`                                 | [leaderboard](./leaderboard.md)                         | The lightest social surface — a live ranked list of classmates by points/XP with the learner's own row pinned and highlighted.                                             |
| Study Goals & Planner               | `/goals`                                       | [goals](./goals.md)                                     | The self-directed counterweight to assigned work — learner-chosen, time-boxed targets with a filling progress ring and a study-history view.                               |

## Account

Identity, preferences, and the inbox.

| Screen                           | Route                 | File                                      | One-line purpose                                                                                                                        |
| -------------------------------- | --------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Profile                          | `/profile`            | [profile](./profile.md)                   | Identity + a proud snapshot of momentum (level, streak, badges, spaces completed) with quick edits to the basics — not a settings page. |
| Settings                         | `/settings`           | [settings](./settings.md)                 | Learner preferences — notification toggles, theme, password/account — for both B2B and B2C learners.                                    |
| Notifications                    | `/notifications`      | [notifications](./notifications.md)       | The full notification center (companion to the Topbar `NotificationBell`) — new spaces, exam results, achievements, and gentle nudges.  |
| Consumer Profile / Account (B2C) | `/profile` (consumer) | [consumer-profile](./consumer-profile.md) | The B2C consumer's account surface — identity, plan, purchase receipts, logout, and the "enter a school code" path into B2B.            |

## B2C Consumer & Store

The self-serve consumer-only surfaces — store, purchase, and the consumer
learning home. B2B school students never see these (their spaces are
teacher-assigned).

| Screen                                 | Route             | File                                          | One-line purpose                                                                                              |
| -------------------------------------- | ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Consumer Dashboard / My Learning (B2C) | `/consumer`       | [consumer-dashboard](./consumer-dashboard.md) | The B2C learning home — owned spaces, continue-learning, and momentum for the self-serve consumer learner.    |
| Store (Browse)                         | `/store`          | [store-browse](./store-browse.md)             | The B2C marketplace browse — `SpaceCard` catalog of purchasable `platform_public` spaces with search/filter.  |
| Store: Space Detail                    | `/store/:spaceId` | [store-space-detail](./store-space-detail.md) | One store space's sales page — overview, syllabus preview, ratings/reviews, and the buy CTA.                  |
| B2C Checkout (Cart & Purchase)         | `/store/checkout` | [checkout](./checkout.md)                     | The self-serve cart-and-purchase flow — order summary, payment, and entitlement grant for a consumer learner. |

**Total: 27 screen specs.** (Shell & Auth 2 · Learning & Content 5 · Assessment
6 · AI Tutor 1 · Progress & Gamification 5 · Account 4 · B2C Consumer & Store 4
= 27.)

---

## Shared domain components used across student screens

Composed from FOUNDATION §5 (cite by name, never re-roll):

- **Learning path:** `SpaceCard` · `StoryPointTrack` · `StoryPointNode` ·
  `ContentRenderer` (md+KaTeX)
- **Assessment:** `QuestionCard` (dispatch over 15 types) · `AnswerInput` (per
  type) · `TimerBar` (server-authoritative countdown) · `TestRunnerShell` ·
  `ResultSummary` · `RubricBreakdown` · `ConfidenceBadge` · `GradePill` ·
  `SubmissionCard`
- **Answer-key guard:** `AnswerKeyLock` (server-only guard visual — the
  staff/student boundary)
- **Gamification:** `XPMeter` · `StreakFlame` · `LevelBadge` · `Achievement` ·
  `LeaderboardRow`
- **Tutor:** `TutorChatBubble`
- **Signals:** `AtRiskBadge` · `InsightCard`
- Plus the shared **AppShell / Sidebar / Topbar / Tabbar**, `NotificationBell`,
  and the primitives/containers/data/feedback families from §5.

## Proposed FOUNDATION additions (flagged by these specs, not silently invented)

Each is flagged for promotion into FOUNDATION §5 _before build_; several recur
across three or more screens, which is the bar for promotion:

- **`QuestionNavigator`** — the NTA-style status-colored numbered grid; three
  consumers (timed-test-runner, practice-mode, learning-content-view's
  `ItemNavigator`) justify promotion.
- **`FeedbackPanel`** — per-question server-feedback container (named in
  `webapps-design.md §2.2` / `shared-ui/feedback` but absent from §5); used in
  test-results-review and learning-content-view.
- **`StarRating`** + **`RatingDistribution`** / `SpaceReviewSection` —
  keyboard-accessible star rating input and review breakdown for B2C store
  reviews (store-space-detail).
- **`StudyHistoryHeatmap`** (+ `WeekStrip`) — learner study-consistency heatmap
  (goals); related `ClassHeatmap` / `MasteryGrid` for progress-analytics.
- **`TierTrack`** — horizontal 5-tier rail with the current tier highlighted +
  "N XP to next" (gamification-xp-streaks).
- **`OrderSummaryCard`** + **`PaymentMethodSlot`** (checkout) and
  **`ReceiptList` / `ReceiptRow` / `DangerZone`** (consumer-profile) — B2C
  purchase/account composites.
- **`SegmentedControl`** + **`SocialAuthButton`** / `AuthLayout` — auth-mode
  switch and social sign-in (learner-authentication).
- **`LeaderboardSelfBar`** + **`RankChangeIndicator`** — pinned self-row and
  rank-change cue (leaderboard).
- **`StreamingDots`** — tutor "thinking" indicator (ai-tutor-chat).
- **`DifficultyProgressionChart`** / `ChartRangeToggle` — named in
  `webapps-design.md §2.2` (`shared-ui/charts`) but not yet in §5
  (test-results-review, progress-analytics).
- **`achievement_unlocked` notification type** — currently arrives as a
  gamification-flavored `system_announcement`; a dedicated type is flagged in
  notifications.
- **Tri-state `ThemeToggle`** (System · Light · Dark) — settings asks the shared
  `ThemeToggle` spec to expose "follow my device".
- **`ImageLightbox` / `ScanCrop`** — scanned-answer image viewer inside
  `SubmissionCard`; exists informally and should be promoted rather than
  re-rolled per screen (exam-results-view).
