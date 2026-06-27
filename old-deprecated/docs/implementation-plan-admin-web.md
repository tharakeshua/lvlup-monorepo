# Implementation Plan: Admin-Web UI/UX Fixes

**Source:** [UI/UX Audit - Admin Web](/docs/ui-ux-audit-admin-web.md) **Date:**
March 2026 **Author:** UI/UX Designer Agent

---

## Overview

This plan addresses **every issue** identified in the Admin-Web UI/UX audit,
organized into 4 phases by priority. Each item includes the exact files to
modify, specific code changes, and complexity estimates.

**Complexity Key:** S = Small (< 30 min), M = Medium (1-2 hrs), L = Large (2-4
hrs), XL = Extra-Large (4+ hrs)

---

## Phase 1: Critical Fixes & Foundation

> These issues break design consistency, prevent scalability, or block core
> functionality.

---

### 1.1 Add Dark Mode Support

**Audit Ref:** Section 4.2, Section 6 Priority 1 Item 1 **Severity:** Critical
**Complexity:** L

**Files to modify:**

- `apps/admin-web/src/index.css`
- `apps/admin-web/src/main.tsx`
- `apps/admin-web/src/layouts/AppLayout.tsx`

**Changes:**

**`index.css` — Add `.dark` class CSS variables after the `:root` block (after
line 37):**

```css
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

**`main.tsx` — Wrap the app with `ThemeProvider` from `next-themes`:**

```tsx
import { ThemeProvider } from "next-themes";
// Inside render:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <BrowserRouter>...</BrowserRouter>
</ThemeProvider>;
```

**`AppLayout.tsx` — Add theme toggle button in the `headerRight` area (line
~185):**

```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@levelup/shared-ui";

// Inside component:
const { theme, setTheme } = useTheme();

// In headerRight, before NotificationBell:
<Button
  variant="ghost"
  size="icon"
  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
  aria-label="Toggle theme"
>
  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
