# Seed Data & End-to-End Test Plan

**Author:** Claude (automated) **Date:** 2026-03-08 **Task:** Create tenant,
accounts, system-design course, and run E2E Playwright tests across all apps

---

## 1. Overview

This plan covers two major phases:

1. **Data Seeding** — Create a new tenant (Subhang's school), accounts (admin,
   teacher, student, parent), a "System Design" space with a full course, and
   populate it with 4 different story point types and rich content items.
2. **E2E Playwright Testing** — Write and execute Playwright tests across all 5
   apps (super-admin, admin-web, teacher-web, student-web, parent-web) verifying
   the seeded data, course interactions, item submissions, scoring, and UI/UX.

---

## 2. Phase 1: Data Seeding

### 2.1 Tenant Creation

| Field       | Value                     |
| ----------- | ------------------------- |
| Tenant Name | Subhang Academy           |
| Tenant Code | SUB001                    |
| Owner Email | subhang.rocklee@gmail.com |
| Status      | active                    |
| Plan        | premium                   |
| Contact     | subhang.rocklee@gmail.com |

**Actions:**

1. Create Firebase Auth user for `subhang.rocklee@gmail.com` (password:
   `Test@12345`)
2. Create `/users/{uid}` document with `isSuperAdmin: false`
3. Create `/tenants/tenant_subhang` document with full tenant config
4. Create `/tenantCodes/SUB001` index document pointing to tenant
5. Create academic session `2025-26` (current)

### 2.2 Account Creation

#### 2.2.1 School Admin (Tenant Admin)

| Field        | Value                     |
| ------------ | ------------------------- |
| Email        | subhang.rocklee@gmail.com |
| Role         | tenantAdmin               |
| Display Name | Subhang                   |

- Reuses same Firebase Auth UID as tenant owner
- Create `/userMemberships/{uid}_tenant_subhang` with role `tenantAdmin`
- Set custom claims:
  `{ role: 'tenantAdmin', tenantId: 'tenant_subhang', tenantCode: 'SUB001' }`

#### 2.2.2 Teacher

| Field        | Value                                |
| ------------ | ------------------------------------ |
| Email        | subhang.rocklee@gmail.com            |
| Role         | teacher                              |
| Display Name | Subhang                              |
| Department   | Computer Science                     |
| Subjects     | System Design, Software Architecture |

- Same Firebase Auth UID (multi-role user)
- Create `/tenants/tenant_subhang/teachers/{teacherId}` document
- Update membership to include `teacherId`
- Note: In production, the active role is determined by `activeTenantId` +
  membership. The user can switch between admin/teacher views.

#### 2.2.3 Student (Test Account)

| Field        | Value                        |
| ------------ | ---------------------------- |
| Email        | student.test@subhang.academy |
| Password     | Test@12345                   |
| Role         | student                      |
| Display Name | Test Student                 |
| Roll Number  | 2026001                      |
| Grade        | 10                           |
| Section      | A                            |

- Create new Firebase Auth user
- Create `/users/{uid}` document
- Create `/tenants/tenant_subhang/students/{studentId}` document
- Create `/userMemberships/{uid}_tenant_subhang` with role `student`
- Set custom claims:
  `{ role: 'student', tenantId: 'tenant_subhang', tenantCode: 'SUB001', studentId: '...' }`

#### 2.2.4 Parent (Test Account)

| Field          | Value                       |
| -------------- | --------------------------- |
| Email          | parent.test@subhang.academy |
| Password       | Test@12345                  |
| Role           | parent                      |
| Display Name   | Test Parent                 |
| Linked Student | Test Student (from 2.2.3)   |

- Create new Firebase Auth user
- Create `/users/{uid}` document
- Create `/tenants/tenant_subhang/parents/{parentId}` document with
  `studentIds: [studentId]`
- Create `/userMemberships/{uid}_tenant_subhang` with role `parent`
- Set custom claims:
  `{ role: 'parent', tenantId: 'tenant_subhang', tenantCode: 'SUB001', parentId: '...' }`

#### 2.2.5 Class Creation

