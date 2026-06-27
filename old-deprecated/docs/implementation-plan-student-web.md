# Implementation Plan: Student-Web UI/UX Fixes

**Source:** [UI/UX Audit Report](/docs/ui-ux-audit-student-web.md) **Target
App:** `apps/student-web/` **Total Issues:** 4 Critical, 6 Major, 10 Minor = 20
issues

---

## Table of Contents

1. [Phase 1: Design System Alignment (Critical)](#phase-1-design-system-alignment)
2. [Phase 2: Accessibility (Critical)](#phase-2-accessibility)
3. [Phase 3: Mobile & Responsive Design (Major)](#phase-3-mobile--responsive-design)
4. [Phase 4: Error Handling & Loading States (Major)](#phase-4-error-handling--loading-states)
5. [Phase 5: Component Refactoring (Major + Minor)](#phase-5-component-refactoring)
6. [Phase 6: Interaction & Motion Design (Minor)](#phase-6-interaction--motion-design)
7. [Phase 7: Gamification & Advanced Features (Minor)](#phase-7-gamification--advanced-features)
8. [Cross-Cutting: Hardcoded Color Replacement Map](#cross-cutting-hardcoded-color-replacement-map)

---

## Phase 1: Design System Alignment

**Addresses:** C1 (Dark Mode), C2 (Raw HTML Elements), m7 (Custom Dialog), M4
(Timer Bar) **Priority:** Critical — blocks all other visual work

### 1.1 Add Dark Mode CSS Variables

**Issue:** C1 — No `.dark` theme variant in `index.css` **File:**
`apps/student-web/src/index.css` **Complexity:** S

**Current state (lines 5-37):** Only `:root` (light theme) CSS custom properties
defined. No `.dark` block.

**Change:** Add a `.dark` class block after the `:root` block with dark-mode HSL
values:

```css
/* Add after line 37, before the * selector on line 39 */
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
  --sidebar-background: 240 5.9% 10%;
  --sidebar-foreground: 240 4.8% 95.9%;
  --sidebar-primary: 217.2 91.2% 59.8%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 240 3.7% 15.9%;
  --sidebar-accent-foreground: 240 4.8% 95.9%;
  --sidebar-border: 240 3.7% 15.9%;
  --sidebar-ring: 217.2 91.2% 59.8%;
}
```

**Also required:**

- Wrap app with `<ThemeProvider>` from `next-themes` in `main.tsx`
- Add a theme toggle component to `AppLayout.tsx` and `ConsumerLayout.tsx`
  headers

**File:** `apps/student-web/src/main.tsx`

```tsx
// Add import
import { ThemeProvider } from "next-themes";

// Wrap <App /> with:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <App />
</ThemeProvider>;
```

**File:** `apps/student-web/src/layouts/AppLayout.tsx` Add a theme toggle button
in the header (next to NotificationBell):

```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
// In header: <Button variant="ghost" size="icon" onClick={toggleTheme}>...
```

---

### 1.2 Replace All Hardcoded Colors with Token-Aware Classes

**Issue:** C1 — 80+ instances of hardcoded Tailwind colors **Files:** Every page
and component file **Complexity:** L

This is the largest single task. Every hardcoded color must be replaced with a
CSS-variable-aware Tailwind class. See
[Cross-Cutting: Hardcoded Color Replacement Map](#cross-cutting-hardcoded-color-replacement-map)
at the bottom of this document for the complete file-by-file replacement table.

**Summary of replacements:**

| Hardcoded Class         | Token Replacement                               | Count |
| ----------------------- | ----------------------------------------------- | ----- |
| `bg-gray-50`            | `bg-muted/50`                                   | ~8    |
| `bg-gray-100`           | `bg-muted`                                      | ~15   |
| `bg-gray-200`           | `bg-muted` or `bg-border`                       | ~6    |
| `bg-white`              | `bg-background` or `bg-card`                    | ~5    |
| `bg-blue-50`            | `bg-primary/5` or `bg-accent`                   | ~8    |
| `bg-blue-500`           | `bg-primary`                                    | ~8    |
| `bg-blue-600` (hover)   | `bg-primary/90` (hover)                         | ~5    |
| `bg-green-50`           | `bg-emerald-500/10` (or define `--success` var) | ~3    |
| `bg-green-100`          | `bg-emerald-500/10`                             | ~2    |
| `bg-red-50`             | `bg-destructive/10`                             | ~3    |
| `bg-red-100`            | `bg-destructive/10`                             | ~1    |
| `bg-orange-50`          | `bg-amber-500/10`                               | ~2    |
| `bg-orange-100`         | `bg-amber-500/10`                               | ~2    |
| `text-gray-700`         | `text-foreground`                               | ~5    |
| `text-gray-600`         | `text-muted-foreground`                         | ~4    |
| `text-gray-400`         | `text-muted-foreground`                         | ~2    |
| `text-gray-300`         | `text-muted-foreground/50`                      | ~2    |
| `text-gray-900`         | `text-foreground`                               | ~1    |
| `text-blue-700`         | `text-primary`                                  | ~2    |
| `text-blue-800`         | `text-primary`                                  | ~1    |
| `text-blue-600`         | `text-primary`                                  | ~3    |
| `text-blue-500`         | `text-primary`                                  | ~3    |
| `text-blue-300`         | `text-primary/50`                               | ~1    |
| `hover:bg-gray-50`      | `hover:bg-accent`                               | ~5    |
| `hover:bg-gray-100`     | `hover:bg-accent`                               | ~1    |
| `hover:bg-gray-200`     | `hover:bg-accent`                               | ~1    |
| `focus:border-blue-500` | `focus-visible:ring-2 focus-visible:ring-ring`  | ~2    |

**Also add to `index.css`** (both `:root` and `.dark`):

```css
--success: 142.1 76.2% 36.3%; /* green-600 light */
--success-foreground: 355.7 100% 97.3%;
--warning: 32.1 94.6% 43.7%; /* amber-600 light */
--warning-foreground: 26 83.3% 14.1%;
```

---

### 1.3 Replace Raw `<button>` with `<Button>` from shared-ui

**Issue:** C2 — ~40 instances of raw `<button>` elements **Complexity:** M

Import `{ Button }` from `@levelup/shared-ui` in each file and replace
inline-styled buttons.

**File-by-file changes:**

#### `pages/TimedTestPage.tsx` (14 raw buttons)

1. **Line 296-303** — "Start Test" button:

   ```tsx
   // Before:
   <button onClick={handleStartTest} disabled={startTest.isPending}
     className="flex items-center gap-2 rounded-md bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">

   // After:
   <Button onClick={handleStartTest} disabled={startTest.isPending} className="gap-2">
     <PlayCircle className="h-5 w-5" />
     {startTest.isPending ? 'Starting...' : 'Start Test'}
   </Button>
   ```

2. **Lines 400-406** — "Previous" button → `<Button variant="outline">`
3. **Lines 408-414** — "Save & Next" button → `<Button>`
4. **Lines 416-421** — "Mark for Review" →
   `<Button variant="outline" className="border-orange-300 text-orange-600">`
5. **Lines 423-428** — "Clear" →
   `<Button variant="outline" className="text-destructive">`
6. **Lines 432-437** — "Submit Test" → `<Button variant="destructive">`
7. **Lines 458-462** — Confirmation "Cancel" → `<Button variant="outline">`
8. **Lines 464-469** — Confirmation "Submit" → `<Button variant="destructive">`
9. **Lines 591-594** — "Back to Test Info" → `<Button variant="outline">`
10. **Lines 317-319** — Previous attempts buttons →
    `<Button variant="ghost" className="w-full text-left">`

#### `pages/LoginPage.tsx` (10 raw buttons)

1. **Line 167-173** — "Continue" submit →
   `<Button type="submit" className="w-full">`
2. **Line 177-184** — "Sign in as learner" link → `<Button variant="link">`
3. **Line 193-203** — "Change" school → `<Button variant="link" size="sm">`
4. **Line 213-224** — Roll Number tab → Use `<Tabs>` component (see 1.6)
5. **Line 227-240** — Email tab → Use `<Tabs>` component (see 1.6)
6. **Line 277-283** — "Sign In" submit →
   `<Button type="submit" className="w-full">`
7. **Line 327-333** — Consumer "Sign In" →
   `<Button type="submit" className="w-full">`
8. **Line 345-352** — Google sign-in →
   `<Button variant="outline" className="w-full">`
9. **Line 431-437** — "Create Account" →
   `<Button type="submit" className="w-full">`
10. All "Back to school" / "Create account" link-style buttons →
    `<Button variant="link">`

#### `pages/PracticeModePage.tsx` (5 raw buttons)

1. **Lines 151-161** — Difficulty filter pills → `<Badge>` with `cursor-pointer`
   or `<ToggleGroup>` from shared-ui
2. **Lines 174-186** — Question number grid buttons →
   `<Button variant="ghost" size="icon" className="h-8 w-8">`
3. **Lines 225-229** — "Previous" → `<Button variant="outline">`
4. **Lines 232-238** — "Next" → `<Button>`

#### `pages/LeaderboardPage.tsx` (0 raw buttons but 1 raw select — see 1.5)

#### `pages/StoreListPage.tsx` (3 raw buttons)

1. **Lines 218-224** — "Remove from Cart" →
   `<Button variant="outline" size="sm" className="w-full">`
2. **Lines 226-240** — "Add to Cart" → `<Button size="sm" className="w-full">`
3. **Lines 209-216** — "Continue Learning" →
   `<Button variant="secondary" size="sm" className="w-full" asChild><Link to="...">`

**Also:** Replace `<button>` in `ChatTutorPanel.tsx` (close, send),
`QuestionAnswerer.tsx`, `ExamResultPage.tsx`, `ConsumerDashboardPage.tsx`,
`CheckoutPage.tsx`, `ConsumerProfilePage.tsx`.

---

### 1.4 Replace Raw `<input>` with `<Input>` from shared-ui

**Issue:** C2 — ~15 instances of raw `<input>` elements **Complexity:** S

Import `{ Input }` from `@levelup/shared-ui` and replace.

#### `pages/LoginPage.tsx` (7 raw inputs)

All inputs currently replicate the shared-ui `Input` styles manually. Replace:

```tsx
// Before (line 156-164):
<input id="schoolCode" type="text" required value={schoolCode}
  onChange={(e) => setSchoolCode(e.target.value)} placeholder="Enter your school code"
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />

// After:
<Input id="schoolCode" type="text" required value={schoolCode}
  onChange={(e) => setSchoolCode(e.target.value)} placeholder="Enter your school code" />
```

Repeat for: `credential` (line 247-258), `password` (line 266-274),
`consumerEmail` (line 301-309), `consumerPassword` (line 316-324), `signupName`
(line 390-398), `signupEmail` (line 405-413), `signupPassword` (line 420-428).

#### `pages/StoreListPage.tsx` (1 raw input)

**Line 89-96** — Search input:

```tsx
// After:
<Input
  type="text"
  placeholder="Search spaces..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="pl-9"
/>
```

(Keep the Search icon positioning wrapper)

#### `components/chat/ChatTutorPanel.tsx` (1 raw input)

**Line 104-110:**

```tsx
// After:
<Input
  type="text"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
  placeholder="Ask the AI tutor..."
  className="flex-1"
/>
```

---

### 1.5 Replace Raw `<select>` with `<Select>` from shared-ui

**Issue:** C2 — 3 instances of raw `<select>` **Complexity:** S

#### `pages/LeaderboardPage.tsx` (line 140-153)

```tsx
// Before:
<select
  value={selectedSpaceId ?? ""}
  onChange={(e) => setSelectedSpaceId(e.target.value || null)}
  className="appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none"
>
  <option value="">Overall</option>
  {(spaces ?? []).map((space) => (
    <option key={space.id} value={space.id}>
      {space.title}
    </option>
  ))}
</select>;

// After:
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@levelup/shared-ui";

<Select
  value={selectedSpaceId ?? ""}
  onValueChange={(v) => setSelectedSpaceId(v || null)}
>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Overall" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Overall</SelectItem>
    {(spaces ?? []).map((space) => (
      <SelectItem key={space.id} value={space.id}>
        {space.title}
      </SelectItem>
    ))}
  </SelectContent>
</Select>;
```

#### `pages/StoreListPage.tsx` (line 98-108)

Same pattern. Replace `<select>` with `<Select>` component. Also note: subject
options are hardcoded (issue m4 — addressed in Phase 7).

---

### 1.6 Replace Custom Confirmation Dialog with `<AlertDialog>`

**Issue:** m7, C2 — Custom fixed overlay in TimedTestPage **File:**
`apps/student-web/src/pages/TimedTestPage.tsx` (lines 442-474) **Complexity:** S

```tsx
// Before (lines 442-474):
{
  showConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        ...
      </div>
    </div>
  );
}

// After:
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@levelup/shared-ui";

<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        Submit Test?
      </AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to submit? You cannot change your answers after
        submission.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="space-y-1 text-sm">
      <p>
        Answered: {answeredCount}/{questionOrder.length}
      </p>
      <p>Marked for review: {markedCount}</p>
      <p>Not answered: {unansweredCount}</p>
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleSubmitTest(false)}
        disabled={submitTest.isPending}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {submitTest.isPending ? "Submitting..." : "Submit"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

---

### 1.7 Replace Custom Tabs with `<Tabs>` from shared-ui

**Issue:** C2 — Custom tab implementations **Complexity:** S

#### `pages/ProgressPage.tsx` (lines 44-59)

```tsx
// Before:
<div className="flex gap-1 border-b">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === tab.id
          ? "border-primary text-primary"
          : "text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>;

// After:
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@levelup/shared-ui";

<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
  <TabsList>
    <TabsTrigger value="overall">Overall</TabsTrigger>
    <TabsTrigger value="exams">Exams</TabsTrigger>
    <TabsTrigger value="spaces">Spaces</TabsTrigger>
  </TabsList>
  <TabsContent value="overall">...</TabsContent>
  <TabsContent value="exams">...</TabsContent>
  <TabsContent value="spaces">...</TabsContent>
</Tabs>;
```

#### `pages/LoginPage.tsx` — Login method toggle (lines 212-241)

Replace the Roll Number / Email toggle with `<Tabs>`:

```tsx
<Tabs
  value={loginMethod}
  onValueChange={(v) => {
    setLoginMethod(v as LoginMethod);
    setCredential("");
  }}
>
  <TabsList className="w-full">
    <TabsTrigger value="roll-number" className="flex-1">
      Roll Number
    </TabsTrigger>
    <TabsTrigger value="email" className="flex-1">
      Email
    </TabsTrigger>
  </TabsList>
</Tabs>
```

---

### 1.8 Replace Raw `<table>` with `<Table>` from shared-ui

**Issue:** C2 — Raw HTML table **File:**
`apps/student-web/src/pages/ProgressPage.tsx` (lines 126-163) **Complexity:** S

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelup/shared-ui";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Exam</TableHead>
      <TableHead>Score</TableHead>
      <TableHead>Percentage</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {summary.autograde.recentExams.map((exam) => (
      <TableRow key={exam.examId}>
        <TableCell className="font-medium">{exam.examTitle}</TableCell>
        <TableCell className="text-muted-foreground">
          {exam.score.toFixed(2)}
        </TableCell>
        <TableCell>
          <span
            className={`font-medium ${exam.percentage >= 70 ? "text-green-600" : exam.percentage >= 40 ? "text-yellow-600" : "text-red-600"}`}
          >
            {Math.round(exam.percentage)}%
          </span>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>;
```

---

### 1.9 Replace ChatTutorPanel with `<Sheet>` from shared-ui

**Issue:** M6 — No focus trap, no ARIA, not responsive **File:**
`apps/student-web/src/components/chat/ChatTutorPanel.tsx` **Complexity:** M

Replace the entire `<div className="fixed inset-y-0 right-0 w-96 ...">` wrapper
with:

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@levelup/shared-ui';

<Sheet open={true} onOpenChange={(open) => !open && onClose()}>
  <SheetContent side="right" className="w-96 sm:max-w-md flex flex-col p-0">
    <SheetHeader className="border-b px-4 py-3">
      <SheetTitle className="flex items-center gap-2 text-sm">
        <Bot className="h-5 w-5 text-primary" />
        AI Tutor
      </SheetTitle>
    </SheetHeader>
    {/* Messages area */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* ... existing message rendering ... */}
    </div>
    {/* Input area */}
    <div className="border-t p-3">
      <div className="flex items-center gap-2">
        <Input type="text" value={input} ... />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </SheetContent>
</Sheet>
```

This gives us: focus trap, backdrop, ARIA `role="dialog"` + `aria-modal`,
keyboard dismiss (Escape), and proper z-index management — all for free.

**Additional changes needed at call sites:**

- `StoryPointViewerPage.tsx`: Replace conditional render with
  `<Sheet open={chatOpen}>`
- `PracticeModePage.tsx`: Same pattern
- `ChatTutorPage.tsx`: On this page, render as full-page chat instead of Sheet

---

## Phase 2: Accessibility

**Addresses:** C3 (Keyboard Navigation), C4 (ARIA Attributes) **Priority:**
Critical

### 2.1 Add ARIA Attributes to ProgressBar

**Issue:** C4 — Missing `role="progressbar"` and ARIA value attributes **File:**
`apps/student-web/src/components/common/ProgressBar.tsx` **Complexity:** S

```tsx
// Replace lines 41-45:
<div
  className={`bg-muted w-full rounded-full ${sizeMap[size]}`}
  role="progressbar"
  aria-valuenow={percentage}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={label ?? "Progress"}
>
  <div
    className={`rounded-full ${sizeMap[size]} ${colorMap[color]} transition-all duration-300`}
    style={{ width: `${Math.min(percentage, 100)}%` }}
  />
</div>
```

Also fix the track color: `bg-gray-200` → `bg-muted` (dark mode fix).

---

### 2.2 Add ARIA Attributes to CountdownTimer

**Issue:** C4 — No `role="timer"`, no `aria-live` **File:**
`apps/student-web/src/components/test/CountdownTimer.tsx` **Complexity:** S

```tsx
// Replace lines 40-59:
<div
  role="timer"
  aria-live="polite"
  aria-label={`Time remaining: ${hours > 0 ? `${hours} hours ` : ""}${minutes} minutes ${seconds} seconds`}
  className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-sm font-bold ${
    isCritical
      ? "bg-destructive/10 text-destructive animate-pulse"
      : isWarning
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-muted text-foreground"
  }`}
>
  {isCritical ? (
    <AlertTriangle className="h-4 w-4" />
  ) : (
    <Clock className="h-4 w-4" />
  )}
  <span>
    {hours > 0 && `${pad(hours)}:`}
    {pad(minutes)}:{pad(seconds)}
  </span>
</div>
```

---

### 2.3 Add ARIA Attributes to QuestionNavigator

**Issue:** C4 — No `aria-current`, no `aria-label` on buttons **File:**
`apps/student-web/src/components/test/QuestionNavigator.tsx` **Complexity:** S

```tsx
// Replace lines 42-52:
<button
  key={qId}
  onClick={() => onNavigate(index)}
  aria-label={`Question ${index + 1}: ${statusLabels[status]}`}
  aria-current={isCurrent ? "step" : undefined}
  className={`h-9 w-9 rounded text-xs font-medium transition-all ${statusColors[status]} ${
    isCurrent ? "ring-primary ring-2 ring-offset-1" : ""
  }`}
>
  {index + 1}
</button>
```

Also add `role="navigation" aria-label="Question navigator"` to the outer
`<div>`.

---

### 2.4 Add ARIA to Tab-like Interfaces

**Issue:** C4 — Tab groups lack ARIA roles **Complexity:** S

This is resolved by Phase 1.7 (replacing custom tabs with `<Tabs>` from
shared-ui which includes proper ARIA `role="tablist"`, `role="tab"`,
`aria-selected`).

---

### 2.5 Add Keyboard Navigation for Test Questions

**Issue:** C3 — No keyboard shortcuts in test **File:**
`apps/student-web/src/pages/TimedTestPage.tsx` **Complexity:** M

Add a `useEffect` keyboard handler in the test view section:

```tsx
// Add inside the test view (after line 347):
useEffect(() => {
  if (view !== "test") return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't interfere with input elements
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questionOrder.length - 1, prev + 1));
        break;
      case "m":
      case "M":
        e.preventDefault();
        handleMarkForReview();
        break;
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [view, questionOrder.length, handleMarkForReview]);
```

Add a keyboard shortcuts hint below the test controls bar:

```tsx
<p className="text-muted-foreground mt-2 text-xs">
  Keyboard: ← Previous · → Next · M Mark for Review
</p>
```

---

### 2.6 Add Focus Management

**Issue:** C3 — No auto-focus, no focus management on view transitions
**Complexity:** S

#### LoginPage — Auto-focus first input

Add `autoFocus` to the first input in each form view:

- Line 156: `<Input id="schoolCode" autoFocus ...`
- Line 247: `<Input id="credential" autoFocus ...`
- Line 301: `<Input id="consumerEmail" autoFocus ...`
- Line 390: `<Input id="signupName" autoFocus ...`

#### TimedTestPage — Focus question on navigation

```tsx
// After setCurrentIndex, focus the main content area:
const mainRef = useRef<HTMLDivElement>(null);
// On main element: <main ref={mainRef} ...>
// After navigation: mainRef.current?.focus();
```

#### Focus-visible rings

Audit all custom buttons and ensure they have
`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. The
`<Button>` component from shared-ui includes this by default — another reason
Phase 1.3 is critical.

---

### 2.7 Add Breadcrumb Semantics

**Issue:** C4 — Breadcrumbs lack `aria-label`, `<ol>/<li>` structure **Files:**
SpaceViewerPage, StoryPointViewerPage, TimedTestPage, PracticeModePage,
ExamResultPage **Complexity:** S

**Option A (recommended):** Use `<Breadcrumb>` from shared-ui if available.

**Option B:** Create a shared component at
`apps/student-web/src/components/common/Breadcrumb.tsx`:

```tsx
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground mb-2 text-xs">
      <ol className="flex items-center gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {item.href ? (
              <Link
                to={item.href}
                className="hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Then replace all inline breadcrumbs with:

```tsx
<Breadcrumb
  items={[
    { label: "Spaces", href: "/spaces" },
    { label: space?.title ?? "Space", href: `/spaces/${spaceId}` },
    { label: storyPoint?.title ?? "Test" },
  ]}
/>
```

---

### 2.8 Add `aria-live` to FeedbackPanel

**Issue:** C4 — Screen readers can't detect evaluation results **File:**
`apps/student-web/src/components/common/FeedbackPanel.tsx` **Complexity:** S

Add `aria-live="polite"` to the outer `<div>` on line 16:

```tsx
<div aria-live="polite" className={`mt-4 rounded-lg border p-4 ${...}`}>
```

---

## Phase 3: Mobile & Responsive Design

**Addresses:** M1 (No Mobile Layout), M6 (Chat Panel) **Priority:** Major

### 3.1 Mobile Layout for TimedTestPage

**Issue:** M1 — `flex gap-4` with fixed `w-52` sidebar doesn't collapse
**File:** `apps/student-web/src/pages/TimedTestPage.tsx` **Complexity:** L

**Changes:**

1. **Hide sidebar on mobile, show bottom sheet trigger:**

```tsx
// Replace line 368-377:
<div className="flex gap-4 h-[calc(100vh-4rem)]">
  {/* Left: Question Navigator — hidden on mobile */}
  <aside className="hidden lg:block w-52 flex-shrink-0 overflow-y-auto border-r pr-4">
    <QuestionNavigator ... />
  </aside>

  <main className="flex-1 min-w-0 overflow-y-auto">
    {/* Mobile question navigator trigger */}
    <div className="lg:hidden mb-3">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            Question {currentIndex + 1} of {questionOrder.length} — View All
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader>
            <SheetTitle>Questions</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <QuestionNavigator ... />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    ...
  </main>
</div>
```

2. **Stack controls on mobile:**

```tsx
// Replace line 399:
<div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
  {/* Primary actions */}
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
      disabled={currentIndex === 0}
      size="sm"
    >
      <ChevronLeft className="h-4 w-4" />{" "}
      <span className="hidden sm:inline">Previous</span>
    </Button>
    <Button
      onClick={handleSaveAndNext}
      disabled={currentIndex === questionOrder.length - 1}
      size="sm"
    >
      <span className="hidden sm:inline">Save &</span> Next{" "}
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>

  {/* Secondary actions — in dropdown on mobile */}
  <div className="hidden items-center gap-2 sm:flex">
    <Button variant="outline" size="sm" onClick={handleMarkForReview}>
      <Flag className="h-4 w-4" /> Mark
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={handleClearResponse}
      className="text-destructive"
    >
      <Trash2 className="h-4 w-4" /> Clear
    </Button>
  </div>
  <div className="sm:hidden">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          More
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleMarkForReview}>
          <Flag className="mr-2 h-4 w-4" /> Mark for Review
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleClearResponse}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Clear Response
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <div className="flex-1" />

  <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
    <Send className="h-4 w-4" />{" "}
    <span className="hidden sm:inline">Submit Test</span>
    <span className="sm:hidden">Submit</span>
  </Button>
</div>
```

3. **Fix timer bar for dark mode (M4):**

```tsx
// Line 382: Replace bg-white with bg-background
<div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 py-2 border-b">
```

---

### 3.2 Mobile Layout for StoryPointViewerPage

**Issue:** M1 — `flex gap-6` with `w-48` sidebar **File:**
`apps/student-web/src/pages/StoryPointViewerPage.tsx` **Complexity:** M

Replace the sidebar layout:

```tsx
// Hide sidebar on mobile, replace with a dropdown:
<div className="flex gap-6">
  {/* Desktop sidebar */}
  <aside className="hidden w-48 flex-shrink-0 lg:block">
    {/* section buttons */}
  </aside>

  {/* Mobile section picker */}
  <div className="mb-4 lg:hidden">
    <Select value={currentSection} onValueChange={setCurrentSection}>
      <SelectTrigger>
        <SelectValue placeholder="Select section" />
      </SelectTrigger>
      <SelectContent>
        {sections.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <main className="min-w-0 flex-1">{/* ... content ... */}</main>
</div>
```

---

### 3.3 Mobile ChatTutorPanel

**Issue:** M1, M6 — Fixed `w-96` overflows on mobile **Complexity:** Already
addressed in Phase 1.9

The `<Sheet>` replacement handles this. The sheet component automatically
adapts:

- Desktop: `w-96 sm:max-w-md` right-side panel
- Mobile: Full-width panel with proper backdrop

For `ChatTutorPage.tsx` (dedicated chat page), render an inline full-page chat
instead of the Sheet overlay.

---

### 3.4 Touch Target Audit

**Issue:** M1 — WCAG 2.5.5 minimum 44px touch targets **Complexity:** S

**Key files to fix:**

1. **`QuestionNavigator.tsx`** — Buttons are `h-9 w-9` (36px). Change to
   `h-10 w-10 sm:h-9 sm:w-9` for mobile-first sizing.

2. **`PracticeModePage.tsx`** — Question grid buttons are `h-8 w-8` (32px).
   Change to `h-10 w-10 sm:h-8 sm:w-8`.

3. **Close buttons** — ChatTutorPanel close button (line 51) has only `p-1`. Add
   `h-9 w-9` minimum.

---

## Phase 4: Error Handling & Loading States

**Addresses:** M2 (Silent Errors), M3 (Loading States), M5 (LoginPage refactor
partially) **Priority:** Major

### 4.1 Add Toast Notifications for Async Errors

**Issue:** M2 — 5+ empty `catch {}` blocks silently swallow errors
**Complexity:** M

**Step 1:** Set up Sonner toaster in the app root.

**File:** `apps/student-web/src/main.tsx`

```tsx
import { Toaster } from "@levelup/shared-ui"; // sonner integration

// Inside the render tree, after <App />:
<Toaster position="top-right" richColors />;
```

**Step 2:** Replace all empty catch blocks:

#### `pages/TimedTestPage.tsx`

**Line 157-159** (handleStartTest):

```tsx
// Before:
} catch {
  // Handle error
}

// After:
} catch (err) {
  toast.error('Failed to start test', {
    description: err instanceof Error ? err.message : 'You may have reached the maximum attempts.',
  });
}
```

**Line 232-234** (handleSubmitTest):

```tsx
} catch (err) {
  toast.error('Failed to submit test', {
    description: err instanceof Error ? err.message : 'Please try again.',
  });
}
```

#### `pages/PracticeModePage.tsx`

**Line 103-105** (handleSubmit):

```tsx
} catch (err) {
  toast.error('Failed to evaluate answer', {
    description: err instanceof Error ? err.message : 'Please try again.',
  });
}
```

**Line 68-69** (persistToRTDB):

```tsx
}).catch((err) => {
  toast.error('Failed to save practice progress');
});
```

#### `pages/StoryPointViewerPage.tsx`

Find the empty catch block and replace similarly.

#### `pages/LoginPage.tsx`

**Line 56-58** (handleSchoolCodeSubmit): Already handled — `setCodeError(...)`.

**Lines 70-72, 82-84, 92-94** (login handlers): Already handled — error set in
auth store. But add toast for unexpected errors.

---

### 4.2 Replace Text-Only Loading with Skeleton Components

**Issue:** M3 — Inconsistent/primitive loading states **Complexity:** M

**Step 1:** Import `Skeleton` from `@levelup/shared-ui`:

```tsx
import { Skeleton } from "@levelup/shared-ui";
```

**Step 2:** Create page-specific skeleton compositions.

#### `pages/ConsumerDashboardPage.tsx`

Replace `"Loading your spaces..."` text with:

```tsx
<div className="space-y-6">
  <div className="grid gap-4 sm:grid-cols-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-24 rounded-lg" />
    ))}
  </div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-48 rounded-lg" />
    ))}
  </div>
</div>
```

#### `pages/StoreListPage.tsx` (lines 112-115)

Replace `"Loading spaces..."` with:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {[1, 2, 3, 4, 5, 6].map((i) => (
    <div key={i} className="rounded-lg border">
      <Skeleton className="h-40 rounded-t-lg" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-2 h-8 w-full" />
      </div>
    </div>
  ))}
</div>
```

#### `pages/StoreDetailPage.tsx`

Replace `"Loading space details..."` with content-shaped skeletons matching the
hero + content layout.

#### `guards/RequireAuth.tsx`

Replace `"Loading..."` with a branded splash:

```tsx
<div className="flex h-screen items-center justify-center">
  <div className="text-center">
    <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
    <p className="text-muted-foreground text-sm">Loading...</p>
  </div>
</div>
```

#### All other skeleton replacements

Replace `<div className="h-24 animate-pulse rounded-lg border bg-gray-100" />`
pattern across all pages with:

```tsx
<Skeleton className="h-24 rounded-lg" />
```

Files: `DashboardPage.tsx`, `SpacesListPage.tsx`, `SpaceViewerPage.tsx`,
`StoryPointViewerPage.tsx`, `PracticeModePage.tsx`, `ProgressPage.tsx`,
`TestsPage.tsx`, `ChatTutorPage.tsx`, `ExamResultPage.tsx`.

---

### 4.3 Add Per-Section Error Boundaries

**Issue:** M2 — No section-level error recovery **Complexity:** S

Create `apps/student-web/src/components/common/SectionErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from "react";
import { Button } from "@levelup/shared-ui";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}
interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-6 text-center">
          <AlertTriangle className="text-destructive mx-auto mb-2 h-8 w-8" />
          <p className="text-sm font-medium">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap major page sections (dashboard cards, space lists, leaderboard table) with
this component.

---

## Phase 5: Component Refactoring

**Addresses:** M5 (LoginPage), m1 (Breadcrumbs), m2 (SpaceCard duplication), m3
(Consumer NotificationBell), m8 (Type assertions), m10 (Routing bug)
**Priority:** Major + Minor

### 5.1 Split LoginPage into Sub-Components

**Issue:** M5 — 460+ lines, ~30 state variables in single component **File:**
`apps/student-web/src/pages/LoginPage.tsx` **Complexity:** L

Create 4 new files under `apps/student-web/src/components/auth/`:

1. **`SchoolCodeForm.tsx`** — School code lookup (lines 143-185)
2. **`SchoolCredentialsForm.tsx`** — Roll number / email + password login (lines
   189-284)
3. **`ConsumerLoginForm.tsx`** — Consumer email login + Google OAuth (lines
   288-373)
4. **`ConsumerSignupForm.tsx`** — Consumer signup (lines 377-460)

**LoginPage.tsx becomes a thin orchestrator:**

```tsx
export default function LoginPage() {
  const [view, setView] = useState<View>("school-code");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");

  return (
    <div className="bg-card shadow-card rounded-lg border p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Student Portal</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sign in to start learning
        </p>
      </div>

      {view === "school-code" && (
        <SchoolCodeForm
          onCodeVerified={(code, name) => {
            setSchoolCode(code);
            setSchoolName(name);
            setView("credentials");
          }}
          onSwitchToConsumer={() => setView("consumer-login")}
        />
      )}
      {view === "credentials" && (
        <SchoolCredentialsForm
          schoolCode={schoolCode}
          schoolName={schoolName}
          onBack={() => setView("school-code")}
        />
      )}
      {view === "consumer-login" && (
        <ConsumerLoginForm
          onSwitchToSignup={() => setView("consumer-signup")}
          onSwitchToSchool={() => setView("school-code")}
        />
      )}
      {view === "consumer-signup" && (
        <ConsumerSignupForm
          onSwitchToLogin={() => setView("consumer-login")}
          onSwitchToSchool={() => setView("school-code")}
        />
      )}
    </div>
  );
}
```

Each sub-component manages its own form state. Use `<Input>`, `<Button>`,
`<Label>` from shared-ui internally.

**Future enhancement (not in scope now):** Add react-hook-form + Zod validation,
password visibility toggle, password strength meter, "Forgot Password" link.

---

### 5.2 Create Unified SpaceCard Component

**Issue:** m2 — 3 separate space card implementations **Files:** DashboardPage
(DashboardSpaceCard), SpacesListPage (SpaceCard), ProgressPage
(SpaceProgressCard) **Complexity:** M

Create `apps/student-web/src/components/common/SpaceCard.tsx`:

```tsx
import { Link } from "react-router-dom";
import { useProgress } from "@levelup/shared-hooks";
import ProgressBar from "./ProgressBar";
import { Card, CardContent } from "@levelup/shared-ui";
import { Badge } from "@levelup/shared-ui";
import { BookOpen, ChevronRight, Award } from "lucide-react";
import type { Space } from "@levelup/shared-types";

type SpaceCardVariant = "compact" | "full" | "progress";

interface SpaceCardProps {
  space: Space;
  tenantId: string;
  userId: string;
  variant?: SpaceCardVariant;
  linkPrefix?: string; // '/spaces' or '/consumer/spaces'
}

export function SpaceCard({
  space,
  tenantId,
  userId,
  variant = "full",
  linkPrefix = "/spaces",
}: SpaceCardProps) {
  const { data: progress } = useProgress(tenantId, userId, space.id);
  const percentage = progress?.percentage ?? 0;

  // Variant-specific rendering...
}
```

Then replace inline components in DashboardPage, SpacesListPage, and
ProgressPage with `<SpaceCard variant="..." />`.

---

### 5.3 Create Shared EmptyState Component

**Issue:** Inconsistent empty state patterns **Complexity:** S

Create `apps/student-web/src/components/common/EmptyState.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { Button } from "@levelup/shared-ui";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="bg-muted/30 rounded-lg border py-12 text-center">
      <Icon className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

Replace inline empty states across: DashboardPage, SpacesListPage,
SpaceViewerPage, LeaderboardPage, TestsPage, StoreListPage.

---

### 5.4 Add NotificationBell to ConsumerLayout

**Issue:** m3 — Consumer users have no notification indicator **File:**
`apps/student-web/src/layouts/ConsumerLayout.tsx` **Complexity:** S

Import and add `<NotificationBell>` in the header, same pattern as
`AppLayout.tsx`.

---

### 5.5 Fix Consumer Store Routing Bug

**Issue:** m10 — "Continue Learning" links to B2B route `/spaces/` instead of
`/consumer/spaces/` **File:** `apps/student-web/src/pages/StoreListPage.tsx`,
line 211 **Complexity:** S

```tsx
// Before (line 211):
<Link to={`/spaces/${space.id}`} ...>

// After:
<Link to={`/consumer/spaces/${space.id}`} ...>
```

---

### 5.6 Fix Type Assertions in DashboardPage

**Issue:** m8 — `(exam as any)` casts **File:**
`apps/student-web/src/pages/DashboardPage.tsx`, lines 50-61 **Complexity:** S

**Option A:** Fix the shared type definition in `@levelup/shared-types` to
include `scheduledAt` and `startDate` as optional `Timestamp` fields on the Exam
type.

**Option B (quick fix):** Create a local helper:

```tsx
function getExamTimestamp(exam: Exam): number | null {
  const ts =
    (exam as Record<string, any>).scheduledAt ??
    (exam as Record<string, any>).startDate;
  return ts?.seconds ? ts.seconds * 1000 : null;
}
```

Then replace all `(exam as any).scheduledAt?.seconds` patterns with
`getExamTimestamp(exam)`.

---

### 5.7 Rename "Download PDF" Button

**Issue:** m5 — "Download PDF" actually calls `window.print()` **File:**
`apps/student-web/src/pages/ExamResultPage.tsx` **Complexity:** S

Change button label from "Download PDF" to "Print Results" and update the icon
to `<Printer>` from Lucide.

---

### 5.8 Extract Inline Components to Separate Files

**Issue:** m2 — Multiple inline component definitions **Complexity:** S

Move these inline components to dedicated files:

| Current Location         | Inline Component     | New File Path                                 |
| ------------------------ | -------------------- | --------------------------------------------- |
| `DashboardPage.tsx:342`  | `DashboardSpaceCard` | (Replaced by unified SpaceCard — see 5.2)     |
| `ProgressPage.tsx:192`   | `SpaceProgressCard`  | (Replaced by unified SpaceCard — see 5.2)     |
| `LeaderboardPage.tsx:15` | `LeaderboardTable`   | `components/leaderboard/LeaderboardTable.tsx` |

---

## Phase 6: Interaction & Motion Design

**Addresses:** m6 (View transitions), general polish **Priority:** Minor

### 6.1 Add Button Loading Spinners

**Complexity:** S

The shared-ui `<Button>` can be composed with a spinner. Create a pattern:

```tsx
import { Loader2 } from "lucide-react";

<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isPending ? "Submitting..." : "Submit"}
</Button>;
```

Apply to all async action buttons:

- TimedTestPage: Start Test, Submit Test
- PracticeModePage: implicit via QuestionAnswerer
- LoginPage: All form submit buttons
- StoreListPage: Add to Cart
- CheckoutPage: Purchase buttons
- ChatTutorPanel: Send button

---

### 6.2 Add Toast Notifications for Success Actions

**Complexity:** S

Add `toast.success(...)` calls after successful operations:

```tsx
// TimedTestPage — after successful submission:
toast.success("Test submitted successfully!");

// PracticeModePage — when all questions solved:
toast.success("Amazing! You completed all questions!");

// CheckoutPage — after successful purchase:
toast.success("Purchase complete! Start learning now.");
```

---

### 6.3 Add View Transition Animations

**Issue:** m6 — No animation between test views **Complexity:** M

Add CSS transitions for view changes in TimedTestPage using Tailwind's
`animate-in` pattern:

```tsx
// Wrap each view in a fade-in container:
<div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
  {/* View content */}
</div>
```

This uses `tailwindcss-animate` which is already in the project's Tailwind
config.

---

### 6.4 Add Progress Bar Animation on Mount

**File:** `apps/student-web/src/components/common/ProgressBar.tsx`
**Complexity:** S

The progress bar already has `transition-all duration-300`. To animate on mount,
set initial width to 0 and animate:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

<div ... style={{ width: mounted ? `${Math.min(percentage, 100)}%` : '0%' }} />
```

---

## Phase 7: Gamification & Advanced Features

**Addresses:** m4 (Hardcoded subjects), m9 (Missing back navigation), plus
enhancement requests **Priority:** Minor / Nice-to-have

### 7.1 Add Missing Back Navigation

**Issue:** m9 — LeaderboardPage, TestsPage, ChatTutorPage lack breadcrumbs
**Complexity:** S

Add `<Breadcrumb>` component (from Phase 2.7) to:

- `LeaderboardPage.tsx`:
  `[{ label: 'Dashboard', href: '/' }, { label: 'Leaderboard' }]`
- `TestsPage.tsx`: `[{ label: 'Dashboard', href: '/' }, { label: 'Tests' }]`
- `ChatTutorPage.tsx`:
  `[{ label: 'Dashboard', href: '/' }, { label: 'AI Tutor' }]`

---

### 7.2 Dynamic Subject Filter for Store

**Issue:** m4 — Subject options hardcoded as `math`, `science`, `english`,
`history` **File:** `apps/student-web/src/pages/StoreListPage.tsx`, lines 99-108
**Complexity:** S

Extract subjects from the API response dynamically:

```tsx
const subjects = [...new Set(spaces.map((s) => s.subject).filter(Boolean))];

<Select value={subjectFilter} onValueChange={setSubjectFilter}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="All Subjects" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">All Subjects</SelectItem>
    {subjects.map((subject) => (
      <SelectItem key={subject} value={subject!}>
        {subject}
      </SelectItem>
    ))}
  </SelectContent>
</Select>;
```

---

### 7.3 Add Keyboard Shortcuts Info

**Complexity:** S

After implementing keyboard shortcuts (Phase 2.5), add a keyboard shortcut
reference accessible from the test view. Use a tooltip or small info icon that
shows available shortcuts.

---

### 7.4 Move "Chat Tutor" to "Learning" Sidebar Group

**Issue:** Audit navigation recommendation **File:**
`apps/student-web/src/layouts/AppLayout.tsx` **Complexity:** S

Move the "Chat Tutor" menu item from the "Community" group to the "Learning"
group, and rename to "AI Tutor".

---

## Cross-Cutting: Hardcoded Color Replacement Map

This is the complete, file-by-file list of hardcoded Tailwind color classes that
must be replaced with token-aware alternatives for dark mode support (C1).

### `components/common/ProgressBar.tsx`

| Line | Before          | After                                |
| ---- | --------------- | ------------------------------------ |
| 11   | `bg-blue-500`   | `bg-primary`                         |
| 12   | `bg-green-500`  | `bg-emerald-500 dark:bg-emerald-400` |
| 13   | `bg-orange-500` | `bg-amber-500 dark:bg-amber-400`     |
| 14   | `bg-red-500`    | `bg-destructive`                     |
| 41   | `bg-gray-200`   | `bg-muted`                           |

### `components/common/FeedbackPanel.tsx`

| Line  | Before                           | After                                     |
| ----- | -------------------------------- | ----------------------------------------- |
| 19    | `border-green-200 bg-green-50`   | `border-emerald-500/20 bg-emerald-500/10` |
| 21    | `border-yellow-200 bg-yellow-50` | `border-amber-500/20 bg-amber-500/10`     |
| 23    | `border-red-200 bg-red-50`       | `border-destructive/20 bg-destructive/10` |
| 24    | `border-gray-200 bg-gray-50`     | `border-border bg-muted/50`               |
| 44    | `bg-gray-200` (inner progress)   | `bg-muted`                                |
| 66-68 | `text-green-700`                 | `text-emerald-700 dark:text-emerald-400`  |
| 78-80 | `text-red-700`                   | `text-destructive`                        |
| 88-90 | `text-orange-700`                | `text-amber-700 dark:text-amber-400`      |

### `components/test/CountdownTimer.tsx`

| Line | Before                          | After                                                |
| ---- | ------------------------------- | ---------------------------------------------------- |
| 44   | `bg-red-100 text-red-700`       | `bg-destructive/10 text-destructive`                 |
| 46   | `bg-orange-100 text-orange-700` | `bg-amber-500/10 text-amber-700 dark:text-amber-400` |
| 47   | `bg-gray-100 text-gray-700`     | `bg-muted text-foreground`                           |

### `components/test/QuestionNavigator.tsx`

| Line | Before                      | After                                           |
| ---- | --------------------------- | ----------------------------------------------- |
| 11   | `bg-gray-300 text-gray-700` | `bg-muted text-muted-foreground`                |
| 12   | `bg-red-400 text-white`     | `bg-destructive text-destructive-foreground`    |
| 13   | `bg-green-500 text-white`   | `bg-emerald-500 text-white dark:bg-emerald-600` |
| 14   | `bg-orange-400 text-white`  | `bg-amber-500 text-white dark:bg-amber-600`     |
| 15   | `bg-purple-500 text-white`  | `bg-purple-500 text-white dark:bg-purple-600`   |

### `components/chat/ChatTutorPanel.tsx`

| Line | Before                              | After                                      |
| ---- | ----------------------------------- | ------------------------------------------ |
| 44   | `bg-white`                          | `bg-background` (or use Sheet — Phase 1.9) |
| 51   | `hover:bg-gray-100`                 | `hover:bg-accent`                          |
| 77   | `bg-blue-500 text-white`            | `bg-primary text-primary-foreground`       |
| 78   | `bg-gray-100 text-gray-900`         | `bg-muted text-foreground`                 |
| 92   | `bg-gray-100`                       | `bg-muted`                                 |
| 110  | `focus:border-blue-500`             | (use Input component — Phase 1.4)          |
| 115  | `bg-blue-500 ... hover:bg-blue-600` | `bg-primary hover:bg-primary/90`           |

### `pages/TimedTestPage.tsx`

| Line    | Before                                                     | After                                                                          |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 263     | `rounded bg-blue-50`                                       | `rounded bg-accent`                                                            |
| 264     | `text-blue-800`                                            | `text-accent-foreground`                                                       |
| 265     | `text-blue-700`                                            | `text-accent-foreground/80`                                                    |
| 299     | `bg-blue-500 ... hover:bg-blue-600`                        | `bg-primary hover:bg-primary/90`                                               |
| 382     | `bg-white`                                                 | `bg-background`                                                                |
| 403     | `hover:bg-gray-50`                                         | `hover:bg-accent`                                                              |
| 411     | `bg-blue-500 ... hover:bg-blue-600`                        | `bg-primary hover:bg-primary/90`                                               |
| 418     | `border-orange-300 ... text-orange-600 hover:bg-orange-50` | `border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10` |
| 425     | `text-red-600 hover:bg-red-50`                             | `text-destructive hover:bg-destructive/10`                                     |
| 434     | `bg-red-500 ... hover:bg-red-600`                          | `bg-destructive hover:bg-destructive/90 text-destructive-foreground`           |
| 443-444 | `bg-black/50`, `bg-white`                                  | (Replaced by AlertDialog — Phase 1.6)                                          |
| 460     | `hover:bg-gray-50`                                         | `hover:bg-accent`                                                              |
| 467     | `bg-red-500 ... hover:bg-red-600`                          | `bg-destructive hover:bg-destructive/90`                                       |
| 593     | `hover:bg-gray-50`                                         | `hover:bg-accent`                                                              |
| 599     | `bg-blue-500 ... hover:bg-blue-600`                        | `bg-primary hover:bg-primary/90 text-primary-foreground`                       |

### `pages/DashboardPage.tsx`

| Line | Before                            | After                                                      |
| ---- | --------------------------------- | ---------------------------------------------------------- |
| 127  | `bg-green-100 ... text-green-700` | `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400` |
| 141  | `bg-red-100 ... text-red-700`     | `bg-destructive/10 text-destructive`                       |
| 269  | `bg-orange-100`                   | `bg-amber-500/10`                                          |
| 308  | `text-blue-600`                   | `text-primary`                                             |
| 317  | `bg-gray-100`                     | (use `<Skeleton>` — Phase 4.2)                             |
| 321  | `bg-gray-50`                      | `bg-muted/50`                                              |
| 322  | `text-gray-300`                   | `text-muted-foreground/50`                                 |

### `pages/PracticeModePage.tsx`

| Line    | Before                                                                   | After                                                                                   |
| ------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 109     | `bg-gray-100`                                                            | (use `<Skeleton>` — Phase 4.2)                                                          |
| 155-157 | `bg-blue-500 text-white` / `bg-gray-100 text-gray-600 hover:bg-gray-200` | `bg-primary text-primary-foreground` / `bg-muted text-muted-foreground hover:bg-accent` |
| 179-183 | `bg-green-500`, `bg-red-400`, `bg-gray-200 text-gray-600`                | `bg-emerald-500`, `bg-destructive`, `bg-muted text-muted-foreground`                    |
| 228     | `hover:bg-gray-50`                                                       | `hover:bg-accent`                                                                       |
| 235     | `bg-blue-500 ... hover:bg-blue-600`                                      | `bg-primary hover:bg-primary/90 text-primary-foreground`                                |

### `pages/LeaderboardPage.tsx`

| Line | Before          | After                                    |
| ---- | --------------- | ---------------------------------------- |
| 25   | `text-gray-300` | `text-muted-foreground/50`               |
| 39   | `bg-blue-50`    | `bg-primary/5`                           |
| 56   | `text-blue-700` | `text-primary`                           |
| 59   | `text-blue-500` | `text-primary/80`                        |
| 143  | `bg-white`      | `bg-background` (use Select — Phase 1.5) |
| 169  | `bg-gray-100`   | (use `<Skeleton>` — Phase 4.2)           |

### `pages/ProgressPage.tsx`

| Line    | Before                                                                                  | After                                                                                                                      |
| ------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 31      | `bg-gray-100`                                                                           | (use `<Skeleton>` — Phase 4.2)                                                                                             |
| 222-225 | `bg-green-100 text-green-700`, `bg-blue-100 text-blue-700`, `bg-gray-100 text-gray-600` | `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`, `bg-primary/10 text-primary`, `bg-muted text-muted-foreground` |

### `pages/StoreListPage.tsx`

| Line | Before          | After                      |
| ---- | --------------- | -------------------------- |
| 101  | `bg-background` | Already token-aware (keep) |

### `pages/ExamResultPage.tsx`

Audit for hardcoded colors in grade badges and feedback sections. Replace
`bg-green-*`, `bg-red-*`, `bg-orange-*` with token-aware variants following the
pattern above.

---

## Implementation Dependencies

```
Phase 1.1 (Dark Mode CSS) ─────┐
Phase 1.2 (Color Replacement) ──┤── Must happen together (colors reference dark theme vars)
                                 │
Phase 1.3 (Button) ──────────────┤
Phase 1.4 (Input) ───────────────┤
Phase 1.5 (Select) ──────────────┤── Can be done in parallel
Phase 1.6 (AlertDialog) ─────────┤
Phase 1.7 (Tabs) ────────────────┤
Phase 1.8 (Table) ───────────────┤
Phase 1.9 (Sheet) ───────────────┘
                                 │
Phase 2 (Accessibility) ─────────┤── Depends on Phase 1 (components have built-in ARIA)
                                 │
Phase 3 (Mobile) ────────────────┤── Depends on Phase 1 (uses Sheet, DropdownMenu, etc.)
                                 │
Phase 4 (Error/Loading) ─────────┤── Independent, can start in parallel with Phase 2-3
                                 │
Phase 5 (Refactoring) ───────────┤── Depends on Phase 1 (sub-components use shared-ui)
                                 │
Phase 6 (Motion) ────────────────┤── Depends on Phase 1-2 (animate on new components)
                                 │
Phase 7 (Advanced) ──────────────┘── Independent, lowest priority
```

---

## Complexity Summary

| Phase                  | Items   | Total Complexity                    |
| ---------------------- | ------- | ----------------------------------- |
| Phase 1: Design System | 9 tasks | 1S + 1L + 4S + 1M + 2S = **L**      |
| Phase 2: Accessibility | 8 tasks | 6S + 1M + 1S = **M**                |
| Phase 3: Mobile        | 4 tasks | 1L + 1M + already done + 1S = **L** |
| Phase 4: Error/Loading | 3 tasks | 2M + 1S = **M**                     |
| Phase 5: Refactoring   | 8 tasks | 1L + 1M + 6S = **L**                |
| Phase 6: Motion        | 4 tasks | 4S = **S**                          |
| Phase 7: Advanced      | 4 tasks | 4S = **S**                          |

**Estimated total: ~40 individual changes across 7 phases**

---

## Verification Checklist

After implementation, verify:

- [ ] Dark mode toggle works and all pages render correctly in both themes
- [ ] No hardcoded Tailwind color classes remain (search for `bg-gray-`,
      `bg-white`, `bg-blue-50`, etc.)
- [ ] All interactive elements use shared-ui components (Button, Input, Select,
      Dialog, etc.)
- [ ] All `<button>` tags come from shared-ui `<Button>` or have ARIA attributes
- [ ] Keyboard navigation works in timed test (arrow keys, M for mark)
- [ ] Screen reader announces: progress bars, timer, question status,
      breadcrumbs
- [ ] TimedTestPage works on 375px width (iPhone SE)
- [ ] ChatTutorPanel works on mobile (Sheet with backdrop)
- [ ] No empty `catch {}` blocks remain
- [ ] All loading states use Skeleton components
- [ ] Toast notifications appear for errors and success actions
- [ ] Consumer store "Continue Learning" links to `/consumer/spaces/`
- [ ] No `(exam as any)` type assertions remain
