# Mobile-Teacher Design Surface Audit

**Date:** 2026-07-19  
**App:** `apps/mobile-teacher` (Expo/RN)  
**Design system:** `lvlup-full-design-system`  
**References:** `app/mobile-staff/App-MobileStaff.card.html` (teacher-role
sections t1–t5), `prototypes/teacher/*.card.html`,
`prototypes/exams/*.card.html` (teacher-relevant subset)

---

## Method

One Haiku subagent per screen or small batch: (1) read the `.card.html` spec,
(2) find the matching app route/page, (3) verdict on **functional coverage**,
not pixel fidelity. "Heavy authoring lives on the web app" notes in specs are
treated as correctly out of scope (→ `web-deferred`), not missing.

---

## Summary

| Verdict                   | Count  |
| ------------------------- | ------ |
| Implemented               | 15     |
| Partial                   | 14     |
| Missing                   | 1      |
| Web-deferred / Admin-only | 3      |
| **Total audited**         | **33** |

Additionally, 2 screens exist **in the app with no design spec counterpart**
(Space Editor, Story Point Editor — logged at bottom).

---

## MISSING (1)

| Screen        | Design Spec                                | App File | Reason                                                                                                                                                        |
| ------------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exam Settings | `prototypes/exams/exam-settings.card.html` | _(none)_ | No gradingConfig settings editor or exam settings tab exists in mobile-teacher; lifecycle controls, post-publish locks, and archive/delete cascade are absent |

---

## PARTIAL (14)

| Screen                      | Design Spec                                            | App File                              | Gap                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assignment Tracker          | `prototypes/teacher/assignment-tracker.card.html`      | `src/app/teacher/assignments.tsx`     | Core filters/status badges/progress present; desktop matrix grid replaced by mobile card layout (appropriate) but no per-student drill-through from the list                                                            |
| Assign Content to Class     | `prototypes/teacher/assign-content-to-class.card.html` | `src/app/teacher/assign.tsx`          | Streamlined single-pick flow; desktop stepper shows multi-class selection, scheduling, visibility controls, sticky review panel — deferred to web via "Continue on web"                                                 |
| Exams Overview (Review tab) | `prototypes/teacher/exams-overview.card.html`          | `src/app/teacher/review.tsx`          | Core exam list with filtering and per-row review CTA present; missing search input, kebab-menu per-exam actions (Release / Archive), and "needs review" row highlighting                                                |
| Submissions Grading Queue   | `prototypes/exams/submissions-grading-queue.card.html` | `src/app/teacher/grading.tsx`         | Exam picker and submission list present; missing KPI metrics strip, search/filter toolbar, bulk-action bar, sortable columns, and live-sync indicator                                                                   |
| Grading Review              | `prototypes/exams/grading-review.card.html`            | `src/app/teacher/grading-review.tsx`  | Lane-based tab filtering and submission header present; two-pane HITL workspace (answer canvas + question-by-question panel with confidence routing) absent — the spec's flagship grading cockpit                       |
| Submission Detail           | `prototypes/exams/submission-detail.card.html`         | `src/app/teacher/submission.tsx`      | Score summary + per-question cards with status/confidence present; accordion rubric expansion, feedback/answer crops, strengths/weaknesses section, and override audit timeline missing                                 |
| Manual Override             | `prototypes/exams/manual-override.card.html`           | `src/app/teacher/override.tsx`        | Score stepper + reason textarea + save present; ResultSummary header recomputation, staff-only rubric/model-answer evidence block, original-vs-new score comparison, and override audit trail missing                   |
| At-Risk Students            | `prototypes/teacher/at-risk-students.card.html`        | `src/app/teacher/at-risk.tsx`         | Severity filter chips and per-row triage list with dismiss actions present; search toolbar and bulk-action selection UI missing                                                                                         |
| Class Test Analytics        | `prototypes/teacher/class-test-analytics.card.html`    | `src/app/teacher/class-tests.tsx`     | Exam picker, KPI tiles, grade distribution, hardest questions, and topic performance present; score histogram with pass-line, time-usage/timer-band breakdown, retakes section, and per-question data table missing     |
| Space Analytics             | `prototypes/teacher/space-analytics.card.html`         | `src/app/teacher/space-analytics.tsx` | Space picker, content shape card, KPI tiles, and learner reviews present; mastery distribution ring, story-point completion funnel, per-class completion bars, and student completion table missing                     |
| Teacher Settings            | `prototypes/teacher/teacher-settings.card.html`        | `src/app/teacher/settings.tsx`        | Profile (name/email/role/tenant) and Appearance (theme picker) present; Evaluation tab (tenant-wide dimension/confidence settings) intentionally deferred to web per code comment                                       |
| Exam Questions Editor       | `prototypes/exams/exam-questions-editor.card.html`     | `src/app/teacher/item-editor.tsx`     | 14 of 15 question types editable; `chat_agent_question` explicitly excluded from mobile (read-only) to protect private answer-key schema — deliberate, not accidental                                                   |
| Exam Detail Overview        | `prototypes/exams/exam-detail-overview.card.html`      | _(spread)_                            | Lifecycle stepper + KPI strip + Questions/Submissions/Settings tabs specified as unified page; mobile app spreads this across `review.tsx`, `grading.tsx`, and `exam-analytics.tsx` with no single cohesive detail view |
| Subquestion Rubric          | `prototypes/exams/subquestion-rubric.card.html`        | `src/app/teacher/rubric.tsx`          | Spec is a rubric **editor** (add/remove/reorder criteria, edit name/points/guidance); app has a rubric **viewer** used during grading review — read-only, no authoring capability                                       |

