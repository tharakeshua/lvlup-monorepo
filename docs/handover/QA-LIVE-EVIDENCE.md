# QA Live Evidence (Authentic)

Generated: 2026-07-12T20:17:54.175Z

Evidence rule: **PASS only with Playwright/browser proof**
(`tmp/qa-handover-*.png`).

## Scorecard

| App       | PASS | FAIL | SKIP |
| --------- | ---- | ---- | ---- |
| teacher   | 18   | 0    | 2    |
| student   | 11   | 0    | 0    |
| admin     | 16   | 0    | 0    |
| parent    | 10   | 0    | 0    |
| **TOTAL** | 55   | 0    | 2    |

## Credentials & ports

- School: `GRN001`
- Teacher :4569 — `priya.sharma@greenwood.edu` / `Test@12345`
- Student :4570 — `aarav.patel@greenwood.edu` / `Test@12345`
- Admin :4568 — `admin@greenwood.edu` / `Test@12345`
- Parent :4571 — `suresh.patel@gmail.com` / `Test@12345` (TEST_CREDENTIALS.md)

## Fixes applied

- `apps/teacher-web/src/sdk/session.tsx`: P0: HMR-safe SessionContext singleton
  — prevents useAuthSession crash outside SessionProvider after Vite module
  reload
- `apps/admin-web/src/sdk/session.tsx`: Same HMR-safe SessionContext singleton
  for admin SessionProvider

## Per-route results

### PASS — teacher `/ (post-login)`

- Final URL: `http://127.0.0.1:4569/`
- Screenshot: `tmp/qa-handover-teacher-01-login.png`
- Note: url=http://127.0.0.1:4569/
- Note: bodyLen=619

### PASS — teacher `/`

- Final URL: `http://127.0.0.1:4569/`
- Screenshot: `tmp/qa-handover-teacher-02-dashboard.png`
- Note: url=http://127.0.0.1:4569/
- Note: bodyLen=319

### PASS — teacher `/spaces`

- Final URL: `http://127.0.0.1:4569/spaces`
- Screenshot: `tmp/qa-handover-teacher-03-spaces.png`
- Note: url=http://127.0.0.1:4569/spaces
- Note: bodyLen=556

### PASS — teacher `/question-bank`

- Final URL: `http://127.0.0.1:4569/question-bank`
- Screenshot: `tmp/qa-handover-teacher-04-question-bank.png`
- Note: url=http://127.0.0.1:4569/question-bank
- Note: bodyLen=362

### PASS — teacher `/rubric-presets`

- Final URL: `http://127.0.0.1:4569/rubric-presets`
- Screenshot: `tmp/qa-handover-teacher-05-rubric-presets.png`
- Note: url=http://127.0.0.1:4569/rubric-presets
- Note: bodyLen=273

### PASS — teacher `/exams`

- Final URL: `http://127.0.0.1:4569/exams`
- Screenshot: `tmp/qa-handover-teacher-06-exams.png`
- Note: url=http://127.0.0.1:4569/exams
- Note: bodyLen=407

### PASS — teacher `/exams/new`

- Final URL: `http://127.0.0.1:4569/exams/new`
- Screenshot: `tmp/qa-handover-teacher-07-exam-create.png`
- Note: url=http://127.0.0.1:4569/exams/new
- Note: bodyLen=501

### PASS — teacher `/classes`

- Final URL: `http://127.0.0.1:4569/classes`
- Screenshot: `tmp/qa-handover-teacher-08-classes.png`
- Note: url=http://127.0.0.1:4569/classes
- Note: bodyLen=458

### PASS — teacher `/analytics/classes` (retest)

- Final URL: `http://127.0.0.1:4569/analytics/classes`
- Screenshot: `tmp/qa-handover-retest-teacher-analytics-classes.png`
- Note: replaced-by-retest
- Note: screenshot-present

### PASS — teacher `/analytics/exams`

- Final URL: `http://127.0.0.1:4569/analytics/exams`
- Screenshot: `tmp/qa-handover-teacher-10-analytics-exams.png`
- Note: url=http://127.0.0.1:4569/analytics/exams
- Note: bodyLen=428