| Field    | Value                        |
| -------- | ---------------------------- |
| Name     | System Design Class          |
| Grade    | 10                           |
| Section  | A                            |
| Teacher  | Subhang (teacher from 2.2.2) |
| Students | Test Student (from 2.2.3)    |

- Create `/tenants/tenant_subhang/classes/{classId}` document
- Link teacher and student to the class

---

### 2.3 Space & Course Creation: "System Design"

#### Space Configuration

| Field       | Value                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title       | System Design                                                                                                                                                                               |
| Slug        | system-design                                                                                                                                                                               |
| Description | Master the fundamentals of system design, covering scalability, databases, caching, load balancing, and distributed architectures through theory, practice, quizzes, and timed assessments. |
| Type        | hybrid                                                                                                                                                                                      |
| Subject     | Computer Science                                                                                                                                                                            |
| Access Type | class_assigned                                                                                                                                                                              |
| Class IDs   | [classId from 2.2.5]                                                                                                                                                                        |
| Teacher IDs | [teacherId from 2.2.2]                                                                                                                                                                      |
| Status      | published                                                                                                                                                                                   |

#### Story Points (4 types)

Each story point uses a different `StoryPointType` to showcase all available
types.

---

##### Story Point 1: "Fundamentals of Scalability" — Type: `standard`

**Description:** Learn core scalability concepts — horizontal vs vertical
scaling, CAP theorem, and trade-offs.

**Sections:** | ID | Title | Order | |----|-------|-------| | sec_theory |
Theory & Concepts | 0 | | sec_practice | Practice Questions | 1 |

**Items (8 items):**

1. **[Material - Rich]** "Introduction to Scalability"
   - Section: Theory & Concepts
   - Rich content blocks covering: What is scalability, horizontal vs vertical
     scaling, real-world examples, CAP theorem overview

2. **[Material - Video]** "Scalability Deep Dive"
   - Section: Theory & Concepts
   - Video material with embedded YouTube link to a scalability talk

3. **[Question - MCQ]** "Which type of scaling adds more machines?"
   - Section: Practice Questions
   - Options: Horizontal (correct), Vertical, Diagonal, Circular
   - Points: 10, Difficulty: easy

4. **[Question - True/False]** "CAP theorem states you can have all three:
   Consistency, Availability, Partition Tolerance"
   - Section: Practice Questions
   - Answer: false
   - Points: 10, Difficulty: easy

5. **[Question - MCAQ]** "Select all benefits of horizontal scaling"
   - Section: Practice Questions
   - Options: Better fault tolerance (correct), Linear cost scaling (correct),
     Simpler architecture (incorrect), No need for load balancer (incorrect)
   - Points: 15, Difficulty: medium

6. **[Question - Numerical]** "If a system handles 1000 req/s with 1 server, how
   many req/s can 4 identical servers handle with perfect horizontal scaling?"
   - Section: Practice Questions
   - Answer: 4000, Tolerance: 0
   - Points: 10, Difficulty: easy

7. **[Question - Fill Blanks]** "The **\_** theorem states that a distributed
   system can only guarantee two of three properties."
   - Section: Practice Questions
   - Answer: CAP
   - Points: 10, Difficulty: medium

8. **[Question - Paragraph]** "Explain the trade-offs between horizontal and
   vertical scaling with real-world examples."
   - Section: Practice Questions
   - AI-evaluatable, model answer provided
   - Points: 25, Difficulty: hard

---

##### Story Point 2: "Database Design & Patterns" — Type: `practice`

**Description:** Practice database selection, schema design, partitioning, and
replication strategies.

**Sections:** | ID | Title | Order | |----|-------|-------| | sec_concepts | Key
Concepts | 0 | | sec_exercises | Practice Exercises | 1 | | sec_advanced |
Advanced Patterns | 2 |

**Items (8 items):**

1. **[Material - Rich]** "SQL vs NoSQL Decision Guide"
   - Section: Key Concepts
   - Comparison table, when to use each, real-world examples (MySQL vs MongoDB
     vs Cassandra)

2. **[Question - MCQ]** "Which database is best for highly relational data with
   complex joins?"
   - Section: Practice Exercises
   - Options: PostgreSQL (correct), MongoDB, Redis, Cassandra
   - Points: 10, Difficulty: easy

