# Implementation Plan: Teacher-Web UI/UX Fixes

**Based on:** UI/UX Audit Report (March 2026) **App Path:**
`apps/teacher-web/src/` **Shared UI Path:** `packages/shared-ui/src/`

---

## Phase 1: Critical Fixes (Priority: Immediate)

### 1.1 Add Dark Mode CSS Variables

**Audit Ref:** Critical #1 — No dark mode support **Complexity:** S **Files to
Modify:**

- `apps/teacher-web/src/index.css`

**What to Change:** Add a `.dark` class block after the `:root` block with
dark-mode HSL values. Reference the existing dark mode pattern used in other
apps (e.g., `apps/student-web/src/index.css` or
`packages/tailwind-config/theme.js`).

```css
/* Add after line 37 (closing of :root) */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --card-border: 217.2 32.6% 17.5%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --primary-glow: 217.2 91.2% 59.8%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
  --sidebar-background: 222.2 84% 4.9%;
  --sidebar-foreground: 210 40% 98%;
  --sidebar-primary: 217.2 91.2% 59.8%;
  --sidebar-primary-foreground: 222.2 47.4% 11.2%;
  --sidebar-accent: 217.2 32.6% 17.5%;
  --sidebar-accent-foreground: 210 40% 98%;
  --sidebar-border: 217.2 32.6% 17.5%;
  --sidebar-ring: 224.3 76.3% 48%;
}
```

**Dependencies:** None. This is a standalone CSS change.

---

### 1.2 Replace Space Picker Modal with Radix Dialog

**Audit Ref:** Critical #2 — Hardcoded `bg-white`, no accessibility, no focus
trap **Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx` (lines 426–467)

**What to Change:** Replace the raw `<div className="fixed inset-0 ...">`
overlay at lines 426-467 with the shared-ui `Dialog` component. This adds:

- Focus trap (Radix built-in)
- Escape key handling
- Dark mode support (`bg-card` instead of `bg-white`)
- `role="dialog"` and `aria-modal`

```tsx
// Add to imports (line ~27):
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@levelup/shared-ui";

// Replace lines 426-467 with:
<Dialog open={showSpacePicker} onOpenChange={setShowSpacePicker}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Link to a Space</DialogTitle>
      <DialogDescription>
        Select a published space to link to this exam. Students will see it as a
        study resource.
      </DialogDescription>
    </DialogHeader>
    <div className="max-h-64 space-y-2 overflow-y-auto">
      {allSpaces.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No published spaces available.
        </p>
      ) : (
        allSpaces.map((space) => (
          <button
            key={space.id}
            onClick={() => handleLinkSpace(space.id)}
            disabled={linkingSpace}
            className="hover:bg-muted flex w-full items-center gap-3 rounded-md border p-3 text-left disabled:opacity-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{space.title}</p>
              {space.subject && (
                <p className="text-muted-foreground text-xs">{space.subject}</p>
              )}
            </div>
            <LinkIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          </button>
        ))
      )}
    </div>
  </DialogContent>
</Dialog>;
```

**Dependencies:** None.

---

### 1.3 Convert Page-Replacing Editors to Sheet/Panel Pattern

**Audit Ref:** Critical #3 — Item/StoryPoint editors replace entire page, losing
context **Complexity:** L **Files to Modify:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` (lines 532-555)

**What to Change:** Replace the conditional rendering pattern (lines 532-555)
that replaces the entire page with a `Sheet` (side panel) from shared-ui. This
preserves the parent page context and scroll position.

**Step 1:** Add Sheet import:

```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@levelup/shared-ui";
```

**Step 2:** Remove the early-return patterns at lines 532-555 (the
`if (editingItem)` and `if (editingSP)` blocks that return early).

**Step 3:** Add Sheet components inside the main return JSX (after the
ConfirmDialog):

```tsx
{
  /* Item Editor Sheet */
}
<Sheet
  open={!!editingItem}
  onOpenChange={(open) => {
    if (!open) {
      setEditingItem(null);
      setEditingItemSPId(null);
    }
  }}
>
  <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
    <SheetHeader>
      <SheetTitle>Edit Item</SheetTitle>
    </SheetHeader>
    {editingItem && editingItemSPId && (
      <ItemEditor
        item={editingItem}
        onSave={handleSaveItem}
        onCancel={() => {
          setEditingItem(null);
          setEditingItemSPId(null);
        }}
      />
    )}
  </SheetContent>
</Sheet>;

{
  /* Story Point Editor Sheet */
}
<Sheet
  open={!!editingSP}
  onOpenChange={(open) => {
    if (!open) setEditingSP(null);
  }}
>
  <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
    <SheetHeader>
      <SheetTitle>Edit Story Point</SheetTitle>
    </SheetHeader>
    {editingSP && (
      <StoryPointEditor
        storyPoint={editingSP}
        onSave={handleSaveStoryPoint}
        onCancel={() => setEditingSP(null)}
      />
    )}
  </SheetContent>
</Sheet>;
```

**Step 4:** Apply the same pattern to `ExamDetailPage.tsx` for rubric editing
(lines 116-140). Replace the early return with a Sheet:

```tsx
<Sheet
  open={!!editingRubric}
  onOpenChange={(open) => {
    if (!open) setEditingRubric(null);
  }}
>
  <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
    <SheetHeader>
      <SheetTitle>
        Edit Rubric — Q{questions.find((q) => q.id === editingRubric)?.order}
      </SheetTitle>
    </SheetHeader>
    {editingRubric && questions.find((q) => q.id === editingRubric) && (
      <RubricEditor
        rubric={questions.find((q) => q.id === editingRubric)!.rubric}
        onSave={(rubric) => handleSaveQuestionRubric(editingRubric, rubric)}
      />
    )}
  </SheetContent>
</Sheet>
```

**Dependencies:** None.

---

### 1.4 Add Form Validation to ExamCreatePage

**Audit Ref:** Critical #4 — No form validation (passing marks > total possible)
**Complexity:** M **Files to Modify:**

- `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx`

**What to Change:** Add validation before allowing step progression. Insert
validation at the "Next" button handler (currently line 231):

```tsx
// Add validation state
const [errors, setErrors] = useState<Record<string, string>>({});

// Add validation function
const validateMetadata = (): boolean => {
  const newErrors: Record<string, string> = {};
  if (!title.trim()) newErrors.title = "Title is required";
  if (!subject.trim()) newErrors.subject = "Subject is required";
  if (totalMarks <= 0) newErrors.totalMarks = "Total marks must be greater than 0";
  if (passingMarks < 0) newErrors.passingMarks = "Passing marks cannot be negative";
  if (passingMarks > totalMarks) newErrors.passingMarks = "Passing marks cannot exceed total marks";
  if (duration <= 0) newErrors.duration = "Duration must be greater than 0";
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

// Replace the Next button onClick:
onClick={() => {
  if (validateMetadata()) setStep("upload");
}}

// Add error messages below each input (example for passing marks):
{errors.passingMarks && (
  <p className="text-xs text-destructive mt-1">{errors.passingMarks}</p>
)}
```

Also add error handling for file upload (lines 45-65):

```tsx
// Replace try/finally with try/catch/finally:
try {
  // ... existing upload logic
} catch (err) {
  toast({
    title: "Upload failed",
    description: err instanceof Error ? err.message : "Failed to upload files",
    variant: "destructive",
  });
} finally {
  setUploading(false);
}
```

**Dependencies:** None.

---

### 1.5 Replace Custom Tab Bars with Shared-UI Tabs

**Audit Ref:** Critical #5 — Custom tab bars lack keyboard navigation (ARIA
violation) **Complexity:** M **Files to Modify:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` (lines 646-661)
- `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx` (lines 259-273)

**What to Change:** Replace the custom `<button>` tab bars with the shared-ui
`Tabs` component (Radix-based with built-in ARIA `role="tablist"` /
`role="tab"`, keyboard arrow navigation).

**SpaceEditorPage.tsx:**

```tsx
// Add imports:
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@levelup/shared-ui";

// Replace the tab state + custom tab bar + conditional content (lines 133, 646-797)
// with a single Tabs compound component:
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EditorTab)}>
  <TabsList>
    {tabs.map((tab) => (
      <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
        <tab.icon className="h-4 w-4" />
        {tab.label}
      </TabsTrigger>
    ))}
  </TabsList>
  <TabsContent value="settings">
    <SpaceSettingsPanel
      space={space}
      onSave={handleSaveSettings}
      saving={saving}
    />
  </TabsContent>
  <TabsContent value="content">
    {/* ... existing content tab JSX ... */}
  </TabsContent>
  <TabsContent value="rubric">
    <RubricEditor
      rubric={space.defaultRubric}
      onSave={(rubric) => handleSaveSettings({ defaultRubric: rubric })}
    />
  </TabsContent>
  <TabsContent value="agents">
    {spaceId && <AgentConfigPanel spaceId={spaceId} />}
  </TabsContent>
</Tabs>;
```

**ExamDetailPage.tsx:** Same approach — replace lines 259-272 custom buttons and
conditional rendering with `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`.

**Dependencies:** None.

---

## Phase 2: Major Fixes — Design System Migration

### 2.1 Create Shared StatusBadge Component

**Audit Ref:** Major #14 — Status badge rendering duplicated across 6+ files
**Complexity:** S **Files to Create:**

- `packages/shared-ui/src/components/ui/status-badge.tsx`

**Files to Modify:**

- `packages/shared-ui/src/index.ts` (add export)
- All pages that use inline status badge logic (SpaceListPage, SpaceEditorPage,
  ExamListPage, ExamDetailPage, StudentsPage, ClassDetailPage)

**Component Design:**

```tsx
// packages/shared-ui/src/components/ui/status-badge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const statusBadgeVariants = cva(
  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      status: {
        draft:
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        published:
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        archived:
          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        active:
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        inactive:
          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        grading:
          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        completed:
          "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
        results_released:
          "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
        question_paper_uploaded:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        question_paper_extracted:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        pending:
          "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      },
    },
    defaultVariants: {
      status: "draft",
    },
  }
);

export interface StatusBadgeProps extends VariantProps<
  typeof statusBadgeVariants
