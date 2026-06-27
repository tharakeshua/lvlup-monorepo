# Phase 9: PDF Result Export — Implementation Report

## Overview

Implemented PDF generation for student result reports (individual exam results,
progress reports) and class-level report cards. Teachers, parents, and admins
can download these from their respective web apps.

---

## 1. Files Created

### Cloud Functions — PDF Generation

| File                                                               | Purpose                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `functions/analytics/src/utils/pdf-helpers.ts`                     | Reusable PDFKit utilities: document creation, headers, sections, key-value pairs, tables, footers, color helpers, buffer export |
| `functions/analytics/src/callable/generate-exam-result-pdf.ts`     | Generates individual student result PDF or class results summary PDF                                                            |
| `functions/analytics/src/callable/generate-progress-report-pdf.ts` | Generates combined AutoGrade + LevelUp progress report for a student                                                            |
| `functions/analytics/src/callable/generate-class-report-pdf.ts`    | Generates class-level report card with all students' data                                                                       |

### Shared Services — Callable Wrappers

| File                                                    | Purpose                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/shared-services/src/reports/pdf-callables.ts` | Frontend callable wrappers: `callGenerateExamResultPdf`, `callGenerateProgressReportPdf`, `callGenerateClassReportPdf` |
| `packages/shared-services/src/reports/index.ts`         | Barrel export for reports module                                                                                       |

### Shared UI — Component

| File                                                      | Purpose                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/shared-ui/src/components/DownloadPDFButton.tsx` | Reusable button component with loading spinner, error handling, opens download URL in new tab |

### Admin Web — New Page

