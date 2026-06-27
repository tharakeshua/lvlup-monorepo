# Teacher Portal — Class / Student / Exam Management Implementation Plan

**Status:** Proposed **Owner:** TBD **Date:** 2026-05-01 **Scope:**
`apps/teacher-web` only — backend callables and shared hooks already exist.

---

## 1. Problem statement

Teachers cannot complete the basic roster + assessment loop end-to-end inside
the teacher portal:

1. There is no Classes list page. The only way to reach a class is via the
   Dashboard's at-risk panel or by typing `/classes/:id` directly.
2. There is no "Create Class" affordance anywhere.
3. `ClassDetailPage` is read-only across all five tabs (Overview / Spaces /
   Exams / Students / Analytics).
4. `StudentsPage` is read-only — no create, no edit, no enroll.
5. `ExamCreatePage` collects `classIds` as a comma-separated free-text input.
6. `ExamDetailPage` has no UI to edit `classIds` or any other exam metadata
   after creation; the Settings tab only shows grading config.

Backend support already exists for every operation we need:

- `useCreateClass`, `useUpdateClass`, `useDeleteClass` —
  `packages/shared-hooks/src/queries/useClasses.ts:39-110`
- `useCreateStudent`, `useUpdateStudent` —
  `packages/shared-hooks/src/queries/useStudents.ts:39-96`
- `callSaveExam` already accepts `classIds` —
  `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx:103-124`

So this is a **pure frontend gap** in the teacher portal.

---

## 2. Goals

By the end of this work, a teacher logged into `apps/teacher-web` (port 4569)
can:

- G1. List all classes for their tenant in a dedicated page reachable from the
  sidebar.
- G2. Create a new class (name, grade, section).
- G3. Edit a class's metadata and archive/unarchive it.
- G4. Enroll an existing student into a class and unenroll them.
- G5. Create a new student (with optional class enrollment) and edit core
  student fields.
- G6. Pick classes for a new exam from a multi-select against the actual class
  roster (not free text).
- G7. Add or remove classes on an existing exam after creation.
- G8. Edit core exam metadata (title, subject, dates, marks) after creation.

The submission upload cascade (class → student → answer-sheet) already works
(`apps/teacher-web/src/pages/exams/SubmissionsPage.tsx:86-103`); this plan does
not change it but unblocks it for teachers who don't have classes/students set
up yet.

---

## 3. Non-goals

- Bulk CSV import of students (defer to a follow-up).
- Inviting parents from teacher portal (admin-only).
- Editing teacher rosters / assigning teachers to classes (admin scope; depends
  on JWT claim refresh — `firestore.rules:69-71`).
- Changing the JWT claim flow that drives Firestore rules (out of scope).
- Promotion / academic-session rollover.
- Submission "already uploaded" indicator (small follow-up, captured
  separately).

---

## 4. Architecture & affordance map

### 4.1 New routes

| Route               | Purpose                                          | New / existing    |
| ------------------- | ------------------------------------------------ | ----------------- |
| `/classes`          | Classes list + Create Class dialog               | NEW               |
| `/classes/:classId` | Class detail with tab-level Add/Edit affordances | EXISTING — extend |
| `/students`         | Students list + Create Student dialog            | EXISTING — extend |
| `/exams/new`        | Multi-select class picker                        | EXISTING — extend |
| `/exams/:examId`    | Edit exam metadata + manage classes              | EXISTING — extend |

### 4.2 Sidebar

Add a "Classes" entry to `apps/teacher-web/src/layouts/AppLayout.tsx` between
"Spaces" and "Exams" (before the existing `/analytics/classes` analytics entry),
pointing to `/classes`.

### 4.3 Hooks reused (no new hooks needed)

- `useClasses(tenantId)` — list
- `useCreateClass`, `useUpdateClass`, `useDeleteClass` — CRUD
- `useStudents(tenantId, { classId? })` — list
- `useCreateStudent`, `useUpdateStudent` — CRUD
- `callSaveExam({ id, tenantId, data: { classIds, title, subject, ... } })` —
  exam edit (already supports partial updates)

### 4.4 New shared components (in `apps/teacher-web/src/components/`)

- `class/ClassFormDialog.tsx` — create + edit class (name, grade, section,
  status)
- `class/EnrollStudentDialog.tsx` — multi-select existing students into a class
- `student/StudentFormDialog.tsx` — create + edit student
- `exam/ExamMetadataEditDialog.tsx` — edit title, subject, classIds, dates,
  marks
- `exam/ClassMultiSelect.tsx` — chip-style picker over `useClasses(tenantId)`
  (used in both create + edit)

---

## 5. Workstreams

### W1 — Classes list page + Create / Edit / Archive _(G1, G2, G3)_

**Files:**