3. **[Question - Matching]** "Match the database to its primary use case"
   - Section: Practice Exercises
   - Pairs: Redis → Caching, PostgreSQL → Relational Data, MongoDB → Document
     Storage, Cassandra → Time-series Data
   - Points: 20, Difficulty: medium

4. **[Question - MCAQ]** "Select all valid database sharding strategies"
   - Section: Practice Exercises
   - Options: Hash-based (correct), Range-based (correct), Directory-based
     (correct), Random distribution (incorrect)
   - Points: 15, Difficulty: medium

5. **[Question - Text]** "What is database denormalization and when would you
   use it?"
   - Section: Practice Exercises
   - AI-evaluatable short answer
   - Points: 15, Difficulty: medium

6. **[Question - MCQ]** "What is the primary benefit of database replication?"
   - Section: Advanced Patterns
   - Options: High availability (correct), Reduced storage, Faster writes,
     Simpler queries
   - Points: 10, Difficulty: easy

7. **[Question - True/False]** "In a master-slave replication setup, writes go
   to slave nodes"
   - Section: Advanced Patterns
   - Answer: false
   - Points: 10, Difficulty: easy

8. **[Question - Paragraph]** "Design a database schema for a social media
   platform like Twitter. Include tables, relationships, and indexing strategy."
   - Section: Advanced Patterns
   - AI-evaluatable, detailed model answer
   - Points: 30, Difficulty: hard

---

##### Story Point 3: "Caching & Load Balancing Quiz" — Type: `quiz`

**Description:** Quick assessment on caching strategies, CDNs, and load
balancing algorithms.

**Assessment Config:**

- Max attempts: 3
- Shuffle questions: true
- Show results immediately: true
- Passing percentage: 60

**Sections:** | ID | Title | Order | |----|-------|-------| | sec_caching |
Caching Questions | 0 | | sec_lb | Load Balancing Questions | 1 |

**Items (8 items):**

1. **[Question - MCQ]** "Which caching strategy writes to cache AND database
   simultaneously?"
   - Section: Caching Questions
   - Options: Write-through (correct), Write-back, Write-around, Cache-aside
   - Points: 10, Difficulty: easy

2. **[Question - MCQ]** "What is a cache stampede?"
   - Section: Caching Questions
   - Options: Many requests hitting DB when cache expires (correct), Cache
     becoming too large, Cache writing incorrect data, Cache server crashing
   - Points: 10, Difficulty: medium

3. **[Question - True/False]** "CDN (Content Delivery Network) is primarily used
   for caching static assets"
   - Section: Caching Questions
   - Answer: true
   - Points: 10, Difficulty: easy

4. **[Question - Fill Blanks]** "The **\_** caching pattern has the application
   check cache first, and on miss, loads from DB and populates cache."
   - Section: Caching Questions
   - Answer: cache-aside
   - Points: 10, Difficulty: medium

5. **[Question - MCQ]** "Which load balancing algorithm sends each request to
   the next server in order?"
   - Section: Load Balancing Questions
   - Options: Round Robin (correct), Least Connections, IP Hash, Random
   - Points: 10, Difficulty: easy

6. **[Question - MCQ]** "Which load balancing algorithm is best for servers with
   different capacities?"
   - Section: Load Balancing Questions
   - Options: Weighted Round Robin (correct), Simple Round Robin, Random, IP
     Hash
   - Points: 10, Difficulty: medium

7. **[Question - MCAQ]** "Select all Layer 7 (application layer) load balancing
   features"
   - Section: Load Balancing Questions
   - Options: URL-based routing (correct), SSL termination (correct), Header
     inspection (correct), MAC address routing (incorrect)
   - Points: 15, Difficulty: medium

8. **[Question - Jumbled]** "Arrange the caching layers from closest to furthest
   from the user"
   - Section: Load Balancing Questions
   - Correct order: Browser Cache → CDN → Application Cache → Database Cache
   - Points: 15, Difficulty: medium

---

##### Story Point 4: "System Design Assessment" — Type: `timed_test`

**Description:** Timed assessment covering all system design topics. Tests deep
understanding of distributed systems architecture.