> {
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      aria-label={`Status: ${label ?? status}`}
    >
      {label ?? String(status).replace(/_/g, " ")}
    </span>
  );
}
```

Then replace all inline status badge logic across the codebase:

- `SpaceListPage.tsx`: Replace `statusBadge()` function (lines 23-36) with
  `<StatusBadge status={space.status} />`
- `SpaceEditorPage.tsx`: Replace inline badge (lines 594-603) with
  `<StatusBadge status={space.status} />`
- `ExamDetailPage.tsx`: Replace inline badge (lines 159-171) with
  `<StatusBadge status={exam.status} />`
- `StudentsPage.tsx`: Replace inline badge (lines 95-103) with
  `<StatusBadge status={student.status} />`
- `ExamListPage.tsx`: Replace `statusBadge()` function with `<StatusBadge />`
- `ClassDetailPage.tsx`: Replace all 6 status badge instances

**Dependencies:** None.

---

### 2.2 Replace All Raw `<button>` with Shared-UI `Button`

**Audit Ref:** Major #2 — All buttons are raw HTML (~50+ instances)
**Complexity:** L **Files to Modify:** (All pages — systematic replacement)

| File                       | Approximate Raw Button Count | Key Button Types                           |
| -------------------------- | ---------------------------- | ------------------------------------------ |
| `DashboardPage.tsx`        | 0 (uses LogoutButton)        | —                                          |
| `SpaceListPage.tsx`        | 4                            | Create, tab filter buttons                 |
| `SpaceEditorPage.tsx`      | 15+                          | Publish, Archive, tabs, Add SP, drag items |
| `ExamListPage.tsx`         | 4                            | Create, tabs                               |
| `ExamCreatePage.tsx`       | 8                            | Next, Back, Upload, Create                 |
| `ExamDetailPage.tsx`       | 8                            | Back, Publish, Release, Link, tabs         |
| `SubmissionsPage.tsx`      | 3                            | Back, Upload, Release                      |
| `GradingReviewPage.tsx`    | 5                            | Back, Approve, Override, expand toggles    |
| `StudentsPage.tsx`         | 0                            | —                                          |
| `SettingsPage.tsx`         | 1                            | Save                                       |
| `LoginPage.tsx`            | 3                            | Continue, Change, Sign In                  |
| Space components (5 files) | ~15                          | Various                                    |

**Pattern for Replacement:**

```tsx
// Import:
import { Button } from "@levelup/shared-ui";

// Before (primary):
<button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">

// After:
<Button>

// Before (outline):
<button className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">

// After:
<Button variant="outline" size="sm">

// Before (ghost/icon):
<button className="rounded-md p-1.5 hover:bg-muted">

// After:
<Button variant="ghost" size="icon">

// Before (destructive):
<button className="... bg-green-600 ... text-white ...">

// After (for semantic actions like Publish, keep inline colors or extend Button variants):
<Button className="bg-green-600 hover:bg-green-700 text-white">
```

**Approach:** Process file by file, top to bottom. Import `Button`, then replace
each `<button>` with appropriate variant/size.

**Dependencies:** None. Can be done in parallel per file.

---

### 2.3 Replace All Raw `<input>` with Shared-UI `Input`

**Audit Ref:** Major #1 — All forms use raw HTML inputs (~100+ instances)
**Complexity:** L **Files to Modify:** All form-containing pages and components.

**Pattern:**

```tsx
// Import:
import { Input } from "@levelup/shared-ui";

// Before:
<input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="..."
  className="h-9 w-full rounded-md border bg-background px-3 text-sm ..."
/>

// After:
<Input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="..."
/>
```

**Files with raw inputs:** | File | Count | Notes | |------|-------|-------| |
`LoginPage.tsx` | 3 | school code, email, password | | `SpaceListPage.tsx` | 1 |
search | | `ExamListPage.tsx` | 1 | search | | `ExamCreatePage.tsx` | 7 | title,
subject, topics, marks, duration, classIds, file | | `SubmissionsPage.tsx` | 4 |
student name, roll, classId, file | | `GradingReviewPage.tsx` | 2 | score,
reason | | `StudentsPage.tsx` | 1 | search | | `SettingsPage.tsx` | 3 |
checkboxes (→ Switch, see 2.6) | | `SpaceSettingsPanel.tsx` | ~6 | form fields |
| `StoryPointEditor.tsx` | ~5 | form fields | | `ItemEditor.tsx` | ~20+ |
various per question type | | `RubricEditor.tsx` | ~8 | criteria, levels | |
`AgentConfigPanel.tsx` | ~3 | name, model, prompt |

**Dependencies:** None. Can parallel with 2.2.

---

### 2.4 Replace All Raw `<select>` with Shared-UI `Select`

**Audit Ref:** Major #1 (part of inputs) **Complexity:** M **Files to Modify:**

- `ExamCreatePage.tsx` (line 216-227) — linked space select
- `SettingsPage.tsx` (line 127-135) — strictness select
- `ClassAnalyticsPage.tsx` — class selector
- `ExamAnalyticsPage.tsx` — exam selector
- `SpaceAnalyticsPage.tsx` — space selector
- `SpaceSettingsPanel.tsx` — type, access selects
- `StoryPointEditor.tsx` — type, difficulty selects
- `ItemEditor.tsx` — question type selects
- `AgentConfigPanel.tsx` — model select

**Pattern:**

```tsx
// Import:
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@levelup/shared-ui";

// Before:
<select value={val} onChange={(e) => setVal(e.target.value)} className="...">
  <option value="a">A</option>
  <option value="b">B</option>
