# QA Live Evidence (Authentic)

Generated: 2026-07-12T19:50:25.509Z

Evidence rule: **PASS only with Playwright/browser proof** (screenshot under `tmp/qa-handover-*.png`).

## Scorecard

| App | PASS | FAIL | SKIP |
|-----|------|------|------|
| teacher | 9 | 10 | 1 |
| student | 3 | 7 | 1 |
| admin | 0 | 1 | 0 |
| **TOTAL** | 12 | 18 | 2 |

## Credentials & ports

- School: `GRN001`
- Teacher :4569 — `priya.sharma@greenwood.edu` / `Test@12345`
- Student :4570 — `aarav.patel@greenwood.edu` / `Test@12345`
- Admin :4568 — `admin@greenwood.edu` / `Test@12345`
- Parent :4571 — `suresh.patel@gmail.com` / `Test@12345` (from TEST_CREDENTIALS.md)

## Per-route results

### FAIL — teacher `/ (post-login)`

- Final URL: `http://127.0.0.1:4569/`
- Screenshot: `tmp/qa-handover-teacher-01-login.png`
- Note: url=http://127.0.0.1:4569/
- Note: bodyLen=401
- Note: crashSignals=something went wrong
- Note: pageErrors=TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4569/src/pages/DashboardPage.tsx | TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4569/src/pages/DashboardPage.tsx
- Page errors: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4569/src/pages/DashboardPage.tsx || TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4569/src/pages/DashboardPage.tsx

### FAIL — teacher `/`

- Final URL: `http://127.0.0.1:4569/`
- Screenshot: `tmp/qa-handover-teacher-02-dashboard.png`
- Note: url=http://127.0.0.1:4569/
- Note: bodyLen=150
- Note: crashSignals=something went wrong
- Note: pageErrors=Error: useAuthSession must be used within <SessionProvider> | Error: useAuthSession must be used within <SessionProvider>
- Page errors: Error: useAuthSession must be used within <SessionProvider> || Error: useAuthSession must be used within <SessionProvider>

### FAIL — teacher `/spaces`

- Final URL: `http://127.0.0.1:4569/spaces`
- Screenshot: `tmp/qa-handover-teacher-03-spaces.png`
- Note: url=http://127.0.0.1:4569/spaces
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/question-bank`

- Final URL: `http://127.0.0.1:4569/question-bank`
- Screenshot: `tmp/qa-handover-teacher-04-question-bank.png`
- Note: url=http://127.0.0.1:4569/question-bank
- Note: bodyLen=20

### FAIL — teacher `/rubric-presets`

- Final URL: `http://127.0.0.1:4569/rubric-presets`
- Screenshot: `tmp/qa-handover-teacher-05-rubric-presets.png`
- Note: url=http://127.0.0.1:4569/rubric-presets
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/exams`

- Final URL: `http://127.0.0.1:4569/exams`
- Screenshot: `tmp/qa-handover-teacher-06-exams.png`
- Note: url=http://127.0.0.1:4569/exams
- Note: bodyLen=407

### FAIL — teacher `/exams/new`

- Final URL: `http://127.0.0.1:4569/exams/new`
- Screenshot: `tmp/qa-handover-teacher-07-exam-create.png`
- Note: url=http://127.0.0.1:4569/exams/new
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/classes`

- Final URL: `http://127.0.0.1:4569/classes`
- Screenshot: `tmp/qa-handover-teacher-08-classes.png`
- Note: url=http://127.0.0.1:4569/classes
- Note: bodyLen=458

### FAIL — teacher `/analytics/classes`

- Final URL: `http://127.0.0.1:4569/analytics/classes`
- Screenshot: `tmp/qa-handover-teacher-09-analytics-classes.png`
- Note: url=http://127.0.0.1:4569/analytics/classes
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/analytics/exams`

- Final URL: `http://127.0.0.1:4569/analytics/exams`
- Screenshot: `tmp/qa-handover-teacher-10-analytics-exams.png`
- Note: url=http://127.0.0.1:4569/analytics/exams
- Note: bodyLen=428

### FAIL — teacher `/analytics/spaces`

- Final URL: `http://127.0.0.1:4569/analytics/spaces`
- Screenshot: `tmp/qa-handover-teacher-11-analytics-spaces.png`
- Note: url=http://127.0.0.1:4569/analytics/spaces
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/analytics/tests`

- Final URL: `http://127.0.0.1:4569/analytics/tests`
- Screenshot: `tmp/qa-handover-teacher-12-analytics-tests.png`
- Note: url=http://127.0.0.1:4569/analytics/tests
- Note: bodyLen=523

### FAIL — teacher `/assignments`

- Final URL: `http://127.0.0.1:4569/assignments`
- Screenshot: `tmp/qa-handover-teacher-13-assignments.png`
- Note: url=http://127.0.0.1:4569/assignments
- Note: bodyLen=10
- Note: empty-body

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

