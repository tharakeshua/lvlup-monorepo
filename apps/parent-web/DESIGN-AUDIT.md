# Parent Web — Design Surface Audit

**Date:** 2026-07-19  
**Design system source:**
`lvlup-full-design-system/prototypes/parent/*.card.html` +
`app/web-parent/App-Parent.card.html`  
**App audited:** `apps/parent-web/src/`  
**Method:** Parallel Haiku subagent per screen batch; judged on functional
coverage, not pixel fidelity.

---

## Results Summary

| Verdict     | Count  |
| ----------- | ------ |
| Missing     | 3      |
| Partial     | 9      |
| Implemented | 1      |
| **Total**   | **13** |

_(Plus App-Parent shell/nav: partial — see below. Mobile-family extra features:
see appendix.)_

---

## MISSING (3 screens)

### 1. `announcements.card.html`

- **File:** none
- **Gap:** No `AnnouncementsPage` route or component exists anywhere in the app.
  The design spec describes a full-page feed with category filter chips
  (school/class/exam), featured/pinned announcement card, accordion entries
  grouped by recency, and per-announcement metadata (author, timestamp, category
  icons). The nav sidebar has no Announcements entry.

### 2. `multi-child-switcher.card.html`

- **File:** none
- **Gap:** No topbar child-switcher dropdown menu exists. The existing
  `RoleSwitcher` in `AppLayout.tsx` switches _tenants_ (schools), not individual
  children within a tenant. The design spec calls for a topbar dropdown showing
  all linked children with avatars, name, grade, average score, at-risk
  indicator, active-child checkmark highlight, and footer buttons ("Compare all"
  / "Manage children"). Child selection currently only exists as page-level
  query-param tabs within `ChildProgressPage`.

### 3. `child-exam-result-detail.card.html`

- **File:** none (partial coverage in
  `apps/parent-web/src/pages/ExamResultsPage.tsx`)
- **Gap:** No dedicated full-page detail route. The design spec requires a
  standalone page with back-nav, large header card with grade pill, overall
  score section, released-only security note, and structured per-question
  breakdown cards. Current `ExamResultsPage.tsx` embeds per-question feedback as
  accordion expansion within the list — there is no `/results/:id` detail route
  in `App.tsx`.

---

## PARTIAL (9 screens)

### 4. `parent-login.card.html`

- **File:** `apps/parent-web/src/pages/LoginPage.tsx`
- **Verdict:** Two-step flow (school-code → credentials) and form validation are
  present. **Missing:** school lockup branding section (crest icon, school name,
  "Parent Portal" label), visual stepper progress indicator (step 1/2 with
  progress bar), and security reassurance footer message.

### 5. `parent-dashboard.card.html`

- **File:** `apps/parent-web/src/pages/DashboardPage.tsx`
- **Verdict:** KPI strip (4 scorecards), child cards with avatars/stats/progress
  bars, quick-action cards, and data freshness indicator are implemented.
  **Missing:** at-risk alert banner (highlighted warning above content), recent
  activity card with activity list, subject display in child card metadata.
  Note: `summaries` variable referenced but undefined at line 150.

### 6. `children-roster.card.html`

- **File:** `apps/parent-web/src/pages/ChildrenPage.tsx`
- **Verdict:** Core card layout, at-risk badge, metrics grid, and recent exam
  results are present. **Missing:** 4-metric grid (only 3 metrics shown),
  exam-average grade pill, "Compare children" button in page header, "Space
  progress" action button on each child card.

### 7. `child-space-progress.card.html`

- **File:** `apps/parent-web/src/pages/SpaceProgressPage.tsx`
- **Verdict:** Core grid layout (space cards grouped by child) is working.
  **Missing:** released-only informational note, per-child section headers with
  avatar/grade/metadata, at-risk indicators on child sections, visual
  story-point track component (spec shows track visualization; app shows text
  counts only), empty state for unassigned spaces, compare children button.

### 8. `child-comparison.card.html`

- **File:** `apps/parent-web/src/pages/ChildComparisonPage.tsx`
- **Verdict:** Basic comparison cards with metric display are present.
  **Missing:** DataTable-style metric comparison with row-level best-performer
  highlighting (green badge + checkmark), "Subject averages" grouped bar chart
  section with legend, full visual hierarchy from spec.

### 9. `notifications.card.html`

- **File:** `apps/parent-web/src/pages/NotificationsPage.tsx`
- **Verdict:** Filter chips (All/Unread), mark-all-read button, and basic
  notification list are present. **Missing:** unread dot indicators per
  notification row, type-specific icon chips with color tones (warn/info/ok),
  `aria-live` region for screen readers, header subtitle with school context,
  chevron icons on rows, proper per-type empty state as designed. Uses basic
  Tabs instead of designed filter chips with icon + count.

### 10. `performance-alerts.card.html`

- **File:** `apps/parent-web/src/pages/PerformanceAlertsPage.tsx`
- **Verdict:** Per-child alert sections and at-risk badge derivation are
  present. **Missing:** unified global alert feed (spec shows a single card feed
  across all children), child filter chips, server metadata display
  (last-updated timestamp, "nightly" tag), refresh button, severity icon chips
  with color tones, card-based alert rows with explicit action buttons,
  loading/empty/error state variants. Renders per-child accordion sections
  instead of a unified alert feed.

### 11. `child-exam-results-released.card.html`

- **File:** `apps/parent-web/src/pages/ExamResultsPage.tsx`
- **Verdict:** Accordion list with per-question feedback is partially
  implemented. **Missing:** subject filter chips, prominent domain banner
  explaining answer keys are not shown, exam-level summary comment display in
  expanded state, routing link to a detail view, and proper loading/empty/error
  state cards as shown in spec.

### 12. `parent-settings.card.html`

- **File:** `apps/parent-web/src/pages/SettingsPage.tsx`
- **Verdict:** Profile section (name/email read-only), notification preference
  toggles (×5), and account logout are implemented. **Missing:** Appearance
  section with theme selector (light/dark/system), linked children display with
  status badges in the settings page.

### 13. `App-Parent.card.html` (shell / nav)

- **File:** `apps/parent-web/src/layouts/AppLayout.tsx`
- **Verdict:** Full nav structure is present — Overview (Dashboard), My Children
  (Children, Exam Results, Space Progress, Child Progress, Alerts, Compare),
  Account (Notifications, Settings), alerts badge on Notifications. **Missing:**
  Announcements nav entry (referenced in spec but no route exists).

---

## IMPLEMENTED (1 screen)

### 14. `child-progress.card.html`

- **File:** `apps/parent-web/src/pages/ChildProgressPage.tsx`
- All 10 major functional sections present: child selector tabs, student header
  with at-risk badge, alert banner, stat strip (5 stats: overall score, exams,
  spaces, streak, points), strengths/weaknesses display, performance trends
  chart, subject breakdown charts, recommendations, recent activity timeline,
  and download report button.

---

## Appendix: Mobile-Family Features Absent from Parent Web

The mobile-family shell (`app/mobile-family/App-MobileFamily.card.html`) implies
two parent features not present in parent-web:

| Feature                       | Mobile-family description                                                          | parent-web status                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Announcements Feed**        | School/class announcement feed with categories, featured cards, filter + accordion | **Missing** — no page, no route, no nav entry                                            |
| **Multi-Child Switcher View** | Full-screen child-picker modal with role selector and child selection UI           | **Missing** — only implicit query-param selection exists; no dedicated discoverable view |

All other features described in the mobile-family shell (child comparison, exam
results, child progress, space progress, children roster, notifications,
dashboard, login, settings, performance alerts) have functional equivalents in
parent-web.