- NEW `apps/teacher-web/src/pages/ClassesPage.tsx`
- NEW `apps/teacher-web/src/components/class/ClassFormDialog.tsx`
- EDIT `apps/teacher-web/src/App.tsx` — add `<Route path="/classes" ... />`
- EDIT `apps/teacher-web/src/layouts/AppLayout.tsx` — add sidebar nav entry +
  route prefetch entry

**Behavior:**

- Table columns: Name, Grade, Section, Student count, Status, Actions.
- Search by name/grade.
- "+ Create Class" button → `ClassFormDialog` in create mode → `useCreateClass`.
- Per-row "Edit" → `ClassFormDialog` in edit mode → `useUpdateClass`.
- Per-row "Archive" / "Unarchive" → `useUpdateClass({ status })`. (Use archive
  over delete for safety.)
- Empty state with primary CTA pointing at the Create dialog.

**Acceptance:**

- A logged-in teacher can navigate to `/classes`, create a class, and see it in
  the list within ~1s of the mutation settling (cache invalidation already wired
  in `useCreateClass`).
- Editing a class refreshes the list.
- Archived classes are visually distinct and filtered out by default with a
  "Show archived" toggle.

---

### W2 — ClassDetailPage: enroll/unenroll students + edit metadata _(G3, G4)_

**Files:**

- EDIT `apps/teacher-web/src/pages/ClassDetailPage.tsx`
- NEW `apps/teacher-web/src/components/class/EnrollStudentDialog.tsx`

**Behavior on Students tab:**

- "+ Add Student" button (top-right of the students table). Opens
  `EnrollStudentDialog`.
- Dialog shows a searchable list of tenant students NOT already in this class
  (filter `useStudents(tenantId)` by `!classIds.includes(currentClassId)`).
- Multi-select with chip preview; on submit, batch-call
  `useUpdateStudent({ classIds: [...existing, classId] })` for each. Cache
  invalidation (already wired) refreshes both students and classes lists.
- Per-row "Remove from class" → confirm dialog →
  `useUpdateStudent({ classIds: existing.filter(id => id !== classId) })`.

**Behavior on header:**

- Add a small "Edit class" button next to the StatusBadge → reuses
  `ClassFormDialog` from W1 in edit mode.

**Acceptance:**

- Enrolling 5 students at once results in a single dialog interaction and
  updates both `Class.studentIds` and each `Student.classIds[]` (the callable
  already mirrors).
- Removing a student from a class does not delete the student.
- The class detail page's `studentCount`/`Students` count updates.

---

### W3 — StudentsPage: create + edit _(G5)_

**Files:**

- EDIT `apps/teacher-web/src/pages/StudentsPage.tsx`
- NEW `apps/teacher-web/src/components/student/StudentFormDialog.tsx`

**Behavior:**

- "+ Create Student" button on top of the search bar.
- Dialog fields: First name, Last name, Email (optional), Roll number, Admission
  number, Grade, Section, optional initial class (single-select for the create
  flow). On submit → `useCreateStudent`.
- Per-row "Edit" → `StudentFormDialog` in edit mode → `useUpdateStudent`. Dialog
  edit mode also exposes class enrollment as a multi-select against
  `useClasses`.
- Per-row "Archive" with confirm → `useUpdateStudent({ status: 'archived' })`.
- Note: the underlying `createStudent` callable expects `uid` (existing Firebase
  Auth uid). Until a separate "invite student" flow lands, the dialog must
  accept an existing `uid` OR we add a `tenantAdmin`-only gate. **Decision
  needed before implementation:** scope the create flow to "link existing auth
  user" (safe) vs. extending the callable to provision auth (separate ticket).
  Default to "link existing" to avoid scope creep.

**Acceptance:**

- A teacher with an existing student `uid` can create a student record from the
  teacher portal and see them in the list.
- Edit + archive flows round-trip cleanly.

---

### W4 — Exam create: replace text input with class multi-select _(G6)_

**Files:**

- EDIT `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx`
- NEW `apps/teacher-web/src/components/exam/ClassMultiSelect.tsx`

**Behavior:**

- Replace the comma-separated text input at `ExamCreatePage.tsx:248-257` with
  `<ClassMultiSelect value={classIds} onChange={setClassIds} />`.
- Component renders chips for selected classes + popover with searchable list
  pulled from `useClasses(tenantId, { status: 'active' })`.
- Validation: Step "metadata" cannot proceed if `classIds.length === 0`
  (currently it can; this also fixes the silent footgun that produces the
  empty-state warning we see in `SubmissionsPage.tsx:346-353`).
- Inline "+ Create new class" link inside the popover, opening `ClassFormDialog`
  so a teacher can author both in one flow.

**Acceptance:**

