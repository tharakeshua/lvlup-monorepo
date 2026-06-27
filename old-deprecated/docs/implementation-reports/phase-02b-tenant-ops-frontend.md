# Phase 2B: Tenant Operations Frontend — Implementation Report

## Overview

Built the admin-web UI pages for managing tenant entities (classes, students,
teachers, parents, academic sessions), wired to Phase 2A Cloud Functions via
TanStack Query hooks with httpsCallable mutations.

---

## 1. Files Created / Modified

### New Files Created (10)

| File Path                                                  | Description                                   |
| ---------------------------------------------------------- | --------------------------------------------- |
| `packages/shared-hooks/src/queries/useClasses.ts`          | TanStack Query hooks for Class CRUD           |
| `packages/shared-hooks/src/queries/useStudents.ts`         | TanStack Query hooks for Student CRUD         |
| `packages/shared-hooks/src/queries/useTeachers.ts`         | TanStack Query hooks for Teacher CRUD         |
| `packages/shared-hooks/src/queries/useParents.ts`          | TanStack Query hooks for Parent operations    |
| `packages/shared-hooks/src/queries/useAcademicSessions.ts` | TanStack Query hooks for AcademicSession CRUD |
| `packages/shared-ui/src/components/EntityPicker.tsx`       | Reusable multi-select combobox component      |
| `packages/shared-ui/src/components/BulkImportDialog.tsx`   | CSV upload dialog with preview & validation   |
| `apps/admin-web/src/pages/AcademicSessionPage.tsx`         | New page for academic session management      |

### Files Modified (5)

| File Path                                    | Change Summary                                                  |
| -------------------------------------------- | --------------------------------------------------------------- |
| `packages/shared-hooks/src/queries/index.ts` | Added exports for all 5 new hook modules + tenant entity types  |
| `packages/shared-ui/src/index.ts`            | Added exports for EntityPicker and BulkImportDialog             |
| `apps/admin-web/src/pages/ClassesPage.tsx`   | Full rewrite: data table, CRUD dialogs, assignment flows        |
| `apps/admin-web/src/pages/UsersPage.tsx`     | Full rewrite: tabs, CRUD, assignment, bulk import               |
| `apps/admin-web/src/App.tsx`                 | Added AcademicSessionPage import and `/academic-sessions` route |

---

## 2. TanStack Query Hooks Created

### useClasses.ts

- **`useClasses(tenantId, options?)`** — List query for
  `/tenants/{tenantId}/classes`. Supports filters: `grade`, `status`,
  `academicSessionId`. Ordered by `name asc`. StaleTime: 5min.
- **`useCreateClass()`** — Mutation calling `createClass` Cloud Function.
  Invalidates classes cache on success.
- **`useUpdateClass()`** — Mutation calling `updateClass`. Supports partial
  updates: name, grade, section, teacherIds, studentIds.
- **`useDeleteClass()`** — Mutation calling `deleteClass` (soft-delete/archive).

### useStudents.ts

- **`useStudents(tenantId, options?)`** — List query for
  `/tenants/{tenantId}/students`. Supports filters: `classId` (array-contains on
  classIds), `status`, `grade`. Ordered by `rollNumber asc`. StaleTime: 5min.
- **`useCreateStudent()`** — Mutation calling `createStudent`. Invalidates both
  students and classes caches.
- **`useUpdateStudent()`** — Mutation calling `updateStudent`. Supports
  classIds, parentIds, rollNumber, section, grade updates.

### useTeachers.ts

- **`useTeachers(tenantId, options?)`** — List query for
  `/tenants/{tenantId}/teachers`. Supports filters: `classId` (array-contains),
  `status`. Ordered by `uid asc`. StaleTime: 5min.
- **`useCreateTeacher()`** — Mutation calling `createTeacher`.
- **`useUpdateTeacher()`** — Mutation calling `updateTeacher`. Supports
  subjects, designation, classIds updates.

### useParents.ts