### PASS — teacher `/analytics/spaces`

- Final URL: `http://127.0.0.1:4569/analytics/spaces`
- Screenshot: `tmp/qa-handover-teacher-11-analytics-spaces.png`
- Note: url=http://127.0.0.1:4569/analytics/spaces
- Note: bodyLen=421

### PASS — teacher `/analytics/tests`

- Final URL: `http://127.0.0.1:4569/analytics/tests`
- Screenshot: `tmp/qa-handover-teacher-12-analytics-tests.png`
- Note: url=http://127.0.0.1:4569/analytics/tests
- Note: bodyLen=523

### PASS — teacher `/assignments`

- Final URL: `http://127.0.0.1:4569/assignments`
- Screenshot: `tmp/qa-handover-teacher-13-assignments.png`
- Note: url=http://127.0.0.1:4569/assignments
- Note: bodyLen=399

### PASS — teacher `/grading`

- Final URL: `http://127.0.0.1:4569/grading`
- Screenshot: `tmp/qa-handover-teacher-14-grading.png`
- Note: url=http://127.0.0.1:4569/grading
- Note: bodyLen=452

### PASS — teacher `/students`

- Final URL: `http://127.0.0.1:4569/students`
- Screenshot: `tmp/qa-handover-teacher-15-students.png`
- Note: url=http://127.0.0.1:4569/students
- Note: bodyLen=745

### PASS — teacher `/settings` (retest)

- Final URL: `http://127.0.0.1:4569/settings`
- Screenshot: `tmp/qa-handover-retest-teacher-settings.png`
- Note: replaced-by-retest
- Note: screenshot-present

### PASS — teacher `/notifications`

- Final URL: `http://127.0.0.1:4569/notifications`
- Screenshot: `tmp/qa-handover-teacher-17-notifications.png`
- Note: url=http://127.0.0.1:4569/notifications
- Note: bodyLen=315

### PASS — teacher `/classes/cls_greenwood-class-g8-math_db8edee86a`

- Final URL:
  `http://127.0.0.1:4569/classes/cls_greenwood-class-g8-math_db8edee86a`
- Screenshot: `tmp/qa-handover-teacher-18-class-detail.png`
- Note: url=http://127.0.0.1:4569/classes/cls_greenwood-class-g8-math_db8edee86a
- Note: bodyLen=309

### SKIP — teacher `/spaces/:id/edit`

- Final URL: `http://127.0.0.1:4569/spaces`
- Note: No space edit link visible

### SKIP — teacher `/exams/:id`

- Final URL: `http://127.0.0.1:4569/exams`
- Note: No exam detail link visible

### PASS — student `/ (post-login)`

- Final URL: `http://127.0.0.1:4570/`
- Screenshot: `tmp/qa-handover-student-01-login.png`
- Note: url=http://127.0.0.1:4570/
- Note: bodyLen=278

### PASS — student `/` (retest)

- Final URL: `http://127.0.0.1:4570/`
- Screenshot: `tmp/qa-handover-retest-student-dashboard.png`
- Note: bodyLen=258
- Note: replaced-by-retest

### PASS — student `/spaces` (retest)

- Final URL: `http://127.0.0.1:4570/spaces`
- Screenshot: `tmp/qa-handover-retest-student-spaces.png`
- Note: bodyLen=148
- Note: replaced-by-retest

### PASS — student `/tests`

- Final URL: `http://127.0.0.1:4570/tests`
- Screenshot: `tmp/qa-handover-student-04-tests.png`
- Note: url=http://127.0.0.1:4570/tests
- Note: bodyLen=215

### PASS — student `/results`

- Final URL: `http://127.0.0.1:4570/results`
- Screenshot: `tmp/qa-handover-student-05-results.png`
- Note: url=http://127.0.0.1:4570/results
- Note: bodyLen=147

### PASS — student `/leaderboard`

- Final URL: `http://127.0.0.1:4570/leaderboard`
- Screenshot: `tmp/qa-handover-student-06-leaderboard.png`
- Note: url=http://127.0.0.1:4570/leaderboard
- Note: bodyLen=235