**Assessment Config:**

- Duration: 30 minutes
- Max attempts: 1
- Shuffle questions: true
- Show results immediately: false (results after review)
- Passing percentage: 50

**Sections:** | ID | Title | Order | |----|-------|-------| | sec_mcq | Multiple
Choice | 0 | | sec_design | Design Questions | 1 |

**Items (8 items):**

1. **[Question - MCQ]** "What is the primary purpose of a message queue in
   system design?"
   - Section: Multiple Choice
   - Options: Asynchronous processing & decoupling (correct), Database
     replication, User authentication, File storage
   - Points: 10, Difficulty: easy

2. **[Question - MCQ]** "Which consistency model does eventual consistency
   belong to?"
   - Section: Multiple Choice
   - Options: Weak consistency (correct), Strong consistency, Immediate
     consistency, Causal consistency
   - Points: 10, Difficulty: medium

3. **[Question - True/False]** "A microservices architecture always performs
   better than a monolith"
   - Section: Multiple Choice
   - Answer: false
   - Points: 10, Difficulty: easy

4. **[Question - MCQ]** "What does a reverse proxy do?"
   - Section: Multiple Choice
   - Options: Sits in front of servers and forwards client requests (correct),
     Sits in front of clients and masks their identity, Encrypts database
     connections, Manages DNS records
   - Points: 10, Difficulty: medium

5. **[Question - Numerical]** "If a system has 99.9% uptime, how many minutes of
   downtime per year approximately?"
   - Section: Multiple Choice
   - Answer: 526 (365.25 _ 24 _ 60 \* 0.001 = 525.96), Tolerance: 5
   - Points: 15, Difficulty: hard

6. **[Question - Paragraph]** "Design a URL shortener like bit.ly. Describe the
   key components, APIs, database schema, and how you would handle high
   traffic."
   - Section: Design Questions
   - AI-evaluatable, model answer provided
   - Points: 30, Difficulty: hard

7. **[Question - Paragraph]** "Design a notification system that supports email,
   SMS, and push notifications. How would you handle millions of notifications
   per day?"
   - Section: Design Questions
   - AI-evaluatable, model answer provided
   - Points: 30, Difficulty: hard

8. **[Question - Text]** "Name three key metrics you would monitor for a
   production distributed system."
   - Section: Design Questions
   - AI-evaluatable short answer
   - Points: 15, Difficulty: medium

---

### 2.4 Seeding Implementation Approach

**Script:** Create `scripts/seed-subhang.ts`

The script will:

1. Use Firebase Admin SDK connecting to production Firestore
2. Follow the same pattern as `seed-production.ts` (ensureAuthUser, BatchWriter,
   etc.)
3. Create all entities in the correct order with proper references
4. Set custom claims for all users
5. Publish the space so it's visible to students
6. Log all created IDs for test reference

**Execution:**

```bash
GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/seed-subhang.ts
```

---

## 3. Phase 2: E2E Playwright Testing

### 3.1 Test File Structure

Create a new test file: `tests/e2e/system-design-e2e.spec.ts`

Add new credentials to `tests/e2e/helpers/selectors.ts`:

```typescript
subhangAdmin: { email: 'subhang.rocklee@gmail.com', password: 'Test@12345' },
subhangTeacher: { email: 'subhang.rocklee@gmail.com', password: 'Test@12345' },
subhangStudent: { email: 'student.test@subhang.academy', password: 'Test@12345' },
subhangParent: { email: 'parent.test@subhang.academy', password: 'Test@12345' },
```

### 3.2 Test Scenarios

#### 3.2.1 Super Admin Tests (Port 4567)

| #   | Test                          | Description                                                     |
| --- | ----------------------------- | --------------------------------------------------------------- |
| 1   | Login as Super Admin          | Verify super admin can log in                                   |
| 2   | Verify Subhang Academy tenant | Check tenant appears in tenant list with correct details        |
| 3   | View tenant details           | Navigate to tenant detail page, verify name, code, status, plan |
| 4   | Verify tenant stats           | Check totalStudents, totalTeachers, totalSpaces counts          |

