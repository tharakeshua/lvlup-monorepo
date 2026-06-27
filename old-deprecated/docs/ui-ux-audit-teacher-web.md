# UI/UX Audit Report: Teacher-Web Application

**Date:** March 2026 **Auditor:** UI/UX Designer Agent **App Path:**
`apps/teacher-web/` **Tech Stack:** React 18, Vite, Tailwind CSS, shadcn/ui
(shared-ui), Firebase, React Router v7, TanStack React Query, dnd-kit, Lucide
React

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture & Navigation Review](#architecture--navigation-review)
4. [Page-by-Page Analysis](#page-by-page-analysis)
5. [Component Quality Assessment](#component-quality-assessment)
6. [Design System Compliance](#design-system-compliance)
7. [Teacher-Specific UX Patterns](#teacher-specific-ux-patterns)
8. [Forms & Input Design](#forms--input-design)
9. [Data Visualization & Analytics](#data-visualization--analytics)
10. [Loading, Empty & Error States](#loading-empty--error-states)
11. [Accessibility Audit](#accessibility-audit)
12. [Responsive Design Review](#responsive-design-review)
13. [Issues Summary (Critical / Major / Minor)](#issues-summary)
14. [Redesign Recommendations](#redesign-recommendations)
15. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Executive Summary

The Teacher-Web app is a functional multi-page dashboard serving teachers with
content authoring (Spaces), exam management, grading review, student tracking,
and class analytics. It leverages a monorepo shared-ui package built on
shadcn/ui and Tailwind CSS.

### Strengths

- **Well-structured routing** with lazy-loaded pages and role-based guards
- **Comprehensive feature set** covering spaces, exams, grading, analytics, and
  notifications
- **Consistent visual language** — pages follow a coherent card-based layout
  with proper spacing
- **Good loading states** — skeleton placeholders present across most list pages
- **Shared-ui reuse** — `AppShell`, `AppSidebar`, `NotificationBell`,
  `ScoreCard`, `ProgressRing`, `ConfirmDialog`, `Tabs` are correctly consumed
  from the design system
- **Drag-and-drop** story point reordering via dnd-kit with keyboard sensor
  support

### Critical Issues Found

1. **No dark mode support** — `index.css` only defines `:root` light-mode HSL
   variables; no `.dark` class block exists
2. **Raw HTML inputs everywhere** — native `<input>`, `<select>`, `<textarea>`,
   and `<button>` elements are used directly instead of shared-ui `Input`,
   `Button`, `Select`, `Textarea` components, creating visual inconsistency
3. **Hardcoded modal** in `ExamDetailPage` — Space Picker uses a manual `div`
   overlay with `bg-white` instead of Radix Dialog, breaking dark mode and
   accessibility
4. **Missing keyboard navigation** on several interactive elements — drag
   handles, tab bars, and custom dropdowns lack proper ARIA and focus management
5. **No breadcrumbs** — deeply nested routes (e.g., exam > submissions > grading
   review) lack contextual navigation, causing disorientation

### Overall Assessment

The app is **functionally complete** but suffers from **design system
inconsistency**, **accessibility gaps**, and **missing dark mode**. The codebase
is in a "first working version" state that needs a focused polish pass to reach
production quality. Approximately 60% of UI elements bypass the shared component
library.

---

## 2. Current State Analysis

### 2.1 File Structure

```
src/
├── App.tsx                      # Router config with lazy loading
├── main.tsx                     # Entry point (QueryClient, Firebase, ErrorBoundary, Toaster)
├── index.css                    # Tailwind + HSL variables (light mode only)
├── guards/
│   └── RequireAuth.tsx          # Role-based route guard
├── layouts/
│   ├── AppLayout.tsx            # Sidebar + header shell
│   └── AuthLayout.tsx           # Centered login layout
├── pages/
│   ├── DashboardPage.tsx        # Teacher dashboard
│   ├── LoginPage.tsx            # Multi-step login
│   ├── StudentsPage.tsx         # Student list table
│   ├── ClassDetailPage.tsx      # Per-class detail with tabs
│   ├── ClassAnalyticsPage.tsx   # Class performance analytics
│   ├── ExamAnalyticsPage.tsx    # Per-exam analytics
│   ├── SpaceAnalyticsPage.tsx   # Per-space analytics
│   ├── SettingsPage.tsx         # Evaluation settings
│   ├── NotificationsPage.tsx    # Notification list (uses shared-ui)
│   ├── NotFoundPage.tsx         # 404 page
│   ├── spaces/
│   │   ├── SpaceListPage.tsx    # Space grid with filters
│   │   └── SpaceEditorPage.tsx  # Full space editor (settings, content, rubric, agents)
│   └── exams/
│       ├── ExamListPage.tsx     # Exam list with status tabs
│       ├── ExamCreatePage.tsx   # Multi-step exam creation wizard
│       ├── ExamDetailPage.tsx   # Exam detail with questions, submissions, settings
│       ├── SubmissionsPage.tsx  # Submission list + upload
│       └── GradingReviewPage.tsx # Per-submission grading review
└── components/
    ├── shared/
    │   └── ConfirmDialog.tsx    # Wraps shared-ui AlertDialog
    └── spaces/
        ├── SpaceSettingsPanel.tsx   # Space settings form
        ├── StoryPointEditor.tsx     # Story point editor
        ├── ItemEditor.tsx           # Question/material editor (large: ~1000 lines)
        ├── RubricEditor.tsx         # Rubric configuration editor
        └── AgentConfigPanel.tsx     # AI agent configuration
```

### 2.2 Route Map

| Route                                      | Page               | Description                                  |
| ------------------------------------------ | ------------------ | -------------------------------------------- |
| `/login`                                   | LoginPage          | School code + credentials                    |
| `/`                                        | DashboardPage      | Overview stats, charts, grading queue        |
| `/spaces`                                  | SpaceListPage      | Grid with status filters                     |
| `/spaces/:spaceId/edit`                    | SpaceEditorPage    | Multi-tab editor                             |
| `/exams`                                   | ExamListPage       | List with status tabs                        |
| `/exams/new`                               | ExamCreatePage     | 4-step wizard                                |
| `/exams/:examId`                           | ExamDetailPage     | Questions, submissions, settings             |
| `/exams/:examId/submissions`               | SubmissionsPage    | Upload + submission list                     |
| `/exams/:examId/submissions/:submissionId` | GradingReviewPage  | Per-question grading                         |
| `/classes/:classId`                        | ClassDetailPage    | Overview, spaces, exams, students, analytics |
| `/analytics/classes`                       | ClassAnalyticsPage | Cross-class performance                      |
| `/analytics/exams`                         | ExamAnalyticsPage  | Per-exam grade distribution                  |
| `/analytics/spaces`                        | SpaceAnalyticsPage | Per-space engagement                         |
| `/students`                                | StudentsPage       | Student roster table                         |
| `/settings`                                | SettingsPage       | Evaluation configuration                     |
| `/notifications`                           | NotificationsPage  | Notification feed                            |
| `*`                                        | NotFoundPage       | 404                                          |

### 2.3 Shared-UI Components Used

| Component                               | Used In                        | Status  |
| --------------------------------------- | ------------------------------ | ------- |
| `AppShell`                              | AppLayout                      | Correct |
| `AppSidebar`                            | AppLayout                      | Correct |
| `RoleSwitcher`                          | AppLayout footer               | Correct |
| `NotificationBell`                      | AppLayout header               | Correct |
| `Toaster`                               | main.tsx                       | Correct |
| `ErrorBoundary`                         | main.tsx                       | Correct |
| `LogoutButton`                          | DashboardPage                  | Correct |
| `ScoreCard`                             | Dashboard, Analytics pages     | Correct |
| `SimpleBarChart`                        | Dashboard, ExamAnalytics       | Correct |
| `AtRiskBadge`                           | Dashboard                      | Correct |
| `ProgressRing`                          | ClassAnalytics, SpaceAnalytics | Correct |
| `Tabs/TabsList/TabsTrigger/TabsContent` | ClassDetailPage                | Correct |
| `AlertDialog` (via ConfirmDialog)       | SpaceEditorPage                | Correct |
| `NotificationsPage`                     | NotificationsPage              | Correct |
| `DownloadPDFButton`                     | ExamDetailPage                 | Correct |

### 2.4 Shared-UI Components NOT Used (but should be)

| Component                              | Should Replace                      | Where                          |
| -------------------------------------- | ----------------------------------- | ------------------------------ |
| `Button`                               | Raw `<button>` elements             | All pages                      |
| `Input`                                | Raw `<input>` elements              | All forms                      |
| `Textarea`                             | Raw `<textarea>` elements           | All forms                      |
| `Select`                               | Raw `<select>` elements             | All dropdowns                  |
| `Badge`                                | Inline status badges                | Status pills across pages      |
| `Card/CardHeader/CardContent`          | Raw `div.rounded-lg.border.bg-card` | All card containers            |
| `Dialog`                               | Raw modal overlay                   | ExamDetailPage Space Picker    |
| `Label`                                | Raw `<label>` elements              | All forms                      |
| `Switch`                               | Raw `<input type="checkbox">`       | SettingsPage, AgentConfigPanel |
| `Separator`                            | Raw borders/divides                 | Visual separators              |
| `Skeleton`                             | Raw `animate-pulse` divs            | Loading states                 |
| `Table/TableHeader/TableRow/TableCell` | Raw `<table>` elements              | StudentsPage, ClassDetailPage  |

---

## 3. Architecture & Navigation Review

### 3.1 Information Architecture

The sidebar navigation is organized into 5 groups:

```
Overview: Dashboard
Content:  Spaces, Exams
Analytics: Class Analytics, Exam Analytics
People:   Students
System:   Settings
```

**Issues:**

- **Space Analytics** is in the route map (`/analytics/spaces`) but NOT in the
  sidebar navigation — it's unreachable via nav
- **Class Detail pages** (`/classes/:classId`) are navigable from dashboard but
  have no sidebar presence
- **Notifications** are accessible via the bell icon but not in the sidebar
- The **Analytics** group splits Class and Exam analytics but omits Space
  Analytics — inconsistent

**Recommendations:**

- Add Space Analytics to the Analytics nav group
- Add a "Classes" item under the People group linking to a class list page
- Consider adding a Notifications item to the System group as a fallback

### 3.2 Navigation Depth & Breadcrumbs

The deepest route is `/exams/:examId/submissions/:submissionId` (4 levels deep).
Currently, navigation relies solely on back arrows (`<ArrowLeft>` buttons) with
no breadcrumb trail.

**Problem:** If a teacher navigates to a grading review page and wants to jump
back to the exam list (not just one level up), they must click back twice. With
no breadcrumbs, the path is opaque.

**Recommendation:** Implement a `Breadcrumb` component for all detail pages:

```
Exams > Mid-Term Math > Submissions > John Doe
```

### 3.3 Active State Accuracy

The sidebar uses `location.pathname.startsWith(...)` for active highlighting,
which works correctly for most routes. However:

- The Analytics section uses exact match (`===`) for class and exam analytics,
  which means child routes won't highlight
- Space Analytics at `/analytics/spaces` would have no active highlight (not in
  sidebar)

---

## 4. Page-by-Page Analysis

### 4.1 Login Page (`LoginPage.tsx`)

**Layout:** Centered card on muted background (via AuthLayout). Two-step flow:
school code → credentials.

**Strengths:**

- Clean two-step flow with clear school name confirmation
- Error states displayed with destructive styling
- Loading state on submit buttons

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | Uses raw `<input>` instead of shared-ui `Input` | L83-91, L129-137,
L145-152 | | Major | Uses raw `<button>` instead of shared-ui `Button` |
L94-100, L155-161 | | Minor | No "Forgot Password" link — teachers stuck if they
forget credentials | - | | Minor | No password visibility toggle | L145-152 | |
Minor | School code input lacks autocomplete attribute | L83-91 | | A11y |
Labels use `htmlFor` correctly — good | L80, L126, L141 |

**Redesign Recommendations:**

- Replace with shared-ui `Input`, `Button`, `Label` components
- Add password visibility toggle
- Add "Forgot password?" link below the password field
- Consider adding the school logo (if available from tenant data) after school
  code validation
- Add `autoComplete="email"` and `autoComplete="current-password"` attributes

### 4.2 Dashboard Page (`DashboardPage.tsx`)

**Layout:** Stats grid (4 cards) → performance chart + at-risk alerts → recent
spaces + exams grid → grading queue.

**Strengths:**

- Good use of `ScoreCard` and `SimpleBarChart` from shared-ui
- `AtRiskBadge` integration for student alerts
- Grading queue with pending count badge
- Empty states with create CTAs for spaces and exams

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | Logout button in page header is unusual — should be in sidebar/profile
menu | L78-83 | | Major | No loading state — dashboard fetches 5 queries but
shows no skeleton while loading | L35-47 | | Minor | `_membership` and
`_publishedSpaces` unused variables | L33, L49 | | Minor | "At-Risk Students"
card uses `trend="down"` when count > 0, which is confusing — "down" sounds
positive | L107 | | Minor | Class chart card uses raw div instead of `Card`
component | L115-122 | | Minor | At-risk section scrollable area has no visual
scroll indicator | L135 | | A11y | Links have proper accessible text via visible
labels — acceptable | - |

**Redesign Recommendations:**

- Move logout to sidebar footer (user menu dropdown) or profile section
- Add comprehensive skeleton loading state for the entire dashboard
- Replace raw card divs with `Card`/`CardHeader`/`CardContent`
- Add a "Quick Actions" section: Create Space, Create Exam, Review Submissions
- Add a time-based greeting: "Good morning, {name}"
- The grading queue should show urgency indicators (e.g., how long submissions
  have been waiting)

### 4.3 Space List Page (`SpaceListPage.tsx`)

**Layout:** Header with title + create button → search + status tab bar → space
grid.

**Strengths:**

- Good filter UI with segmented control-style status tabs
- Skeleton loading with grid placeholders
- Empty state with icon + CTA
- Search filtering
- Card hover effects with shadow and primary color

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | Raw input/button elements throughout | L100-106, L87-93, L110-121 | |
Minor | Status badge is a local function `statusBadge()` — should use shared
`Badge` component | L23-36 | | Minor | New space creation uses "Untitled Space"
default — could offer a quick name prompt | L63-68 | | Minor | No sort options
(newest, alphabetical, most items) | - | | Minor | Labels truncated to 3 — no
"+N more" indicator | L183 |

**Redesign Recommendations:**

- Use shared-ui `Input`, `Button`, `Badge`, `Card` components
- Add sort dropdown (Recently Updated, Alphabetical, Most Items)
- Add batch actions (archive multiple, delete multiple)
- Show space thumbnail/icon per type for visual differentiation
- Add creation date or last modified date to each card

### 4.4 Space Editor Page (`SpaceEditorPage.tsx`)

**Layout:** Header with back + title + status actions → tab bar (Settings,
Content, Rubric, Agent Config) → tab content.

This is the **most complex page** in the app (~800 lines), functioning as a
multi-tab editor with nested sub-editors for story points, items, rubrics, and
agent configs.

**Strengths:**

- Well-organized tab structure with icons
- Drag-and-drop story point reordering with `dnd-kit`
- Sortable story points with expand/collapse for items
- Confirmation dialogs for destructive actions
- Item editor overlay for focused editing

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Critical | Item editor replaces entire page content (renders instead of modal) —
loses scroll position and context | L533-544 | | Critical | Story point editor
also replaces page — same issue | L547-555 | | Major | No unsaved changes
warning — navigating away loses work | - | | Major | No auto-save or draft
persistence | - | | Major | Raw buttons and tab implementation instead of
shared-ui components | L646-661 | | Major | Status badge logic duplicated from
SpaceListPage | L594-603 | | Minor | `SortableStoryPoint` inline component —
should be extracted to separate file | L67-123 | | Minor | No visual indicator
for which story point is being dragged (no drag overlay) | - | | Minor | Item
list shows `(item.payload as any)?.questionType` — casting to `any` | L748-749 |
| A11y | Drag handle has `cursor-grab` but no aria-label for screen readers |
L91 | | A11y | Tab bar uses buttons but not ARIA `role="tablist"` / `role="tab"`
pattern | L646-661 |

**Redesign Recommendations:**

- **Use side panel or modal** for item/story point editing instead of page
  replacement
- Implement **auto-save with debounce** (save 2 seconds after last edit)
- Add **unsaved changes confirmation** before navigation
- Extract status badge to a reusable component or use shared-ui Badge
- Add drag overlay for better drag-and-drop visual feedback
- Use shared-ui `Tabs` component for the editor tabs
- Add a publish preview button that shows how students will see the space
- Consider a split-pane layout: story point tree on left, editor on right

### 4.5 Exam List Page (`ExamListPage.tsx`)

**Layout:** Header with title + new exam button → search + status tab bar → exam
list.

**Strengths:**

- Clean list layout with exam metadata
- Status tabs with 6 statuses
- Stats display (submissions, graded, avg score) on each exam row
- Good loading and empty states

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | Raw HTML elements instead of shared-ui components | L79-84, L66-72,
L88-100 | | Major | Status tab bar overflows on small screens but has
`overflow-x-auto` with no visual indicator | L87 | | Minor | `statusBadge()`
function duplicated from SpaceListPage pattern — needs shared component | L21-41
| | Minor | Exam cards show stats but don't differentiate visually when stats
are missing (draft exams) | L149-170 | | Minor | No bulk actions for exam
management | - |

**Redesign Recommendations:**

- Consolidate status badge rendering into a shared component
- Add horizontal scroll fade indicators for tab overflow
- Add bulk operations (archive, delete)
- Add exam date display and countdown for upcoming exams
- Use shared-ui `Card` for each exam row

### 4.6 Exam Create Page (`ExamCreatePage.tsx`)

**Layout:** Header with back arrow + title → stepper → step content.

**Strengths:**

- Clean 4-step wizard flow (Metadata → Upload → Review → Publish)
- Good stepper UI with completed/active/pending states
- Review step summarizes all data before creation
- Link-to-Space feature with published space dropdown

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Critical | No form validation beyond title/subject required check — no marks
validation (passing > total?) | L231 | | Major | Raw HTML form elements
throughout | L143-231 | | Major | File upload area uses unstyled native
`<input type="file">` — poor UX | L247-252 | | Major | No error handling for
file upload failure (try/finally with no catch) | L45-65 | | Minor | Class IDs
entered as comma-separated text — should be a multi-select from actual classes |
L203-210 | | Minor | Topics also comma-separated — should be a tag input |
L163-170 | | Minor | No way to go back and edit after reviewing (only sequential
navigation) | - | | Minor | Publish step `bg-green-50` hardcoded — doesn't
support dark mode | L359 |

**Redesign Recommendations:**

- Replace class ID text input with a multi-select dropdown from actual classes
- Replace topics input with a tag input component
- Add form validation with error messages (passing marks < total marks,
  duration > 0, etc.)
- Style the file upload area as a drag-and-drop zone using shared patterns
- Add file preview (thumbnail for images, filename for PDFs) after selection
- Allow step navigation by clicking on stepper items (not just sequential)
- Use react-hook-form + zod for proper validation

### 4.7 Exam Detail Page (`ExamDetailPage.tsx`)

**Layout:** Header with back + title + status + actions → stats grid → tabs
(Questions, Submissions, Settings).

**Strengths:**

- Good header with contextual actions based on exam status
- Stats grid with 4 key metrics
- Questions list with rubric editing
- Submissions quick view with scores
- Space linking feature
- PDF results download

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Critical | Space Picker modal uses raw `div` with `bg-white` hardcode — breaks
dark mode, no Radix Dialog, no focus trap, no escape key handling | L427-467 | |
Major | Rubric editing replaces the entire page (same pattern as SpaceEditor) |
L116-140 | | Major | Raw buttons/tabs/inputs | L260-272, various | | Minor |
Submissions tab only shows first 10 — pagination/infinite scroll needed | L342 |
| Minor | Settings tab is read-only — should allow inline editing | L380-423 | |
A11y | Space picker modal has no `role="dialog"`, no `aria-modal`, no focus
management | L427-467 |

**Redesign Recommendations:**

- Replace Space Picker with shared-ui `Dialog` component
- Use sheet/panel for rubric editing instead of page replacement
- Make settings tab editable inline
- Add full pagination for submissions tab
- Add question search/filter in questions tab
- Add exam timeline visualization showing status progression

### 4.8 Submissions Page (`SubmissionsPage.tsx`)

**Layout:** Header with back + title + release button → upload form → submission
list.

**Strengths:**

- Upload form with student metadata fields
- Pipeline status icons with color coding
- Score display with percentage
- Release results bulk action
- Good status visualization

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | File input uses unstyled native element | L184-189 | | Major | Raw form
inputs throughout | L157-181 | | Major | No bulk upload support (uploading one
student at a time) | - | | Minor | `_bulkFiles` and `_setBulkFiles` declared but
unused — suggests planned but unfinished feature | L64 | | Minor | No pagination
for long submission lists | - | | Minor | `animate-spin` on processing icons
creates visual noise with many items | L43 |

**Redesign Recommendations:**

- Add bulk CSV upload for multiple student answer sheets
- Style the upload section as a proper drop zone
- Add filtering by pipeline status
- Add search by student name
- Implement pagination or virtual scrolling for large lists
- Add a progress bar showing overall grading completion

### 4.9 Grading Review Page (`GradingReviewPage.tsx`)

**Layout:** Header with back + student name + approve all → summary stats grid →
per-question accordion.

This is the **most complex review interface** — a teacher's primary grading
workflow page.

**Strengths:**

- Clean per-question accordion expansion
- AI evaluation display with scores, strengths, weaknesses, rubric breakdown
- Manual override form with required reason
- Bulk "Approve All" action
- Answer image display
- Override history display

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Critical | Override form inline within each question — too cramped on smaller
screens | L457-508 | | Major | No keyboard shortcuts for grading workflow (next
question, approve, override) | - | | Major | Answer images displayed at fixed
`h-48` — no zoom/lightbox | L338 | | Major | No way to navigate between
submissions (next/previous student) | - | | Major | Raw form elements | L460-495
| | Minor | Override state management with nested Record is fragile | L48-50 | |
Minor | No visual progress indicator showing how many questions reviewed | - | |
A11y | Accordion doesn't use ARIA accordion pattern | L289-321 |

**Redesign Recommendations:**

- Add **keyboard shortcuts**: `J`/`K` for next/prev question, `A` to approve,
  `O` to open override form
- Add **image lightbox** for answer sheet viewing (zoom, pan, rotate)
- Add **next/previous submission** navigation
- Add a **progress bar** showing reviewed vs total questions
- Use shared-ui `Accordion` component for question expansion
- Consider a **split-pane layout**: answer images on left, evaluation on right
- Add **comparison view** to see student answer alongside model answer
- Color-code questions by grading confidence (green = high, yellow = medium, red
  = low)

### 4.10 Students Page (`StudentsPage.tsx`)

**Layout:** Header with title → search → student table.

**Strengths:**

- Clean table layout with proper headers
- Search filtering
- Status badges
- Loading skeletons
- Error state display

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | Students are not clickable — no detail view or link to student profile |
L80-106 | | Major | Table uses raw `<table>` instead of shared-ui `Table`
component | L59-109 | | Major | Student name not displayed — shows only uid,
roll number, admission number | L82-83 | | Minor | No pagination for large
student lists | - | | Minor | No sort by column | - | | Minor | No export
functionality | - |

**Redesign Recommendations:**

- Display student display name (not just uid)
- Make rows clickable linking to a student profile/detail page
- Use shared-ui `Table` component
- Add column sorting (by name, grade, section, status)
- Add pagination
- Add export to CSV/Excel
- Add student count per status in the header

### 4.11 Class Detail Page (`ClassDetailPage.tsx`)

**Layout:** Header with back + class info → Tabs (Overview, Spaces, Exams,
Students, Analytics).

**Strengths:**

- Properly uses shared-ui `Tabs` component — the only page that does!
- Comprehensive overview with ScoreCards
- Analytics tab with AutoGrade and LevelUp sections
- ProgressRing integration
- Top performers lists

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Minor | Status badges duplicated (same pattern repeated) | L85-92, L165-175,
L203-210, L248-256, L310-319, L377-385 | | Minor | Empty states lack CTAs (e.g.,
"Assign a space to this class") | L144-147, L184-186, L229-233 | | Minor |
Analytics tab loads per-call but doesn't show a loading state for the
ProgressRing | - |

**Redesign Recommendations:**

- Add action CTAs to empty states
- Consolidate status badge rendering
- Add class-level actions: assign space, create exam for class, add students
- Add a "Class Health" summary widget with at-risk count

### 4.12 Analytics Pages (Class, Exam, Space)

All three analytics pages follow a consistent pattern: header with dropdown
selector → score cards → visualizations.

**Strengths:**

- Consistent layout pattern across all three
- Good use of ScoreCard and ProgressRing
- Color-coded performance indicators
- Empty states with contextual messages

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | All use raw `<select>` instead of shared-ui `Select` |
ClassAnalytics:L39-50, ExamAnalytics:L57-69, SpaceAnalytics:L80-91 | | Minor |
No date range filtering | - | | Minor | No data export | - | | Minor |
ExamAnalytics table uses raw `<table>` | ExamAnalytics:L136-199 | | Minor | No
comparison view (compare two classes, two exams, etc.) | - |

**Redesign Recommendations:**

- Use shared-ui `Select` with `Command` (searchable dropdown) for entity pickers
- Add date range picker for filtering analytics
- Add CSV/PDF export for analytics data
- Add comparison mode between entities
- Add trend lines showing improvement over time
- Add print-friendly styles for teacher reports

### 4.13 Settings Page (`SettingsPage.tsx`)

**Layout:** Header → settings card with toggles and dropdown.

**Issues:** | Severity | Issue | Line(s) | |----------|-------|---------| |
Major | Uses raw `<input type="checkbox">` instead of shared-ui `Switch` |
L83-88, L98-103, L117-120 | | Major | Uses raw `<select>` instead of shared-ui
`Select` | L127-135 | | Minor | Settings are limited to evaluation only — should
expand to profile, preferences, etc. | - | | Minor | No success toast after
saving | L38-56 | | Minor | Type casting with `(settings as any)` — indicates
type mismatch | L27-35 |

**Redesign Recommendations:**

- Use `Switch` components for boolean toggles
- Use `Select` component for dropdowns
- Expand to include sections: Profile, Notifications, Evaluation, Display
  Preferences
- Add success feedback after save
- Consider using shared-ui form patterns with react-hook-form

### 4.14 Notifications Page (`NotificationsPage.tsx`)

This page correctly delegates to the shared-ui `NotificationsPageUI` component —
good pattern.

**No issues found.** This is the exemplary page for shared-ui usage.

### 4.15 Not Found Page (`NotFoundPage.tsx`)

Clean and functional. Uses shared-ui icon and consistent styling.

**Minor:** Uses raw `<Link>` styled as button — should use shared-ui `Button`
with `asChild` and `Link`.

---

## 5. Component Quality Assessment

### 5.1 ConfirmDialog (`components/shared/ConfirmDialog.tsx`)

**Quality: Excellent.** Properly wraps shared-ui `AlertDialog` with a clean API.
Supports destructive variant. Only local component that correctly uses the
design system.

### 5.2 SpaceSettingsPanel (`components/spaces/SpaceSettingsPanel.tsx`)

**Quality: Fair.** Functional form but uses all raw HTML elements. Multiple
`useState` calls for each field instead of a form library.

**Recommendation:** Refactor to use react-hook-form + zod schema with shared-ui
form components.

### 5.3 StoryPointEditor (`components/spaces/StoryPointEditor.tsx`)

**Quality: Fair.** Similar to SpaceSettingsPanel — functional but raw HTML.
Assessment config section is well-organized.

**Recommendation:** Same — react-hook-form migration.

### 5.4 ItemEditor (`components/spaces/ItemEditor.tsx`)

**Quality: Poor.** This is a ~1000-line monolithic component handling 15+
question types and 8+ material types. While comprehensive, it's:

- Too large for a single component file
- Uses `as any` type assertions
- Duplicates input patterns extensively
- Has no form validation
- No error boundaries for individual question type editors

**Recommendation:** Split into:

- `ItemEditorShell.tsx` — header, type selector, save/cancel
- `QuestionTypeEditor.tsx` — question-specific sub-editors
- `MaterialTypeEditor.tsx` — material-specific sub-editors
- One file per complex question type (MCQ, Code, Matching, etc.)

### 5.5 RubricEditor (`components/spaces/RubricEditor.tsx`)

**Quality: Fair.** Clean scoring mode selector with card-based options. Criteria
and dimension editors are functional. The nested level editing is compact but
usable.

**Issues:** Deeply nested state updates are hard to follow. Would benefit from
`useReducer`.

### 5.6 AgentConfigPanel (`components/spaces/AgentConfigPanel.tsx`)

**Quality: Good.** Clean card-based layout for each agent. Type badge, enable
toggle, model selector, and system prompt. Loading state with skeletons. Empty
state with helpful text.

**Minor Issue:** Model options are hardcoded — should come from a config or API.

---

## 6. Design System Compliance

### 6.1 Compliance Score: ~35%

| Category  | Compliant           | Non-Compliant | Notes                                   |
| --------- | ------------------- | ------------- | --------------------------------------- |
| Buttons   | 0                   | ~50 instances | All raw `<button>` with inline Tailwind |
| Inputs    | 0                   | ~40 instances | All raw `<input>` with copied styles    |
| Selects   | 0                   | ~12 instances | All raw `<select>`                      |
| Textareas | 0                   | ~8 instances  | All raw `<textarea>`                    |
| Cards     | 2 (ScoreCard)       | ~25 instances | Most cards are raw divs                 |
| Badges    | 1 (AtRiskBadge)     | ~15 instances | Status badges are inline spans          |
| Tables    | 0                   | 4 instances   | All raw `<table>`                       |
| Tabs      | 1 (ClassDetailPage) | 3 instances   | SpaceEditor, ExamDetail use raw tabs    |
| Dialogs   | 1 (ConfirmDialog)   | 1 instance    | Space Picker is raw div                 |
| Switches  | 0                   | 5 instances   | All checkboxes                          |
| Skeletons | 0                   | ~8 instances  | All inline animate-pulse divs           |
| Labels    | 0                   | ~35 instances | All raw `<label>`                       |

### 6.2 Repeated CSS Patterns

The following Tailwind class strings are repeated across 10+ files — strong
signal they should be componentized:

```css
/* Button primary — appears ~20 times */
"inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"

/* Button outline — appears ~15 times */
"inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"

/* Input — appears ~40 times */
"h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

/* Status badge — appears ~15 times with slight variations */
"inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize"
```

---

## 7. Teacher-Specific UX Patterns

### 7.1 Grading Workflow

The current grading path is: Dashboard → Exams → Exam Detail → Submissions →
Grading Review.

**Issues:**

- **5 clicks** to get to grading — too many steps for a daily task
- No **grading queue shortcut** from the dashboard (grading queue section links
  exist but could be more prominent)
- No **batch grading view** — teachers review one submission at a time
- No **keyboard-driven grading** — everything requires mouse clicks

**Recommendations:**

- Add a prominent "Start Grading" button on the dashboard that opens the next
  unreviewed submission
- Add keyboard shortcuts throughout the grading flow
- Add a grading queue sidebar that shows pending submissions across all exams
- Consider a "Review Mode" that auto-advances to the next submission after
  approval

### 7.2 Content Authoring

Space and item creation is functional but labor-intensive.

**Issues:**

- Creating a question requires multiple steps: expand story point → add item →
  opens full-page editor → configure type → add content → save
- No **question bank** to reuse questions across spaces
- No **duplicate** action for similar questions
- No **bulk import** (CSV, document parsing)
- No **AI-assisted content generation** (generate questions from a topic)

**Recommendations:**

- Add "Duplicate" action on items and story points
- Add question bank feature
- Add AI-powered question generation
- Add bulk import from CSV/document
- Add drag-and-drop between story points to reorganize items

### 7.3 Class Management

Teachers can view classes but cannot manage them from this app.

**Issues:**

- No **class creation** in teacher-web (only admin creates)
- No **student assignment** to classes
- No **class schedule** or timetable view
- Cannot **assign spaces/exams** to classes from the class detail page

**Recommendations:**

- Allow teachers to assign existing spaces and exams to their classes
- Add a class list page (currently no route for `/classes`)
- Add student progress overview per class

---

## 8. Forms & Input Design

### 8.1 Current Form Pattern

All forms use local `useState` for each field with raw HTML inputs. There is no:

- Form library (react-hook-form)
- Schema validation (zod)
- Shared form components
- Inline validation feedback
- Dirty state tracking

### 8.2 Specific Form Issues

| Form               | Issue                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Login              | No autocomplete attributes, no password toggle                                       |
| Exam Create        | No validation (passing > total possible), comma-separated inputs for structured data |
| Space Settings     | No dirty tracking, saves even if nothing changed                                     |
| Story Point Editor | No validation on required fields                                                     |
| Item Editor        | No validation per question type, `as any` casts                                      |
| Rubric Editor      | Criterion levels can have duplicate scores, no sort                                  |
| Agent Config       | System prompt has no character limit indicator                                       |
| Settings           | No success toast, checkboxes instead of switches                                     |
| Submission Upload  | No drag-drop, unstyled file input                                                    |

### 8.3 Recommended Form Architecture

```tsx
// Recommended pattern for all forms:
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@levelup/shared-ui";
import { Input, Button, Select, Switch, Textarea } from "@levelup/shared-ui";
```

---

## 9. Data Visualization & Analytics

### 9.1 Current State

- `SimpleBarChart` used for class performance and exam score distribution
- `ProgressRing` used for completion percentages
- `ScoreCard` used for key metrics

### 9.2 Missing Visualizations

| Missing                      | Where                    | Impact                               |
| ---------------------------- | ------------------------ | ------------------------------------ |
| Line chart / trend over time | All analytics pages      | Can't see improvement trends         |
| Pie/donut chart              | Exam status distribution | No quick status overview             |
| Heatmap                      | Question performance     | Can't identify systematic weaknesses |
| Histogram                    | Score distribution       | SimpleBarChart works but is basic    |
| Student progress timeline    | Class Detail             | Can't track individual students      |
| Comparison charts            | Analytics pages          | Can't compare classes/exams          |

### 9.3 Recommendations

- Add `recharts` `LineChart` for trend data
- Add `recharts` `PieChart` for status distribution
- Add a `HeatmapChart` component for question-topic performance matrices
- Add date range filtering to enable meaningful time-series visualization
- Add export buttons (PNG, CSV) on all charts

---

## 10. Loading, Empty & Error States

### 10.1 Loading States

| Page            | Has Loading State      | Quality                                      |
| --------------- | ---------------------- | -------------------------------------------- |
| Dashboard       | No                     | Missing — shows nothing while 5 queries load |
| Space List      | Yes (skeleton grid)    | Good                                         |
| Space Editor    | Yes (spinner)          | Fair — plain spinner, no skeleton            |
| Exam List       | Yes (skeleton cards)   | Good                                         |
| Exam Create     | No                     | N/A — no async on initial load               |
| Exam Detail     | Yes (spinner)          | Fair                                         |
| Submissions     | No explicit loading    | Missing for submission list                  |
| Grading Review  | Yes (spinner)          | Fair                                         |
| Students        | Yes (skeleton rows)    | Good                                         |
| Class Detail    | Partial                | Missing for overview, good for sub-tabs      |
| Analytics pages | Yes (skeleton cards)   | Good                                         |
| Settings        | No                     | Missing — settings may load slowly           |
| Notifications   | Delegated to shared-ui | Good                                         |

**Recommendation:** Standardize all loading states to use skeleton patterns
instead of plain spinners. Create a reusable `PageSkeleton` component per page
layout type.

### 10.2 Empty States

| Page                    | Has Empty State | CTA Included                  |
| ----------------------- | --------------- | ----------------------------- |
| Space List              | Yes             | Yes — "Create Space"          |
| Exam List               | Yes             | Yes — "Create Exam"           |
| Students                | Yes             | No — just "No students found" |
| Class Detail (sub-tabs) | Yes             | No — missing CTAs             |
| Analytics (all)         | Yes             | No — informational only       |
| Grading Review          | No              | N/A                           |

**Recommendation:** All empty states should include:

1. Relevant icon
2. Primary message
3. Secondary explanation
4. Action button where applicable

### 10.3 Error States

| Page         | Error Handling          |
| ------------ | ----------------------- | ----------------------- |
| Students     | Has error state display | Good                    |
| Space Editor | Toast on error          | Acceptable              |
| All others   | Try/catch with toast    | No inline error display |

**Recommendation:** Add error boundary per page section. Show inline error
messages with retry buttons instead of only relying on toasts (which disappear).

---

## 11. Accessibility Audit

### 11.1 WCAG 2.1 AA Compliance Issues

| Category       | Issue                                                                 | Severity | Where                     |
| -------------- | --------------------------------------------------------------------- | -------- | ------------------------- |
| Keyboard       | Custom tab bars not navigable with arrow keys                         | Critical | SpaceEditor, ExamDetail   |
| Keyboard       | Drag handles have no keyboard alternative label                       | Major    | SpaceEditor story points  |
| Keyboard       | Space Picker modal has no focus trap                                  | Critical | ExamDetailPage            |
| Screen Reader  | Missing `aria-label` on icon-only buttons (back, delete, settings)    | Major    | All detail pages          |
| Screen Reader  | Status badges lack `aria-label` (visual color only)                   | Major    | All list pages            |
| Screen Reader  | Charts are not described with `aria-label` or accessible alternatives | Major    | Dashboard, Analytics      |
| Color Contrast | `text-muted-foreground` on `bg-muted` may be low contrast             | Minor    | Various                   |
| Color Contrast | Status badge colors (yellow-100/yellow-700) may be borderline         | Minor    | Multiple                  |
| Semantics      | Tab bars use `<button>` without `role="tablist"`/`role="tab"`         | Major    | SpaceEditor, ExamDetail   |
| Semantics      | Tables lack `<caption>` or `aria-label`                               | Minor    | StudentsPage, ClassDetail |
| Focus          | No visible focus indicators customized beyond browser default         | Minor    | All interactive elements  |
| Forms          | Labels exist but not associated via shared-ui `FormField` pattern     | Minor    | All forms                 |

### 11.2 Recommendations

1. **Immediate:** Add `aria-label` to all icon-only buttons
2. **Immediate:** Replace custom tabs with shared-ui `Tabs` (Radix-based,
   accessible)
3. **Immediate:** Replace Space Picker with shared-ui `Dialog` (has focus trap)
4. **Short-term:** Add `aria-label` to all status badges
5. **Short-term:** Add chart descriptions / data tables as accessible
   alternatives
6. **Medium-term:** Audit and fix all color contrast ratios
7. **Medium-term:** Add skip-to-content link
8. **Medium-term:** Test with screen reader (VoiceOver/NVDA)

---

## 12. Responsive Design Review

### 12.1 Current Responsive Support

The app targets desktop-first with some responsive grid breakpoints:

- `md:grid-cols-2`, `lg:grid-cols-3` for card grids
- `sm:grid-cols-2`, `sm:grid-cols-3` for form layouts
- Sidebar collapses via `AppShell` (handled by shared-ui)

### 12.2 Issues

| Issue                                                                       | Severity | Where                       |
| --------------------------------------------------------------------------- | -------- | --------------------------- |
| Status tab bar overflows on mobile with no scroll indicator                 | Major    | ExamListPage, SpaceListPage |
| Exam stats display (3 columns) breaks on narrow screens                     | Minor    | ExamListPage                |
| Grading review override form is unusable on mobile (too many inline inputs) | Major    | GradingReviewPage           |
| Tables don't scroll horizontally on mobile                                  | Major    | StudentsPage, ExamAnalytics |
| Space editor tabs need horizontal scrolling on small tablets                | Minor    | SpaceEditorPage             |
| Dashboard stat cards stack properly but chart side-by-side breaks below lg  | Minor    | DashboardPage               |

### 12.3 Recommendations

- Add `overflow-x-auto` with scroll fade indicators on tab bars
- Use responsive table patterns (cards on mobile, table on desktop)
- Stack grading review override form vertically on mobile
- Test all pages at 768px (iPad) and 375px (iPhone) widths
- Consider a "mobile grading" simplified view for tablet use in classrooms

---

## 13. Issues Summary

### Critical (5)

1. **No dark mode** — CSS variables only define light theme
2. **Space Picker modal** — hardcoded `bg-white`, no accessibility, no Radix
   Dialog
3. **Page-replacing editors** — Item/StoryPoint editors replace entire page,
   losing context
4. **No form validation** — Exam creation allows invalid data (passing marks >
   total)
5. **Custom tab bars lack keyboard navigation** — ARIA violation

### Major (18)

1. All forms use raw HTML inputs instead of shared-ui components (~100+
   instances)
2. All buttons are raw HTML instead of shared-ui Button (~50+ instances)
3. Dashboard has no loading state while fetching 5 queries
4. No breadcrumbs on nested routes
5. No unsaved changes warning in editors
6. No keyboard shortcuts for grading workflow
7. Answer images fixed size with no lightbox/zoom
8. No next/previous navigation between submissions
9. Students page doesn't show student names
10. Space Analytics missing from sidebar navigation
11. Logout button in dashboard header (should be in sidebar)
12. File upload areas use unstyled native inputs
13. Tables use raw HTML instead of shared-ui Table components
14. Status badge rendering duplicated across 6+ files
15. Exam status tab bar overflows without scroll indicator on mobile
16. Settings page uses checkboxes instead of switches
17. ExamCreatePage has no error handling for upload failures
18. Grading review form unusable on mobile/tablet

### Minor (20)

1. Unused variables (`_membership`, `_publishedSpaces`, `_bulkFiles`)
2. `as any` type assertions in ItemEditor
3. No sort options on list pages
4. No pagination on any list page
5. No export/download on analytics or student data
6. No date range filtering on analytics
7. No "Forgot Password" on login
8. Labels show max 3 with no "+N more"
9. No creation date/last modified on cards
10. ClassDetail empty states lack CTAs
11. Settings has no success toast
12. Model options hardcoded in AgentConfigPanel
13. No character limit indicators on text areas
14. `SortableStoryPoint` inline in SpaceEditorPage
15. No drag overlay for dnd-kit
16. No search within exam questions
17. No comparison view in analytics
18. Missing autocomplete on login form
19. 404 page button uses Link with inline styles
20. ItemEditor is ~1000 lines — should be split

---

## 14. Redesign Recommendations

### 14.1 Priority 1: Design System Migration (1-2 weeks)

**Goal:** Replace all raw HTML elements with shared-ui components.

| Task                                       | Estimated Effort |
| ------------------------------------------ | ---------------- |
| Replace all `<button>` with `Button`       | 2 days           |
| Replace all `<input>` with `Input`         | 2 days           |
| Replace all `<select>` with `Select`       | 1 day            |
| Replace all `<textarea>` with `Textarea`   | 0.5 days         |
| Replace all `<label>` with `Label`         | 0.5 days         |
| Replace checkboxes with `Switch`           | 0.5 days         |
| Replace raw cards with `Card` components   | 1 day            |
| Replace raw tables with `Table` components | 1 day            |
| Create shared `StatusBadge` component      | 0.5 days         |
| Replace custom tabs with shared-ui `Tabs`  | 0.5 days         |

### 14.2 Priority 2: Dark Mode & Accessibility (1 week)

| Task                                                        | Estimated Effort |
| ----------------------------------------------------------- | ---------------- |
| Add `.dark` class HSL variables to `index.css`              | 0.5 days         |
| Replace `bg-white` hardcodes with `bg-background`/`bg-card` | 0.5 days         |
| Replace Space Picker with shared-ui `Dialog`                | 0.5 days         |
| Add `aria-label` to all icon-only buttons                   | 1 day            |
| Add ARIA patterns to custom interactive elements            | 1 day            |
| Add focus ring styling                                      | 0.5 days         |
| Screen reader testing pass                                  | 1 day            |

### 14.3 Priority 3: Form Architecture (1 week)

| Task                                         | Estimated Effort |
| -------------------------------------------- | ---------------- |
| Install react-hook-form + zod                | 0.5 days         |
| Refactor LoginPage form                      | 0.5 days         |
| Refactor ExamCreatePage form with validation | 1 day            |
| Refactor SpaceSettingsPanel form             | 0.5 days         |
| Refactor StoryPointEditor form               | 0.5 days         |
| Add unsaved changes guard                    | 0.5 days         |
| Add auto-save to SpaceEditor                 | 1 day            |

### 14.4 Priority 4: UX Improvements (2 weeks)

| Task                                                | Estimated Effort |
| --------------------------------------------------- | ---------------- |
| Add breadcrumb component to all detail pages        | 1 day            |
| Add Space Analytics to sidebar nav                  | 0.5 days         |
| Move logout to sidebar user menu                    | 0.5 days         |
| Dashboard loading skeleton                          | 0.5 days         |
| Grading keyboard shortcuts                          | 1 day            |
| Image lightbox for answer sheets                    | 1 day            |
| Next/prev submission navigation                     | 0.5 days         |
| Side-panel editors (replace page-replacing pattern) | 2 days           |
| File upload drop zones                              | 1 day            |
| Pagination on list pages                            | 1 day            |
| Class ID multi-select on ExamCreate                 | 0.5 days         |
| Tag input for topics                                | 0.5 days         |

### 14.5 Priority 5: Advanced Features (3+ weeks)

| Feature               | Description                                         |
| --------------------- | --------------------------------------------------- |
| Question Bank         | Reusable question library across spaces             |
| AI Content Generation | Generate questions from topic/difficulty            |
| Bulk Operations       | Multi-select + batch archive/delete/publish         |
| Advanced Analytics    | Trend charts, heatmaps, comparison views            |
| Export System         | CSV/PDF export for analytics, student data, results |
| Grading Queue         | Cross-exam pending review dashboard                 |
| Student Profiles      | Clickable students with performance history         |
| Mobile Grading Mode   | Simplified tablet-friendly grading interface        |

---

## 15. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Theme: Design System Compliance**

- Replace all raw HTML with shared-ui components
- Create `StatusBadge` shared component
- Add dark mode CSS variables
- Fix Space Picker accessibility (Dialog)

### Phase 2: Forms & Validation (Week 3)

**Theme: Data Integrity**

- Migrate to react-hook-form + zod
- Add validation to ExamCreate, SpaceSettings
- Add unsaved changes guards
- Add auto-save to editors

### Phase 3: Navigation & Workflow (Week 4)

**Theme: Teacher Efficiency**

- Add breadcrumbs
- Fix sidebar navigation (add missing items)
- Add keyboard shortcuts to grading
- Add image lightbox
- Add next/prev submission navigation
- Convert page-replacing editors to side panels

### Phase 4: Polish & Accessibility (Week 5)

**Theme: Production Readiness**

- Full accessibility audit pass
- Responsive testing and fixes
- Error boundary additions
- Loading state standardization
- Empty state improvements

### Phase 5: Advanced Features (Week 6+)

**Theme: Teacher Delight**

- Pagination across all lists
- Export system
- Advanced analytics
- Question bank
- Bulk operations

---

## Appendix A: Color Token Audit

### Current `index.css` Variables (Light Only)

```css
--primary: 221.2 83.2% 53.3%; /* Blue */
--destructive: 0 84.2% 60.2%; /* Red */
--muted: 210 40% 96.1%; /* Light gray */
--muted-foreground: 215.4 16.3% 46.9%; /* Medium gray */
--border: 214.3 31.8% 91.4%; /* Light border */
```

### Missing: Dark Mode Variables

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --border: 217.2 32.6% 17.5%;
  /* ... complete set needed */
}
```

### Hardcoded Colors Found

| Color                                  | Location                 | Issue                                                               |
| -------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `bg-white`                             | ExamDetailPage:L428      | Breaks dark mode                                                    |
| `bg-green-50`                          | ExamCreatePage:L359      | Breaks dark mode                                                    |
| `bg-orange-50`                         | GradingReviewPage:L443   | Breaks dark mode                                                    |
| `text-red-500`, `text-green-500`, etc. | Various                  | Acceptable for semantic colors but should ideally use CSS variables |
| `bg-yellow-100`, `bg-green-100`, etc.  | Status badges everywhere | Need dark mode variants                                             |

---

## Appendix B: Component Dependency Map

```
AppLayout
├── AppShell (shared-ui)
│   ├── AppSidebar (shared-ui)
│   │   └── RoleSwitcher (shared-ui)
│   └── NotificationBell (shared-ui)
└── Outlet
    ├── DashboardPage
    │   ├── ScoreCard (shared-ui)
    │   ├── SimpleBarChart (shared-ui)
    │   ├── AtRiskBadge (shared-ui)
    │   └── LogoutButton (shared-ui)
    ├── SpaceListPage
    ├── SpaceEditorPage
    │   ├── SpaceSettingsPanel (local)
    │   ├── StoryPointEditor (local)
    │   ├── ItemEditor (local)
    │   ├── RubricEditor (local)
    │   ├── AgentConfigPanel (local)
    │   ├── ConfirmDialog (local → AlertDialog shared-ui)
    │   └── SortableStoryPoint (inline)
    ├── ExamListPage
    ├── ExamCreatePage
    ├── ExamDetailPage
    │   ├── RubricEditor (local)
    │   └── DownloadPDFButton (shared-ui)
    ├── SubmissionsPage
    ├── GradingReviewPage
    ├── StudentsPage
    ├── ClassDetailPage
    │   ├── Tabs/TabsList/TabsTrigger/TabsContent (shared-ui)
    │   ├── ScoreCard (shared-ui)
    │   └── ProgressRing (shared-ui)
    ├── ClassAnalyticsPage
    │   ├── ScoreCard (shared-ui)
    │   └── ProgressRing (shared-ui)
    ├── ExamAnalyticsPage
    │   ├── ScoreCard (shared-ui)
    │   └── SimpleBarChart (shared-ui)
    ├── SpaceAnalyticsPage
    │   ├── ScoreCard (shared-ui)
    │   └── ProgressRing (shared-ui)
    ├── SettingsPage
    └── NotificationsPage
        └── NotificationsPageUI (shared-ui)
```

---

_End of UI/UX Audit Report_