</Button>;
```

**Dependencies:** Install `next-themes` if not already in admin-web deps.

---

### 1.2 Replace Raw HTML in LoginPage with Shared-UI Components

**Audit Ref:** Section 3.1 Issues #1, #4, #5, #6 **Severity:** Critical
**Complexity:** M

**File to modify:** `apps/admin-web/src/pages/LoginPage.tsx`

**Changes:**

1. **Replace all `<input>` elements with `<Input>` from shared-ui:**
   - Lines 83-91: School code input → `<Input id="schoolCode" autoFocus ...>`
   - Lines 129-137: Email input →
     `<Input id="email" type="email" autoFocus ...>`
   - Lines 144-152: Password input →
     `<Input id="password" type={showPassword ? "text" : "password"} ...>`

2. **Replace all `<button>` elements with `<Button>` from shared-ui:**
   - Lines 94-100: Submit button →
     `<Button type="submit" className="w-full" disabled={codeLoading}>`
   - Lines 106-116: Change school link → `<Button variant="link" ...>`
   - Lines 155-161: Sign In button →
     `<Button type="submit" className="w-full" disabled={loading}>`

3. **Add password visibility toggle:**

   ```tsx
   import { Eye, EyeOff } from "lucide-react";
   const [showPassword, setShowPassword] = useState(false);

   // Wrap password input in relative div:
   <div className="relative">
     <Input id="password" type={showPassword ? "text" : "password"} ... />
     <Button
       type="button"
       variant="ghost"
       size="icon"
       className="absolute right-0 top-0 h-10 w-10"
       onClick={() => setShowPassword(!showPassword)}
       aria-label={showPassword ? "Hide password" : "Show password"}
     >
       {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
     </Button>
   </div>
   ```

4. **Add `autoFocus` to first input in each step:**
   - School code input (line 83): Add `autoFocus`
   - Email input (line 129): Add `autoFocus`

5. **Add `aria-describedby` for error messages:**

   ```tsx
   // For codeError:
   {codeError && <div id="schoolCode-error" role="alert" ...>{codeError}</div>}
   <Input aria-describedby={codeError ? "schoolCode-error" : undefined} ... />

   // For auth error:
   {error && <div id="login-error" role="alert" ...>{error}</div>}
   ```

6. **Add imports at top:**
   ```tsx
   import { Input } from "@levelup/shared-ui";
   import { Button } from "@levelup/shared-ui";
   import { Eye, EyeOff } from "lucide-react";
   ```

---

### 1.3 Replace Raw HTML in ExamsOverviewPage

**Audit Ref:** Section 3.5 Issue #1 **Severity:** Critical **Complexity:** M

**File to modify:** `apps/admin-web/src/pages/ExamsOverviewPage.tsx`

**Changes:**

1. **Replace `<input>` (line 45-51) with shared-ui `<Input>`:**

   ```tsx
   import { Input } from "@levelup/shared-ui";
   // Replace the search input:
   <Input
     type="text"
     placeholder="Search exams..."
     value={searchQuery}
     onChange={(e) => setSearchQuery(e.target.value)}
     className="pl-9"
   />;
   ```

2. **Replace raw `<button>` filter pills (lines 55-65) with shared-ui
   `<Button>`:**

   ```tsx
   import { Button } from "@levelup/shared-ui";
   {
     statuses.map((s) => (
       <Button
         key={s}
         variant={statusFilter === s ? "default" : "secondary"}
         size="sm"
         onClick={() => setStatusFilter(s)}
         className="capitalize"
       >
         {s}
       </Button>
     ));
   }
   ```

3. **Replace raw `<table>` (lines 71-127) with shared-ui `<Table>` components:**

   ```tsx
   import {
     Table,
     TableHeader,
     TableBody,
     TableHead,
     TableRow,
     TableCell,
   } from "@levelup/shared-ui";
   import { Badge } from "@levelup/shared-ui";

   <Table>
     <TableHeader>
       <TableRow>
         <TableHead>Title</TableHead>
         <TableHead>Subject</TableHead>
         <TableHead>Total Marks</TableHead>
         <TableHead>Status</TableHead>
         <TableHead>Created By</TableHead>
       </TableRow>
     </TableHeader>
     <TableBody>
       {filtered?.map((exam) => (
         <TableRow key={exam.id}>
           <TableCell className="font-medium">{exam.title}</TableCell>
           <TableCell className="text-muted-foreground">
             {exam.subject || "--"}
           </TableCell>
           <TableCell>{exam.totalMarks}</TableCell>
           <TableCell>
             <Badge variant="secondary" className="capitalize">
               {exam.status}
             </Badge>
           </TableCell>
           <TableCell className="text-muted-foreground font-mono">
             {exam.createdBy?.slice(0, 8) || "--"}
           </TableCell>
         </TableRow>
       ))}
     </TableBody>
   </Table>;
   ```

4. **Remove the local `STATUS_COLORS` object** (lines 6-13) — replaced by Badge
   variant.

---

### 1.4 Replace Raw HTML in SpacesOverviewPage

**Audit Ref:** Section 3.6 Issue #1 **Severity:** Major **Complexity:** M

**File to modify:** `apps/admin-web/src/pages/SpacesOverviewPage.tsx`

**Changes:**

1. **Replace `<input>` (line 50-55) with shared-ui `<Input>`** (same pattern as
   Exams).

2. **Replace raw `<button>` filter pills (lines 59-71) with shared-ui
   `<Button>`** (same pattern as Exams).

3. **Replace inline status/type pills with shared-ui `<Badge>`:**
   - Line 92-96: Status pill →
     `<Badge variant="secondary" className="capitalize">{space.status}</Badge>`
   - Line 104-108: Type badge →
     `<Badge variant="outline" className="capitalize">{space.type}</Badge>`

4. **Wrap cards in shared-ui `<Card>` component:**

   ```tsx
   import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@levelup/shared-ui";

   <Card className="hover:shadow-sm transition-shadow">
     <CardHeader className="pb-2">
       <div className="flex items-start justify-between">
         <CardTitle className="text-base">{space.title}</CardTitle>
         <Badge ...>{space.status}</Badge>
       </div>
       {space.description && <CardDescription className="line-clamp-2">{space.description}</CardDescription>}
     </CardHeader>
     <CardContent>
       <div className="flex flex-wrap gap-2">...</div>
       <div className="mt-3 flex gap-4 text-xs text-muted-foreground">...</div>
     </CardContent>
   </Card>
   ```

5. **Remove the local `STATUS_COLORS` and `TYPE_COLORS` objects** (lines 6-18).

---

### 1.5 Replace Raw HTML in SettingsPage

**Audit Ref:** Section 3.11 Issues #1, #2, #3 **Severity:** Major
**Complexity:** L

**File to modify:** `apps/admin-web/src/pages/SettingsPage.tsx`

**Changes:**

1. **Replace custom tab switcher (lines 166-180) with shared-ui `<Tabs>`:**

   ```tsx
   import {
     Tabs,
     TabsList,
     TabsTrigger,
     TabsContent,
   } from "@levelup/shared-ui";

   <Tabs
     value={activeTab}
     onValueChange={(v) => setActiveTab(v as SettingsTab)}
   >
     <TabsList className="grid w-full grid-cols-3">
       <TabsTrigger value="tenant">Tenant Settings</TabsTrigger>
       <TabsTrigger value="evaluation">Evaluation Settings</TabsTrigger>
       <TabsTrigger value="api">API Keys</TabsTrigger>
     </TabsList>
     <TabsContent value="tenant">...</TabsContent>
     <TabsContent value="evaluation">...</TabsContent>
     <TabsContent value="api">...</TabsContent>
   </Tabs>;
   ```

2. **Replace all raw `<input>` elements with shared-ui `<Input>`:**
   - Lines 215-223: School Name →
     `<Input value={...} onChange={...} readOnly={!isEditingSchool} />`
   - Lines 227-232: Tenant Code →
     `<Input defaultValue={...} readOnly className="bg-muted font-mono" />`
   - Lines 236-247: Contact Email → `<Input type="email" ...>`
   - Lines 252-264: Contact Phone → `<Input type="tel" ...>`
   - Lines 466-471: API key input → `<Input type="password" ...>`

3. **Replace all raw `<button>` elements with shared-ui `<Button>`:**
   - Line 189-192: Edit button → `<Button variant="link" size="sm">`
   - Lines 196-209: Cancel/Save buttons →
     `<Button variant="ghost">Cancel</Button>` + `<Button>Save</Button>`
   - Lines 341-351: Eval Cancel/Save → same pattern
   - Lines 475-490: API key Save/Cancel → same pattern
   - Lines 502-506: Set/Update Key → `<Button>`
   - Lines 509-515: Remove → `<Button variant="destructive">`

4. **Replace raw `<label>` elements with shared-ui `<Label>`:**

   ```tsx
   import { Label } from "@levelup/shared-ui";
   // Replace all <label> tags (lines 214, 226, 235, 251, 368, 393, 406)
   ```

5. **Replace raw checkboxes (lines 394-418) with shared-ui `<Switch>`:**

   ```tsx
   import { Switch } from "@levelup/shared-ui";
   <div className="flex items-center gap-2">
     <Switch
       checked={evalForm.showStrengths}
       onCheckedChange={(checked) =>
         setEvalForm((p) => ({ ...p, showStrengths: checked }))
       }
     />
     <Label>Show strengths</Label>
   </div>;
   ```

6. **Add imports:**
   ```tsx
   import {
     Input,
     Button,
     Label,
     Switch,
     Tabs,
     TabsList,
     TabsTrigger,
     TabsContent,
     Card,
     CardHeader,
     CardContent,
   } from "@levelup/shared-ui";
   ```

---

### 1.6 Replace Raw HTML in AIUsagePage

**Audit Ref:** Section 3.9 Issues #1, #3 **Severity:** Major **Complexity:** M

**File to modify:** `apps/admin-web/src/pages/AIUsagePage.tsx`

**Changes:**

1. **Replace raw month navigation `<button>` (lines 99-114) with shared-ui
   `<Button>`:**

   ```tsx
   import { Button } from "@levelup/shared-ui";
   <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset(o => o - 1)}>
     <ChevronLeft className="h-4 w-4" />
   </Button>
   <span className="text-sm font-medium w-20 text-center">{range.label}</span>
   <Button variant="outline" size="icon" className="h-8 w-8" onClick={...} disabled={monthOffset >= 0}>
     <ChevronRight className="h-4 w-4" />
   </Button>
   ```

2. **Replace raw `<table>` (lines 189-232) with shared-ui `<Table>`:**

   ```tsx
   import {
     Table,
     TableHeader,
     TableBody,
     TableHead,
     TableRow,
     TableCell,
   } from "@levelup/shared-ui";
   ```

   Same pattern as ExamsOverviewPage — wrap in `<Table>` with proper
   sub-components.

3. **Replace hardcoded hex colors in purpose chart (lines 77-87) with CSS
   variable references:**

   ```tsx
   const PURPOSE_COLORS: Record<string, string> = {
     extraction: "hsl(var(--primary))",
     grading: "hsl(var(--state-completed, 142 71% 45%))",
     evaluation: "hsl(45 93% 47%)",
     tutoring: "hsl(263 70% 50%)",
   };
   ```

4. **Standardize cost precision — use `.toFixed(2)` consistently:**
   - Line 227: `${day.totalCostUsd.toFixed(4)}` → change to `.toFixed(2)`

---

### 1.7 Replace Custom Tabs in ReportsPage

**Audit Ref:** Section 3.10 Issues #1, #2 **Severity:** Major **Complexity:** M

**File to modify:** `apps/admin-web/src/pages/ReportsPage.tsx`

**Changes:**

1. **Remove duplicated `useClasses` hook (lines 21-33):**

   ```tsx
   // DELETE the local useClasses function (lines 14-33)
   // REPLACE with import:
   import { useExams, useClasses } from "@levelup/shared-hooks";
   ```

2. **Replace custom tabs (lines 57-70) with shared-ui `<Tabs>`:**

   ```tsx
   import {
     Tabs,
     TabsList,
     TabsTrigger,
     TabsContent,
   } from "@levelup/shared-ui";

   <Tabs
     value={activeTab}
     onValueChange={(v) => setActiveTab(v as "exams" | "classes")}
   >
     <TabsList>
       <TabsTrigger value="exams">Exam Reports</TabsTrigger>
       <TabsTrigger value="classes">Class Reports</TabsTrigger>
     </TabsList>
     <TabsContent value="exams">...</TabsContent>
     <TabsContent value="classes">...</TabsContent>
   </Tabs>;
   ```

3. **Wrap report cards in shared-ui `<Card>`:**
   ```tsx
   import { Card, CardContent } from "@levelup/shared-ui";
   // Replace the raw div cards (lines 84-109, 124-149)
   ```

---

### 1.8 Move Logout to Sidebar / Add User Dropdown

**Audit Ref:** Section 2 Issue #1, #2; Section 3.2 Issue #1 **Severity:**
Critical **Complexity:** M

**Files to modify:**

- `apps/admin-web/src/layouts/AppLayout.tsx`
- `apps/admin-web/src/pages/DashboardPage.tsx`

**Changes:**

**`AppLayout.tsx` — Replace the plain user info div (lines 163-174) with a
DropdownMenu:**

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@levelup/shared-ui";
import { Avatar, AvatarFallback } from "@levelup/shared-ui";
import { Button } from "@levelup/shared-ui";
import { LogOut, Settings as SettingsIcon, User } from "lucide-react";

// Replace the sidebarFooter (lines 163-174):
const sidebarFooter = (
  <div className="space-y-2">
    <RoleSwitcher
      currentTenantId={currentTenantId}
      tenants={tenantOptions}
      onSwitch={switchTenant}
    />
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {(user?.displayName ?? user?.email ?? "A")
                .charAt(0)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs">
            {user?.displayName ?? user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user?.displayName ?? "Admin"}
            </p>
            <p className="text-muted-foreground text-xs">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
```