| File                                       | Purpose                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/admin-web/src/pages/ReportsPage.tsx` | New Reports page with Exam Reports and Class Reports tabs, each with download buttons |

---

## 2. Files Modified

| File                                                  | Change                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `functions/analytics/package.json`                    | Added `pdfkit` dependency, moved `@types/pdfkit` to devDependencies   |
| `functions/analytics/src/index.ts`                    | Exported 3 new callable functions                                     |
| `packages/shared-services/src/index.ts`               | Added `export * from './reports'`                                     |
| `packages/shared-ui/src/index.ts`                     | Added `export * from './components/DownloadPDFButton'`                |
| `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx` | Added "Download Results PDF" button (class summary) in header actions |
| `apps/parent-web/src/pages/ExamResultsPage.tsx`       | Added "Download Result" button per exam result card                   |
| `apps/admin-web/src/App.tsx`                          | Added `/reports` route with `ReportsPage`                             |
| `apps/admin-web/src/layouts/AppLayout.tsx`            | Added "Reports" nav item with `FileText` icon under Analytics section |

---

## 3. PDF Generation Functions

### generate-exam-result-pdf (onCall)

- **Input:** `{ tenantId, examId, studentId? }`
- **Individual report** (when studentId provided):
  - Student info (name, roll number, subject, total marks)
  - Score summary with percentage, grade, class average comparison
  - Per-question breakdown table (Q#, max marks, obtained, status)
- **Class summary** (when no studentId):
  - Exam overview and statistical summary (mean, median, std dev, highest,
    lowest)
  - Grade distribution table
  - Top 10 and Bottom 10 performers tables
- **Config:** region: asia-south1, memory: 512MiB, timeout: 120s

### generate-progress-report-pdf (onCall)

- **Input:** `{ tenantId, studentId, academicSessionId? }`
- **Content:**
  - Student info with overall score and at-risk status
  - AutoGrade section: exams taken, average score, total marks, subject
    breakdown, recent exams
  - LevelUp section: spaces enrolled/completed, points, accuracy, streak,
    subject breakdown
  - Strengths & areas for improvement
  - At-risk flags (if applicable)
- **Config:** region: asia-south1, memory: 512MiB, timeout: 120s

### generate-class-report-pdf (onCall)

- **Input:** `{ tenantId, classId, academicSessionId? }`
- **Content:**
  - Class overview with aggregate metrics from ClassProgressSummary
  - Student performance roster (sorted by overall score)
  - AutoGrade section: exam averages per student
  - LevelUp section: space completion per student
  - At-risk students highlighted with reasons
- **Config:** region: asia-south1, memory: 512MiB, timeout: 120s

---

## 4. Cloud Storage Integration

### Upload Path Pattern

```
tenants/{tenantId}/reports/exams/{examId}/{fileName}.pdf
tenants/{tenantId}/reports/progress/{studentId}/{fileName}.pdf
tenants/{tenantId}/reports/classes/{classId}/{fileName}.pdf
```

### Signed URL

- All functions upload the PDF buffer to Cloud Storage via
  `admin.storage().bucket()`
- Generate signed URLs with 1-hour expiry using `file.getSignedUrl()`
- Return `{ downloadUrl, fileName }` to the client

---

## 5. Frontend Components

### DownloadPDFButton (shared-ui)

```tsx
interface DownloadPDFButtonProps {
  onGenerate: () => Promise<{ downloadUrl: string }>;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md";
}
```

- Takes an `onGenerate` callback (no firebase dependency in shared-ui)
- Shows loading spinner during generation
- Displays error message inline if generation fails
- Opens download URL in new tab on success

### Callable Wrappers (shared-services)

```tsx
callGenerateExamResultPdf({ tenantId, examId, studentId? })
callGenerateProgressReportPdf({ tenantId, studentId, academicSessionId? })
callGenerateClassReportPdf({ tenantId, classId, academicSessionId? })
```

- Follow the existing `auth-callables.ts` pattern
- Use `httpsCallable` from `firebase/functions` via `getFirebaseServices()`

### Integration Points

| App         | Page              | Button                                                                  |
| ----------- | ----------------- | ----------------------------------------------------------------------- |
| teacher-web | ExamDetailPage    | "Download Results PDF" — class summary (visible when submissions exist) |
| parent-web  | ExamResultsPage   | "Download Result" — per exam result card (individual student PDF)       |
| admin-web   | ReportsPage (NEW) | "Class Summary PDF" per exam + "Class Report PDF" per class             |

---

## 6. Design Decisions

### PDFKit over @react-pdf/renderer

Chose PDFKit for Cloud Functions because:

- No React dependency needed in the functions package
- Simpler streaming API for server-side generation
- Lightweight and well-suited for structured reports
- Built-in font support (Helvetica family) without custom font files

### Callback-based DownloadPDFButton

The component uses an `onGenerate` callback instead of directly importing
`firebase/functions` because:

- `@levelup/shared-ui` has no `firebase` dependency and shouldn't need one
- Keeps the component pure/presentational
- Callable wrappers live in `shared-services` which already depends on
  `firebase`
- Follows separation of concerns — UI doesn't know about Cloud Function names

### Callable wrappers in shared-services

Added `packages/shared-services/src/reports/pdf-callables.ts` following the
existing `auth-callables.ts` pattern for consistency. This centralizes all Cloud
Function invocations in one package.

### New ReportsPage for admin-web

Created a dedicated `/reports` page instead of adding to DashboardPage because:

- Other sessions were actively editing DashboardPage (avoids conflicts)
- Reports deserve their own page with tabs for exam reports and class reports
- Easier to extend later with more report types

### Memory & Timeout

- Set 512MiB memory (up from default 256MiB) to handle PDFKit buffer operations
- Set 120s timeout for potentially large class reports with many students
- Region: asia-south1 consistent with all other functions

---

## 7. Build Verification

| Target                                 | Status |
| -------------------------------------- | ------ |
| `admin-web typecheck`                  | Pass   |
| `teacher-web typecheck`                | Pass   |
| `parent-web typecheck`                 | Pass   |
| `admin-web build`                      | Pass   |
| `teacher-web build`                    | Pass   |
| `parent-web build`                     | Pass   |
| `functions-analytics` (new files only) | Pass   |

**Note:** Pre-existing build errors exist in
`functions/analytics/src/schedulers/nightly-at-risk-detection.ts` and
`functions/levelup/src/callable/publish-space.ts` — these are unrelated to
Phase 9.