</select>

// After:
<Select value={val} onValueChange={setVal}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">A</SelectItem>
    <SelectItem value="b">B</SelectItem>
  </SelectContent>
</Select>
```

**Dependencies:** None.

---

### 2.5 Replace All Raw `<textarea>` with Shared-UI `Textarea`

**Audit Ref:** Major #1 (part of inputs) **Complexity:** S **Files to Modify:**

- `SpaceSettingsPanel.tsx` — description textarea
- `AgentConfigPanel.tsx` — system prompt textarea
- `ItemEditor.tsx` — content textareas
- `RubricEditor.tsx` — model answer, evaluator guidance

**Pattern:**

```tsx
// Import:
import { Textarea } from "@levelup/shared-ui";

// Before:
<textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} className="..." />

// After:
<Textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} />
```

**Dependencies:** None.

---

### 2.6 Replace Checkboxes with Shared-UI `Switch`

**Audit Ref:** Major #16 — Settings page uses checkboxes instead of switches
**Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/SettingsPage.tsx` (lines 83-122)

**What to Change:** Replace the 3 `<input type="checkbox">` elements with
`Switch` from shared-ui:

```tsx
// Import:
import { Switch } from "@levelup/shared-ui";

// Before (line 83-88):
<input
  type="checkbox"
  checked={autoGrade}
  onChange={(e) => setAutoGrade(e.target.checked)}
  className="h-4 w-4 rounded border"
/>

// After:
<Switch checked={autoGrade} onCheckedChange={setAutoGrade} />
```

Apply to all 3 toggles: `autoGrade`, `requireOverrideReason`,
`releaseResultsAutomatically`.

**Dependencies:** None.

---

### 2.7 Replace Raw Tables with Shared-UI `Table`

**Audit Ref:** Major #13 — Tables use raw HTML instead of shared-ui Table
**Complexity:** M **Files to Modify:**

- `apps/teacher-web/src/pages/StudentsPage.tsx` (lines 58-109)
- `apps/teacher-web/src/pages/ClassDetailPage.tsx` (student tables)
- `apps/teacher-web/src/pages/ExamAnalyticsPage.tsx` (data table)

**Pattern for StudentsPage:**

```tsx
// Import:
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@levelup/shared-ui";

// Replace:
<div className="rounded-lg border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Roll Number</TableHead>
        <TableHead>Admission No.</TableHead>
        <TableHead>Grade</TableHead>
        <TableHead>Section</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {filtered.map((student) => (
        <TableRow key={student.id}>
          <TableCell className="font-mono text-xs">
            {student.rollNumber ?? "-"}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {student.admissionNumber ?? "-"}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {student.grade ?? "-"}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {student.section ?? "-"}
          </TableCell>
          <TableCell>
            <StatusBadge status={student.status} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>;
```

**Dependencies:** 2.1 (StatusBadge) for clean badge integration.

---

### 2.8 Replace Raw `<label>` with Shared-UI `Label`

**Audit Ref:** Major #1 (part of form consistency) **Complexity:** S **Files to
Modify:** All form-containing files (~35 instances)

**Pattern:**

```tsx
// Import:
import { Label } from "@levelup/shared-ui";

// Before:
<label className="text-sm font-medium">Field Name</label>

// After:
<Label>Field Name</Label>

// Before (with htmlFor):
<label htmlFor="email" className="text-sm font-medium">Email</label>

// After:
<Label htmlFor="email">Email</Label>
```

**Dependencies:** None.

---

### 2.9 Replace Raw Card Divs with Shared-UI `Card`

**Audit Ref:** Major #1 (part of component consistency) **Complexity:** M
**Files to Modify:**

- `DashboardPage.tsx` — chart section (line 115), at-risk section (line 125),
  recent lists, grading queue
- `ExamDetailPage.tsx` — stats grid (lines 235-256), question cards (line
  288-329)
- `GradingReviewPage.tsx` — summary grid (lines 247-276), per-question cards
- `SettingsPage.tsx` — settings card (line 70)
- `SpaceListPage.tsx` — space cards
- `ExamCreatePage.tsx` — review card (line 298)

**Pattern:**

```tsx
// Import:
import { Card, CardHeader, CardTitle, CardContent } from "@levelup/shared-ui";

// Before:
<div className="rounded-lg border bg-card p-5">
  <h2 className="font-semibold">Title</h2>
  <div>...content...</div>
</div>

// After:
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    ...content...
  </CardContent>
</Card>
```

**Dependencies:** None.

---

### 2.10 Add Dashboard Loading Skeleton

**Audit Ref:** Major #3 — Dashboard has no loading state while fetching 5
queries **Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/DashboardPage.tsx`

**What to Change:** Add a loading check before the main render. Use `Skeleton`
from shared-ui:

```tsx
// Import:
import { Skeleton } from "@levelup/shared-ui";

// Add loading detection after hooks (before the return):
const isLoading =
  !spaces.length && !exams.length && !students.length && !classes.length;

