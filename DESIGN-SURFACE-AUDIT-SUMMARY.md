# lvlup-full-design-system implementation audit — cross-app summary

Audited every screen in `lvlup-full-design-system/prototypes/**` and `app/**`
shells against the actual codebase, per app. 8 apps audited via parallel maestro
sonnet sessions (each fanning out haiku subagents per screen). 216 screens
audited total: **18 fully missing, 147 partial, 48 fully implemented.** Full
per-screen detail with file paths lives in each app's own report (linked below).

Two design-system app categories have **no corresponding app in this repo at
all** — not audited screen-by-screen, just flagged as 100% unbuilt:

- **`mobile-family`** — a parent/guardian mobile app for monitoring multiple
  children (leaderboard, streaks, achievements, at-risk alerts, child
  comparison, "Buy now" purchases — a mobile counterpart to parent-web, which is
  currently web-only).
- **`mobile-scanner`** — a dedicated exam-scanning mobile app
  (`prototypes/scanner/*`, 9 screens: camera-capture, capture-review,
  scan-history, scanner-login, scanner-settings, select-exam, select-student,
  submit-confirm, upload-queue). No scanning capability exists in any app today.

---

## Per-app: screens with NO implementation at all

### super-admin (1 missing / 12 audited) — [full report](super-admin-design-audit.md)

- **super-admin-billing** — no route/page at all; subscription details, quota
  caps, cost ledger, cost trend chart, per-tenant usage table all absent.

### admin-web (1 missing / 21 audited) — [full report](apps/admin-web/admin-design-audit.md)

- **llm-usage** — no route exists. Note: the design spec renders it inside a
  super-admin shell, so this may actually belong on the super-admin app rather
  than tenant-admin — reconcile before building.

### parent-web (3 missing / 13 audited) — [full report](apps/parent-web/DESIGN-AUDIT.md)

- **announcements** — no page, route, or nav entry at all.
- **multi-child-switcher** — no topbar child-picker; the existing RoleSwitcher
  only switches tenants; child selection is implicit via page-level query
  params.
- **child-exam-result-detail** — no `/results/:id` detail route; feedback is an
  inline accordion instead of a standalone page.

### student-web (1 missing / 32 audited) — [full report](apps/student-web/design-surface-audit.md)

- **tests-list** — only a card-list exists; needs a full table with status
  badges, filter chips, sort controls, attempt counters, grade pills, window
  dates, cooldown timers.

### teacher-web (10 missing / 53 audited) — [full report](apps/teacher-web/design-surface-audit.md)

- **announcements-compose** — no route/page.
- **assign-content-to-class** — no creation flow; existing page only tracks
  assignments read-only.
- **at-risk-students** — no intervention triage worklist page.
- **teacher-settings** — only an Evaluation tab exists;
  Profile/Appearance/Notifications missing.
- **pipeline-deadletter-monitor** — no DLQ monitoring page
  (retry/manual-grade/dismiss).
- **results-release** — no dedicated page; exam detail has a Release button but
  no checklist/auto-release-toggle/per-student table.
- **subquestion-rubric** — no interactive per-question rubric editor.
- **answer-key-management** — no dedicated answer-key editor/lock UI.
- **item-type-picker** — no visual question-type catalog modal; editor is opened
  directly.
- **space-detail-overview** — no read-only detail view with KPI stats +
  story-point track.

### mobile-admin (0 missing / 21 audited) — [full report](apps/mobile-admin/docs/design-audit-report.md)

Every screen has a route. Gaps are all partial-implementation depth issues (see
below).

### mobile-teacher (1 missing / 33 audited) — [full report](docs/audits/mobile-teacher-design-audit.md)

- **Exam Settings** — no `gradingConfig` settings editor; lifecycle controls,
  post-publish locks, archive/delete cascade all absent.

### mobile-student (1 missing / 31 audited) — [full report](apps/mobile-student/docs/design-audit-report.md)

- **learner-app-shell** — spec is a full B2B desktop shell
  (sidebar/topbar/⌘K/breadcrumbs); app has a mobile-only bottom tabbar. Flagged
  by the auditor as expected architectural divergence, not a real gap — mobile
  apps shouldn't have a desktop shell.

---

## Scale of partial implementations (real functional gaps, not just missing screens)

Fully-missing screens (18) undercount the real gap — **147 of 216 screens are
"partial":** routed and rendering, but missing meaningful chunks of the spec'd
functionality. Recurring cross-app patterns worth fixing systemically rather
than screen-by-screen:

- **No bulk actions / row action menus / table views** — recurring across
  admin-web, mobile-admin, teacher-web (courses, spaces-overview, question-bank,
  exams-list, classes-overview, etc. all use simplified card grids instead of
  the spec'd sortable/filterable data tables).
- **No trend/analytics charts anywhere** — platform-analytics,
  class-analytics-insights, progress-analytics, exam-analytics, space-analytics
  all lack the spec'd bar/trend charts across every app that has an analytics
  surface.
- **Celebration/burst animations absent everywhere** on mobile-student and
  student-web.
- **HITL grading two-pane workspace missing** on both teacher-web and
  mobile-teacher (grading-review, submission-detail, manual-override all lack
  side-by-side answer+rubric view).
- **Reviews/ratings write flows are read-only or absent**
  (space-reviews-ratings, store-space-detail) across student-web and
  mobile-student — no compose/edit/vote UI.
- **Settings pages are single-tab stubs** vs the spec'd multi-tab
  (teacher-settings on both teacher-web and mobile-teacher;
  tenant-settings-branding missing Evaluation/Features tabs on both admin-web
  and mobile-admin).

## Counts by app

| App            | Audited | Missing                    | Partial | Implemented                                  |
| -------------- | ------- | -------------------------- | ------- | -------------------------------------------- |
| super-admin    | 12      | 1                          | 7       | 4                                            |
| admin-web      | 21      | 1                          | 15      | 5                                            |
| parent-web     | 13      | 3                          | 9       | 1                                            |
| student-web    | 32      | 1                          | 27      | 4                                            |
| teacher-web    | 53      | 10                         | 32      | 11                                           |
| mobile-admin   | 21      | 0                          | 20      | 1                                            |
| mobile-teacher | 33      | 1                          | 14      | 15 (+3 web-deferred, +2 app-only w/ no spec) |
| mobile-student | 31      | 1                          | 23      | 7                                            |
| **Total**      | **216** | **18**                     | **147** | **48**                                       |
| mobile-family  | —       | _entire app unbuilt_       | —       | —                                            |
| mobile-scanner | 9       | _entire app unbuilt (9/9)_ | —       | —                                            |