**`DashboardPage.tsx` — Remove the LogoutButton (lines 80-85):**

- Remove the `LogoutButton` import (line 18)
- Remove `const { logout } = useAuthStore();` (line 31) — or keep if used
  elsewhere
- Remove the `<LogoutButton>` JSX block (lines 80-85)
- Remove the wrapping flex div and simplify the header

---

### 1.9 Add Sonner Toast Provider

**Audit Ref:** Section 4.4 **Severity:** Major (foundational for all CRUD
feedback) **Complexity:** S

**File to modify:** `apps/admin-web/src/main.tsx`

**Changes:**

Add the `<Toaster />` component from shared-ui (which wraps sonner):

```tsx
import { Toaster } from "@levelup/shared-ui";

// Add after the closing </BrowserRouter>, inside providers:
<Toaster position="top-right" richColors />;
```

This is a prerequisite for all toast notifications in Phase 2.

---

## Phase 2: Data & Scale Improvements

> Fix performance scalability, loading states, error handling, and navigation.

---

### 2.1 Add Skeleton Loading Components

**Audit Ref:** Section 4.3 **Severity:** Major **Complexity:** L

**New files to create:**

- `apps/admin-web/src/components/skeletons/TableSkeleton.tsx`
- `apps/admin-web/src/components/skeletons/CardGridSkeleton.tsx`
- `apps/admin-web/src/components/skeletons/DashboardSkeleton.tsx`
- `apps/admin-web/src/components/skeletons/PageSkeleton.tsx`

**`TableSkeleton.tsx`:**

```tsx
import { Skeleton } from "@levelup/shared-ui";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@levelup/shared-ui";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-24" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: columns }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**`CardGridSkeleton.tsx`:**

```tsx
import { Skeleton } from "@levelup/shared-ui";

interface CardGridSkeletonProps {
  count?: number;
  columns?: string; // e.g., "md:grid-cols-2 lg:grid-cols-3"
}