// Add at the top of the return, before the Stats section:
{
  isLoading && (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
```

Note: A more precise approach is to check `isLoading` from each `useSpaces`,
`useExams`, etc. hook result.

**Dependencies:** None.

---

### 2.11 Add Breadcrumbs to All Detail Pages

**Audit Ref:** Major #4 — No breadcrumbs on nested routes **Complexity:** M
**Files to Modify:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`
- `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- `apps/teacher-web/src/pages/ClassDetailPage.tsx`

**What to Change:** Replace the back arrow button headers with breadcrumbs from
shared-ui:

```tsx
// Import:
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@levelup/shared-ui";
import { Link } from "react-router-dom";

// Example for GradingReviewPage (deepest nesting):
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link to="/exams">Exams</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link to={`/exams/${examId}`}>{exam?.title ?? "Exam"}</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link to={`/exams/${examId}/submissions`}>Submissions</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>{submission?.studentName ?? "Review"}</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>;
```

Keep the back arrow button as well (it's a common shortcut), but add breadcrumbs
below/beside the header.

**Dependencies:** None.

---

### 2.12 Fix Sidebar Navigation — Add Missing Items

**Audit Ref:** Major #10 — Space Analytics missing from sidebar navigation
**Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/layouts/AppLayout.tsx` (lines 69-83)

**What to Change:** Add Space Analytics to the Analytics group and use
`startsWith` for active detection:

```tsx
// In the Analytics navGroups array (around line 69):
{
  label: "Analytics",
  items: [
    {
      title: "Class Analytics",
      url: "/analytics/classes",
      icon: BarChart3,
      isActive: location.pathname.startsWith("/analytics/classes"),
    },
    {
      title: "Exam Analytics",
      url: "/analytics/exams",
      icon: CheckSquare,
      isActive: location.pathname.startsWith("/analytics/exams"),
    },
    {
      title: "Space Analytics",
      url: "/analytics/spaces",
      icon: BookOpen,  // import BookOpen from lucide-react
      isActive: location.pathname.startsWith("/analytics/spaces"),
    },
  ],
},
```

Also add `BookOpen` to the lucide-react imports.

**Dependencies:** None.

---

### 2.13 Move Logout to Sidebar Footer

**Audit Ref:** Major #11 — Logout button in dashboard header is unusual
**Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/layouts/AppLayout.tsx` (sidebar footer, lines 142-153)
- `apps/teacher-web/src/pages/DashboardPage.tsx` (remove logout button, lines
  78-83)

**What to Change:**

**AppLayout.tsx** — Add logout to sidebar footer:

```tsx
// Import LogoutButton:
import { LogoutButton } from "@levelup/shared-ui";

// Update sidebarFooter (line 142-153):
const sidebarFooter = (
  <div className="space-y-2">
    <RoleSwitcher
      currentTenantId={currentTenantId}
      tenants={tenantOptions}
      onSwitch={switchTenant}
    />
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <span className="text-muted-foreground truncate text-xs">
        {user?.displayName ?? user?.email}
      </span>
      <LogoutButton
        onLogout={logout}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        Sign Out
      </LogoutButton>
    </div>
  </div>
);
```

**DashboardPage.tsx** — Remove the `<LogoutButton>` from lines 78-83 and its
import. Also remove `const { logout } = useAuthStore()` if it becomes unused.

**Dependencies:** None.

---

### 2.14 Style File Upload Areas as Drop Zones

**Audit Ref:** Major #12 — File upload areas use unstyled native inputs
**Complexity:** M **Files to Modify:**

- `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx` (line 247-252)
- `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx` (line 184-189)

**What to Change:** Hide the native `<input type="file">` and create a styled
drop zone:

```tsx
// For ExamCreatePage upload step:
const fileInputRef = useRef<HTMLInputElement>(null);

<div
  onClick={() => fileInputRef.current?.click()}
  onDragOver={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onDrop={(e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
  }}
  className="hover:border-primary hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors"
>
  <Upload className="text-muted-foreground mx-auto h-8 w-8" />
  <p className="mt-2 text-sm font-medium">Click to upload or drag and drop</p>
  <p className="text-muted-foreground text-xs">PDF or image files</p>
  <input
    ref={fileInputRef}
    type="file"
    multiple
    accept="image/*,.pdf"
    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
    className="hidden"
  />
</div>;
{
  files.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <Badge key={i} variant="secondary">
          {f.name}
        </Badge>
      ))}
    </div>
  );
}
```

Apply similar pattern to SubmissionsPage.

**Dependencies:** None.

---

### 2.15 Fix Hardcoded Colors for Dark Mode

**Audit Ref:** Critical #1 continuation — Hardcoded colors break dark mode
**Complexity:** S **Files to Modify:**

- `ExamCreatePage.tsx` (line 359) — `bg-green-50` →
  `bg-green-50 dark:bg-green-950/30`
- `ExamDetailPage.tsx` (line 428) — FIXED by 1.2 (Dialog replacement)
- `GradingReviewPage.tsx` (line 443) — `bg-orange-50` →
  `bg-orange-50 dark:bg-orange-950/30`
- `DashboardPage.tsx` (line 131) — `bg-red-100 ... text-red-700` → add dark
  variants
- All status badge colors — FIXED by 2.1 (StatusBadge component)

**Pattern for semantic background colors:**

```
bg-green-50  → bg-green-50 dark:bg-green-950/30
bg-orange-50 → bg-orange-50 dark:bg-orange-950/30
bg-red-100   → bg-red-100 dark:bg-red-900/20
bg-blue-50   → bg-blue-50 dark:bg-blue-950/30
text-green-800 → text-green-800 dark:text-green-300
text-green-700 → text-green-700 dark:text-green-400
text-orange-700 → text-orange-700 dark:text-orange-400
text-red-700 → text-red-700 dark:text-red-400
```

**Dependencies:** 1.1 (Dark mode CSS variables must be in place).

---

## Phase 3: Major Fixes — UX Improvements

### 3.1 Add Answer Image Lightbox/Zoom

**Audit Ref:** Major #7 — Answer images fixed size with no lightbox/zoom
**Complexity:** M **Files to Modify:**

- `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx` (lines 332-340)

**What to Change:** Add a dialog-based lightbox for answer images:

```tsx
// Add state:
const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