- **`useParents(tenantId, options?)`** — List query for
  `/tenants/{tenantId}/parents`. Supports `status` filter. StaleTime: 5min.
- **`useCreateParent()`** — Mutation calling `createParent`.

### useAcademicSessions.ts

- **`useAcademicSessions(tenantId)`** — List query for
  `/tenants/{tenantId}/academicSessions`. Ordered by `startDate desc`.
  StaleTime: 5min.
- **`useCreateAcademicSession()`** — Mutation calling `createAcademicSession`.
  Accepts name, startDate, endDate, isCurrent.
- **`useUpdateAcademicSession()`** — Mutation calling `updateAcademicSession`.
  Supports name, dates, isCurrent toggle, status.

### Hook Design Pattern

All hooks follow the established `useExams` pattern:

- Query keys: `['tenants', tenantId, '<collection>', options]`
- Firestore reads via `getFirebaseServices().db`
- Mutations via `httpsCallable` from `getFirebaseServices().functions`
- Cache invalidation scoped to tenant + collection on mutation success
- Cross-collection invalidation where needed (e.g., student create invalidates
  classes)

---

## 3. Frontend Pages & Components

### ClassesPage.tsx (Enhanced)

- **Data Table**: Columns — Name, Grade, Section, Teachers (count), Students
  (count), Status, Actions
- **Search**: Text filter on name/grade/section
- **Grade Filter**: Select dropdown filtering by grade 1–12
- **Create Dialog**: Name input, grade picker, section picker
- **Edit Dialog**: Pre-populated form for updating class details
- **Archive Dialog**: AlertDialog confirmation for soft-delete
- **Assign Teachers Dialog**: EntityPicker multi-select for teacher assignment
- **Assign Students Dialog**: EntityPicker multi-select for student assignment
- Uses shadcn Table, Dialog, AlertDialog, Select, Badge, Button, Input, Label
  components

### UsersPage.tsx (Enhanced)

- **Tabs**: Teachers | Students | Parents using shadcn Tabs component
- **Teachers Tab**: Table with UID, Subjects (badges), Designation, Classes
  (count link), Status, Actions. Edit opens class assignment.
- **Students Tab**: Table with UID, Roll Number, Grade, Classes (badge links),
  Parents (link count), Status, Actions. Supports class assignment and parent
  linking.
- **Parents Tab**: Table with UID, Linked Children (student badges), Status,
  Actions.
- **Create User Dialog**: Dynamic form based on active tab role — fields adapt
  for teacher (subjects), student (rollNumber, classId), parent. Uses
  `callCreateOrgUser` from shared-services.
- **Bulk Import**: Button on Students tab opens BulkImportDialog. Uses
  `callBulkImportStudents`. Required columns: firstName, lastName, rollNumber.
  Optional: email, phone, classId, className, section, parent fields.
- **Assign Class Dialog**: EntityPicker for assigning teacher/student to classes
  via updateTeacher/updateStudent mutations.
- **Link Parent Dialog**: EntityPicker for linking parents to students via
  updateStudent mutation.

### AcademicSessionPage.tsx (New)