---

## IMPLEMENTED (15)

| Screen                         | Design Spec                                                                                         | App File                                   | Note                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher Dashboard              | `prototypes/teacher/teacher-dashboard.card.html`                                                    | `src/app/teacher/home.tsx`                 | Hero greeting, KPI tiles (classes/review/at-risk), needs-attention feed, class list with progress, announcements card all present               |
| Classes Overview               | `prototypes/teacher/classes-overview.card.html`                                                     | `src/app/teacher/classes.tsx`              | Class index with search, health metrics (students, spaces, exams, at-risk, avg performance) — card layout vs web table                          |
| Class Detail / Roster          | `prototypes/teacher/class-detail-roster.card.html`                                                  | `src/app/teacher/class.tsx`                | All 3 tabs: Roster (searchable, risk flags), Content (assign + answer-key lock), Snapshot (class-level KPIs)                                    |
| Students Directory             | `prototypes/teacher/students-directory.card.html`                                                   | `src/app/teacher/students.tsx`             | Searchable list, filter chips (status/risk), per-row score/enrollment status/at-risk flag/last-active                                           |
| Student Detail Progress        | `prototypes/teacher/student-detail-progress.card.html`                                              | `src/app/teacher/student.tsx`              | Identity header, KPI tiles, subject completion bars, recent exams, strengths/growth badges                                                      |
| Results Release                | `prototypes/exams/results-release.card.html`                                                        | `src/app/teacher/release.tsx`              | Readiness checklist (Ready/Needs review/Failed grading counts), confirmation summary, blocker alerts, approval checkbox, release action + retry |
| Exam Analytics                 | `prototypes/exams/exam-analytics-results.card.html` + `prototypes/teacher/exam-analytics.card.html` | `src/app/teacher/exam-analytics.tsx`       | KPI cards, grade distribution, per-question averages, topic performance, class breakdown                                                        |
| Class Analytics / Insights Hub | `prototypes/teacher/class-analytics-insights.card.html`                                             | `src/app/teacher/insights.tsx`             | Class picker, 4 KPI cards, pass/fail distribution, drill-down cards, recent insights feed                                                       |
| Announcements Compose          | `prototypes/teacher/announcements-compose.card.html`                                                | `src/app/teacher/announcements.tsx`        | Composer (title, message, audience picker, pin toggle) + recent feed with status/audience/timestamp, wired to real query hooks                  |
| Notifications                  | `prototypes/teacher/notifications.card.html`                                                        | `src/app/teacher/notifications.tsx`        | Reverse-chron feed, type registry with icons/tones, read/unread dots, mark-read actions, deep-links (exam/student), empty and error states      |
| Exam Create Setup              | `prototypes/exams/exam-create-setup.card.html`                                                      | `src/app/teacher/exam-wizard.tsx`          | 4-step wizard: metadata → upload (camera/gallery/PDF) → extraction → review/edit; mobile replaces web drag-drop with native file pickers        |
| Question Paper Upload          | `prototypes/exams/question-paper-upload.card.html`                                                  | `src/app/teacher/exam-wizard.tsx` (Step 1) | Covered as Step 1 of the exam wizard — photo, gallery, or PDF; extraction and review wired through Steps 2–3                                    |
| Teacher More / Menu            | `app/mobile-staff/App-MobileStaff.card.html` (Section t5-more)                                      | `src/app/teacher/more.tsx`                 | Identity hero + Communicate (Announcements/Notifications) + Insights (Class insights/At-risk) + Account (Settings/Switch school) + Log out      |
| Generate Content (AI)          | `prototypes/spaces/ai-content-generation.card.html`                                                 | `src/app/teacher/generate-content.tsx`     | 3-step flow: space picker → story-point picker → spec form (PDF upload, question types, difficulty, count) → generation → draft review/accept   |
| Tenant Switcher                | `prototypes/teacher/tenant-switcher.card.html`                                                      | `src/app/teacher/tenant.tsx`               | Memberships list, active/inactive states, switch action, join-by-code, loading/error states                                                     |