export function CardGridSkeleton({
  count = 6,
  columns = "md:grid-cols-2 lg:grid-cols-3",
}: CardGridSkeletonProps) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card space-y-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
```

**`DashboardSkeleton.tsx`:**

```tsx
import { Skeleton } from "@levelup/shared-ui";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
```

**Files to modify (apply skeletons to each page):**

| Page                      | Replace                       | With                                                                                                            |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DashboardPage.tsx`       | No loading state exists       | Wrap with `if (isLoading) return <DashboardSkeleton />;` — need to derive a combined loading state from queries |
| `UsersPage.tsx`           | `"Loading..."` text           | `<TableSkeleton columns={6} />`                                                                                 |
| `ClassesPage.tsx`         | `"Loading..."` text           | `<TableSkeleton columns={7} />`                                                                                 |
| `ExamsOverviewPage.tsx`   | Line 94: `"Loading..."` td    | `<TableSkeleton columns={5} />`                                                                                 |
| `SpacesOverviewPage.tsx`  | Line 76: `"Loading..."` div   | `<CardGridSkeleton count={6} />`                                                                                |
| `CoursesPage.tsx`         | Any loading state             | `<CardGridSkeleton count={4} columns="grid-cols-1" />`                                                          |
| `AnalyticsPage.tsx`       | No loading state              | `<PageSkeleton />`                                                                                              |
| `AIUsagePage.tsx`         | Line 151: animated pulse div  | Keep existing (already good)                                                                                    |
| `SettingsPage.tsx`        | Line 304: `"Loading..."` text | `<Skeleton className="h-40 w-full" />`                                                                          |
| `AcademicSessionPage.tsx` | Any loading state             | `<TableSkeleton columns={6} />`                                                                                 |
| `ReportsPage.tsx`         | No loading state              | `<CardGridSkeleton count={3} columns="grid-cols-1" />`                                                          |
| `RequireAuth.tsx`         | Line 15-17: `"Loading..."`    | Show app shell skeleton with sidebar placeholder                                                                |

---

### 2.2 Add Toast Notifications to All CRUD Operations

**Audit Ref:** Section 4.4, Section 3.11 Issue #5 **Severity:** Major
**Complexity:** M

**Files to modify:**

- `apps/admin-web/src/pages/UsersPage.tsx`
- `apps/admin-web/src/pages/ClassesPage.tsx`
- `apps/admin-web/src/pages/SettingsPage.tsx`
- `apps/admin-web/src/pages/AcademicSessionPage.tsx`

**Pattern to apply in each file:**

```tsx
import { toast } from "sonner";

// In every try/catch/finally for CRUD operations:
try {
  await mutateAsync({ ... });
  toast.success("User created successfully");
  // close dialog, reset form
} catch (err) {
  toast.error("Failed to create user", {
    description: err instanceof Error ? err.message : "Please try again",
  });
}
```

**Specific locations:**

| File                      | Function                        | Line      | Toast Message                                                            |
| ------------------------- | ------------------------------- | --------- | ------------------------------------------------------------------------ |
| `UsersPage.tsx`           | `handleCreate`                  | ~line 85  | `toast.success("User created")` / `toast.error("Failed to create user")` |
| `UsersPage.tsx`           | `handleBulkImport`              | ~line 100 | `toast.success("Students imported")` / `toast.error(...)`                |
| `UsersPage.tsx`           | `handleAssignClasses`           | ~line 115 | `toast.success("Classes assigned")`                                      |
| `UsersPage.tsx`           | `handleLinkParent`              | ~line 130 | `toast.success("Parent linked")`                                         |
| `ClassesPage.tsx`         | `handleCreate`                  | ~CRUD     | `toast.success("Class created")`                                         |
| `ClassesPage.tsx`         | `handleUpdate`                  | ~CRUD     | `toast.success("Class updated")`                                         |
| `ClassesPage.tsx`         | `handleArchive`                 | ~CRUD     | `toast.success("Class archived")`                                        |
| `ClassesPage.tsx`         | `handleAssignTeachers`          | ~CRUD     | `toast.success("Teachers assigned")`                                     |
| `ClassesPage.tsx`         | `handleAssignStudents`          | ~CRUD     | `toast.success("Students assigned")`                                     |
| `SettingsPage.tsx`        | `handleSaveSchool` (line 73)    | 86        | `toast.success("School info updated")`                                   |
| `SettingsPage.tsx`        | `handleSaveEval` (line 100)     | 117       | `toast.success("Evaluation settings saved")`                             |
| `SettingsPage.tsx`        | `handleSetApiKey` (line 123)    | 132       | `toast.success("API key updated")`                                       |
| `SettingsPage.tsx`        | `handleRemoveApiKey` (line 138) | 147       | `toast.success("API key removed")`                                       |
| `AcademicSessionPage.tsx` | create/update                   |           | `toast.success(...)`                                                     |

---

### 2.3 Add React.lazy Code Splitting

**Audit Ref:** Section 1 Issue — No lazy loading **Severity:** Major
**Complexity:** M

**File to modify:** `apps/admin-web/src/App.tsx`

**Changes:**

Replace all static imports (lines 7-19) with React.lazy:

```tsx
import { lazy, Suspense } from "react";
import { Skeleton } from "@levelup/shared-ui";

// Keep non-lazy: AuthLayout, AppLayout, RequireAuth (needed immediately)
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";

// Lazy load all pages:
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const ExamsOverviewPage = lazy(() => import("./pages/ExamsOverviewPage"));
const SpacesOverviewPage = lazy(() => import("./pages/SpacesOverviewPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AcademicSessionPage = lazy(() => import("./pages/AcademicSessionPage"));
const AIUsagePage = lazy(() => import("./pages/AIUsagePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));

// Wrap <Outlet> in AppLayout with Suspense, OR wrap each <Route element>
// Recommended: wrap in AppLayout.tsx around <Outlet>:
```

**`AppLayout.tsx` — Wrap Outlet with Suspense:**

```tsx
import { Suspense } from "react";
// In the return JSX:
<AppShell sidebar={sidebar} headerRight={headerRight}>
  <Suspense
    fallback={
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    }
  >
    <Outlet />
  </Suspense>
</AppShell>;
```

---

### 2.4 Add Route-Level Error Boundaries

**Audit Ref:** Section 1 Issue — No route-level error boundaries **Severity:**
Major **Complexity:** M

**New file to create:** `apps/admin-web/src/components/RouteErrorBoundary.tsx`

```tsx
import { Component, type ReactNode } from "react";
import { Button } from "@levelup/shared-ui";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="text-destructive h-10 w-10" />
          <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
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

**File to modify:** `apps/admin-web/src/App.tsx`

Wrap each page route element:

```tsx
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