### PASS — student `/achievements`

- Final URL: `http://127.0.0.1:4570/achievements`
- Screenshot: `tmp/qa-handover-student-07-achievements.png`
- Note: url=http://127.0.0.1:4570/achievements
- Note: bodyLen=327

### PASS — student `/profile`

- Final URL: `http://127.0.0.1:4570/profile`
- Screenshot: `tmp/qa-handover-student-08-profile.png`
- Note: url=http://127.0.0.1:4570/profile
- Note: bodyLen=354

### PASS — student `/settings`

- Final URL: `http://127.0.0.1:4570/settings`
- Screenshot: `tmp/qa-handover-student-09-settings.png`
- Note: url=http://127.0.0.1:4570/settings
- Note: bodyLen=757

### PASS — student `/notifications`

- Final URL: `http://127.0.0.1:4570/notifications`
- Screenshot: `tmp/qa-handover-student-10-notifications.png`
- Note: url=http://127.0.0.1:4570/notifications
- Note: bodyLen=201

### PASS — student `/spaces/spc_greenwood-space-space-algebra_1d2ab9a5be`

- Final URL:
  `http://127.0.0.1:4570/spaces/spc_greenwood-space-space-algebra_1d2ab9a5be`
- Screenshot: `tmp/qa-handover-student-11-space-viewer.png`
- Note:
  url=http://127.0.0.1:4570/spaces/spc_greenwood-space-space-algebra_1d2ab9a5be
- Note: bodyLen=138

### PASS — admin `/ (post-login)`

- Final URL: `http://127.0.0.1:4568/`
- Screenshot: `tmp/qa-handover-admin-01-login.png`
- Note: url=http://127.0.0.1:4568/
- Note: bodyLen=644

### PASS — admin `/`

- Final URL: `http://127.0.0.1:4568/`
- Screenshot: `tmp/qa-handover-admin-02-dashboard.png`
- Note: url=http://127.0.0.1:4568/
- Note: bodyLen=644

### PASS — admin `/users`

- Final URL: `http://127.0.0.1:4568/users`
- Screenshot: `tmp/qa-handover-admin-03-users.png`
- Note: url=http://127.0.0.1:4568/users
- Note: bodyLen=627

### PASS — admin `/classes`

- Final URL: `http://127.0.0.1:4568/classes`
- Screenshot: `tmp/qa-handover-admin-04-classes.png`
- Note: url=http://127.0.0.1:4568/classes
- Note: bodyLen=599

### PASS — admin `/exams`

- Final URL: `http://127.0.0.1:4568/exams`
- Screenshot: `tmp/qa-handover-admin-05-exams.png`
- Note: url=http://127.0.0.1:4568/exams
- Note: bodyLen=611

### PASS — admin `/spaces`

- Final URL: `http://127.0.0.1:4568/spaces`
- Screenshot: `tmp/qa-handover-admin-06-spaces.png`
- Note: url=http://127.0.0.1:4568/spaces
- Note: bodyLen=368

### PASS — admin `/ai-usage`

- Final URL: `http://127.0.0.1:4568/ai-usage`
- Screenshot: `tmp/qa-handover-admin-07-ai-usage.png`
- Note: url=http://127.0.0.1:4568/ai-usage
- Note: bodyLen=466

### PASS — admin `/settings`

- Final URL: `http://127.0.0.1:4568/settings`
- Screenshot: `tmp/qa-handover-admin-08-settings.png`
- Note: url=http://127.0.0.1:4568/settings
- Note: bodyLen=514

### PASS — admin `/academic-sessions`

- Final URL: `http://127.0.0.1:4568/academic-sessions`
- Screenshot: `tmp/qa-handover-admin-09-academic-sessions.png`
- Note: url=http://127.0.0.1:4568/academic-sessions
- Note: bodyLen=433

### PASS — admin `/reports`

- Final URL: `http://127.0.0.1:4568/reports`
- Screenshot: `tmp/qa-handover-admin-10-reports.png`
- Note: url=http://127.0.0.1:4568/reports
- Note: bodyLen=416

### PASS — admin `/analytics`