- **Current Session Card**: Highlighted card showing the active academic session
- **Sessions Table**: Name, Start Date, End Date, Current (badge or "Set as
  current" button), Status, Actions
- **Create Dialog**: Name, start date (date input), end date, isCurrent toggle
  (Switch)
- **Edit Dialog**: Pre-populated form for updating session details
- **Set Current**: One-click toggle that calls updateAcademicSession with
  `isCurrent: true` (server handles unsetting previous)
- Firestore Timestamp display handled via helper `formatDate()` supporting both
  `.toDate()` and `.seconds` formats

### EntityPicker.tsx (Shared Component)

- Built with shadcn Popover + Command (cmdk) components
- Props: `items` (id, label, description), `selected`, `onChange`, `multiple`,
  `placeholder`, `disabled`
- Features: Search filtering, multi-select with badge chips, remove-on-click,
  single-select mode
- Used across: teacher assignment, student assignment, class assignment, parent
  linking

### BulkImportDialog.tsx (Shared Component)

- Built with shadcn Dialog + Table components
- Props: `open`, `onOpenChange`, `requiredColumns`, `optionalColumns`,
  `onSubmit`, `validateRow`
- Flow: File upload area → CSV parse → Header validation → Row validation →
  Preview table (first 20 rows) → Submit
- Features: Required column check, row-level validation callback, error display
  (max 10), file change, success state
- CSV parsing uses `parseCSVLine` from `@levelup/shared-utils/csv`
  (linter-applied import)

---

## 4. Router Changes

**apps/admin-web/src/App.tsx:**

```
Added: import AcademicSessionPage from "./pages/AcademicSessionPage"
Added: <Route path="/academic-sessions" element={<AcademicSessionPage />} />
```

Route is nested under `RequireAuth allowedRoles={["tenantAdmin"]}` and
`AppLayout`, consistent with all other admin routes.

Full route table after changes: | Path | Page | Auth | |---|---|---| | `/login`
| LoginPage | Public | | `/` | DashboardPage | tenantAdmin | | `/users` |
UsersPage | tenantAdmin | | `/classes` | ClassesPage | tenantAdmin | | `/exams`
| ExamsOverviewPage | tenantAdmin | | `/spaces` | SpacesOverviewPage |
tenantAdmin | | `/ai-usage` | AIUsagePage | tenantAdmin | | `/settings` |
SettingsPage | tenantAdmin | | `/academic-sessions` | AcademicSessionPage |
tenantAdmin |

---

## 5. Design Decisions

### Hook Architecture

- **Direct Firestore reads for queries, httpsCallable for mutations**: Follows
  the established pattern where read operations go directly to Firestore
  (leveraging client SDK caching and real-time capabilities) while write
  operations route through Cloud Functions (for server-side validation,
  authorization checks, and side effects like updating tenant stats).
- **Cross-collection cache invalidation**: Student mutations invalidate both
  `students` and `classes` caches since creating/updating a student can affect
  class studentIds and studentCount.

### Component Reuse

- **EntityPicker over custom dropdowns**: Created one reusable combobox
  component used in 5 different assignment flows (teacher→class, student→class,
  class→teachers, class→students, student→parents) rather than building separate
  pickers.
- **BulkImportDialog as generic**: Designed with configurable `requiredColumns`,
  `optionalColumns`, and `validateRow` callback so it can be reused for future
  bulk import flows (teachers, parents, etc.).

### Data Flow

- **callCreateOrgUser for user creation**: Rather than calling individual
  createTeacher/createStudent/createParent Cloud Functions, the Users page uses
  `callCreateOrgUser` which handles the full flow: Firebase Auth user creation →
  membership creation → entity profile creation. This ensures proper auth setup.
- **Separate entity hooks for data display**: The entity hooks (useTeachers,
  useStudents, useParents) read from the tenant subcollections for richer
  profile data, while user creation goes through the unified `createOrgUser`
  flow.

### UI Patterns

- **Table view for ClassesPage**: Switched from grid cards to data table for
  better information density and action accessibility when managing many
  classes.
- **Tabs for UsersPage**: Using shadcn Tabs to separate
  Teachers/Students/Parents views, each with role-specific columns and actions.
- **Inline actions**: Assignment counts (teachers, students, parents) are
  clickable to open assignment dialogs directly from the table.

### TypeScript

- All new files pass TypeScript compilation with zero errors.
- Types imported from `@levelup/shared-types` (Class, Student, Teacher, Parent,
  AcademicSession).
- EntityPickerItem interface exported from shared-ui for consumers.

### Build Status

- TypeScript: **Clean** (0 errors in admin-web tsconfig)
- Vite build: Blocked by pre-existing `DownloadPDFButton.tsx` issue
  (firebase/functions import in shared-ui without firebase peer dependency) —
  unrelated to Phase 2B changes.