// Replace img elements (line 333-338):
<img
  key={idx}
  src={url}
  alt={`Answer page ${idx + 1}`}
  className="h-48 rounded border object-contain cursor-pointer hover:ring-2 hover:ring-primary"
  onClick={() => setLightboxUrl(url)}
/>

// Add lightbox Dialog at the end of the component return:
<Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
  <DialogContent className="max-w-4xl max-h-[90vh] p-2">
    {lightboxUrl && (
      <img src={lightboxUrl} alt="Full answer" className="w-full h-full object-contain" />
    )}
  </DialogContent>
</Dialog>
```

**Dependencies:** None.

---

### 3.2 Add Next/Previous Submission Navigation

**Audit Ref:** Major #8 — No way to navigate between submissions **Complexity:**
M **Files to Modify:**

- `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`

**What to Change:** Fetch the full submissions list and provide navigation:

```tsx
// Add hook for all submissions:
const { data: allSubmissions = [] } = useSubmissions(tenantId, { examId });

// Calculate prev/next:
const currentIdx = allSubmissions.findIndex((s) => s.id === submissionId);
const prevSub = currentIdx > 0 ? allSubmissions[currentIdx - 1] : null;
const nextSub =
  currentIdx < allSubmissions.length - 1
    ? allSubmissions[currentIdx + 1]
    : null;

// Add navigation buttons in the header:
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="sm"
    disabled={!prevSub}
    onClick={() =>
      prevSub && navigate(`/exams/${examId}/submissions/${prevSub.id}`)
    }
  >
    <ChevronLeft className="h-4 w-4" /> Previous
  </Button>
  <span className="text-muted-foreground text-xs">
    {currentIdx + 1} of {allSubmissions.length}
  </span>
  <Button
    variant="outline"
    size="sm"
    disabled={!nextSub}
    onClick={() =>
      nextSub && navigate(`/exams/${examId}/submissions/${nextSub.id}`)
    }
  >
    Next <ChevronRight className="h-4 w-4" />
  </Button>
</div>;
```

**Dependencies:** None.

---

### 3.3 Show Student Names on StudentsPage

**Audit Ref:** Major #9 — Student name not displayed **Complexity:** S **Files
to Modify:**

- `apps/teacher-web/src/pages/StudentsPage.tsx`

**What to Change:** Add a "Name" column as the first column and include
`displayName` in the search filter:

```tsx
// Update search filter (line 11-16):
const filtered = students.filter(
  (s) =>
    (s.displayName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    s.uid.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.admissionNumber ?? "").toLowerCase().includes(search.toLowerCase())
);

// Add Name column header before Roll Number:
<TableHead>Name</TableHead>

// Add Name cell in each row:
<TableCell className="font-medium">{student.displayName ?? student.uid}</TableCell>
```

**Dependencies:** 2.7 (Table component replacement) — or can be done
independently on raw table first.

---

### 3.4 Add Settings Page Success Toast

**Audit Ref:** Minor #11 — No success toast after saving **Complexity:** S
**Files to Modify:**

- `apps/teacher-web/src/pages/SettingsPage.tsx` (line 38-56)

**What to Change:** Import `useToast` and add success toast after save:

```tsx
import { useToast } from "@levelup/shared-ui";
const { toast } = useToast();

// In handleSave, after refetch() (line 53):
toast({ title: "Settings saved successfully" });

// Also add catch block:
} catch (err) {
  toast({
    title: "Failed to save settings",
    description: err instanceof Error ? err.message : "Unknown error",
    variant: "destructive",
  });
} finally {
  setSaving(false);
}
```

**Dependencies:** None.

---

### 3.5 Fix `as any` Type Assertions in Settings Page

**Audit Ref:** Minor #2 (partially) — `as any` in SettingsPage **Complexity:** S
**Files to Modify:**

- `apps/teacher-web/src/pages/SettingsPage.tsx` (lines 27-34)

**What to Change:** Create a proper type interface or extend the
EvaluationSettings type:

```tsx
// Replace the as any casts with proper field access:
// If EvaluationSettings doesn't include these fields, either:
// a) Extend the type in shared-types, or
// b) Use a local interface:

interface EvaluationSettingsWithFields extends EvaluationSettings {
  autoGrade?: boolean;
  requireOverrideReason?: boolean;
  releaseResultsAutomatically?: boolean;
  defaultStrictness?: string;
}

const settings: EvaluationSettingsWithFields | null = ...;