// For each route:
<Route path="/" element={
  <RouteErrorBoundary><DashboardPage /></RouteErrorBoundary>
} />
<Route path="/users" element={
  <RouteErrorBoundary><UsersPage /></RouteErrorBoundary>
} />
// ... etc for all routes
```

---

### 2.5 Add Breadcrumb Navigation

**Audit Ref:** Section 2 Issue #6 **Severity:** Minor **Complexity:** M

**New file to create:** `apps/admin-web/src/components/AppBreadcrumb.tsx`

```tsx
import { useLocation, Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@levelup/shared-ui";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/classes": "Classes",
  "/exams": "Exams",
  "/spaces": "Spaces",
  "/courses": "Courses",
  "/analytics": "Analytics",
  "/reports": "Reports",
  "/ai-usage": "AI Usage",
  "/academic-sessions": "Academic Sessions",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

export function AppBreadcrumb() {
  const location = useLocation();
  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Page";

  if (location.pathname === "/") return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

**File to modify:** `apps/admin-web/src/layouts/AppLayout.tsx`

Add breadcrumb above the Outlet:

```tsx
import { AppBreadcrumb } from "../components/AppBreadcrumb";

// In the AppShell children, before <Outlet />:
<AppBreadcrumb />
<Outlet />
```

---

### 2.6 Improve RequireAuth Loading State

**Audit Ref:** Section 1 — RequireAuth loading state is bare **Severity:** Minor
**Complexity:** S

**File to modify:** `apps/admin-web/src/guards/RequireAuth.tsx`

**Replace lines 14-18 with a branded loading screen:**

```tsx
import { Skeleton } from "@levelup/shared-ui";

if (loading) {
  return (
    <div className="flex h-screen">
      {/* Sidebar skeleton */}
      <div className="bg-sidebar hidden w-64 space-y-4 border-r p-4 md:block">
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="mt-6 grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### 2.7 Fix Dashboard ScoreCard Grid for Mobile

**Audit Ref:** Section 3.2 Issue #3 **Severity:** Major **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/DashboardPage.tsx`

**Change line 89:**

```tsx
// FROM:
<div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
// TO:
<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
```

This gives 2-column grid on mobile instead of a single stacked column.

---

### 2.8 Make Dashboard ScoreCards Clickable

**Audit Ref:** Section 3.2 Issue #6 **Severity:** Minor **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/DashboardPage.tsx`

**Wrap each ScoreCard in a Link:**

```tsx
import { Link } from "react-router-dom";

// Replace each ScoreCard with:
<Link to="/users" className="block">
  <ScoreCard label="Total Students" value={...} icon={Users} />
</Link>
<Link to="/users" className="block">
  <ScoreCard label="Total Teachers" value={...} icon={GraduationCap} />
</Link>
<Link to="/classes" className="block">
  <ScoreCard label="Classes" value={...} icon={GraduationCap} />
</Link>
<Link to="/spaces" className="block">
  <ScoreCard label="Total Spaces" value={...} icon={BookOpen} />
</Link>
<Link to="/exams" className="block">
  <ScoreCard label="Total Exams" value={...} icon={ClipboardList} />
</Link>
<Link to="/analytics" className="block">
  <ScoreCard label="At-Risk Students" value={...} icon={AlertTriangle} ... />
</Link>
```

---

### 2.9 Add Empty State for Dashboard Chart

**Audit Ref:** Section 3.2 Issue #4 **Severity:** Major **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/DashboardPage.tsx`

**Replace the conditional rendering (line 126) with always-visible section:**

```tsx
// FROM:
{
  classChartData.length > 0 && (
    <div className="bg-card rounded-lg border p-5">...</div>
  );
}

// TO:
<div className="bg-card rounded-lg border p-5">
  <div className="mb-4 flex items-center gap-2">
    <BarChart3 className="text-muted-foreground h-4 w-4" />
    <h2 className="font-semibold">Class Performance (Avg Exam Score)</h2>
  </div>
  {classChartData.length > 0 ? (
    <SimpleBarChart data={classChartData} maxValue={100} height={200} />
  ) : (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="text-muted-foreground h-8 w-8" />
      <p className="text-muted-foreground mt-2 text-sm">
        No performance data available yet
      </p>
    </div>
  )}
</div>;
```

---

### 2.10 Replace Hardcoded Feature Status Colors

**Audit Ref:** Section 3.2 Issue #5 **Severity:** Minor **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/DashboardPage.tsx`

**Replace lines 194-196:**

```tsx
// FROM:
<span className={`h-2 w-2 rounded-full ${enabled ? "bg-green-500" : "bg-gray-300"}`} />

// TO:
<span className={`h-2 w-2 rounded-full ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`} />
<span className="text-muted-foreground">
  {key.replace(/([A-Z])/g, " $1").replace("Enabled", "")}
  {!enabled && " (off)"}
</span>
```

This uses theme-aware colors and adds text-based indicator for color-blind
users.

---

### 2.11 Remove Unused Variables / Dead Code

**Audit Ref:** Section 3.8 Issue #3, Section 3.3 Issue #7 **Severity:** Minor
**Complexity:** S

**Files to modify:**

1. **`AnalyticsPage.tsx` line 26:** Remove `const _exams = useExams(tenantId);`
   Also remove `useExams` from the import on line 8 if not used elsewhere.

2. **`UsersPage.tsx`:** Find and remove the unused `_studentItems` variable.

---

### 2.12 Replace Hardcoded Colors in AnalyticsPage

**Audit Ref:** Section 3.8 Issue #2 **Severity:** Major **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/AnalyticsPage.tsx`

**Changes:**

1. **Line 82:** Replace `color: "#ef4444"` with
   `color: "hsl(var(--destructive))"`

2. **Lines 247-253:** Replace `bg-green-50` and `text-green-700` with
   theme-aware classes:

   ```tsx
   // FROM:
   className =
     "flex items-center justify-between rounded bg-green-50 px-3 py-1.5 text-sm";
   // TO:
   className =
     "flex items-center justify-between rounded bg-primary/10 px-3 py-1.5 text-sm";

   // FROM:
   className = "font-medium text-green-700";
   // TO:
   className = "font-medium text-primary";
   ```

3. **Lines 269-275:** Replace `bg-red-50` and `text-red-700` with:

   ```tsx
   className =
     "flex items-center justify-between rounded bg-destructive/10 px-3 py-1.5 text-sm";
   className = "font-medium text-destructive";
   ```

4. **Line 219:** Replace `text-red-600` with `text-destructive`

5. **Line 238:** Replace `text-green-600` with `text-primary`

6. **Line 259:** Replace `text-red-600` with `text-destructive`

---

## Phase 3: Enhanced UX & Features

> Add pagination, notification improvements, accessibility fixes, and responsive
> design.

---

### 3.1 Add Client-Side Pagination to Data Tables

**Audit Ref:** Section 4.5, Section 3.3 Issue #1, Section 3.4 Issue #2
**Severity:** Critical **Complexity:** XL

**New file to create:** `apps/admin-web/src/components/DataTablePagination.tsx`

```tsx
import { Button } from "@levelup/shared-ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@levelup/shared-ui";

interface DataTablePaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function DataTablePagination({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-muted-foreground text-sm">
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex h-8 items-center px-2 text-sm">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**New file to create:** `apps/admin-web/src/hooks/usePagination.ts`

```tsx
import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], defaultPageSize = 25) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    currentPage,
    pageSize,
    totalItems: items.length,
    setCurrentPage,
    setPageSize: handlePageSizeChange,
  };
}
```

**Files to modify (integrate pagination):**

| Page                    | Data to Paginate                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UsersPage.tsx`         | Teachers, Students, Parents arrays — add `usePagination` per tab + `<DataTablePagination>` below each table. Reset page on tab change and search. |
| `ClassesPage.tsx`       | Filtered classes array                                                                                                                            |
| `ExamsOverviewPage.tsx` | Filtered exams array                                                                                                                              |
| `AIUsagePage.tsx`       | Daily breakdown table                                                                                                                             |