- Cannot advance past step 1 with zero classes.
- Selected classes appear as chips and persist into `callSaveExam` payload as
  `string[]`.

---

### W5 — Exam detail: edit classes + edit metadata _(G7, G8)_

**Files:**

- EDIT `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- NEW `apps/teacher-web/src/components/exam/ExamMetadataEditDialog.tsx`
- REUSE `ClassMultiSelect` from W4

**Behavior on header:**

- Add an "Edit" button (pencil icon) next to "Publish" / "Link to Space" → opens
  `ExamMetadataEditDialog`.
- Dialog edits: title, subject, topics, totalMarks, passingMarks, duration,
  examDate, classIds (via `ClassMultiSelect`).
- Submit → `callSaveExam({ id: examId, tenantId, data })` → `refetch()`.

**Behavior on Settings tab:**

- Add a "Classes" section above "Grading Configuration" listing
  currently-assigned classes as chips with × to remove and a "+ Add class"
  picker.
- Each mutation calls `callSaveExam({ data: { classIds: [...] } })` directly so
  you don't have to open the full edit dialog for a one-off class swap.

**Edit-window guard:**

- If the exam is `results_released`, disable the editor and show "Editing locked
  after results release" — the grading pipeline must not see a class added after
  release.
- For other terminal-ish states (`completed`), allow class edits with a warning
  that adding a class won't retroactively grade old submissions.

**Acceptance:**

- A teacher can change `classIds` on an existing exam and the Submissions page's
  class dropdown reflects it on next render (the cascade in
  `SubmissionsPage.tsx:86-103` is already reactive on `exam?.classIds`).
- A teacher can edit title/subject/marks and the changes persist.
- Editing is locked once results are released.

---

### W6 — Cross-cutting

- Sidebar: add "Classes" nav entry (`AppLayout.tsx`).
- Toasts on success/failure for every mutation (use the existing `useApiError`
  pattern from `ExamCreatePage.tsx:35`).
- Optimistic UI is **not** required — TanStack Query cache invalidation already
  covers re-fetch (see `useCreateClass.onSuccess` and friends).
- E2E coverage: extend `apps/teacher-web/e2e/` with:
  - `class-crud.spec.ts` (create / edit / archive class)
  - `student-enroll.spec.ts` (create student, add to class, remove from class)
  - `exam-class-edit.spec.ts` (edit exam classes, validation, lock after
    release)

---

## 6. Out-of-scope items captured for follow-ups

- F1. CSV bulk import of students.
- F2. "Already submitted" indicator on the student picker in `SubmissionsPage`.
- F3. Provisioning a Firebase Auth user from the teacher portal during student
  create.
- F4. Assigning teachers to classes from the teacher portal (admin scope).
- F5. Promotion / academic-session rollover UI.

---

## 7. Risks

| Risk                                                                                                                               | Mitigation                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher's JWT `classIds` claim is stale after a class is created/edited and the new class isn't visible.                           | The teacher should still see classes they own (createdBy in this session); the claim is only relevant for cross-class read scoping. Document that claim refresh on next login is acceptable. |
| Editing `classIds` on an exam mid-grading creates orphan submissions for removed classes.                                          | Show a confirm dialog explaining "Removing a class won't delete existing submissions for students in that class" + telemetry.                                                                |
| `createStudent` callable expects a pre-existing `uid`.                                                                             | Constrain UI to "link existing user" until F3 lands. Document this in the dialog's helper text.                                                                                              |
| `useCreateClass` invalidates the classes list but not student lists; stale Class detail pages may briefly show old `studentCount`. | `useUpdateStudent.onSuccess` already invalidates both `students` and `classes` query keys (`useStudents.ts:91-94`) — verify this fires for the bulk enroll path.                             |

---

## 8. Acceptance criteria for the whole epic

- [ ] Teacher can complete this end-to-end without leaving the portal: **create
      class → create student → enroll student → create exam against that class →
      upload submission for that student**. Today, steps 1–3 are impossible
      in-portal.
- [ ] All six gaps in §1 closed.
- [ ] No new shared-types or callable changes required.
- [ ] E2E specs for the three new flows pass headless.
- [ ] No regressions in existing `SubmissionsPage` cascade.

---

## 9. Suggested execution order

1. W1 (Classes list + Create dialog) — unblocks everything else.
2. W4 (Exam create class multi-select) — small, high-value fix; depends on W1's
   `ClassMultiSelect`.
3. W2 (ClassDetailPage enroll students) — depends on W3 dialog if we share it;
   otherwise standalone.
4. W3 (Students create/edit).
5. W5 (Exam detail edit) — last because it composes W4's `ClassMultiSelect`.
6. W6 (Sidebar + E2E) — folded into each PR or a final sweep.