### FAIL — teacher `/settings`

- Final URL: `http://127.0.0.1:4569/settings`
- Screenshot: `tmp/qa-handover-teacher-16-settings.png`
- Note: url=http://127.0.0.1:4569/settings
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/notifications`

- Final URL: `http://127.0.0.1:4569/notifications`
- Screenshot: `tmp/qa-handover-teacher-17-notifications.png`
- Note: url=http://127.0.0.1:4569/notifications
- Note: bodyLen=20

### FAIL — teacher `/classes/cls_greenwood-class-g8-math_db8edee86a`

- Final URL: `http://127.0.0.1:4569/classes/cls_greenwood-class-g8-math_db8edee86a`
- Screenshot: `tmp/qa-handover-teacher-18-class-detail.png`
- Note: url=http://127.0.0.1:4569/classes/cls_greenwood-class-g8-math_db8edee86a
- Note: bodyLen=10
- Note: empty-body

### PASS — teacher `/spaces/V5VjUSqrAzy9CjxnVQvo/edit`

- Final URL: `http://127.0.0.1:4569/spaces/V5VjUSqrAzy9CjxnVQvo/edit`
- Screenshot: `tmp/qa-handover-teacher-19-space-edit.png`
- Note: url=http://127.0.0.1:4569/spaces/V5VjUSqrAzy9CjxnVQvo/edit
- Note: bodyLen=20

### SKIP — teacher `/exams/:id`

- Final URL: `http://127.0.0.1:4569/exams`
- Note: No exam detail link visible

### PASS — student `/ (post-login)`

- Final URL: `http://127.0.0.1:4570/`
- Screenshot: `tmp/qa-handover-student-01-login.png`
- Note: url=http://127.0.0.1:4570/
- Note: bodyLen=278

### PASS — student `/`

- Final URL: `http://127.0.0.1:4570/`
- Screenshot: `tmp/qa-handover-student-02-dashboard.png`
- Note: url=http://127.0.0.1:4570/
- Note: bodyLen=278

### FAIL — student `/spaces`

- Final URL: `http://127.0.0.1:4570/spaces`
- Screenshot: `tmp/qa-handover-student-03-spaces.png`
- Note: url=http://127.0.0.1:4570/spaces
- Note: bodyLen=10
- Note: empty-body

### FAIL — student `/tests`

- Final URL: `http://127.0.0.1:4570/tests`
- Screenshot: `tmp/qa-handover-student-04-tests.png`
- Note: url=http://127.0.0.1:4570/tests
- Note: bodyLen=10
- Note: empty-body

### FAIL — student `/results`

- Final URL: `http://127.0.0.1:4570/results`
- Screenshot: `tmp/qa-handover-student-05-results.png`
- Note: url=http://127.0.0.1:4570/results
- Note: bodyLen=10
- Note: empty-body

### FAIL — student `/leaderboard`

- Final URL: `http://127.0.0.1:4570/leaderboard`
- Screenshot: `tmp/qa-handover-student-06-leaderboard.png`
- Note: url=http://127.0.0.1:4570/leaderboard
- Note: bodyLen=10
- Note: empty-body

### FAIL — student `/achievements`

- Final URL: `http://127.0.0.1:4570/achievements`
- Screenshot: `tmp/qa-handover-student-07-achievements.png`
- Note: url=http://127.0.0.1:4570/achievements
- Note: bodyLen=10
- Note: empty-body

### PASS — student `/profile`

- Final URL: `http://127.0.0.1:4570/profile`
- Screenshot: `tmp/qa-handover-student-08-profile.png`
- Note: url=http://127.0.0.1:4570/profile
- Note: bodyLen=149

### FAIL — student `/settings`

- Final URL: `http://127.0.0.1:4570/settings`
- Screenshot: `tmp/qa-handover-student-09-settings.png`
- Note: url=http://127.0.0.1:4570/settings
- Note: bodyLen=0
- Note: empty-body

### FAIL — student `/notifications`

- Final URL: `http://127.0.0.1:4570/notifications`
- Screenshot: `tmp/qa-handover-student-10-notifications.png`
- Note: url=http://127.0.0.1:4570/notifications
- Note: bodyLen=0
- Note: empty-body

### SKIP — student `/spaces/:id`

- Final URL: `http://127.0.0.1:4570/spaces`
- Note: No space detail link for Aarav

### FAIL — admin `FATAL`

- Final URL: `chrome-error://chromewebdata/`
- Note: Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4568/login
Call log:
[2m  - navigating to "http://127.0.0.1:4568/login", waiting until "domcontentloaded"[22m


## Machine report

See `tmp/QA-HANDOVER-AUTHENTIC.json`.
