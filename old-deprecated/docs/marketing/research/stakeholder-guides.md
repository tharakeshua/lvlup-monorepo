# Auto-LevelUp: Stakeholder Experience Guides

> **Research Document** — Compiled from codebase exploration of all four
> portals. **Date**: 2026-03-12 **Portals Explored**: `apps/teacher-web`,
> `apps/student-web`, `apps/parent-web`, `apps/admin-web`

---

## Table of Contents

1. [Teacher](#1-teacher)
2. [Student](#2-student)
3. [Parent](#3-parent)
4. [School Admin](#4-school-admin)

---

---

## 1. Teacher

### Key Capabilities & Powers

Teachers on Auto-LevelUp are **content architects and performance coaches** —
equipped with a full suite of tools to design learning experiences, automate the
grading grind, and surface insights that were previously buried in spreadsheets.

**Content Creation**

- Build **Spaces** (subject courses) from templates — blank, course, assessment,
  or practice
- Organize learning into **Story Points** (modules) with five modes: standard
  lessons, timed tests, quizzes, practice sets, and full exams
- Author **15+ question types** in a unified Item Editor: MCQ, multi-select,
  code-with-test-cases, paragraph essays, fill-in-the-blanks, matching pairs,
  audio responses, image evaluation, Socratic chat-agent dialogs, and more
- Create and reuse **Rubrics** in four scoring modes: criteria-based,
  dimension-based, holistic, and hybrid
- Maintain a **Question Bank** for reusable questions that can be imported
  across multiple spaces and exams
- Save **Rubric Presets** by category (math, science, language, coding, essay)
  so every new assessment starts from a proven foundation
- Configure per-space **AI Agents** (Evaluator, Tutor) with custom system
  prompts and model selection
- **Duplicate spaces** and questions for rapid content reuse

**Class & Exam Management**

- Associate spaces and exams with classes; track class-level enrollment and
  engagement
- Run a **multi-step exam creation wizard** — upload a question paper
  (PDF/images), let OCR extract questions, optionally link to published spaces,
  then publish to students
- Track exam **submission pipelines** from upload → OCR → scouting → grading →
  review → released

**Grading Workflows**

- AI auto-grades all submissions; teacher reviews flagged or low-confidence
  scores
- **Batch Grading Page** with filters (all, needs review, auto-graded, flagged)
  and pagination
- **Grading Review Page** with keyboard shortcuts, prev/next navigation,
  per-question score overrides with mandatory reasoning
- Bulk-approve confident auto-grades in one click
- Configure grading behavior: strictness (lenient / moderate / strict),
  require-override-reason toggle, auto-release results

**Analytics Dashboards**

- **Class Analytics**: Cross-class average scores, top/bottom performers,
  at-risk student list, active student rates, top point earners
- **Exam Analytics**: Grade distribution chart, per-question avg
  score/difficulty/common mistakes, topic performance breakdown, pass rates
- **Space Analytics**: Completion rates, engagement time per student, individual
  progress tracking
- **Student Report**: Individual learner profile with subject breakdown, graded
  submission counts, at-risk flag, overall LevelUp score — with PDF export
- **Assignment Tracker**: Completion rates and assignment status across classes

---

### Dashboard Overview

The teacher's command center loads immediately with a structured at-a-glance
view:

| Section                     | What it shows                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------- |
| **Stats Row**               | Total students • Active exams • Total spaces • At-risk student count                |
| **Class Performance Chart** | Bar chart comparing average scores across all classes                               |
| **At-Risk Alerts**          | Named list of struggling students by class, ready for outreach                      |
| **Class Heatmap**           | Grid view of class-by-class performance for rapid pattern spotting                  |
| **Recent Spaces**           | Last 5 spaces with story point counts                                               |
| **Recent Exams**            | Last 5 exams with total mark values                                                 |
| **Grading Queue**           | Pending submissions ready for review — roll number, student name, pipeline progress |

The grading queue is the hidden gem: teachers see exactly what needs their
attention today, without hunting through submission lists.

---

### Unique Value Proposition

**Auto-LevelUp gives teachers back their time.**

Before Auto-LevelUp, a teacher running an exam would spend hours scanning
handwritten answer sheets, applying rubrics manually, and computing scores in
spreadsheets. On Auto-LevelUp, the OCR pipeline digitizes answer sheets
automatically, AI applies rubrics to every response, and the teacher steps in
only to review edge cases. What took a weekend now takes an afternoon.

But the deeper value is _intelligence_. Teachers don't just save time — they
gain insights they couldn't compute before. Which question confused the most
students? Which class is drifting at-risk? Which student's essay showed great
structure but weak evidence? The platform surfaces these answers proactively, so
teachers can act on data rather than instinct.

Content reuse compounds the advantage. A well-crafted rubric preset, once saved,
becomes institutional knowledge that every teacher can build on. A question bank
question, once authored, can appear in ten different assessments without anyone
re-typing it.

---

### Day-in-the-Life Scenario

**Meet Ms. Priya Sharma, 10th Grade Physics Teacher**

**7:30 AM** — Priya opens the dashboard on her laptop before the first bell. The
grading queue shows 23 submissions from yesterday's electrostatics test. At-risk
alerts flag two students: Arjun (missed last 3 assignments) and Meera (exam
average dropped to 38%).

**8:15 AM** — During a free period, Priya opens the Batch Grading page and
filters to "Needs Review." Only 6 of the 23 submissions need her eyes — the
other 17 are auto-graded with high confidence. She uses keyboard shortcuts to
step through each flagged question, adjusts two scores (adding a brief reason
for each override), and bulk-approves the rest.

**9:00 AM** — Class 10-B arrives. Priya releases the exam results to students
mid-class so they can review feedback on their devices while she discusses the
common mistakes she spotted in the Exam Analytics page: 68% of students got Q4
wrong, and the AI flagged "confusion between series and parallel resistance" as
the top error theme.

**12:30 PM** — Lunch. Priya uses the Space Editor to add a new story point to
the Electrostatics space — a short quiz that targets the series/parallel
concept. She imports three questions from the Question Bank, sets the difficulty
to "hard," and configures the AI evaluator with a rubric preset she built last
term.

**3:00 PM** — Priya emails Arjun and Meera's parents from the Student Report
page, attaching auto-generated PDF reports. She flags Arjun's at-risk status in
the platform, which triggers a notification to the school admin dashboard.

**3:30 PM** — Done. Priya has graded 23 tests, diagnosed a class-wide
misconception, created a targeted remediation module, and contacted two parents
— all before the end of the school day.

---

---

## 2. Student

### Key Capabilities & Powers

Students on Auto-LevelUp are **active learners on a personalized journey** — not
passive recipients of instruction. The platform wraps every learning interaction
in feedback, gamification, and AI support.

**Learning Journey**

- Browse and navigate assigned **Spaces** (subjects) organized into **Story
  Points** (modules/lessons)
- Consume rich learning materials: markdown text, videos, PDFs, links,
  interactive content, and story-based narratives — all within the same
  interface
- Track progress through every module with per-item completion indicators
- Resume exactly where they left off with "Continue Learning" deep links from
  the dashboard

**AI Tutor Chat (Socratic Method)**

- Launch a **sliding chat panel** on any question or topic, at any time
- The AI tutor doesn't give answers — it asks guiding questions to lead the
  student to understanding (Socratic method)
- Chat sessions are **persistent** — students can return to a conversation days
  later and pick up the thread
- Multiple sessions per content item, with full history browsable in the Chat
  page

**Tests & Quizzes**

- Take **Timed Tests** with a live countdown timer synchronized to the server
  (prevents clock manipulation)
- Navigate questions with a visual **Question Navigator** grid showing status:
  unvisited, unanswered, answered, marked-for-review, answered-and-marked
- Auto-save answers to the real-time database during the test — no data lost on
  refresh or disconnect
- A network status banner warns of offline state before auto-submit triggers
- **Practice Mode** for self-paced learning: immediate AI feedback on every
  answer, with difficulty filtering and an integrated AI tutor button per
  question
- View detailed **Exam Results**: overall grade (A+ through F), per-question
  feedback, strengths, weaknesses, and model answers (when released)

**Achievements & Gamification**

- Earn **Achievement Badges** across 6 categories: learning, consistency,
  excellence, exploration, social, and milestone
- Badges span 5 tiers: bronze, silver, gold, platinum, and diamond
- Gain **XP** and level up, with a visible progress bar tracking the path to the
  next level
- Maintain a **Learning Streak** measured in consecutive study days
- Earn **Points** for completing story points and assessments

**Leaderboard & Social**

- See class-wide and space-specific **Leaderboard** rankings updated in
  real-time
- Current rank is animated and prominent — students know exactly where they
  stand
- Compete and track progress against peers without any external comparison
  pressure

**Progress & Insights**

- **Progress Page** with three tabs: overall summary, exam history, and
  per-space completion
- Dashboard surfaces **strength areas** (topics performing well) and **weakness
  areas** (topics needing work) as color-coded tags
- At-risk status with specific reasons ("low exam average", "no recent
  activity") shown on the profile
- **AI Analytics** tab inside each space: personalized recommendations, weakest
  module, strongest area, per-module performance bars

---

### Dashboard Overview

Every student starts their session at a dashboard designed to **motivate,
orient, and guide**:

| Section                    | What it shows                                                          |
| -------------------------- | ---------------------------------------------------------------------- |
| **4 Metric Cards**         | Overall score % • Avg exam score • Space completion % • Current streak |
| **Resume Learning**        | One-click link to the most recent in-progress space                    |
| **Level & XP Bar**         | Current level badge + progress to next level                           |
| **Streak Widget**          | Consecutive study day count                                            |
| **Recent Achievements**    | Last 5 unlocked badges                                                 |
| **Strengths & Weaknesses** | Color-coded topic tags (emerald = strong, red = needs work)            |
| **Quick Stats**            | Points earned vs. available • Exams done vs. total                     |
| **Recent Exam Results**    | Last 3 exam scores, color-coded by grade threshold                     |
| **Upcoming Exams**         | Calendar view of scheduled assessments                                 |
| **AI Recommendations**     | Personalized next-step suggestions                                     |
| **My Spaces**              | 4 latest spaces with thumbnails and progress bars                      |

The dashboard is both a **motivational mirror** (showing progress and
achievement) and a **navigation hub** (directing the student to where they need
to go next).

---

### Unique Value Proposition

**Auto-LevelUp makes learning feel like leveling up in a game — but the skills
are real.**

Traditional learning is passive: read, memorize, test, repeat. Auto-LevelUp adds
a progression layer where every lesson completed, every question answered, every
day of study earns tangible rewards. Students see their level rising, their
streak extending, their rank climbing. This isn't cosmetic gamification — it's
tied directly to actual learning activity.

The deeper differentiator is the **AI tutor**. Most EdTech platforms give
students answer keys. Auto-LevelUp gives students a Socratic conversation
partner that meets them exactly where they are, asks the right questions, and
watches them arrive at understanding themselves. This style of learning has
decades of research behind it — students who discover answers through guided
dialogue retain them longer than students who are told.

For exam-focused students (like those preparing for competitive assessments),
the timed test environment mirrors real exam conditions — synchronized timer,
no-cheat auto-submit, adaptive question selection — while the detailed
per-question feedback and AI analytics turn every test into a diagnostic tool
for the next study session.

---

### Day-in-the-Life Scenario

**Meet Rohan Verma, 11th Grade, Preparing for JEE**

**6:30 AM** — Rohan opens the student app. His dashboard shows a 12-day streak
(best ever) and his leaderboard rank has climbed to #4 in his class. He sees an
AI recommendation: "You scored only 40% on the Recurrence Relations module — try
the practice set."

**6:35 AM** — He navigates to the DSA space → Recurrence Relations story point.
He filters to "unanswered" questions and starts the practice set. On the third
question — a classic Master Theorem problem — he's stuck. He clicks "Ask AI
Tutor."

**6:40 AM** — The chat panel slides open. Instead of giving the answer, the AI
asks: _"What are the three cases of the Master Theorem? Which one applies when
the function grows polynomially faster than the recursion?"_ After two more
back-and-forth turns, Rohan works it out. He answers the question correctly and
sees the green feedback banner.

**7:15 AM** — Rohan closes the app, having completed 8 practice questions. His
streak extends to 13 days. He earns the "Consistency Champion" bronze badge.

**3:00 PM** — School ends. Rohan opens the Tests page and sees an upcoming timed
test scheduled for tomorrow. He navigates to the Space Analytics tab in the DSA
space to check which modules have the lowest scores — Trees (55%) and Graphs
(48%). He spends 45 minutes on both.

**7:00 PM** — Rohan gets a notification: exam results are released for last
week's class test. He opens the Exam Results page. He scored 72/100 (grade B+).
Per-question feedback shows he lost 8 marks on dynamic programming because he
described the concept correctly but couldn't derive the state transition
equation. The model answer is shown. He saves it to his notes app and adds "DP
state transitions" to his next study session.

**9:30 PM** — Rohan checks the leaderboard one more time. He's now #3. He grins,
closes the app, and sleeps.

---

---

## 3. Parent

### Key Capabilities & Powers

Parents on Auto-LevelUp are **informed advocates** — given real visibility into
their child's academic journey without needing to wait for report cards or
parent-teacher conferences.

**Child Monitoring**

- View a **complete performance profile** for each linked child: overall score,
  exam average, space completion %, learning streak, and points earned
- See **strength areas** and **improvement areas** identified from AI analysis
- Read **personalized recommendations** auto-generated for each child's specific
  gaps
- Track recent activity — what spaces were completed, when
- Download **PDF progress reports** for any child on demand

**Progress Comparison (Multiple Children)**

- If managing multiple children, access a **side-by-side comparison dashboard**
  showing all key metrics in a single view
- A star indicator highlights the top performer for each metric (overall score,
  exam avg, completion %, streak, points) — making sibling progress
  conversations easier and fairer

**Exam Results Viewing**

- Browse all released exam results per child with full per-question breakdowns
- See each question's score, grading status, and AI-generated feedback
- Color-coded scoring: green (≥70%), yellow (40–69%), red (<40%)
- Export exam results as PDF reports for offline review

**At-Risk Alerts**

- Dedicated **Alerts page** that aggregates all performance warnings across all
  children in one view
- Alert severity levels: Danger (at-risk designation with specific reasons),
  Warning (low exam scores), Info (no recent learning activity), and Completion
  Warning (very low space progress)
- See exactly what triggered each alert — not just "struggling" but "scored
  below 40% on the last two exams" or "hasn't logged in for 7 days"

**Notification Preferences**

- Granularly control which events trigger notifications:
  - Exam results released
  - At-risk alerts
  - Performance summaries
  - Daily digest
  - Weekly summary
  - New spaces added
  - Assignment deadline reminders

---

### Dashboard Overview

The parent dashboard is designed for **busy people who need the truth at a
glance**:

| Section            | What it shows                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Summary Cards**  | Total children • Avg family performance % • School code • Active at-risk alert count                                         |
| **Quick Links**    | Shortcuts to Exam Results, Space Progress, My Children                                                                       |
| **Children Grid**  | One card per child showing: avatar, at-risk badge, progress ring, exam average, completion %, streak, and last 2 exam scores |
| **Data Freshness** | Timestamp of last sync + manual refresh button                                                                               |

Parents don't need to navigate multiple pages to spot a problem — the children
grid surfaces at-risk indicators and score trends right on the home screen.

---

### Unique Value Proposition

**Auto-LevelUp closes the gap between what schools know and what parents know.**

Traditionally, parents learn about their child's academic struggles at the end
of a term — too late to course-correct. Auto-LevelUp changes the timing. When a
child's exam score drops below 40%, the parent receives an alert the same day
results are released. When a child stops logging in for a week, the parent sees
it in the Alerts page before attendance becomes a serious issue.

The multi-child comparison feature addresses a real need in families with more
than one school-going child: parents often have unequal visibility into each
child's performance simply because the louder or more assertive child gets more
attention. Auto-LevelUp makes the data equal and objective — same metrics, same
view, side by side.

Perhaps most importantly, Auto-LevelUp gives parents **actionable information**.
Not just a score, but a breakdown: "Your child lost marks on Q4 because they
couldn't apply the formula under time pressure." Parents can walk into a tutor
session or a conversation with their child carrying real, specific, helpful
information.

---

### Day-in-the-Life Scenario

**Meet Mrs. Kavita Menon, Parent of Two: Arjun (10th) and Sneha (8th)**

**8:00 AM** — Kavita gets a push notification: "Arjun's Chemistry exam results
have been released." She opens the parent app over breakfast. The dashboard
shows Arjun's score: 44% (yellow). Sneha's progress ring is at 78% — she's doing
well.

**8:05 AM** — Kavita taps on the Alerts page. Arjun has two active alerts: a
Warning for his 44% Chemistry score, and an Info alert for no learning activity
in the past 5 days. Sneha is in the green.

**8:10 AM** — She opens Arjun's individual progress page. The AI-generated
recommendations read: _"Practice the Electrolysis chapter in the Chemistry space
— it appears in 3 of the last 4 low-scoring questions."_ She screenshots this
for the tutoring session on Saturday.

**8:15 AM** — She downloads Arjun's PDF progress report, which she'll share with
his class teacher at next week's parent-teacher meeting.

**8:20 AM** — Curious, she switches to the comparison view. Sneha leads in
streak (18 days vs. Arjun's 0) and space completion (72% vs. 31%). Arjun leads
in exam average across subjects (he's genuinely strong at Math and Physics).
Kavita makes a mental note: Arjun needs to rebuild his consistency habit, not
his academic ability.

**6:00 PM** — Kavita asks Arjun about his learning streak during dinner. He
didn't realize he'd been away from the platform for 5 days. He opens the app
that evening and logs back in. The streak resets to day 1 — but he's back.

**6:30 PM** — Kavita receives a weekly digest notification: both children's
progress summaries for the week. Sneha's completion jumped 6%. Arjun's streak is
back to day 2. Small but visible progress.

---

---

## 4. School Admin

### Key Capabilities & Powers

School Admins on Auto-LevelUp are **institutional operators** — responsible for
setting up the platform, managing every user, monitoring school-wide
performance, and ensuring the organization runs efficiently.

**User Management**

- Full CRUD for **Teachers**: create, edit, import via CSV bulk upload, set
  active/inactive status, assign to classes and subjects, manage permissions
- Full CRUD for **Students**: create, edit, bulk CSV import, assign to classes,
  track roll numbers, link to parents
- Full CRUD for **Parents**: create, edit, link to multiple students
- **Staff Permission System**: granularly assign which teachers can create
  exams, edit rubrics, manually grade, view all exams, create spaces, manage
  content, view analytics, or configure AI agents

**Class & Academic Structure**

- Create and manage **Classes** (grade + section) with assigned teachers and
  students
- Manage **Academic Sessions** — create, activate, and archive academic calendar
  periods
- Run the **Onboarding Wizard** for initial school setup: school info → academic
  structure → teacher import → student import → class setup → confirmation

**School-Wide Analytics**

- View aggregate metrics: total students, total at-risk students, average exam
  score, average space completion, average learning streak
- Compare **Class Performance** side-by-side with sorted bar charts
- Identify which classes have the highest at-risk student counts
- Select any specific class for detailed drill-down metrics

**AI Cost Tracking**

- Monitor **monthly AI expenditure** with day-by-day cost breakdown tables
- Track cumulative cost, daily average cost, and cost-per-submission metrics
- Navigate month-by-month to compare spending trends
- Monitor the **Dead Letter Queue (DLQ)**: failed grading pipeline attempts,
  with submission ID, failed step, error description, retry count, and a manual
  retry button
- Receive alerts when costs approach quota thresholds

**Data Export**

- Export any combination of data collections: Students, Teachers, Classes,
  Exams, Submissions
- Choose output format: CSV or JSON
- Downloads are time-limited (expiring URLs) for security
- Staff can export only if they have the explicit `canExportData` permission

**Platform Configuration**

- **Tenant Settings**: school name, contact email/phone, tenant code
- **Branding**: primary and accent color pickers, logo upload, theme preview
- **Evaluation Settings**: configure rubric dimensions, toggle AI feedback
  fields (show strengths, key takeaways)
- **API Key Management**: generate, rotate, and copy API keys for integrations
- **Announcement System**: draft, publish, and archive announcements targeting
  specific roles (teacher/student/parent) and specific classes, with expiration
  dates
- **Courses & Spaces Overview**: school-wide visibility into all learning
  content

---

### Dashboard Overview

The admin dashboard is a **control tower** — high-level visibility into the
entire school with immediate access to the metrics that matter:

| Section                     | What it shows                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **7 Stat Cards**            | Total students • Total teachers • Total classes • Total spaces • Total exams • At-risk students • Today's AI cost (USD) |
| **Class Performance Chart** | Bar chart of average scores per class, sorted for quick comparison                                                      |
| **Quota Usage Card**        | Real-time AI/resource usage against configured limits                                                                   |
| **Quick Links**             | Navigate to Users, Analytics, AI Usage, Settings                                                                        |

The "Today's AI Cost" card is unique — most school admins don't have real-time
visibility into what AI grading is costing them. Auto-LevelUp surfaces this
front and center so cost surprises never happen.

---

### Unique Value Proposition

**Auto-LevelUp gives school administrators the infrastructure to run a
data-driven institution — without a data team.**

Running a school is an operations challenge: managing hundreds of users,
tracking who's underperforming, handling exam pipelines, ensuring content
quality. Historically these tasks require either significant administrative
staff or resigned tolerance of information gaps.

Auto-LevelUp consolidates all of it. The user management system replaces manual
roster spreadsheets. The analytics dashboard replaces end-of-term report
compilation. The AI cost tracker replaces surprise invoices. The announcement
system replaces the notice board.

For schools that are newly adopting AI-powered grading — still a new concept for
most institutions — the **DLQ monitoring and AI cost tracking** are particularly
important. Admins can see exactly when the AI pipeline fails, retry specific
submissions, and track costs in real time. This creates the organizational trust
necessary for confident AI adoption.

The permission system deserves special mention: not every teacher should be able
to create exams or configure AI agents. Auto-LevelUp's granular staff
permissions let admins run a school where trust and capability are aligned —
senior teachers get broader access, while junior staff or substitutes operate in
controlled lanes.

---

### Day-in-the-Life Scenario

**Meet Mr. Suresh Iyer, School Admin at DPS Hyderabad**

**9:00 AM** — Suresh opens the admin dashboard. Today's AI cost is ₹847
(~$10.20) — within budget. At-risk student count is 12, up from 9 last week. He
makes a note to follow up with the class coordinators.

**9:15 AM** — Three new students joined the school this week. Suresh navigates
to Users → Students. He opens the CSV import dialog, downloads the template,
fills it in for the three students (name, email, roll number, class), and
uploads it. All three accounts are created within seconds. He links two of them
to their parents (who already have parent accounts).

**10:00 AM** — The new Chemistry teacher, Ms. Roja, starts today. Suresh creates
her teacher account via the Teachers tab, assigns her to Class 10-A (Chemistry)
and Class 10-B (Chemistry). He opens Staff Permissions and grants her: Can
Create Exams, Can View Analytics, Can Manually Grade. She does not yet get "Can
Configure AI Agents" — that requires additional training.

**11:00 AM** — Suresh receives a notification from the AI Usage page: 3
submissions are in the Dead Letter Queue (DLQ). He navigates to AI Usage → DLQ
and inspects the failures. One is a network timeout at the OCR step, the other
two failed at the grading step. He hits "Retry" on all three. Two succeed
immediately; one needs the teacher to re-upload the answer sheet.

**2:00 PM** — The school's annual parent-teacher meeting is in two weeks. Suresh
heads to Announcements and drafts a message targeting "Parent" role, expiring in
10 days. He also drafts a separate announcement for "Teacher" role about the
grading deadline. Both are scheduled for publication tomorrow morning.

**3:30 PM** — Suresh runs a monthly data export: Students + Exams + Submissions
in CSV format. He shares the download link with the school's Academic Director
for the board review next Friday.

**4:00 PM** — He opens the Analytics page. Class 10-A has the lowest average
exam score (52%) and the highest at-risk count (4 students). He forwards this
data to the class coordinator and flags it in the school's weekly review doc.

**4:30 PM** — Month-end: Suresh reviews the AI Usage page. Total monthly spend:
₹23,400. Daily average: ₹756. Cost per submission: ₹18.2. Within the approved
₹30,000 quota. He saves a screenshot for the budget report and logs off.

---

---

## Summary: The Auto-LevelUp Ecosystem at a Glance

| Stakeholder      | Core Superpower                             | Time Saved                 | Key Metric Owned                           |
| ---------------- | ------------------------------------------- | -------------------------- | ------------------------------------------ |
| **Teacher**      | AI-powered grading + rich analytics         | Hours per exam cycle       | Exam pass rate & at-risk count             |
| **Student**      | Personalized AI tutor + gamified progress   | Hours of aimless studying  | Streak, XP level, leaderboard rank         |
| **Parent**       | Real-time visibility + early at-risk alerts | Weeks between term reports | Child progress % and alert status          |
| **School Admin** | Unified platform control + AI cost tracking | Days of spreadsheet work   | School-wide performance & monthly AI spend |

> Auto-LevelUp doesn't just digitize the classroom — it upgrades every role in
> the educational ecosystem, giving each stakeholder the specific information
> and tools they need to do their best work.
