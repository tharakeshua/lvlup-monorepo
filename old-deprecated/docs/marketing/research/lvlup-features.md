# LvlUp Spaces — Complete Feature Inventory

**Research document for marketing & sales enablement** _Sourced directly from
codebase: shared-types, shared-services, cloud functions_ _Date: 2026-03-12_

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Spaces — The Core Learning Unit](#spaces--the-core-learning-unit)
3. [Story Points — 5 Learning Modes](#story-points--5-learning-modes)
4. [15 Question Types](#15-question-types)
5. [7 Material Types](#7-material-types)
6. [AI Tutor — Socratic Chat](#ai-tutor--socratic-chat)
7. [AI Evaluator — Rubric-Based Grading](#ai-evaluator--rubric-based-grading)
8. [Adaptive Difficulty Engine](#adaptive-difficulty-engine)
9. [Gamification System](#gamification-system)
10. [Progress Tracking & At-Risk Detection](#progress-tracking--at-risk-detection)
11. [Learning Insights Engine](#learning-insights-engine)
12. [Content Marketplace (B2C Store)](#content-marketplace-b2c-store)
13. [Question Bank](#question-bank)
14. [Bloom's Taxonomy Alignment](#blooms-taxonomy-alignment)
15. [Content Versioning](#content-versioning)

---

## Platform Overview

**LvlUp Spaces** is the digital learning module of the Auto-LevelUp platform. It
turns static lesson plans into interactive, AI-powered learning experiences —
with built-in gamification, real-time progress tracking, and adaptive
assessments — all manageable from the school's teacher and admin dashboards.

**School benefit:** A single platform replaces multiple disconnected tools (LMS,
quiz software, AI tutoring apps, progress dashboards), reducing admin overhead
and giving teachers a unified view of every student's learning journey.

---

## Spaces — The Core Learning Unit

A **Space** is the top-level container for a subject course or learning module.
Each Space is:

- **Assigned** to specific classes/sections or opened tenant-wide
- **Typed** as one of: `learning`, `practice`, `assessment`, `resource`, or
  `hybrid`
- **Configured** with default AI agents (tutor + evaluator), time limits, retake
  policies, and rubrics
- **Versioned** so content changes are tracked and reversible

**School benefit:** Teachers can build structured, curriculum-aligned course
spaces without any coding. Content can be reused across classes, shared
school-wide, or sold to other schools via the marketplace.

---

## Story Points — 5 Learning Modes

Story Points are the "chapters" within a Space. Each Story Point operates in one
of **5 distinct UX modes**, letting teachers choose the right pedagogical format
for each topic:

### 1. `standard` — Guided Lesson

**What it is:** A mixed-format lesson combining instructional materials (video,
PDFs, rich text) with embedded practice questions. Students work through content
at their own pace with no time pressure.

**How it works:** Items within the story point are presented sequentially.
Students can interact with materials, answer questions, and request AI tutor
help at any point. No hard deadline or score lock.

**School benefit:** Perfect for introducing new topics — students get the theory
and practice in one seamless experience, without the anxiety of being graded.

---

### 2. `quiz` — Graded Quiz

**What it is:** A graded assessment with immediate feedback after each
submission. Results are shown to students right after completing the quiz.

**How it works:** Supports configurable max attempts, passing percentage
thresholds, question and option shuffling, and a cool-down period between
retakes (`retryConfig`). Scores are logged to the student's progress record.

**School benefit:** Enables formative assessment that gives teachers real-time
insight into class understanding — without waiting for a formal exam. Students
get fast feedback loops that accelerate learning.

---

### 3. `timed_test` — Formal Timed Assessment

**What it is:** A full proctored-style assessment with a countdown timer
enforced server-side. Auto-submits when time expires.

**How it works:** A `DigitalTestSession` is created on the server with a
`serverDeadline` timestamp. Students can flag questions for review, navigate
between questions, and track answered/unanswered counts. Adaptive difficulty can
be enabled. On expiry, the system auto-submits whatever has been answered.

**School benefit:** Replicates real exam conditions digitally. Teachers can run
mid-terms and finals online with full audit trails, per-question time analytics,
and zero paper handling.

---

### 4. `practice` — Unlimited Practice Mode

**What it is:** An open-ended, ungraded practice environment where students can
attempt questions as many times as they need. Correct answers and explanations
are revealed after each attempt.

**How it works:** Uses the `evaluateAnswer` callable in `practice` mode. Every
attempt is scored and tracked, but the student's official progress is only
updated with their best score. AI tutor chat is always available alongside
practice questions.

**School benefit:** Students who need extra support can practice without fear of
failure affecting their grade. Teachers can identify which students are using
practice mode heavily as an early intervention signal.

---

### 5. `test` — Standard Test

**What it is:** A structured test format combining elements of quiz and timed
modes — graded, with configurable time limits and attempt restrictions, but
without the full proctored countdown of `timed_test`.

**How it works:** Supports the same `AssessmentConfig` as other types (duration,
shuffle, passing percentage, adaptive config) but is presented with a test-style
interface rather than a quiz or lesson flow.

**School benefit:** Provides a middle ground between casual quizzes and formal
exams — ideal for unit tests, chapter assessments, and periodic reviews.

---

## 15 Question Types

Every question is a `UnifiedItem` with a typed `QuestionPayload`. The system
automatically determines whether each type requires AI grading or can be
auto-evaluated instantly.

### Auto-Evaluated Types (instant grading, no AI cost)

#### 1. `mcq` — Multiple Choice (Single Answer)

**What it is:** Classic one-correct-answer multiple choice with 2–6 options.
**How it works:** Options can include per-option explanations. `shuffleOptions`
randomizes presentation. Marked correct/incorrect instantly. **School benefit:**
The workhorse of formative assessment — create hundreds of curriculum-aligned
MCQs in minutes using the AI question generator, and get class-wide accuracy
reports instantly.

---

#### 2. `mcaq` — Multiple Choice (Multiple Answers)

**What it is:** Select-all-that-apply question type. Configurable min/max
selections. **How it works:** Students must select the correct combination of
answers. Partial scoring supported. Options can be shuffled. **School benefit:**
Tests deeper analytical thinking than single-answer MCQ — ideal for "which of
these are properties of X" style questions in science, law, and medicine
curricula.

---

#### 3. `true-false` — True/False

**What it is:** Binary true/false question with an optional explanation shown
after answering. **How it works:** Simplest auto-evaluated type. Explanation
field lets teachers add teaching moments for wrong answers. **School benefit:**
Quickly check conceptual understanding or common misconceptions. Great for
warm-up activities and exit tickets.

---

#### 4. `numerical` — Numerical Answer

**What it is:** Student types a number. Accepts tolerance ranges, specific
units, and decimal precision settings. **How it works:** `tolerance` field
allows a ±range for acceptable answers (e.g., physics problems with rounding).
`unit` field validates the answer includes the correct unit (e.g., "m/s").
**School benefit:** Handles the full complexity of STEM assessments — from
simple arithmetic to multi-step physics calculations with tolerance for rounding
errors.

---

#### 5. `fill-blanks` — Fill in the Blanks (Typed)

**What it is:** A passage with blank fields that students type answers into.
**How it works:** Multiple blanks per question, each with its own correct answer
and list of acceptable alternatives. Case sensitivity is configurable. **School
benefit:** Excellent for vocabulary, grammar, and recall-based assessments.
Auto-graded so no teacher marking time needed.

---

#### 6. `fill-blanks-dd` — Fill in the Blanks (Dropdown)

**What it is:** A passage with blank fields populated by selecting from dropdown
menus. **How it works:** Each blank has its own set of distractor options,
preventing students from simply typing random words. Reduces ambiguity in
grading. **School benefit:** Scaffolded version of fill-in-the-blank — better
for younger students or when teachers want to control the answer space
precisely.

---

#### 7. `matching` — Matching Pairs

**What it is:** Match items from a left column to items in a right column. **How
it works:** `pairs` array defines correct matches. `shufflePairs` randomizes
presentation. Evaluated by counting correct pairings. **School benefit:**
Perfect for vocabulary-definition, cause-effect, and term-concept assessments
across all subjects. Students build associative knowledge — not just recall.

---

#### 8. `jumbled` — Arrange in Correct Order

**What it is:** Reorder a jumbled set of items into the correct sequence. **How
it works:** `correctOrder` defines the target sequence. Items are shuffled for
presentation. Evaluated against the correct arrangement. **School benefit:**
Tests procedural understanding — great for historical timelines, scientific
processes (cell division steps, chemical reaction stages), and algorithm
ordering.

---

#### 9. `group-options` — Sort into Categories

**What it is:** Drag-and-drop items into labeled groups/categories. **How it
works:** `groups` defines the categories with their correct member items.
`items` are presented randomly for students to sort. Each item can belong to
only one group. **School benefit:** Builds classification skills — ideal for
taxonomy questions (plant types, chemical properties, grammar categories) and
concept mapping activities.

---

### AI-Evaluated Types (rich open-ended assessment)

#### 10. `text` — Short Text Answer

**What it is:** Single-line or short text response evaluated by AI against a
model answer. **How it works:** AI compares student response to `correctAnswer`
and any `acceptableAnswers`. Case sensitivity configurable. Returns score,
strengths, weaknesses, and feedback summary. **School benefit:** Goes beyond
keyword matching — the AI understands synonyms, paraphrasing, and partial
credit, giving students fair grades for correct-but-differently-worded answers.

---

#### 11. `paragraph` — Long-Form Essay / Paragraph

**What it is:** Extended written response evaluated by AI using a model answer
and rubric. **How it works:** Teacher provides a `modelAnswer` for reference and
`evaluationGuidance`. AI evaluates using the space's rubric (criteria,
dimensions, holistic, or hybrid scoring), returning a rubric breakdown with
per-criterion scores and structured feedback. **School benefit:** Teachers can
assign essays and extended responses without spending hours marking. Each
student gets detailed, personalized feedback — not just a grade — within seconds
of submission.

---

#### 12. `code` — Coding Challenge

**What it is:** Student writes code in a specified language, evaluated against
test cases by AI. **How it works:** `starterCode` can be provided. Hidden and
visible test cases (`isHidden`) are defined. AI evaluates correctness, code
quality, edge case handling, and efficiency. `timeoutMs` and `memoryLimitMb`
constraints supported. **School benefit:** Enables programming education at
scale — CS teachers can run automated coding assessments that evaluate both
correctness (test case pass/fail) and code quality, without needing to run
student code manually.

---

#### 13. `audio` — Audio Recording Submission

**What it is:** Student records an audio response; AI transcribes and evaluates.
**How it works:** Max recording duration and expected language are configurable.
AI receives the audio URL and transcription, then evaluates against the
question's evaluation guidance and rubric. **School benefit:** Unlocks oral
language assessment for foreign language, speech, and communication courses —
previously impossible to scale. Students practice speaking; teachers get
AI-assisted pronunciation and content evaluations.

---

#### 14. `image_evaluation` — Image / Diagram Upload

**What it is:** Student uploads a photo or drawn diagram for AI evaluation.
**How it works:** Instructions define what should be in the image. AI receives
the image URL and any student description text, then evaluates against
`evaluationGuidance` and rubric criteria. **School benefit:** Science diagrams,
geometry proofs, chemistry lab drawings, and art assessments can all be
collected and AI-evaluated digitally — removing the logistical barrier of
physical submissions.

---

#### 15. `chat_agent_question` — Conversational AI Interaction

**What it is:** Student has a guided conversation with an AI agent; the entire
conversation is evaluated as the "answer." **How it works:** `objectives` define
learning goals the student should demonstrate. `conversationStarters` seed the
dialogue. `maxTurns` limits conversation length. After the chat, AI evaluates
how well the student demonstrated each objective based on the full transcript.
**School benefit:** The most sophisticated assessment type — evaluates
communication skills, critical thinking, and conceptual depth in a natural
dialogue format. Ideal for Socratic seminars, case study discussions, and
language practice.

---

## 7 Material Types

Materials are non-question learning content items embedded within story points.

### 1. `text` — Plain Text

Markdown/plain text blocks for brief explanations, definitions, or
context-setting paragraphs.

**School benefit:** Teachers can add concise explanations between question
groups without needing to embed full documents.

---

### 2. `video` — Video Content

Embeds video content via URL. Supports duration tracking so teachers know if
students actually watched.

**School benefit:** Integrate existing lecture recordings, YouTube tutorials, or
custom explainer videos directly into the learning flow — students get theory
and practice in one place.

---

### 3. `pdf` — PDF Document

Embed and optionally allow download of PDF documents (textbook pages, handouts,
reference sheets).

**School benefit:** No more emailing PDFs. Reference materials appear alongside
relevant questions — students get the resource at exactly the moment they need
it.

---

### 4. `link` — External Link

Direct hyperlinks to external resources (documentation, articles, tools).

**School benefit:** Teachers can curate web resources (official docs, reference
sites, reputable articles) and embed them contextually within lessons.

---

### 5. `interactive` — Interactive Simulation / Game

Embed interactive tools, simulations, or educational games via URL (e.g., PhET
simulations, GeoGebra).

**School benefit:** STEM and humanities teachers can embed hands-on simulations
that would otherwise require separate apps or lab setups — making abstract
concepts tangible.

---

### 6. `story` — Story-Based Narrative

Narrative content type for storytelling-based pedagogy (case studies, historical
scenarios, literature excerpts).

**School benefit:** Contextualizes learning in real-world scenarios — a medical
school can present a patient case study as a story before assessment questions,
making the learning more memorable.

---

### 7. `rich` — Rich Content Block

A fully structured content layout supporting: `heading`, `paragraph`, `image`,
`video`, `audio`, `code`, `quote`, `list`, and `divider` blocks in any
combination. Supports cover images, author attribution, and estimated reading
time.

**School benefit:** Teachers can create publication-quality lesson articles with
multimedia elements — no graphic design or web development skills required.
Students engage with professionally structured content on any device.

---

## AI Tutor — Socratic Chat

### What it is

An in-context AI tutor chat interface attached to every question. Students can
ask for help at any time during practice or learning sessions.

### How it works

The `sendChatMessage` cloud function builds a **Socratic-method prompt** that:

- Loads the exact question the student is working on as context
- Includes the student's current answer and their evaluation result (if they've
  already submitted)
- Applies a strict rule set: **never give the direct answer**, use leading
  questions, give hints not solutions, celebrate progress
- Injects **subject-specific guidance** (7 subjects: math, physics, chemistry,
  biology, English, history, CS) with domain-appropriate tutoring strategies
- Enforces **safety guardrails**: refuses off-topic requests, ignores jailbreak
  attempts, stays purely educational
- Supports multiple languages via the `language` parameter

Each school can configure a **custom AI Tutor Agent** per space with a bespoke
identity, persona, system prompt, and supported languages. The agent's
`feedbackStyle` (brief/detailed/encouraging) and `strictness`
(lenient/moderate/strict) are also configurable.

**School benefit:** Every student gets a patient, always-available, infinitely
knowledgeable tutor — without increasing the school's staffing costs. Students
who are too shy to ask questions in class can get guidance privately, at their
own pace, at 2am before an exam. The Socratic approach ensures students develop
genuine understanding rather than dependency.

---

## AI Evaluator — Rubric-Based Grading

### What it is

An AI grading engine that evaluates open-ended student responses (text, essays,
code, audio, images, conversations) against configurable rubrics.

### How it works

The `evaluateAnswer` cloud function:

1. Builds a **type-specific evaluation prompt** for each of the 6 AI-evaluatable
   question types
2. **Injects the rubric** in the format matching the scoring mode:
   - `criteria_based`: each criterion scored separately (e.g., "Argument
     Quality: 5/10")
   - `dimension_based`: RELMS-style dimensions with weights and scales
   - `holistic`: overall impression with guidance text
   - `hybrid`: combination of criteria and dimensions
3. Returns a structured **UnifiedEvaluationResult** with:
   - Score, max score, percentage
   - Strengths and weaknesses arrays
   - Missing concepts list
   - Per-criterion rubric breakdown with individual feedback
   - Summary: key takeaway + overall comment
   - Mistake classification: Conceptual / Silly Error / Knowledge Gap / None
   - Confidence score (0–1)

Rubrics cascade by inheritance: `tenant default → space → story point → item`,
so teachers can set one rubric at the space level and override it per item where
needed.

**School benefit:** AI evaluation reduces teacher marking time for essays and
open-ended assignments by up to 90%. Every student receives detailed,
personalized feedback — not just a score — within seconds. The rubric breakdown
makes assessment transparent and defensible, replacing subjective marking with
structured evaluation. Mistake classification helps teachers identify pattern
errors across the class.

---

## Adaptive Difficulty Engine

### What it is

A real-time difficulty adjustment algorithm that dynamically changes the
difficulty of questions presented to each student based on their performance.

### How it works

The `AdaptiveEngine` (pure function module, fully testable) implements:

- **State tracking**: `currentDifficulty`, `consecutiveCorrect`,
  `consecutiveIncorrect`, `answeredByDifficulty` counts
- **Two adjustment modes**:
  - `gradual`: shifts difficulty after 3 consecutive correct/incorrect answers
  - `aggressive`: shifts after just 2 consecutive answers
- **Guard rails**:
  - `minQuestionsPerDifficulty`: ensures students answer a minimum number of
    questions at each level before moving
  - `maxConsecutiveSameDifficulty`: forces a shift if stuck at the same level
    too long
- **Fallback logic**: if no questions exist at the target difficulty,
  automatically picks the nearest available difficulty

The difficulty progression is stored in the `DigitalTestSession` as
`difficultyProgression` — a full log of every question index, difficulty level,
and whether it was answered correctly — giving complete traceability for
academic audits.

**School benefit:** Adaptive difficulty eliminates the "too easy / too hard"
problem that causes students to disengage. High achievers are automatically
challenged; struggling students aren't left behind. Teachers get a difficulty
progression map for each student that reveals precisely where their
understanding breaks down — something impossible with paper exams.

---

## Gamification System

### XP & Level System

Each student has a `StudentLevel` document tracking:

- **Level** (numeric, progressively harder to advance)
- **Current XP** and **XP to next level**
- **Total XP** (all-time)
- **Tier**: bronze → silver → gold → platinum → diamond

XP is awarded on every correct answer, quiz completion, perfect score, and
streak milestone.

**School benefit:** The XP/level system creates a visible sense of progression
that motivates students to continue learning even after completing mandatory
coursework. Parents and students can see tangible growth — not just grades.

---

### Achievements & Badges

The achievement system has three dimensions:

**6 Achievement Categories:** | Category | What it rewards | |---|---| |
`learning` | Completing spaces and story points | | `consistency` | Daily login
streaks and regular study habits | | `excellence` | High scores, perfect exams,
top performance | | `exploration` | Trying content across multiple subjects | |
`social` | Leaderboard placements, helping peers | | `milestone` | Major
progress milestones |

**5 Rarity Tiers:** | Rarity | Scarcity | |---|---| | `common` | Attainable by
most students | | `uncommon` | Requires sustained effort | | `rare` | Achieved
by top performers | | `epic` | Reserved for exceptional accomplishments | |
`legendary` | The rarest — only the best of the best |

**5 Achievement Tiers:** bronze, silver, gold, platinum, diamond — reflect the
overall tier of the student's achievement collection.

Achievements are triggered by **10 criteria types**: spaces_completed,
story_points_completed, exams_passed, perfect_scores, streak_days, total_points,
items_completed, chat_sessions, leaderboard_top3, login_days.

When an achievement is earned, students see an **unlock notification** (tracked
via `seen` flag) — a moment of celebration and recognition.

**School benefit:** Achievements give students tangible recognition for effort
and consistency — not just academic ability. A student who logs in every day
earns Consistency achievements even if they struggle academically, building
self-esteem and habit formation. Schools can customize achievement criteria to
align with their own values.

---

### Leaderboards

**Three scopes:**

- **Story Point leaderboard**: ranked within a single assessment
- **Course leaderboard**: ranked within an entire subject space
- **Quest leaderboard** (framework in place for future use)

**Three time periods:**

- Weekly (resets every Monday)
- Monthly (resets on the 1st)
- All-time

Leaderboard entries show: rank, display name, avatar, points, completion
percentage, streak days, and achievement tier counts
(silver/gold/platinum/diamond).

**School benefit:** Healthy competition motivates students who are falling
behind. Leaderboards are refreshed weekly, giving every student a fresh chance
to rise — not just the top performers who dominate all-time rankings. Schools
can use leaderboards for public recognition events or class competitions.

---

### Study Goals & Study Planner

Students can set personal `StudyGoal` records targeting: spaces completed, story
points completed, items completed, exams taken, or minutes studied — with
start/end dates and auto-completion tracking.

Daily `StudySession` logs record: minutes studied, spaces worked on, items
completed, and points earned.

**School benefit:** Teaches students self-directed learning and time management
skills from an early age. Teachers can encourage students to set weekly goals as
part of structured homework policies. Completed goals create a record of
initiative that can be highlighted in parent-teacher conferences.

---

## Progress Tracking & At-Risk Detection

### Granular Per-Student Progress

Every student interaction is recorded at three levels:

1. **Item level** (`ItemProgressEntry`): completion status, time spent,
   interactions, attempts count, best score, points earned — per question or
   material
2. **Story Point level** (`StoryPointProgress`): aggregate points earned,
   percentage, completion status, completion timestamp
3. **Space level** (`SpaceProgress`): overall percentage, marks earned,
   per-story-point rollup, started/completed timestamps

### Cross-System Progress Summary

`StudentProgressSummary` aggregates data from both LvlUp Spaces and AutoGrade
(the offline exam module) into a unified student profile:

- Average completion rate across all spaces
- Average accuracy across all questions
- Streak days (consecutive days of activity)
- Subject-by-subject breakdown
- Strength areas and weakness areas
- **At-risk flag** with specific reasons

### Class-Level Analytics

`ClassProgressSummary` rolls up all student data per class:

- Average class completion rate
- Active student rate
- Top and bottom performers
- At-risk student count and IDs
- Leaderboard-style top point earners

### At-Risk Detection

The system automatically flags students as at-risk based on **5 signals**: |
Signal | Meaning | |---|---| | `low_exam_score` | Consistently scoring below
threshold | | `no_recent_activity` | No activity in an extended period | |
`low_space_completion` | Not completing assigned spaces | |
`declining_performance` | Scores trending downward | | `zero_streak` | No
consistent daily learning habit |

**School benefit:** Teachers no longer need to manually scan gradebooks for
struggling students. The at-risk detection system surfaces students who need
intervention before they fall so far behind that catching up becomes impossible.
Early identification = better outcomes. Schools reduce dropout rates and improve
overall cohort results.

---

## Learning Insights Engine

### What it is

An AI-powered personalized recommendation engine that generates contextual
nudges and actionable recommendations for each student.

### How it works

`LearningInsight` documents are generated per student with **6 insight types**:

| Insight Type                | What it does                                                               |
| --------------------------- | -------------------------------------------------------------------------- |
| `weak_topic_recommendation` | Recommends a specific space to practice based on detected topic weaknesses |
| `exam_preparation`          | Identifies upcoming exams where the student is under-prepared              |
| `streak_encouragement`      | Motivates students who are close to a streak milestone                     |
| `improvement_celebration`   | Celebrates measurable improvement to reinforce positive behavior           |
| `at_risk_intervention`      | Generates an intervention recommendation for at-risk students              |
| `cross_system_correlation`  | Identifies patterns spanning both digital learning and formal exams        |

Each insight has a **priority** (high/medium/low), **action type**
(practice_space, review_exam, seek_help, celebrate), and links to the specific
entity (space or exam) the student should engage with.

**School benefit:** Students receive personalized guidance that feels like a
dedicated advisor — without any extra teacher workload. The cross-system
correlation insight is particularly powerful: it can tell a student "You scored
well on the LvlUp DSA practice space but struggled on the formal DS exam —
consider reviewing these specific topics." This kind of cross-contextual insight
is impossible without a unified platform.

---

## Content Marketplace (B2C Store)

### What it is

A public content marketplace where schools and content creators can list Spaces
for purchase by other schools or students.

### How it works

Any Space can be **published to the store** by enabling `publishedToStore: true`
and setting a `price` and `currency`. Published spaces appear in the marketplace
with:

- Store-specific thumbnail and description
- Subject category and tags
- Total enrolled students count
- Total story points count
- Star ratings and written reviews (1–5 stars)

The `listStoreSpaces` callable supports **browsing by subject**, **search by
keyword**, and **pagination**. The `purchaseSpace` callable handles the
transaction and grants access.

Students and schools can **rate and review** purchased spaces, with ratings
aggregated into averages and distribution histograms displayed on the store
listing.

**School benefit:** Schools can generate revenue by selling their best content
to other institutions — turning curriculum development investment into a
recurring income stream. Teachers get access to high-quality, pre-built content
created by peer educators rather than starting from scratch. The rating system
ensures quality — poorly-rated content is naturally deprioritized.

---

## Question Bank

### What it is

A **reusable, searchable library** of questions shared across all spaces within
a tenant (school).

### How it works

Teachers save questions to the bank via `saveQuestionBankItem`. The bank is
fully searchable and filterable by:

- Subject
- Topics (multi-tag)
- Difficulty (easy/medium/hard)
- Bloom's level (remember → create)
- Question type (any of the 15 types)
- Custom tags
- Usage count and average score (sortable)

Questions from the bank can be imported into any story point via
`importFromBank` — no copying or re-entering required.

**School benefit:** Eliminates duplicate work across departments. A maths
department's Question Bank becomes a shared institutional resource — every
teacher benefits from every other teacher's question authoring effort.
High-performing questions (tracked by average score and usage count) float to
the top, helping teachers pick the most effective items.

---

## Bloom's Taxonomy Alignment

### What it is

Every question in the platform can be tagged with one of the **6 Bloom's
Taxonomy cognitive levels**:

| Level        | Description                             |
| ------------ | --------------------------------------- |
| `remember`   | Recall facts and basic concepts         |
| `understand` | Explain ideas or concepts               |
| `apply`      | Use information in new situations       |
| `analyze`    | Draw connections, break down components |
| `evaluate`   | Justify a decision or course of action  |
| `create`     | Produce new or original work            |

### How it works

The `bloomsLevel` field is stored on every `UnifiedItem`. Test analytics
(`TestAnalytics`) include a `bloomsBreakdown` showing score breakdowns per
Bloom's level — so teachers can see at a glance whether students are struggling
with recall (low-order) vs. synthesis (high-order) thinking.

**School benefit:** Curriculum coordinators can ensure spaces are not just
testing recall-level knowledge but building higher-order thinking skills. The
Bloom's breakdown in test analytics provides accreditation-ready evidence that
the curriculum meets pedagogical standards.

---

## Content Versioning

### What it is

A full version history system that tracks every change made to Spaces, Story
Points, and Items.

### How it works

`ContentVersion` documents are created on every `created`, `updated`,
`published`, or `archived` event. Each version record stores: entity type,
entity ID, change type, a human-readable `changeSummary`, who made the change,
and when.

Teachers can `listVersions` for any space and drill into specific entity
histories.

**School benefit:** Provides an audit trail for curriculum changes — essential
for accreditation, quality assurance reviews, and resolving disputes about what
content a student was assessed on. If a question was changed after a student's
attempt, the version history proves the student answered the original version.

---

## Summary Table

| Feature Area             | Key Metrics                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| Question Types           | 15 types (9 auto-graded, 6 AI-graded)                                      |
| Material Types           | 7 types (text, video, PDF, link, interactive, story, rich)                 |
| Story Point Modes        | 5 modes (standard, quiz, timed_test, practice, test)                       |
| AI Features              | Tutor (Socratic), Evaluator (4 rubric modes), Adaptive Engine              |
| Rubric Scoring Modes     | 4 (criteria_based, dimension_based, holistic, hybrid)                      |
| Achievement Categories   | 6 (learning, consistency, excellence, exploration, social, milestone)      |
| Achievement Rarity Tiers | 5 (common → legendary)                                                     |
| Achievement Tiers        | 5 (bronze → diamond)                                                       |
| Leaderboard Scopes       | 3 (story point, course, quest)                                             |
| Leaderboard Periods      | 3 (weekly, monthly, all-time)                                              |
| At-Risk Signals          | 5 (low score, no activity, low completion, declining, zero streak)         |
| Insight Types            | 6 (weak topic, exam prep, streak, celebration, intervention, cross-system) |
| Bloom's Levels           | 6 (remember → create)                                                      |
| Content Marketplace      | B2C store with ratings, reviews, purchase flow                             |
| Question Bank            | Searchable, filterable, reusable across all spaces                         |