**Example integration for ExamsOverviewPage:**

```tsx
import { usePagination } from "../hooks/usePagination";
import { DataTablePagination } from "../components/DataTablePagination";

// After filtering:
const {
  paginatedItems,
  currentPage,
  pageSize,
  totalItems,
  setCurrentPage,
  setPageSize,
} = usePagination(filtered ?? [], 25);

// Use paginatedItems instead of filtered in the table map
// Add below the table:
<DataTablePagination
  totalItems={totalItems}
  pageSize={pageSize}
  currentPage={currentPage}
  onPageChange={setCurrentPage}
  onPageSizeChange={setPageSize}
/>;
```

---

### 3.2 Add Notification Bell Empty State

**Audit Ref:** Section 2 Issue #4 **Severity:** Minor **Complexity:** S

**File to modify:** `apps/admin-web/src/layouts/AppLayout.tsx` (or the shared-ui
NotificationBell component if modifications are permitted)

If the `NotificationBell` component from shared-ui doesn't handle empty state:

- Pass an empty state message as a prop (if supported), OR
- Open a feature request on shared-ui to add empty state: "All caught up!" with
  a CheckCircle icon.

If directly fixable in shared-ui: **File:**
`packages/shared-ui/src/components/layout/NotificationBell.tsx` Add after the
notification list map:

```tsx
{
  notifications.length === 0 && !isLoading && (
    <div className="flex flex-col items-center py-6 text-center">
      <CheckCircle className="text-muted-foreground h-8 w-8" />
      <p className="text-muted-foreground mt-2 text-sm">All caught up!</p>
    </div>
  );
}
```

---

### 3.3 Add Table Horizontal Scroll for Mobile

**Audit Ref:** Section 4.6 **Severity:** Minor **Complexity:** S

**Files to modify:** Every page with a `<Table>` component.

Wrap all `<Table>` components in a scrollable container:

```tsx
<div className="overflow-x-auto">
  <Table>...</Table>
</div>
```

**Pages:** UsersPage, ClassesPage, ExamsOverviewPage, AIUsagePage,
AcademicSessionPage

---

### 3.4 Add ARIA Labels to Charts

**Audit Ref:** Section 4.7 **Severity:** Major (accessibility) **Complexity:** S

**Files to modify:**

- `apps/admin-web/src/pages/DashboardPage.tsx`
- `apps/admin-web/src/pages/AnalyticsPage.tsx`
- `apps/admin-web/src/pages/AIUsagePage.tsx`

**Pattern to apply — wrap each chart section with aria attributes:**

```tsx
<div
  role="img"
  aria-label="Bar chart showing class performance with average exam scores per class"
>
  <SimpleBarChart data={classChartData} maxValue={100} height={200} />
</div>
```

**Specific labels:**

| Page          | Chart             | aria-label                                                  |
| ------------- | ----------------- | ----------------------------------------------------------- |
| DashboardPage | Class Performance | "Bar chart showing average exam scores per class"           |
| AnalyticsPage | Exam Performance  | "Bar chart comparing exam performance across classes"       |
| AnalyticsPage | Space Completion  | "Bar chart comparing space completion rates across classes" |
| AnalyticsPage | At-Risk           | "Bar chart showing at-risk student counts by class"         |
| AIUsagePage   | Daily Cost Trend  | "Bar chart showing daily AI costs for the selected month"   |
| AIUsagePage   | Cost by Task Type | "Bar chart showing AI costs broken down by task type"       |

**Also add `aria-label` to ProgressRing (AnalyticsPage line 202):**

```tsx
<div role="img" aria-label={`Exam average score: ${Math.round((selectedSummary.autograde.averageClassScore ?? 0) * 100)}%`}>
  <ProgressRing ... />
</div>
```

---

### 3.5 Add Skip-to-Content Link

**Audit Ref:** Section 4.7 **Severity:** Minor (accessibility) **Complexity:** S

**File to modify:** `apps/admin-web/src/layouts/AppLayout.tsx`

**Add at the very beginning of the AppLayout return, before `<AppShell>`:**

```tsx
<a
  href="#main-content"
  className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
>
  Skip to main content
</a>
```

