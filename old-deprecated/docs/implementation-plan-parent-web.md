# Implementation Plan: Parent-Web UI/UX Fixes

**Based on:** [UI/UX Audit Report](/docs/ui-ux-audit-parent-web.md) **Created:**
2026-03-05 **App:** `apps/parent-web/` **Total Source Files:** ~2,536 lines
across 14 files

---

## Table of Contents

1. [Phase 1: Critical Fixes (P0)](#phase-1-critical-fixes-p0)
2. [Phase 2: Major Improvements (P1)](#phase-2-major-improvements-p1)
3. [Phase 3: Polish & Accessibility (P2)](#phase-3-polish--accessibility-p2)
4. [Phase 4: Advanced Features (P3)](#phase-4-advanced-features-p3)
5. [New Files to Create](#new-files-to-create)
6. [Dependency Graph](#dependency-graph)

---

## Phase 1: Critical Fixes (P0)

### 1.1 Add Dark Mode Support

**Audit Issues:** #1 (Critical), CP-05, CP-06, ER-07 **Complexity:** S **Files
to modify:** `src/index.css`

**What to do:** Add the `.dark` class block with dark mode HSL variables to
`src/index.css`. Copy the exact dark mode variables from the admin-web reference
(`apps/admin-web/src/index.css:39-69`), plus add semantic color variables for
success/warning/info states.

```css
/* Add after the :root block (after line 37) */
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

Also add semantic success/warning/info variables to both `:root` and `.dark`:

```css
/* In :root */
--success: 142 76% 36%;
--success-foreground: 355 7% 97%;
--warning: 38 92% 50%;
--warning-foreground: 48 96% 89%;
--info: 221.2 83.2% 53.3%;
--info-foreground: 210 40% 98%;

/* In .dark */
--success: 142 71% 45%;
--success-foreground: 144 61% 20%;
--warning: 48 96% 53%;
--warning-foreground: 36 45% 15%;
--info: 217.2 91.2% 59.8%;
--info-foreground: 222.2 47.4% 11.2%;
```

---

### 1.2 Redesign Login Page with Shared-UI Components

**Audit Issues:** L-01 (Critical), L-02 (Critical), L-03, L-04, L-05, L-06, L-07
**Complexity:** M **Files to modify:** `src/pages/LoginPage.tsx`

**What to do:** Complete rewrite of LoginPage.tsx using shared-ui components.

**Step-by-step changes:**

1. **Add imports** at top of file:

```tsx
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@levelup/shared-ui";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { sendPasswordResetEmail, getAuth } from "firebase/auth";
```

2. **Add state for password visibility and forgot password:**

```tsx
const [showPassword, setShowPassword] = useState(false);
const [forgotLoading, setForgotLoading] = useState(false);
const [forgotMessage, setForgotMessage] = useState("");
```

3. **Add forgot password handler:**

```tsx
const handleForgotPassword = async () => {
  if (!email) {
    // Show error asking for email first
    return;
  }
  setForgotLoading(true);
  try {
    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);
    setForgotMessage("Password reset email sent. Check your inbox.");
  } catch {
    setForgotMessage("Failed to send reset email. Please try again.");
  } finally {
    setForgotLoading(false);
  }
};
```

4. **Replace the outer `<div>` wrapper** (line 63) with:

```tsx
<Card className="w-full">
  <CardHeader className="text-center">
    <CardTitle className="text-2xl">Parent Portal</CardTitle>
    <CardDescription>Sign in to view your child's progress</CardDescription>
  </CardHeader>
  <CardContent>{/* form content */}</CardContent>
</Card>
```

5. **Replace ALL raw `<input>` elements** (lines 83-91, 129-137, 144-152) with:

```tsx
<Input
  id="schoolCode"
  type="text"
  required
  value={schoolCode}
  onChange={(e) => setSchoolCode(e.target.value)}
  placeholder="Enter your school code"
/>
```

6. **Replace ALL raw `<label>` elements** (lines 80-82, 126-128, 141-143) with:

```tsx
<Label htmlFor="schoolCode">School Code</Label>
```

7. **Replace ALL raw `<button>` elements** (lines 94-100, 106-116, 155-161)
   with:

```tsx
<Button type="submit" className="w-full" disabled={codeLoading}>
  {codeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {codeLoading ? "Validating..." : "Continue"}
</Button>
```

8. **Add password visibility toggle** to password field:

```tsx
<div className="relative">
  <Input
    id="password"
    type={showPassword ? "text" : "password"}
    required
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="Enter your password"
  />
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className="absolute right-0 top-0 h-full px-3"
    onClick={() => setShowPassword(!showPassword)}
  >
    {showPassword ? (
      <EyeOff className="h-4 w-4" />
    ) : (
      <Eye className="h-4 w-4" />
    )}
  </Button>
</div>
```

9. **Add forgot password link** after password field:

```tsx
<div className="flex justify-end">
  <Button
    type="button"
    variant="link"
    size="sm"
    className="px-0 text-xs"
    onClick={handleForgotPassword}
    disabled={forgotLoading}
  >
    Forgot password?
  </Button>
</div>
```

10. **Improve error messages** with icon and `aria-describedby`:

```tsx
{
  codeError && (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      {codeError}
    </div>
  );
}
```

---

### 1.3 Fix Child Display Names Across All Pages

**Audit Issues:** #4 (Critical), D-02, D-03, C-01, CP-01, CP-02 **Complexity:**
M **Files to modify:**

- `src/hooks/useStudentNames.ts` (NEW — extract from SpaceProgressPage)
- `src/pages/DashboardPage.tsx` (lines 189-194)
- `src/pages/ChildrenPage.tsx` (lines 62, 65-67)
- `src/pages/ChildProgressPage.tsx` (lines 72-74, 108-111)
- `src/pages/SpaceProgressPage.tsx` (lines 44-69 — remove inline hook)

**Step-by-step changes:**

1. **Create `src/hooks/useStudentNames.ts`** — extract from
   `SpaceProgressPage.tsx:44-69`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { UnifiedUser } from "@levelup/shared-types";

export function useStudentNames(tenantId: string | null, studentIds: string[]) {
  return useQuery<Record<string, string>>({
    queryKey: ["tenants", tenantId, "studentNames", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return {};
      const { db } = getFirebaseServices();
      const names: Record<string, string> = {};
      await Promise.all(
        studentIds.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const u = snap.data() as UnifiedUser;
              names[uid] = u.displayName || u.email || uid.slice(0, 8);
            }
          } catch {
            // fallback handled by caller
          }
        })
      );
      return names;
    },
    enabled: studentIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
```

2. **Create `src/lib/helpers.ts`** — utility for name initials:

```tsx
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getStudentDisplayName(
  studentNames: Record<string, string> | undefined,
  student: { uid: string; studentId?: string },
  fallbackIndex?: number
): string {
  return (
    studentNames?.[student.uid] ||
    student.studentId ||
    (fallbackIndex != null ? `Child ${fallbackIndex + 1}` : "Student")
  );
}
```

3. **DashboardPage.tsx** — Add hook and replace display logic:

Add imports:

```tsx
import { useStudentNames } from "../hooks/useStudentNames";
import { getInitials, getStudentDisplayName } from "../lib/helpers";
```

After `const summaryResults = ...` (line 38), add:

```tsx
const { data: studentNames } = useStudentNames(tenantId, studentIds);
```

Replace line 190 (avatar):

```tsx
// Before: {(student.studentId || student.uid).slice(0, 2).toUpperCase()}
// After:
{
  getInitials(getStudentDisplayName(studentNames, student, idx));
}
```

Replace line 194 (name):

```tsx
// Before: {student.studentId || `Child ${idx + 1}`}
// After:
{
  getStudentDisplayName(studentNames, student, idx);
}
```

4. **ChildrenPage.tsx** — Same pattern:

Add imports:

```tsx
import { useStudentNames } from "../hooks/useStudentNames";
import { getInitials, getStudentDisplayName } from "../lib/helpers";
```

After `const summaries = ...` (line 19), add:

```tsx
const { data: studentNames } = useStudentNames(tenantId, studentIds);
```

Replace line 62 (avatar) and line 66 (name) with helper calls.

5. **ChildProgressPage.tsx** — Same pattern:

Add the hook after summaries calculation. Replace:

- Line 72-74 (page title):
  `{getStudentDisplayName(studentNames, selectedStudent)}` instead of
  `selectedStudent.studentId || selectedStudent.uid.slice(0, 8)`
- Line 108-111 (selector): Replace avatar
  `student.uid.slice(0, 2).toUpperCase()` and name `student.studentId || \`Child
  ${idx + 1}\``

6. **SpaceProgressPage.tsx** — Remove inline `useStudentNames` (lines 44-69),
   import from hook file instead.

---

### 1.4 Add Mobile Optimization Foundation

**Audit Issues:** #5 (Critical), Mobile section **Complexity:** M **Files to
modify:**

- `src/layouts/AppLayout.tsx` (add bottom nav)
- `src/pages/DashboardPage.tsx` (responsive grids)
- `src/pages/ChildProgressPage.tsx` (responsive grids)
- `src/components/MobileBottomNav.tsx` (NEW)

**Step-by-step changes:**

1. **Create `src/components/MobileBottomNav.tsx`:**

```tsx
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, ClipboardList, Bell } from "lucide-react";
import { cn } from "../lib/utils";

interface NavTabProps {
  icon: React.ElementType;
  label: string;
  to: string;
  badge?: number;
  isActive: boolean;
}

function NavTab({ icon: Icon, label, to, badge, isActive }: NavTabProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1 text-xs",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <div className="relative">
        <Icon className="h-5 w-5" />
        {badge != null && badge > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span>{label}</span>
    </Link>
  );
}

interface MobileBottomNavProps {
  unreadCount?: number;
}

export function MobileBottomNav({ unreadCount }: MobileBottomNavProps) {
  const location = useLocation();

  return (
    <nav className="bg-background fixed bottom-0 left-0 right-0 z-50 border-t md:hidden">
      <div className="flex h-14 items-center justify-around">
        <NavTab
          icon={LayoutDashboard}
          label="Home"
          to="/"
          isActive={location.pathname === "/"}
        />
        <NavTab
          icon={Users}
          label="Children"
          to="/children"
          isActive={location.pathname.startsWith("/children")}
        />
        <NavTab
          icon={ClipboardList}
          label="Results"
          to="/results"
          isActive={location.pathname.startsWith("/results")}
        />
        <NavTab
          icon={Bell}
          label="Alerts"
          to="/notifications"
          badge={unreadCount}
          isActive={location.pathname.startsWith("/notifications")}
        />
      </div>
    </nav>
  );
}
```

2. **AppLayout.tsx** — Add bottom nav:

Add import:

```tsx
import { MobileBottomNav } from "../components/MobileBottomNav";
```

Update the return JSX (after line 173):

```tsx
return (
  <>
    <AppShell sidebar={sidebar} headerRight={headerRight}>
      <div className="pb-16 md:pb-0">
        {" "}
        {/* Add bottom padding for mobile nav */}
        <Outlet />
      </div>
    </AppShell>
    <MobileBottomNav unreadCount={unreadCount} />
  </>
);
```

3. **DashboardPage.tsx** — Add `sm:grid-cols-2` to ScoreCards grid (line 66):

```tsx
// Before: "grid gap-4 md:grid-cols-2 lg:grid-cols-4"
// After:  "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
```

4. **ChildProgressPage.tsx** — Fix 5-column grid (line 120):

```tsx
// Before: "grid gap-4 md:grid-cols-2 lg:grid-cols-5"
// After:  "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
```

Add horizontal scroll for child selector (lines 96-114):

```tsx
// Before: <div className="flex gap-2">
// After:  <div className="flex gap-2 overflow-x-auto pb-1">
```

---

## Phase 2: Major Improvements (P1)

### 2.1 Remove Redundant LogoutButton from Dashboard

**Audit Issues:** D-01, #11 **Complexity:** S **Files to modify:**
`src/pages/DashboardPage.tsx`

**What to do:** Remove the LogoutButton and its imports from DashboardPage.

1. Remove `LogoutButton` from the shared-ui import (line 13).
2. Remove `useAuthStore` import and `const { logout } = useAuthStore()` (lines
   28).
3. Replace the header section (lines 50-63) with:

```tsx
<div>
  <h1 className="text-2xl font-bold">Parent Dashboard</h1>
  <p className="text-muted-foreground text-sm">
    Welcome back, {user?.displayName || user?.email || "Parent"}
  </p>
</div>
```

---

### 2.2 Extract All Inline Hooks

**Audit Issues:** #8 (Major), ER-01, SP-01, S-05 **Complexity:** M **New files
to create:**

| Source File                   | Inline Hook                      | New File                                      |
| ----------------------------- | -------------------------------- | --------------------------------------------- |
| `ExamResultsPage.tsx:31-100`  | `useChildSubmissions`            | `src/hooks/useChildSubmissions.ts`            |
| `ExamResultsPage.tsx:102-121` | `useQuestionSubmissions`         | `src/hooks/useQuestionSubmissions.ts`         |
| `SpaceProgressPage.tsx:16-42` | `useChildProgress`               | `src/hooks/useChildProgress.ts`               |
| `SpaceProgressPage.tsx:44-69` | `useStudentNames`                | `src/hooks/useStudentNames.ts` (done in 1.3)  |
| `SpaceProgressPage.tsx:71-96` | `useSpaceNames`                  | `src/hooks/useSpaceNames.ts`                  |
| `SettingsPage.tsx:36-52`      | `useNotificationPreferences`     | `src/hooks/useNotificationPreferences.ts`     |
| `SettingsPage.tsx:54-81`      | `useSaveNotificationPreferences` | `src/hooks/useSaveNotificationPreferences.ts` |
| `AppLayout.tsx:25-49`         | `useTenantNames`                 | `src/hooks/useTenantNames.ts`                 |

**For each hook:**

1. Cut the function from the source file
2. Create new file in `src/hooks/` with proper imports
3. Export the hook as a named export
4. Update the source file to import from the new location
5. Ensure all type imports (from `@levelup/shared-types`, firebase) are included
   in the new file

**Example for `useChildSubmissions`:**

Create `src/hooks/useChildSubmissions.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  documentId,
} from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Submission, Exam } from "@levelup/shared-types";

export function useChildSubmissions(
  tenantId: string | null,
  studentIds: string[] | undefined
) {
  // ... paste lines 35-99 from ExamResultsPage.tsx
}
```

Then in `ExamResultsPage.tsx`, replace with:

```tsx
import { useChildSubmissions } from "../hooks/useChildSubmissions";
```

Remove the corresponding firebase/firestore imports that were only used by the
hook.

---

### 2.3 Extract QuestionFeedbackSection Component

**Audit Issues:** ER-01 **Complexity:** S **Files to modify:**
`src/pages/ExamResultsPage.tsx` **New file:**
`src/components/QuestionFeedbackSection.tsx`

**What to do:**

1. Move lines 123-280 from `ExamResultsPage.tsx` to
   `src/components/QuestionFeedbackSection.tsx`
2. Move `useQuestionSubmissions` import reference
3. Include all necessary imports (lucide icons, types)
4. Import the component in ExamResultsPage.tsx

---

### 2.4 Replace Custom Accordion with shadcn Accordion

**Audit Issues:** #12, ER-05 **Complexity:** M **Files to modify:**
`src/pages/ExamResultsPage.tsx`

**What to do:**

1. Replace `expandedId` state management with shadcn `Accordion`:

Add import:

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@levelup/shared-ui";
```

Remove `ChevronDown` and `ChevronRight` icon imports. Remove
`const [expandedId, setExpandedId] = useState<string | null>(null);` (line 291).

2. Replace the submissions list (lines 342-507) with:

```tsx
<Accordion type="single" collapsible className="space-y-3">
  {filtered.map((sub) => (
    <AccordionItem
      key={sub.id}
      value={sub.id}
      className="bg-card rounded-lg border"
    >
      <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
        {/* Keep existing trigger content (lines 357-396) */}
      </AccordionTrigger>

      {/* Score bar outside accordion trigger */}
      {sub.summary?.percentage != null && (
        <div className="px-4 pb-2">{/* existing score bar */}</div>
      )}

      <AccordionContent className="space-y-4 border-t px-4 py-4">
        {/* Keep existing expanded content (lines 422-501) */}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

This gives us keyboard navigation (Enter/Space to toggle, Arrow keys), proper
ARIA attributes, and smooth expand/collapse animation for free.

---

### 2.5 Replace Hardcoded Color Classes with Semantic Tokens

**Audit Issues:** #10 (Major), CP-05, CP-06, ER-07, C-05 **Complexity:** M
**Files to modify:** All page files

**Comprehensive replacement map:**

| Current (Hardcoded)                            | Replacement (Semantic)                                    | Used In                                            |
| ---------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `bg-green-100 text-green-700`                  | `bg-success/10 text-success`                              | DashboardPage:199, ChildrenPage:71                 |
| `bg-gray-100 text-gray-600`                    | `bg-muted text-muted-foreground`                          | DashboardPage:201, ChildrenPage:73                 |
| `text-green-600`                               | `text-success`                                            | DashboardPage:269, ChildrenPage:159, many more     |
| `text-yellow-600`                              | `text-warning`                                            | DashboardPage:271, ChildrenPage:161                |
| `text-red-600`                                 | `text-destructive`                                        | DashboardPage:273, ChildrenPage:163                |
| `bg-green-500`                                 | `bg-success`                                              | ChildProgressPage:302, ExamResultsPage:406         |
| `bg-yellow-500`                                | `bg-warning`                                              | ChildProgressPage:304, ExamResultsPage:408         |
| `bg-red-500`                                   | `bg-destructive`                                          | ChildProgressPage:306, ExamResultsPage:410         |
| `border-red-200 bg-red-50 text-red-800/700`    | `border-destructive/20 bg-destructive/5 text-destructive` | ChildProgressPage:150-161                          |
| `border-blue-200 bg-blue-50 text-blue-800/700` | `border-info/20 bg-info/5 text-info`                      | ChildProgressPage:205-250, ExamResultsPage:473-500 |
| `text-green-700` / `bg-green-100`              | `text-success` / `bg-success/10`                          | ChildProgressPage:169-179                          |
| `text-orange-700` / `bg-orange-100`            | `text-warning` / `bg-warning/10`                          | ChildProgressPage:186-196                          |
| `text-blue-500`                                | `text-info`                                               | DashboardPage:107                                  |
| `text-green-500`                               | `text-success`                                            | DashboardPage:118                                  |
| `text-purple-500`                              | `text-primary`                                            | DashboardPage:130                                  |
| `bg-blue-100 text-blue-700`                    | `bg-info/10 text-info`                                    | SpaceProgressPage:100                              |
| `bg-green-100 text-green-700`                  | `bg-success/10 text-success`                              | SpaceProgressPage:101                              |
| `bg-gray-100 text-gray-600`                    | `bg-muted text-muted-foreground`                          | SpaceProgressPage:99                               |

**To support this**, add Tailwind config mappings in `tailwind.config.ts` or
rely on the CSS variables added in 1.1. The `success`, `warning`, and `info`
tokens must be added to the Tailwind config to generate utility classes:

Check if `packages/tailwind-config/theme.js` already maps these. If not, add in
`apps/parent-web/tailwind.config.ts`:

```js
theme: {
  extend: {
    colors: {
      success: "hsl(var(--success))",
      "success-foreground": "hsl(var(--success-foreground))",
      warning: "hsl(var(--warning))",
      "warning-foreground": "hsl(var(--warning-foreground))",
      info: "hsl(var(--info))",
      "info-foreground": "hsl(var(--info-foreground))",
    }
  }
}
```

---

### 2.6 Replace Raw HTML Elements with Shared-UI Components

**Audit Issues:** ER-04, L-01 **Complexity:** S **Files to modify:**
`src/pages/ExamResultsPage.tsx`

**What to do:**

1. **Search input** (lines 315-321): Replace raw `<input>` with shared-ui
   `Input`:

```tsx
import { Input } from "@levelup/shared-ui";

<div className="relative max-w-md">
  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
  <Input
    type="text"
    placeholder="Search by student name, exam, or subject..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9"
  />
</div>;
```

---

### 2.7 Fix School Code Fallback Display

**Audit Issues:** D-05 **Complexity:** S **Files to modify:**
`src/pages/DashboardPage.tsx`

Replace line 79:

```tsx
// Before:
value={membership?.tenantCode || tenantId?.slice(0, 12) || "--"}
// After:
value={membership?.tenantCode || "--"}
```

Never show raw Firebase document IDs to parents.

---

### 2.8 Hide Pipeline Status from Parents

**Audit Issues:** ER-06 **Complexity:** S **Files to modify:**
`src/pages/ExamResultsPage.tsx`

Replace the "Status" grid cell (lines 439-444) with a parent-friendly label:

```tsx
<div className="bg-muted/50 rounded p-3 text-center">
  <p className="text-muted-foreground text-xs">Status</p>
  <p className="text-sm font-medium capitalize">
    {sub.pipelineStatus === "completed"
      ? "Graded"
      : sub.pipelineStatus === "grading"
        ? "Being reviewed"
        : "Processing"}
  </p>
</div>
```

---

### 2.9 Remove Redundant School Code Metric from Children Page

**Audit Issues:** C-04 **Complexity:** S **Files to modify:**
`src/pages/ChildrenPage.tsx`

Delete lines 131-138 (the "School Code" metric card) from the 4-metric grid.
Change grid from `md:grid-cols-4` to `md:grid-cols-3` (line 97).

---

### 2.10 Add Notifications to Sidebar

**Audit Issues:** Navigation #4 **Complexity:** S **Files to modify:**
`src/layouts/AppLayout.tsx`

Add to the `navGroups` array, in the "Account" group (before Settings):

```tsx
{
  title: "Notifications",
  url: "/notifications",
  icon: Bell,
  isActive: location.pathname.startsWith("/notifications"),
  badge: unreadCount > 0 ? unreadCount : undefined,
},
```

Import `Bell` from lucide-react (add to existing import).

---

### 2.11 Fix LogoutButton Styling in Settings

**Audit Issues:** S-02 **Complexity:** S **Files to modify:**
`src/pages/SettingsPage.tsx`

Replace the massive inline className (lines 277-283):

```tsx
// Before:
<LogoutButton
  onLogout={logout}
  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
>
  <LogOut className="mr-2 h-4 w-4" />
  Sign Out
</LogoutButton>

// After — use Button variant styling via className shorthand:
<LogoutButton onLogout={logout}>
  Sign Out
</LogoutButton>
```

The `LogoutButton` component from shared-ui already renders a `Button`
internally with default styling. If it doesn't support variant props, just
remove the custom className entirely and let it use defaults.

---

## Phase 3: Polish & Accessibility (P2)

### 3.1 Proper Skeleton Loading States

**Audit Issues:** #13, D-06, SP-02, CP-07 **Complexity:** M **New file:**
`src/components/skeletons.tsx` **Files to modify:** `DashboardPage.tsx`,
`ChildrenPage.tsx`, `ChildProgressPage.tsx`, `SpaceProgressPage.tsx`,
`SettingsPage.tsx`

**Create `src/components/skeletons.tsx`:**

```tsx
import { Skeleton } from "@levelup/shared-ui";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* ScoreCards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Quick Actions */}
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      {/* Children Grid */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChildrenSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChildProgressSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
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

export function SpaceProgressSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-36 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsPrefsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}
```

**Update each page** to import and use the appropriate skeleton:

- `DashboardPage.tsx:157-165` → `<DashboardSkeleton />`
- `ChildrenPage.tsx:31-37` → `<ChildrenSkeleton />`
- `ChildProgressPage.tsx:81-84` → `<ChildProgressSkeleton />`
- `SpaceProgressPage.tsx:149-152` → `<SpaceProgressSkeleton />`
- `SettingsPage.tsx:187-190` → `<SettingsPrefsSkeleton />`

---

### 3.2 Use Badge Component for Status Badges

**Audit Issues:** #14 **Complexity:** S **Files to modify:**
`DashboardPage.tsx`, `ChildrenPage.tsx`, `SpaceProgressPage.tsx`

Replace all hardcoded status badge spans with the shared-ui `Badge` component:

```tsx
import { Badge } from "@levelup/shared-ui";

// Before (DashboardPage:198-205):
<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
  student.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
}`}>
  {student.status}
</span>

// After:
<Badge variant={student.status === "active" ? "default" : "secondary"}>
  {student.status}
</Badge>
```

For SpaceProgressPage STATUS_COLORS (lines 98-102), replace with Badge variants:

```tsx
// Before:
<span className={`... ${STATUS_COLORS[prog.status] ?? "bg-gray-100"}`}>
  {prog.status.replace(/_/g, " ")}
</span>

// After:
<Badge variant={
  prog.status === "completed" ? "default" :
  prog.status === "in_progress" ? "secondary" :
  "outline"
}>
  {prog.status.replace(/_/g, " ")}
</Badge>
```

---

### 3.3 Add Toast Notification on Settings Save

**Audit Issues:** S-04, S-03 **Complexity:** S **Files to modify:**
`src/pages/SettingsPage.tsx`, `src/main.tsx`

1. **Add Toaster to main.tsx:**

```tsx
import { Toaster } from "@levelup/shared-ui";

// Inside the return, after <App />:
<Toaster />;
```

2. **In SettingsPage.tsx**, use toast for save feedback:

```tsx
import { toast } from "sonner";

// Fix handleSave (lines 110-114):
const handleSave = () => {
  if (!tenantId || !userId) return;
  saveMutation.mutate(
    { tenantId, userId, prefs },
    {
      onSuccess: () => {
        setIsDirty(false);
        toast.success("Preferences saved successfully");
      },
      onError: () => {
        toast.error("Failed to save preferences. Please try again.");
      },
    }
  );
};
```

Remove the `setIsDirty(false)` from line 113 (move it to onSuccess).

---

### 3.4 Accessibility Fixes

**Audit Issues:** Accessibility #1-6 **Complexity:** M **Files to modify:**
Multiple pages

**3.4.1 ProgressRing ARIA labels** (DashboardPage, ChildrenPage):

```tsx
// Wrap ProgressRing with accessible label
<div
  role="img"
  aria-label={`Overall score: ${Math.round(summary.overallScore * 100)}%`}
>
  <ProgressRing
    value={summary.overallScore * 100}
    size={60}
    strokeWidth={6}
    label="Overall"
  />
</div>
```

**3.4.2 Color-coded scores text alternatives** (all pages with percentage
colors):

```tsx
// After each color-coded percentage, add sr-only text
<span className={`font-medium ${scoreColorClass}`}>
  {Math.round(e.percentage)}%
</span>
<span className="sr-only">
  {e.percentage >= 70 ? "(Excellent)" : e.percentage >= 40 ? "(Needs improvement)" : "(At risk)"}
</span>
```

**3.4.3 Loading state ARIA** (all pages):

```tsx
// On loading containers:
<div role="status" aria-live="polite" aria-label="Loading content">
  {/* skeleton content */}
  <span className="sr-only">Loading...</span>
</div>
```

**3.4.4 Login form error association:**

```tsx
// In LoginPage, associate error with inputs:
{
  codeError && (
    <div id="schoolCode-error" role="alert" className="...">
      {codeError}
    </div>
  );
}
<Input
  id="schoolCode"
  aria-describedby={codeError ? "schoolCode-error" : undefined}
  aria-invalid={!!codeError}
  // ... rest of props
/>;
```

---

### 3.5 Add Data Freshness Indicator

**Audit Issues:** #9 (Major), D-08 **Complexity:** S **New file:**
`src/components/DataFreshnessIndicator.tsx` **Files to modify:**
`DashboardPage.tsx`, `ChildProgressPage.tsx`

```tsx
// src/components/DataFreshnessIndicator.tsx
import { RefreshCw } from "lucide-react";

interface DataFreshnessIndicatorProps {
  dataUpdatedAt: number | undefined; // from react-query
  onRefresh?: () => void;
}

export function DataFreshnessIndicator({
  dataUpdatedAt,
  onRefresh,
}: DataFreshnessIndicatorProps) {
  if (!dataUpdatedAt) return null;

  const timeAgo = getTimeAgo(dataUpdatedAt);

  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span>Updated {timeAgo}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="hover:bg-muted rounded p-0.5"
          aria-label="Refresh data"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

Use in DashboardPage header area:

```tsx
<DataFreshnessIndicator
  dataUpdatedAt={summaryResults[0]?.dataUpdatedAt}
  onRefresh={() => summaryResults.forEach((r) => r.refetch())}
/>
```

---

### 3.6 Use Card Component Consistently

**Audit Issues:** Component consistency **Complexity:** S **Files to modify:**
`ChildrenPage.tsx`, `SpaceProgressPage.tsx`

Replace raw `<div className="rounded-lg border bg-card p-4/6">` patterns with
`Card` + `CardContent`:

In ChildrenPage.tsx (line 57):

```tsx
// Before:
<div className="rounded-lg border bg-card p-6">

// After:
<Card>
  <CardContent className="pt-6">
```

In SpaceProgressPage.tsx (line 170):

```tsx
// Before:
<div className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">

// After:
<Card className="hover:shadow-sm transition-shadow">
  <CardContent className="pt-4">
```

---

### 3.7 SpaceProgress Grid Improvement

**Audit Issues:** SP-05 **Complexity:** S **Files to modify:**
`src/pages/SpaceProgressPage.tsx`

Change line 167:

```tsx
// Before: "grid gap-3 md:grid-cols-2"
// After:  "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
```

---

### 3.8 Add Notification Pagination

**Audit Issues:** N-01, N-02 **Complexity:** S **Files to modify:**
`src/pages/NotificationsPage.tsx`

Add `onLoadMore` handler:

```tsx
export default function NotificationsPage() {
  // ... existing code
  const [limit, setLimit] = useState(50);

  // Update useNotifications call:
  const { data, isLoading, isFetching } = useNotifications(
    currentTenantId,
    firebaseUser?.uid ?? null,
    { unreadOnly: filter === "unread", limit }
  );

  return (
    <NotificationsPageUI
      // ... existing props
      onLoadMore={
        data?.hasMore ? () => setLimit((prev) => prev + 50) : undefined
      }
    />
  );
}
```

---

## Phase 4: Advanced Features (P3)

### 4.1 Consolidated Child Detail Page

**Audit Issues:** #6, #7, C-02, Navigation restructure **Complexity:** XL **New
files:**

- `src/pages/ChildDetailPage.tsx`
- `src/pages/ChildDetailPage/ProgressTab.tsx`
- `src/pages/ChildDetailPage/ExamsTab.tsx`
- `src/pages/ChildDetailPage/ActivityTab.tsx`

**What to do:**

1. **Add new route** in `App.tsx`:

```tsx
const ChildDetailPage = lazy(() => import("./pages/ChildDetailPage"));
// Inside the AppLayout routes:
<Route path="/children/:childId" element={<ChildDetailPage />} />;
```

2. **Create `ChildDetailPage.tsx`** that:
   - Reads `childId` from URL params
   - Fetches student name, summary
   - Renders tab navigation (Progress | Exams | Activity)
   - Uses `Tabs` component from shared-ui

3. **ProgressTab** merges content from ChildProgressPage and SpaceProgressPage —
   ScoreCards, strengths/weaknesses, bar charts, space progress cards.

4. **ExamsTab** filters ExamResults to only this child's submissions.

5. **ActivityTab** shows a timeline of recent activity.

6. **Update ChildrenPage.tsx** action links:

```tsx
// Before:
<Link to="/child-progress">View Full Progress</Link>
// After:
<Link to={`/children/${student.uid}`}>View Full Progress</Link>
```

7. **Update sidebar** in AppLayout.tsx to simplify "My Children" group (remove
   Child Progress, Space Progress — keep them as legacy routes that redirect).

---

### 4.2 Historical Trend Charts

**Audit Issues:** CP-08, CP-09, CP-10 **Complexity:** L **Dependencies:**
Requires backend data (historical snapshots) or deriving from existing exam data

**What to do:**

- Add a line chart (recharts `LineChart`) showing exam average percentage over
  the last N exams
- Add a time period selector (this month, this term, all time)
- Place in the child detail page's Progress tab

---

### 4.3 Weekly Summary Digest

**Audit Issues:** Parent journey friction **Complexity:** L **Dependencies:**
Requires Cloud Function to generate weekly summary

**What to do:**

- Add a "This Week" card on Dashboard above the children grid
- Show per-child summary: score changes, spaces completed, streak status
- Could be computed client-side from existing data as a quick win

---

## New Files to Create

| File                                          | Phase | Purpose                                                    |
| --------------------------------------------- | ----- | ---------------------------------------------------------- |
| `src/hooks/useStudentNames.ts`                | 1.3   | Student display names (extract from SpaceProgressPage)     |
| `src/hooks/useChildSubmissions.ts`            | 2.2   | Exam submissions query (extract from ExamResultsPage)      |
| `src/hooks/useQuestionSubmissions.ts`         | 2.2   | Per-question feedback query (extract from ExamResultsPage) |
| `src/hooks/useChildProgress.ts`               | 2.2   | Space progress query (extract from SpaceProgressPage)      |
| `src/hooks/useSpaceNames.ts`                  | 2.2   | Space name lookup (extract from SpaceProgressPage)         |
| `src/hooks/useNotificationPreferences.ts`     | 2.2   | Notification prefs query (extract from SettingsPage)       |
| `src/hooks/useSaveNotificationPreferences.ts` | 2.2   | Save prefs mutation (extract from SettingsPage)            |
| `src/hooks/useTenantNames.ts`                 | 2.2   | Tenant name lookup (extract from AppLayout)                |
| `src/lib/helpers.ts`                          | 1.3   | Utility functions (getInitials, getStudentDisplayName)     |
| `src/components/MobileBottomNav.tsx`          | 1.4   | Mobile bottom navigation bar                               |
| `src/components/skeletons.tsx`                | 3.1   | Skeleton loading components                                |
| `src/components/DataFreshnessIndicator.tsx`   | 3.5   | "Updated X ago" indicator                                  |
| `src/components/QuestionFeedbackSection.tsx`  | 2.3   | Exam question feedback (extract from ExamResultsPage)      |
| `src/pages/ChildDetailPage.tsx`               | 4.1   | Unified child detail page                                  |

---

## Dependency Graph

```
Phase 1 (Critical — do these first):
  1.1 Dark Mode CSS ← no deps (do first, enables 2.5)
  1.2 Login Redesign ← no deps
  1.3 Fix Child Names ← no deps (creates shared hook)
  1.4 Mobile Bottom Nav ← no deps

Phase 2 (Major — after Phase 1):
  2.1 Remove Dashboard LogoutButton ← no deps
  2.2 Extract Inline Hooks ← depends on 1.3 (useStudentNames already extracted)
  2.3 Extract QuestionFeedback ← depends on 2.2
  2.4 Replace Custom Accordion ← depends on 2.3
  2.5 Replace Hardcoded Colors ← depends on 1.1 (needs CSS vars)
  2.6 Replace Raw HTML Elements ← no deps
  2.7 Fix School Code Display ← no deps
  2.8 Hide Pipeline Status ← no deps
  2.9 Remove School Code Metric ← no deps
  2.10 Add Notifications to Sidebar ← no deps
  2.11 Fix LogoutButton Styling ← no deps

Phase 3 (Polish — after Phase 2):
  3.1 Skeleton Loading ← depends on 2.2 (clean page files)
  3.2 Badge Component ← depends on 2.5 (semantic colors)
  3.3 Toast on Save ← no deps
  3.4 Accessibility ← depends on 2.4 (accordion)
  3.5 Data Freshness ← no deps
  3.6 Card Consistency ← no deps
  3.7 SpaceProgress Grid ← no deps
  3.8 Notification Pagination ← no deps

Phase 4 (Advanced — after Phase 3):
  4.1 Child Detail Page ← depends on 2.2, 2.5
  4.2 Historical Charts ← depends on 4.1
  4.3 Weekly Summary ← depends on 1.3
```

---

## Complexity Summary

| Complexity                      | Count | Items                                                                       |
| ------------------------------- | ----- | --------------------------------------------------------------------------- |
| **S (Small)** — < 1 hour        | 13    | 1.1, 2.1, 2.3, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8 |
| **M (Medium)** — 2-4 hours      | 8     | 1.2, 1.3, 1.4, 2.2, 2.4, 2.5, 3.1, 3.4                                      |
| **L (Large)** — 1-2 days        | 2     | 4.2, 4.3                                                                    |
| **XL (Extra Large)** — 3-5 days | 1     | 4.1                                                                         |

**Estimated total effort:**

- Phase 1: ~8-10 hours
- Phase 2: ~8-12 hours
- Phase 3: ~6-8 hours
- Phase 4: ~40-60 hours