---

## WEB-DEFERRED / OUT-OF-SCOPE (3)

| Screen               | Design Spec                                              | Reason                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Answer Sheet Upload  | `prototypes/exams/answer-sheet-upload.card.html`         | Spec explicitly marks `uploadSource: web`; teacher cannot upload scanned sheets via mobile — pipeline monitor row exists in grading queue but upload trigger is web-only |
| Evaluation Settings  | `prototypes/exams/evaluation-settings.card.html`         | Tenant-wide dimension/confidence-routing settings; `TeacherSettingsScreen` code comment explicitly defers to web; desktop-only 1280px viewport in spec                   |
| Pipeline DLQ Monitor | `prototypes/exams/pipeline-deadletter-monitor.card.html` | Admin/ops-only surface (spec sidebar labels it "Admin"); not teacher-facing, out of scope for this app                                                                   |

---

## App-only screens (no design spec counterpart)

These screens are fully implemented in the app but have no matching prototype in
the design system:

| Screen             | App File                                 | Note                                                                                                                                    |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Space Editor       | `src/app/teacher/space-editor.tsx`       | Create/edit space (type, access, metadata) — content-authoring surface; 17 teacher prototypes focus on viewing/analytics, not authoring |
| Story Point Editor | `src/app/teacher/story-point-editor.tsx` | Create/edit story point (type, scoring, time fields); same gap — no authoring spec in design system                                     |

---

## Priority gaps to address

1. **Grading Review** (partial) — the two-pane HITL workspace is the core
   teacher grading experience; current mobile is a lane-filter shell only
2. **Exam Detail Overview** (partial) — unified lifecycle page with
   Questions/Submissions/Settings tabs needs a dedicated route
3. **Exam Settings** (missing) — gradingConfig toggles, post-publish locks, and
   archive controls have no mobile surface at all
4. **Submission Detail** (partial) — rubric breakdown and answer crops are core
   to meaningful review; currently omitted
5. **Subquestion Rubric** (partial) — add authoring mode to the existing
   view-only rubric screen, or explicitly web-defer with a `<WebDefer>` note