**And add `id="main-content"` to the content area in AppShell (or wrap
`<Outlet>`):**

```tsx
<div id="main-content">
  <Outlet />
</div>
```

---

### 3.6 Add Form Validation to SettingsPage

**Audit Ref:** Section 3.11 Issue #3 **Severity:** Major **Complexity:** M

**File to modify:** `apps/admin-web/src/pages/SettingsPage.tsx`

**Add basic validation before save:**

```tsx
const handleSaveSchool = async () => {
  if (!tenantId) return;

  // Validate email
  if (schoolForm.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolForm.contactEmail)) {
    toast.error("Invalid email format");
    return;
  }

  // Validate phone (basic)
  if (schoolForm.contactPhone && !/^[\d\s\-+()]+$/.test(schoolForm.contactPhone)) {
    toast.error("Invalid phone number format");
    return;
  }

  setSavingSchool(true);
  try {
    await callSaveTenant({ ... });
    toast.success("School information updated");
    setIsEditingSchool(false);
  } catch (err) {
    toast.error("Failed to save", { description: err instanceof Error ? err.message : "Try again" });
  } finally {
    setSavingSchool(false);
  }
};
```

---

### 3.7 Add Copy-to-Clipboard for Tenant Code

**Audit Ref:** Section 3.11 Issue #6 **Severity:** Minor **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/SettingsPage.tsx`

**After the Tenant Code input (around line 232), add a copy button:**

```tsx
import { Copy, Check } from "lucide-react";
const [copied, setCopied] = useState(false);

// Replace tenant code input block:
<div className="space-y-2">
  <Label>Tenant Code</Label>
  <div className="flex gap-2">
    <Input
      defaultValue={tenant?.tenantCode ?? ""}
      readOnly
      className="bg-muted font-mono"
    />
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        navigator.clipboard.writeText(tenant?.tenantCode ?? "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Tenant code copied!");
      }}
      aria-label="Copy tenant code"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  </div>
</div>;
```

---

### 3.8 Add End Date Validation to AcademicSessionPage

**Audit Ref:** Section 3.12 Issue #3 **Severity:** Minor **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/AcademicSessionPage.tsx`

In the create/edit form submission handler, add:

```tsx
if (new Date(formData.endDate) <= new Date(formData.startDate)) {
  toast.error("End date must be after start date");
  return;
}
```

---

### 3.9 Implement Notifications `onLoadMore`

**Audit Ref:** Section 3.13 Issue #1 **Severity:** Minor **Complexity:** S

**File to modify:** `apps/admin-web/src/pages/NotificationsPage.tsx`

If `useNotifications` supports a pagination parameter:

```tsx
const [page, setPage] = useState(1);
const { data } = useNotifications(tenantId, userId, { page, limit: 20 });

// Pass to NotificationsPageUI:
onLoadMore={() => setPage(p => p + 1)}
```

If the hook doesn't support pagination, this is a backend/shared-hooks change —
mark as blocked.

---

## Phase 4: Polish, Accessibility & Advanced Features

> Final polish, comprehensive accessibility, and power-user features.

---

### 4.1 Extract Shared Status/Type Color Constants

**Audit Ref:** Section 3.7 Issue #3 **Severity:** Minor **Complexity:** S

**New file to create:** `apps/admin-web/src/lib/constants.ts`

```tsx
import type { BadgeProps } from "@levelup/shared-ui";

export const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  draft: "secondary",
  published: "default",
  active: "default",
  scheduled: "outline",
  grading: "outline",
  completed: "secondary",
  archived: "secondary",
};

export const TYPE_VARIANT: Record<string, BadgeProps["variant"]> = {
  learning: "outline",
  practice: "outline",
  assessment: "default",
  resource: "secondary",
  hybrid: "outline",
};
```

**Files to update:** Remove duplicated `STATUS_COLORS` / `TYPE_COLORS` from:

- `ExamsOverviewPage.tsx` (lines 6-13)
- `SpacesOverviewPage.tsx` (lines 6-18)
- `CoursesPage.tsx` (wherever defined)

Use `<Badge variant={STATUS_VARIANT[status] ?? "secondary"}>` instead.

---

### 4.2 Add Semantic Chart Color CSS Variables

**Audit Ref:** Section 5 — Color Usage Issues **Severity:** Minor
**Complexity:** S

**File to modify:** `apps/admin-web/src/index.css`

**Add inside `:root` (after line 36):**

```css
--chart-1: 221.2 83.2% 53.3%;
--chart-2: 142 71% 45%;
--chart-3: 45 93% 47%;
--chart-4: 263 70% 50%;
--chart-5: 220 9% 46%;
```

**Add inside `.dark`:**

```css
--chart-1: 217.2 91.2% 59.8%;
--chart-2: 142 71% 45%;
--chart-3: 45 93% 47%;
--chart-4: 263 70% 50%;
--chart-5: 220 9% 46%;
```

**Then update `AIUsagePage.tsx` purpose colors:**

```tsx
const PURPOSE_COLORS: Record<string, string> = {
  extraction: "hsl(var(--chart-1))",
  grading: "hsl(var(--chart-2))",
  evaluation: "hsl(var(--chart-3))",
  tutoring: "hsl(var(--chart-4))",
};
```

---

### 4.3 Add `role="tablist"` to Custom Tab Implementations

**Audit Ref:** Section 4.7 **Severity:** Minor (accessibility) **Complexity:** S

After Phase 1 changes, all custom tabs should be replaced with shared-ui
`<Tabs>` (which already has proper ARIA roles). Verify all custom tab
implementations are fully removed from:

- `SettingsPage.tsx` → should use `<Tabs>` after 1.5
- `ReportsPage.tsx` → should use `<Tabs>` after 1.7

If any remain, ensure `role="tablist"` on the container and `role="tab"` +
`aria-selected` on each button.

---

### 4.4 Add `aria-describedby` to Form Error Messages

**Audit Ref:** Section 4.7 **Severity:** Minor (accessibility) **Complexity:** S

**Files to modify:** All pages with form dialogs.

**Pattern:**