// Then replace:
setAutoGrade((settings as any).autoGrade ?? true);
// With:
setAutoGrade(settings.autoGrade ?? true);
```

**Dependencies:** May need shared-types update.

---

### 3.6 Add `aria-label` to Icon-Only Buttons

**Audit Ref:** Major (Accessibility) — Missing aria-label on icon-only buttons
**Complexity:** S **Files to Modify:** All pages with icon-only buttons (back
arrows, delete, settings, drag handles)

**Key Locations:**

- All back arrow buttons: Add `aria-label="Go back"`
- SpaceEditorPage drag handles (line 91): Add `aria-label="Drag to reorder"`
- Delete buttons: Add `aria-label="Delete"`
- Settings gear buttons: Add `aria-label="Edit settings"`
- Expand/collapse toggles: Add `aria-label="Toggle details"`

**Pattern:**

```tsx
// Before:
<Button variant="ghost" size="icon">
  <ArrowLeft className="h-5 w-5" />
</Button>

// After:
<Button variant="ghost" size="icon" aria-label="Go back">
  <ArrowLeft className="h-5 w-5" />
</Button>
```

**Dependencies:** 2.2 (Button replacement) — easier to add aria-labels during
Button migration.

---

### 3.7 Add Login Page Improvements

**Audit Ref:** Minor #7, #18 — No autocomplete, no password toggle
**Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/LoginPage.tsx`

**What to Change:**

```tsx
// Add autoComplete to email input (line 129-137):
<Input
  id="email"
  type="email"
  autoComplete="email"
  ...
/>

// Add autoComplete to password input (line 144-152):
<Input
  id="password"
  type="password"
  autoComplete="current-password"
  ...
/>

// Add password visibility toggle:
const [showPassword, setShowPassword] = useState(false);

<div className="relative">
  <Input
    id="password"
    type={showPassword ? "text" : "password"}
    autoComplete="current-password"
    ...
  />
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className="absolute right-0 top-0 h-full"
    onClick={() => setShowPassword(!showPassword)}
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </Button>
</div>
```

**Dependencies:** 2.2 (Button), 2.3 (Input).

---

## Phase 4: Polish & Minor Fixes

### 4.1 Remove Unused Variables

**Audit Ref:** Minor #1 — Unused variables **Complexity:** S **Files to
Modify:**

- `DashboardPage.tsx` — Remove `_membership` (line 32), `_publishedSpaces`
  (line 49)
- `SubmissionsPage.tsx` — Remove `_bulkFiles`, `_setBulkFiles` (line 64)

---

### 4.2 Add Loading States to Missing Pages

**Audit Ref:** Section 10.1 — Loading states missing **Complexity:** M **Files
to Modify:**

- `SettingsPage.tsx` — Add skeleton while settings load
- `SubmissionsPage.tsx` — Add skeleton for submission list
- `ClassDetailPage.tsx` — Add loading for overview tab

Use `Skeleton` from shared-ui consistently:

```tsx
import { Skeleton } from "@levelup/shared-ui";

{
  isLoading && (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
```

---

### 4.3 Add Empty State CTAs

**Audit Ref:** Minor #10 — ClassDetail empty states lack CTAs **Complexity:** S
**Files to Modify:**

- `ClassDetailPage.tsx` — Add action buttons to empty states in sub-tabs
- `StudentsPage.tsx` — Add CTA to empty state
- Analytics pages — Add link to content pages

**Pattern:**

```tsx
// Before:
<p className="text-sm text-muted-foreground">No spaces assigned</p>

// After:
<div className="flex flex-col items-center gap-3">
  <BookOpen className="h-8 w-8 text-muted-foreground" />
  <p className="text-sm text-muted-foreground">No spaces assigned to this class</p>
  <Button variant="outline" size="sm" asChild>
    <Link to="/spaces">Browse Spaces</Link>
  </Button>
</div>
```

---

### 4.4 Add Labels "+N More" Indicator

**Audit Ref:** Minor #8 — Labels truncated to 3 with no "+N more"
**Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/spaces/SpaceListPage.tsx` (line 181-191)

```tsx
// After the labels.slice(0, 3) map:
{
  space.labels.length > 3 && (
    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
      +{space.labels.length - 3} more
    </span>
  );
}
```

---

### 4.5 Replace SpaceEditorPage Spinner with Skeleton

**Audit Ref:** Section 10.1 — SpaceEditor uses plain spinner **Complexity:** S
**Files to Modify:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` (lines 510-516)

```tsx
// Replace the spinning div with a skeleton layout:
if (isLoading) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

---

### 4.6 Extract SortableStoryPoint to Separate File

**Audit Ref:** Minor #14 — Inline component in SpaceEditorPage **Complexity:** S
**Files to Create:**

- `apps/teacher-web/src/components/spaces/SortableStoryPoint.tsx`

**Files to Modify:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — Remove inline
  component (lines 67-123), import from new file

---

### 4.7 Add Responsive Scroll Indicators to Tab Bars

**Audit Ref:** Major #15 — Exam status tab bar overflows without scroll
indicator on mobile **Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/exams/ExamListPage.tsx`
- `apps/teacher-web/src/pages/spaces/SpaceListPage.tsx`

**What to Change:** Add scroll fade indicators using CSS:

```tsx
<div className="relative">
  <div className="scrollbar-hide flex overflow-x-auto rounded-lg border p-0.5">
    {/* ... tab buttons ... */}
  </div>
  {/* Optional: fade gradient on edges */}
  <div className="from-background pointer-events-none absolute bottom-0 right-0 top-0 w-8 bg-gradient-to-l to-transparent md:hidden" />
</div>
```

---

### 4.8 Fix 404 Page Button

**Audit Ref:** Minor #19 — 404 page button uses Link with inline styles
**Complexity:** S **Files to Modify:**

- `apps/teacher-web/src/pages/NotFoundPage.tsx`

```tsx
// Use Button with asChild:
<Button asChild>
  <Link to="/">Go Home</Link>
</Button>
```

---

## Phase 5: Advanced Improvements (Future)

These items are documented in the audit but require more significant effort and
new feature development. They should be tackled after Phases 1-4.

### 5.1 Form Architecture Migration

**Complexity:** XL

- Install `react-hook-form` and `@hookform/resolvers` (if not already in deps)
- Create Zod schemas for: Login, ExamCreate, SpaceSettings, StoryPointEditor,
  SubmissionUpload
- Refactor each form to use `useForm` + `zodResolver` + shared-ui
  `Form`/`FormField` pattern
- Add unsaved changes guard using `useBlocker` from React Router
- Add auto-save with debounce to SpaceEditorPage

### 5.2 Grading Keyboard Shortcuts

**Complexity:** M

- Add `useEffect` keyboard listener for: `J`/`K` (next/prev question), `A`
  (approve), `O` (open override)
- Show keyboard shortcut hints in a floating help panel

### 5.3 Pagination on List Pages

**Complexity:** M

- Add pagination to: StudentsPage, SubmissionsPage (Exam Detail), ExamListPage,
  SpaceListPage
- Use shared-ui `Pagination` component
- Integrate with data fetching hooks (limit/offset or cursor-based)

### 5.4 ItemEditor Refactoring

**Complexity:** XL

- Split the ~1000-line `ItemEditor.tsx` into:
  - `ItemEditorShell.tsx` — header, type selector, save/cancel
  - `QuestionTypeEditor.tsx` — dispatcher to type-specific editors
  - `MaterialTypeEditor.tsx` — dispatcher to material-specific editors
  - Individual editors: `MCQEditor.tsx`, `CodeEditor.tsx`, `MatchingEditor.tsx`,
    etc.
- Remove all `as any` casts
- Add per-type Zod validation

### 5.5 Advanced Analytics

**Complexity:** XL

- Add trend line charts using recharts `LineChart`
- Add date range filtering to all analytics pages
- Add CSV/PDF export buttons
- Add comparison mode between classes/exams

### 5.6 Question Bank & Bulk Import

**Complexity:** XL

- Create question bank feature for reusing questions
- Add CSV import for questions using shared-ui `BulkImportDialog`
- Add duplicate action on items and story points

---

## Dependency Graph

```
Phase 1 (Critical) — No internal dependencies, all can start in parallel:
├── 1.1 Dark Mode CSS Variables
├── 1.2 Space Picker Dialog
├── 1.3 Sheet Editors
├── 1.4 Form Validation
└── 1.5 Shared-UI Tabs

Phase 2 (Design System) — Most can parallel, some dependencies:
├── 2.1 StatusBadge Component ←── needed by 2.7 (Table)
├── 2.2 Button Replacement (all pages, parallel per file)
├── 2.3 Input Replacement (all pages, parallel per file)
├── 2.4 Select Replacement
├── 2.5 Textarea Replacement
├── 2.6 Switch Replacement
├── 2.7 Table Replacement ←── depends on 2.1 (StatusBadge)
├── 2.8 Label Replacement
├── 2.9 Card Replacement
├── 2.10 Dashboard Skeleton
├── 2.11 Breadcrumbs
├── 2.12 Sidebar Navigation Fix
├── 2.13 Move Logout
├── 2.14 File Upload Drop Zones
└── 2.15 Dark Mode Color Fixes ←── depends on 1.1

Phase 3 (UX) — Mostly independent:
├── 3.1 Image Lightbox
├── 3.2 Submission Navigation
├── 3.3 Student Names
├── 3.4 Settings Toast
├── 3.5 Fix as any Types
├── 3.6 Aria Labels ←── easier after 2.2 (Button)
└── 3.7 Login Improvements ←── depends on 2.2, 2.3

Phase 4 (Polish) — Mostly independent:
├── 4.1 Remove Unused Variables
├── 4.2 Loading States
├── 4.3 Empty State CTAs
├── 4.4 Labels +N More
├── 4.5 Skeleton for SpaceEditor
├── 4.6 Extract SortableStoryPoint
├── 4.7 Responsive Scroll Indicators
└── 4.8 404 Page Button
```

---

## Summary

| Phase              | Items | Complexity Range | Estimated Scope           |
| ------------------ | ----- | ---------------- | ------------------------- |
| 1: Critical        | 5     | S-L              | High priority, immediate  |
| 2: Design System   | 15    | S-L              | Systematic replacement    |
| 3: UX Improvements | 7     | S-M              | User-facing improvements  |
| 4: Polish          | 8     | S-M              | Quality finishing touches |
| 5: Advanced        | 6     | M-XL             | Future roadmap            |

**Total actionable items:** 35 (Phases 1-4) **Total future items:** 6 (Phase 5)