- Final URL: `http://127.0.0.1:4568/analytics`
- Screenshot: `tmp/qa-handover-admin-11-analytics.png`
- Note: url=http://127.0.0.1:4568/analytics
- Note: bodyLen=606

### PASS — admin `/courses`

- Final URL: `http://127.0.0.1:4568/courses`
- Screenshot: `tmp/qa-handover-admin-12-courses.png`
- Note: url=http://127.0.0.1:4568/courses
- Note: bodyLen=704

### PASS — admin `/notifications`

- Final URL: `http://127.0.0.1:4568/notifications`
- Screenshot: `tmp/qa-handover-admin-13-notifications.png`
- Note: url=http://127.0.0.1:4568/notifications
- Note: bodyLen=334

### PASS — admin `/staff`

- Final URL: `http://127.0.0.1:4568/staff`
- Screenshot: `tmp/qa-handover-admin-14-staff.png`
- Note: url=http://127.0.0.1:4568/staff
- Note: bodyLen=640

### PASS — admin `/announcements`

- Final URL: `http://127.0.0.1:4568/announcements`
- Screenshot: `tmp/qa-handover-admin-15-announcements.png`
- Note: url=http://127.0.0.1:4568/announcements
- Note: bodyLen=512

### PASS — admin `/data-export`

- Final URL: `http://127.0.0.1:4568/data-export`
- Screenshot: `tmp/qa-handover-admin-16-data-export.png`
- Note: url=http://127.0.0.1:4568/data-export
- Note: bodyLen=454

### PASS — parent `/ (post-login)`

- Final URL: `http://127.0.0.1:4571/`
- Screenshot: `tmp/qa-handover-parent-01-login.png`
- Note: url=http://127.0.0.1:4571/
- Note: bodyLen=515

### PASS — parent `/`

- Final URL: `http://127.0.0.1:4571/`
- Screenshot: `tmp/qa-handover-parent-02-dashboard.png`
- Note: url=http://127.0.0.1:4571/
- Note: bodyLen=496

### PASS — parent `/children`

- Final URL: `http://127.0.0.1:4571/children`
- Screenshot: `tmp/qa-handover-parent-03-children.png`
- Note: url=http://127.0.0.1:4571/children
- Note: bodyLen=408

### PASS — parent `/results`

- Final URL: `http://127.0.0.1:4571/results`
- Screenshot: `tmp/qa-handover-parent-04-results.png`
- Note: url=http://127.0.0.1:4571/results
- Note: bodyLen=348

### PASS — parent `/progress`

- Final URL: `http://127.0.0.1:4571/progress`
- Screenshot: `tmp/qa-handover-parent-05-progress.png`
- Note: url=http://127.0.0.1:4571/progress
- Note: bodyLen=298

### PASS — parent `/child-progress`

- Final URL: `http://127.0.0.1:4571/child-progress`
- Screenshot: `tmp/qa-handover-parent-06-child-progress.png`
- Note: url=http://127.0.0.1:4571/child-progress
- Note: bodyLen=406

### PASS — parent `/alerts`

- Final URL: `http://127.0.0.1:4571/alerts`
- Screenshot: `tmp/qa-handover-parent-07-alerts.png`
- Note: url=http://127.0.0.1:4571/alerts
- Note: bodyLen=235

### PASS — parent `/compare`

- Final URL: `http://127.0.0.1:4571/compare`
- Screenshot: `tmp/qa-handover-parent-08-compare.png`
- Note: url=http://127.0.0.1:4571/compare
- Note: bodyLen=367

### PASS — parent `/notifications`

- Final URL: `http://127.0.0.1:4571/notifications`
- Screenshot: `tmp/qa-handover-parent-09-notifications.png`
- Note: url=http://127.0.0.1:4571/notifications
- Note: bodyLen=279

### PASS — parent `/settings`

- Final URL: `http://127.0.0.1:4571/settings`
- Screenshot: `tmp/qa-handover-parent-10-settings.png`
- Note: url=http://127.0.0.1:4571/settings
- Note: bodyLen=495

## Machine report

See `tmp/QA-HANDOVER-AUTHENTIC.json`.