```tsx
// For each input with potential error:
<Input
  id="fieldName"
  aria-describedby={errors.fieldName ? "fieldName-error" : undefined}
/>;
{
  errors.fieldName && (
    <p id="fieldName-error" className="text-destructive text-sm" role="alert">
      {errors.fieldName}
    </p>
  );
}
```

Apply to: `LoginPage.tsx`, `UsersPage.tsx` (create user dialog),
`ClassesPage.tsx` (create class dialog), `SettingsPage.tsx` (all forms).

---

### 4.5 Add Sortable Column Headers

**Audit Ref:** Section 3.3 Issue #2 **Severity:** Major **Complexity:** L

**New file to create:** `apps/admin-web/src/components/SortableTableHead.tsx`

```tsx
import { TableHead } from "@levelup/shared-ui";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortDirection = "asc" | "desc" | null;

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  onSort,
}: SortableTableHeadProps) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead>
      <button
        className="hover:text-foreground flex items-center gap-1 transition-colors"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${children}`}
      >
        {children}
        {isActive ? (
          currentSort.direction === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  );
}
```

**New file:** `apps/admin-web/src/hooks/useSort.ts`

```tsx
import { useState, useMemo } from "react";

type SortDirection = "asc" | "desc" | null;

export function useSort<T>(
  items: T[],
  defaultKey = "",
  defaultDirection: SortDirection = null
) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(defaultDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) =>
        d === "asc" ? "desc" : d === "desc" ? null : "asc"
      );
      if (sortDirection === "desc") setSortKey("");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDirection) return items;
    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
      });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDirection]);

  return {
    sortedItems,
    currentSort: { key: sortKey, direction: sortDirection },
    handleSort,
  };
}
```

**Apply to:** `UsersPage.tsx`, `ClassesPage.tsx`, `ExamsOverviewPage.tsx`,
`AIUsagePage.tsx`, `AcademicSessionPage.tsx`

---

### 4.6 Resolve `createdBy` UID to Teacher Name (Exams)

**Audit Ref:** Section 3.5 Issue #3 **Severity:** Major **Complexity:** M

**File to modify:** `apps/admin-web/src/pages/ExamsOverviewPage.tsx`

**Add teacher name resolution:**

```tsx
import { useTeachers } from "@levelup/shared-hooks";

const { data: teachers = [] } = useTeachers(tenantId);
const teacherMap = useMemo(
  () =>
    new Map(
      teachers.map((t) => [
        t.uid,
        t.displayName ?? t.email ?? t.uid.slice(0, 8),
      ])
    ),
  [teachers]
);

// In the table cell (replacing line 120):
<TableCell className="text-muted-foreground">
  {exam.createdBy
    ? (teacherMap.get(exam.createdBy) ?? exam.createdBy.slice(0, 8))
    : "--"}
</TableCell>;
```

---

### 4.7 Fix Eval Settings Hardcoded Colors

**Audit Ref:** Section 3.11 — dimension toggle colors **Severity:** Minor
**Complexity:** S

**File to modify:** `apps/admin-web/src/pages/SettingsPage.tsx`

After Phase 1 replaces the tab component, also fix the dimension toggle pills:

**Replace lines 381-385 and 427-432:**

```tsx
// FROM:
className={`... ${dim.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}

// TO:
className={`... ${dim.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
```

---

### 4.8 Fix Tenant Name N+1 Query

**Audit Ref:** Section 2 Issue #5 **Severity:** Minor (performance)
**Complexity:** S

**File to modify:** `apps/admin-web/src/layouts/AppLayout.tsx`

**Replace lines 144-151 (individual `getDoc` calls) with batch `getDocs`:**

```tsx
import {
  collection,
  query,
  where,
  documentId,
  getDocs,
} from "firebase/firestore";

useEffect(() => {
  const otherTenantIds = adminMemberships
    .map((m) => m.tenantId)
    .filter((id) => id !== currentTenantId);
  if (otherTenantIds.length === 0) return;

  const { db } = getFirebaseServices();
  // Batch fetch all tenant docs at once
  const q = query(
    collection(db, "tenants"),
    where(documentId(), "in", otherTenantIds)
  );
  getDocs(q).then((snap) => {
    const entries = snap.docs.map(
      (doc) =>
        [doc.id, (doc.data() as { name?: string }).name ?? doc.id] as const
    );
    setTenantNames(Object.fromEntries(entries));
  });
}, [adminMemberships.length, currentTenantId]);
```

---

## Dependency Map

```
Phase 1:
  1.9 (Sonner Provider) ← must complete before 2.2 (toast notifications)
  1.1 (Dark Mode CSS)   ← must complete before 4.2 (chart color vars)

Phase 2:
  2.1 (Skeletons)       ← independent
  2.2 (Toasts)          ← depends on 1.9
  2.3 (Code Splitting)  ← independent
  2.4 (Error Boundaries) ← independent
  2.5 (Breadcrumbs)     ← independent

Phase 3:
  3.1 (Pagination)      ← independent
  3.4 (ARIA Charts)     ← independent
  3.6 (Validation)      ← depends on 2.2 (for toast errors)

Phase 4:
  4.1 (Status Colors)   ← depends on 1.3, 1.4 (component replacement)
  4.3 (Tab ARIA)        ← depends on 1.5, 1.7 (tab replacement)
  4.5 (Sortable Columns) ← independent but best after 3.1 (pagination)
```

---

## Summary

| Phase                   | Items        | Est. Total Effort |
| ----------------------- | ------------ | ----------------- |
| Phase 1: Critical Fixes | 9 items      | ~2-3 days         |
| Phase 2: Scale & UX     | 12 items     | ~3-4 days         |
| Phase 3: Enhanced UX    | 9 items      | ~3-4 days         |
| Phase 4: Polish         | 8 items      | ~2-3 days         |
| **Total**               | **38 items** | **~10-14 days**   |

### Quick Wins (can be done in under 30 minutes each):

- 2.7: Fix mobile grid (1 line change)
- 2.8: Make ScoreCards clickable (wrap in Link)
- 2.9: Add chart empty state
- 2.10: Replace hardcoded feature colors
- 2.11: Remove dead code
- 3.3: Add table scroll wrapper
- 3.5: Add skip-to-content link
- 3.8: Add date validation