#### 3.2.2 Client Admin Tests (Port 4568)

| #   | Test                  | Description                                                        |
| --- | --------------------- | ------------------------------------------------------------------ |
| 1   | Login as School Admin | Login with school code SUB001 + admin credentials                  |
| 2   | Verify dashboard      | Check School Admin Dashboard loads with correct school name        |
| 3   | View classes          | Navigate to classes, verify "System Design Class" exists           |
| 4   | View teachers         | Navigate to teachers, verify Subhang appears as teacher            |
| 5   | View students         | Navigate to students, verify Test Student with roll number 2026001 |
| 6   | View parents          | Navigate to parents, verify Test Parent with linked student        |
| 7   | View spaces           | Navigate to spaces/LevelUp section, verify "System Design" space   |
| 8   | View space details    | Click into System Design space, verify 4 story points listed       |

#### 3.2.3 Teacher App Tests (Port 4569)

| #   | Test                        | Description                                                             |
| --- | --------------------------- | ----------------------------------------------------------------------- |
| 1   | Login as Teacher            | Login with school code SUB001 + teacher credentials                     |
| 2   | Verify dashboard            | Check Teacher Dashboard loads                                           |
| 3   | Navigate to Spaces          | Verify "System Design" space appears in teacher's spaces                |
| 4   | View space detail           | Click into space, verify story points and item counts                   |
| 5   | View standard story point   | Open "Fundamentals of Scalability", verify sections & items             |
| 6   | View practice story point   | Open "Database Design & Patterns", verify practice items                |
| 7   | View quiz story point       | Open "Caching & Load Balancing Quiz", verify quiz config                |
| 8   | View timed test story point | Open "System Design Assessment", verify timer config                    |
| 9   | Check item types            | Verify different item types render correctly (MCQ, TF, paragraph, etc.) |

#### 3.2.4 Student App Tests (Port 4570)

| #   | Test                        | Description                                                                |
| --- | --------------------------- | -------------------------------------------------------------------------- |
| 1   | Login as Student            | Login with school code SUB001 + student email credentials                  |
| 2   | Verify dashboard            | Check student Dashboard loads                                              |
| 3   | Find System Design space    | Navigate to spaces, verify "System Design" is visible                      |
| 4   | Enter standard story point  | Open "Fundamentals of Scalability"                                         |
| 5   | Read material               | View rich content material, verify rendering                               |
| 6   | Answer MCQ question         | Select correct answer for an MCQ, submit                                   |
| 7   | Answer True/False question  | Answer a true/false question                                               |
| 8   | Answer numerical question   | Enter numerical answer                                                     |
| 9   | Verify scoring              | Check points earned after answering correctly                              |
| 10  | Start quiz                  | Open "Caching & Load Balancing Quiz", verify quiz mode                     |
| 11  | Answer quiz questions       | Answer 3-4 quiz questions                                                  |
| 12  | Submit quiz                 | Submit quiz and verify results                                             |
| 13  | Start timed test            | Open "System Design Assessment", verify countdown timer                    |
| 14  | Answer timed test questions | Answer a few questions under timed conditions                              |
| 15  | Submit timed test           | Submit test (or let timer elapse), verify submission                       |
| 16  | Check progress              | Navigate to progress/dashboard, verify space progress reflects submissions |

#### 3.2.5 Parent App Tests (Port 4571)

| #   | Test                   | Description                                                               |
| --- | ---------------------- | ------------------------------------------------------------------------- |
| 1   | Login as Parent        | Login with school code SUB001 + parent credentials                        |
| 2   | Verify dashboard       | Check Parent Dashboard loads                                              |
| 3   | View linked student    | Verify Test Student appears in parent's children list                     |
| 4   | View student progress  | Check that space progress for "System Design" reflects student's activity |
| 5   | Check progress details | Verify points earned, completion percentage are visible                   |

---

### 3.3 Cross-App Verification Points

These are the key data points that must be consistent across apps:

