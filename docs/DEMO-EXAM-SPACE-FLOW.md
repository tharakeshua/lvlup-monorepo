# Exam → Practice Space → Student Learning Demo (SUB001)

Live URLs (project `lvlup-ff6fa`):

| App     | URL                                 |
| ------- | ----------------------------------- |
| Teacher | https://lvlup-ff6fa-teacher.web.app |
| Student | https://lvlup-ff6fa-student.web.app |

## Tenant & credentials

| Role          | School code | Email                        | Password   |
| ------------- | ----------- | ---------------------------- | ---------- |
| Teacher/Admin | `SUB001`    | subhang.rocklee@gmail.com    | Test@12345 |
| Student       | `SUB001`    | student.test@subhang.academy | Test@12345 |

Tenant: **Subhang Academy** (`tenant_subhang`, code `SUB001`)

## Teacher path — exam → practice space → release

1. Open https://lvlup-ff6fa-teacher.web.app/login
2. Enter school code **SUB001** → Continue
3. Sign in as **subhang.rocklee@gmail.com** / **Test@12345**
4. Go to **Exams** in the sidebar
5. Open **Demo Post-Grade Practice Quiz** (exam id `rqh0flNYcZ6raUcuVqqj`) or
   any **published** exam with extracted questions
6. On the exam detail page:
   - If no practice space yet: click **Create Practice Space** (calls
     `v1.autograde.createSpaceFromExam`)
   - After grading pipeline completes: click **Release Results** (reconciles
     wrong/partial scores into linked space progress)
7. Click **Practice Space** link to open the linked space in the editor (verify
   items mirror exam questions)

## Student path — learn mistakes → practice

1. Open https://lvlup-ff6fa-student.web.app/login
2. Enter school code **SUB001** → Continue
3. Sign in as **student.test@subhang.academy** / **Test@12345**
4. **Spaces** → open the exam-linked practice space (title ends with “—
   Practice”)
5. Open the exam story point — wrong/partial items show status colors on the
   numbered nav
6. Work through questions (reattempt paragraph items; matching items load
   without “invalid data”)
7. Optional: open **Mock Interview Practice** / **Quiz** / **Timed Assessment**
   story points inside seeded content spaces (e.g. Behavioral Interview Mastery)

### Fixed story-point URL (behavioral content)

- Space: `1AqFwKSf59FiIrqzaQ7i` (Behavioral Interview Mastery)
- Story point: `0VKwtLTt1VydSeI073VB` (Ambiguity & Prioritization)
- Live:
  https://lvlup-ff6fa-student.web.app/spaces/1AqFwKSf59FiIrqzaQ7i/story-points/0VKwtLTt1VydSeI073VB

## Seeded demo artifacts (2026-07-19)

| Artifact          | ID                                                              |
| ----------------- | --------------------------------------------------------------- |
| Exam              | `rqh0flNYcZ6raUcuVqqj`                                          |
| Practice space    | `r2U7Ghi3GzL933TGmkH1`                                          |
| Exam story point  | `vYcwEaIyKM4tV0ORBCsH`                                          |
| Student space URL | https://lvlup-ff6fa-student.web.app/spaces/r2U7Ghi3GzL933TGmkH1 |
| Teacher exam URL  | https://lvlup-ff6fa-teacher.web.app/exams/rqh0flNYcZ6raUcuVqqj  |

Run `npx tsx scripts/seed-exam-space-demo.ts` to recreate. Release results from
teacher UI when exam status is **grading** (seed sets **published** — use
**Release Results** after moving to grading via submissions flow, or re-run seed
after patching status).

```bash
# Reset passwords for demo accounts
npx tsx scripts/heal-test-credentials.ts

# Create fresh exam + practice space + released results (happy path)
npx tsx scripts/seed-exam-space-demo.ts
```

## What's stubbed

- `assignPracticeFromMistakes` — not implemented; students manually reattempt in
  the linked practice space
- Auto-filter “wrong questions only” into a separate assignment — not wired
- PDF report attachment on release — stubbed in `practice-from-mistakes.ts`

## Deploy

```bash
pnpm exec turbo run build --filter=@levelup/student-web --filter=@levelup/teacher-web
firebase deploy --only hosting:student-web,hosting:teacher-web --project lvlup-ff6fa

cd functions/sdk-v1 && pnpm run build
firebase deploy --only functions:sdk-v1 --project lvlup-ff6fa
```

Key functions: `v1-autograde-createSpaceFromExam`,
`v1-autograde-releaseResults`, `v1-levelup-listItems`