| Data Point        | Super Admin | Admin         | Teacher       | Student      | Parent       |
| ----------------- | ----------- | ------------- | ------------- | ------------ | ------------ |
| Tenant exists     | ✓           | ✓ (dashboard) | ✓ (context)   | ✓ (context)  | ✓ (context)  |
| Class visible     | -           | ✓             | ✓             | -            | -            |
| Space visible     | -           | ✓             | ✓             | ✓            | ✓ (progress) |
| Story points      | -           | ✓ (count)     | ✓ (detail)    | ✓ (interact) | -            |
| Items render      | -           | -             | ✓ (preview)   | ✓ (attempt)  | -            |
| Submission scores | -           | -             | ✓ (analytics) | ✓ (results)  | ✓ (progress) |
| Student progress  | -           | ✓ (summary)   | ✓ (detail)    | ✓ (own)      | ✓ (child)    |

---

## 4. Execution Order

### Step 1: Create Seed Script

- Write `scripts/seed-subhang.ts` with all tenant, account, class, space, story
  point, and item data

### Step 2: Run Seed Script

```bash
GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/seed-subhang.ts
```

### Step 3: Verify Apps Are Running

```bash
./start.sh status
```

If not running:

```bash
./start.sh
```

### Step 4: Update Test Helpers

- Add Subhang credentials and school code to `tests/e2e/helpers/selectors.ts`

### Step 5: Write Playwright Tests

- Create `tests/e2e/system-design-e2e.spec.ts`
- Implement all test scenarios from Section 3.2

### Step 6: Execute Tests

```bash
# Run all system-design tests
pnpm run test:e2e -- --grep "System Design"

# Or run per-app
pnpm run test:e2e:super-admin -- --grep "Subhang"
pnpm run test:e2e:admin-web -- --grep "Subhang"
pnpm run test:e2e:teacher-web -- --grep "Subhang"
pnpm run test:e2e:student-web -- --grep "Subhang"
pnpm run test:e2e:parent-web -- --grep "Subhang"
```

### Step 7: Review Results

- Check Playwright HTML report
- Verify screenshots on failures
- Fix any UI/UX issues found
- Re-run failing tests

---

## 5. Success Criteria

1. **All accounts created** — Subhang admin, teacher, test student, test parent
   all exist in Firebase Auth + Firestore
2. **Tenant operational** — Subhang Academy (SUB001) is active with correct
   config
3. **System Design course populated** — Space with 4 story points (standard,
   practice, quiz, timed_test), each with 8 items including multiple question
   types
4. **Super Admin** — Tenant visible in management console
5. **Admin Web** — Dashboard shows correct entity counts,
   classes/teachers/students/parents viewable
6. **Teacher Web** — Space and all story points visible with correct item
   details
7. **Student Web** — Can browse space, read materials, answer questions (MCQ,
   TF, numerical, paragraph), take quiz, take timed test, see scores
8. **Parent Web** — Can see linked student and their progress in System Design
   space
9. **Scoring works** — Auto-evaluatable questions (MCQ, TF, numerical) score
   correctly
10. **UI/UX** — All pages render without errors, navigation works, responsive
    layouts function

---

## 6. Risk Mitigations

| Risk                                              | Mitigation                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Auth UID conflicts (same email for admin+teacher) | Use single UID with dual membership records                                |
| Space not visible to student                      | Ensure space status is `published` and `classIds` includes student's class |
| Timed test timer issues                           | Set generous timeout (30 min), test submission before timer expires        |
| AI-evaluatable questions hang                     | Include timeout on AI calls, test auto-evaluatable questions first         |
| Custom claims not propagated                      | Force token refresh in test (reload page after seeding)                    |
| Apps not running                                  | Check `./start.sh status` before testing                                   |

---

## 7. Estimated Scope

| Component                 | Count                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Firebase Auth users       | 3 (admin/teacher shared UID + student + parent)                                                                       |
| Firestore documents       | ~50+ (tenant, users, memberships, class, teacher, student, parent, academic session, space, 4 story points, 32 items) |
| Playwright test cases     | ~30-35 across 5 apps                                                                                                  |
| Story point types covered | 4/5 (standard, practice, quiz, timed_test)                                                                            |
| Question types tested     | 9 (MCQ, MCAQ, TF, numerical, fill-blanks, matching, jumbled, text, paragraph)                                         |
