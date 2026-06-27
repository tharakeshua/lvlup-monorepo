# Implementation Plan: Super-Admin UI/UX Fixes

**Based on:** UI/UX Audit dated March 4, 2026 **Target App:**
`apps/super-admin/` **Created:** March 5, 2026

---

## Table of Contents

1. [Phase 1: Critical Foundation Fixes](#phase-1-critical-foundation-fixes)
2. [Phase 2: Design System Alignment](#phase-2-design-system-alignment)
3. [Phase 3: Loading, Empty & Error States](#phase-3-loading-empty--error-states)
4. [Phase 4: Form & Interaction Improvements](#phase-4-form--interaction-improvements)
5. [Phase 5: Dashboard Enhancement](#phase-5-dashboard-enhancement)
6. [Phase 6: Navigation & Layout Polish](#phase-6-navigation--layout-polish)
7. [Phase 7: Accessibility & Final Polish](#phase-7-accessibility--final-polish)
8. [New Shared Components to Create](#new-shared-components-to-create)
9. [Dependency Graph](#dependency-graph)

---

## New Shared Components to Create

These components should be created in `packages/shared-ui/src/components/ui/`
and exported from `packages/shared-ui/src/index.ts` before the page-level work
begins. They are reusable across all 5 apps.

### SC-1. `StatusBadge` Component (Size: S)

**File:** `packages/shared-ui/src/components/ui/status-badge.tsx`

**Purpose:** Reusable tenant/entity status indicator using semantic design
tokens instead of hardcoded colors.

```tsx
// status-badge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      status: {
        active:
          "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
        trial:
          "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
        suspended: "bg-destructive/10 text-destructive",
        expired: "bg-muted text-muted-foreground",
        operational:
          "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
        degraded:
          "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
        down: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      status: "active",
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  className?: string;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)}>
      <span className="sr-only">Status: </span>
      {children ?? status}
    </span>
  );
}
```

**Export:** Add `export * from './components/ui/status-badge';` to
`packages/shared-ui/src/index.ts`.

### SC-2. `StatCard` Component (Size: S)

**File:** `packages/shared-ui/src/components/ui/stat-card.tsx`

**Purpose:** Reusable metric display card using the Card composition pattern.

```tsx
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "./card";
import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-4 pb-1 pt-4">
        <Icon className="text-muted-foreground h-4 w-4" />
        <p className="text-muted-foreground text-sm">{label}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <p className="text-2xl font-bold">{value}</p>
        {subtext && <p className="text-muted-foreground text-xs">{subtext}</p>}
      </CardContent>
    </Card>
  );
}
```

**Export:** Add `export * from './components/ui/stat-card';` to
`packages/shared-ui/src/index.ts`.

### SC-3. `SearchInput` Component (Size: S)

**File:** `packages/shared-ui/src/components/ui/search-input.tsx`

**Purpose:** Input with search icon prefix, wrapping the existing `Input`
component.

```tsx
import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("relative", containerClassName)}>
      <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input ref={ref} className={cn("pl-9", className)} {...props} />
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
```

**Export:** Add `export * from './components/ui/search-input';` to
`packages/shared-ui/src/index.ts`.

### SC-4. `PageHeader` Component (Size: S)

**File:** `packages/shared-ui/src/components/ui/page-header.tsx`

**Purpose:** Consistent page header with title, description, and optional
actions slot.

```tsx
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

**Export:** Add `export * from './components/ui/page-header';` to
`packages/shared-ui/src/index.ts`.

---

## Phase 1: Critical Foundation Fixes

### 1.1 Add Dark Mode CSS Variables (Audit: C1) — Size: S

**File:** `apps/super-admin/src/index.css`

**What to change:** Add a `.dark` CSS class block after the `:root` block with
inverted HSL values. Reference the standard shadcn/ui dark theme values used
across the monorepo.

**Specific changes:**

```css
/* Add after the :root { ... } block, inside @layer base */
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

**Also:** Add ThemeProvider wrapping in `main.tsx` (optional — can be deferred
to Phase 6 since the `.dark` class is what matters for CSS compatibility).

### 1.2 Replace Raw HTML Elements with Shared-UI (Audit: C3) — Size: M

Replace ALL raw `<input>`, `<button>`, and `<select>` with shared-ui components.

#### 1.2a LoginPage.tsx — Replace raw `<input>` and `<button>`

**File:** `apps/super-admin/src/pages/LoginPage.tsx` **Lines:** 46-78

**Changes:**

1. Add imports:
   `import { Input, Button, Label, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@levelup/shared-ui";`
2. Replace raw `<input id="email" ...>` (line 46-54) with
   `<Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@levelup.com" />`
3. Replace raw `<input id="password" ...>` (line 61-69) with
   `<Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />`
4. Replace raw `<button>` (line 72-78) with
   `<Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>`
5. Replace raw `<label>` tags (lines 43, 58) with `<Label>` from shared-ui
6. Wrap in `<Card>` composition instead of raw div at line 27

#### 1.2b TenantsPage.tsx — Replace raw search `<input>`

**File:** `apps/super-admin/src/pages/TenantsPage.tsx` **Lines:** 113-119

**Changes:**

1. Import `SearchInput` (new shared component SC-3)
2. Replace the raw `<input>` + wrapping `<div className="relative flex-1">`
   block with:
   ```tsx
   <SearchInput
     placeholder="Search by name, code, or email..."
     value={searchQuery}
     onChange={(e) => setSearchQuery(e.target.value)}
     containerClassName="flex-1"
   />
   ```
3. Remove `Search` icon import from lucide (no longer needed for inline use)

#### 1.2c TenantsPage.tsx — Replace native `<select>` in create dialog

**File:** `apps/super-admin/src/pages/TenantsPage.tsx` **Lines:** 272-287

**Changes:**

1. Add imports: `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`
   from `@levelup/shared-ui`
2. Replace the native `<select id="tenant-plan">` block with:
   ```tsx
   <Select
     value={formData.plan}
     onValueChange={(v) =>
       setFormData((p) => ({ ...p, plan: v as CreateTenantForm["plan"] }))
     }
   >
     <SelectTrigger id="tenant-plan">
       <SelectValue />
     </SelectTrigger>
     <SelectContent>
       <SelectItem value="trial">Trial</SelectItem>
       <SelectItem value="basic">Basic</SelectItem>
       <SelectItem value="premium">Premium</SelectItem>
       <SelectItem value="enterprise">Enterprise</SelectItem>
     </SelectContent>
   </Select>
   ```

#### 1.2d TenantDetailPage.tsx — Replace 2 native `<select>` elements

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 456-466
(edit-status), 497-507 (sub-plan)

**Changes:**

1. Add Select imports to the existing import block
2. Replace `<select id="edit-status">` (line 456-466) with `Select` component
   (same pattern as 1.2c)
3. Replace `<select id="sub-plan">` (line 497-507) with `Select` component

#### 1.2e FeatureFlagsPage.tsx — Replace raw search `<input>` and save `<button>`

**File:** `apps/super-admin/src/pages/FeatureFlagsPage.tsx` **Lines:** 164-170
(search input), 223-230 (save button)

**Changes:**

1. Add imports: `SearchInput` (SC-3), `Button` from `@levelup/shared-ui`
2. Replace raw search `<input>` with `<SearchInput>` component
3. Replace raw `<button>` save button (line 223-230) with
   `<Button size="sm"><Save className="mr-1 h-3 w-3" />{updateFlags.isPending ? "Saving..." : "Save Changes"}</Button>`

#### 1.2f SystemHealthPage.tsx — Replace raw refresh `<button>`

**File:** `apps/super-admin/src/pages/SystemHealthPage.tsx` **Lines:** 196-203

**Changes:**

1. Add import: `Button` from `@levelup/shared-ui`
2. Replace raw `<button onClick={() => refetch()}>` with:
   ```tsx
   <Button
     variant="outline"
     size="sm"
     onClick={() => refetch()}
     disabled={isFetching}
   >
     <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
     {isFetching ? "Checking..." : "Refresh"}
   </Button>
   ```

#### 1.2g GlobalPresetsPage.tsx — Replace raw edit/delete `<button>` elements

**File:** `apps/super-admin/src/pages/GlobalPresetsPage.tsx` **Lines:** 311-322

**Changes:**

1. Replace raw `<button onClick={() => openEdit(preset)}>Edit</button>` with
   `<Button variant="ghost" size="sm" onClick={() => openEdit(preset)}>Edit</Button>`
2. Replace raw `<button onClick={() => setDeleteTarget(preset)}>Delete</button>`
   with
   `<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(preset)}>Delete</Button>`

### 1.3 Replace Hardcoded Status Badge Colors (Audit: C2) — Size: M

**Depends on:** SC-1 (`StatusBadge` component)

Replace ALL 7+ instances of hardcoded status badge conditional classes with
`<StatusBadge>`.

#### Files and exact locations:

| File                    | Lines   | Current Code                                        | Replace With                                                                                                                               |
| ----------------------- | ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DashboardPage.tsx`     | 134-144 | Inline conditional `bg-green-100...` in tenant list | `<StatusBadge status={tenant.status}>{tenant.status}</StatusBadge>`                                                                        |
| `TenantsPage.tsx`       | 32-37   | `STATUS_COLORS` constant + lines 196-201            | Remove `STATUS_COLORS` constant. Replace `<span className={...}>` with `<StatusBadge status={tenant.status}>{tenant.status}</StatusBadge>` |
| `TenantDetailPage.tsx`  | 228-240 | Inline conditional in header                        | `<StatusBadge status={tenant.status}>{tenant.status}</StatusBadge>`                                                                        |
| `UserAnalyticsPage.tsx` | 245-257 | Inline conditional in table row                     | `<StatusBadge status={ts.status}>{ts.status}</StatusBadge>`                                                                                |
| `FeatureFlagsPage.tsx`  | 200-210 | Inline conditional in tenant card header            | `<StatusBadge status={tenant.status}>{tenant.status}</StatusBadge>`                                                                        |

**Import to add in each file:**
`import { StatusBadge } from "@levelup/shared-ui";`

### 1.4 Add `overflow-x-auto` to TenantsPage Table (Audit: Responsive 13.2) — Size: S

**File:** `apps/super-admin/src/pages/TenantsPage.tsx` **Line:** 138

**Change:** Wrap `<table>` in `<div className="overflow-x-auto">`
(UserAnalyticsPage already has this, TenantsPage does not).

```tsx
// Before:
<div className="rounded-lg border">
  <table className="w-full">

// After:
<div className="rounded-lg border">
  <div className="overflow-x-auto">
    <table className="w-full">
    ...
    </table>
  </div>
```

---

## Phase 2: Design System Alignment

### 2.1 Replace Raw HTML Tables with Shared-UI Table (Audit: M3) — Size: M

#### 2.1a TenantsPage.tsx

**File:** `apps/super-admin/src/pages/TenantsPage.tsx` **Lines:** 138-216

**Changes:**

1. Add imports:
   `Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption`
   from `@levelup/shared-ui`
2. Replace the entire
   `<div className="rounded-lg border"><table>...</table></div>` block with:

```tsx
<div className="rounded-lg border">
  <Table>
    <TableCaption className="sr-only">List of registered tenants</TableCaption>
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead>Name</TableHead>
        <TableHead>Code</TableHead>
        <TableHead>Plan</TableHead>
        <TableHead>Users</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {isLoading ? (
        <TableRow>
          <TableCell colSpan={6} className="h-24 text-center">
            {/* Skeleton rows — see Phase 3 */}
            Loading...
          </TableCell>
        </TableRow>
      ) : !filtered?.length ? (
        <TableRow>
          <TableCell colSpan={6} className="h-24 text-center">
            No tenants found
          </TableCell>
        </TableRow>
      ) : (
        filtered.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell>
              <div>
                <p className="font-medium">{tenant.name}</p>
                <p className="text-muted-foreground text-xs">
                  {tenant.contactEmail}
                </p>
              </div>
            </TableCell>
            <TableCell className="font-mono text-sm">
              {tenant.tenantCode}
            </TableCell>
            <TableCell className="capitalize">
              {tenant.subscription?.plan ?? "--"}
            </TableCell>
            <TableCell>
              {(tenant.stats?.totalStudents ?? 0) +
                (tenant.stats?.totalTeachers ?? 0)}
            </TableCell>
            <TableCell>
              <StatusBadge status={tenant.status}>{tenant.status}</StatusBadge>
            </TableCell>
            <TableCell>
              <Link
                to={`/tenants/${tenant.id}`}
                className="text-primary text-sm hover:underline"
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))
      )}
    </TableBody>
  </Table>
</div>
```

#### 2.1b UserAnalyticsPage.tsx

**File:** `apps/super-admin/src/pages/UserAnalyticsPage.tsx` **Lines:** 182-265

**Changes:** Same pattern as 2.1a. Replace raw `<table>` with shared-ui `Table`
components. Keep the existing `<div className="overflow-x-auto">` wrapper (but
note the shared-ui `Table` component already includes `overflow-auto`, so the
outer wrapper can be removed).

### 2.2 Replace Hand-Built Stat Cards with StatCard Component (Audit: M8) — Size: M

**Depends on:** SC-2 (`StatCard` component)

#### 2.2a DashboardPage.tsx

**File:** `apps/super-admin/src/pages/DashboardPage.tsx` **Lines:** 100-111

**Changes:**

1. Import `StatCard` from `@levelup/shared-ui`
2. Replace the `statCards.map` rendering block:

```tsx
// Before:
{
  statCards.map((card) => (
    <div key={card.label} className="bg-card rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <card.icon className="text-muted-foreground h-4 w-4" />
        <p className="text-muted-foreground text-sm">{card.label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold">{card.value}</p>
      <p className="text-muted-foreground text-xs">{card.sub}</p>
    </div>
  ));
}

// After:
{
  statCards.map((card) => (
    <StatCard
      key={card.label}
      label={card.label}
      value={card.value}
      icon={card.icon}
      subtext={card.sub}
    />
  ));
}
```

#### 2.2b TenantDetailPage.tsx

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 252-277

**Changes:** Same pattern. Import `StatCard` and replace 4 hand-built stat divs
with:

```tsx
<StatCard label="Students" value={tenant.stats?.totalStudents ?? 0} icon={Users} />
<StatCard label="Teachers" value={tenant.stats?.totalTeachers ?? 0} icon={GraduationCap} />
<StatCard label="Exams" value={tenant.stats?.totalExams ?? 0} icon={ClipboardList} />
<StatCard label="Spaces" value={tenant.stats?.totalSpaces ?? 0} icon={BookOpen} />
```

Add missing icon imports: `GraduationCap, ClipboardList, BookOpen, Users` from
lucide-react.

#### 2.2c UserAnalyticsPage.tsx

**File:** `apps/super-admin/src/pages/UserAnalyticsPage.tsx` **Lines:** 136-147

**Changes:** Same pattern. Replace with `<StatCard>`.

### 2.3 Replace Hand-Built Progress Bars with Shared-UI Progress (Audit: related to M3) — Size: S

**File:** `apps/super-admin/src/pages/UserAnalyticsPage.tsx` **Lines:** 169-174

**Changes:**

1. Import `Progress` from `@levelup/shared-ui`
2. Replace:

```tsx
// Before:
<div className="h-2 w-full rounded-full bg-gray-200">
  <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
</div>

// After:
<Progress value={Math.min(pct, 100)} className="h-2" />
```

### 2.4 Use Card Components for Info Sections in TenantDetailPage (Audit: M8 extension) — Size: S

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 281, 331,
356, 376

**Changes:** Replace `<div className="rounded-lg border bg-card p-6">` with
proper Card composition:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">Subscription</CardTitle>
  </CardHeader>
  <CardContent>{/* existing dl content */}</CardContent>
</Card>
```

Apply same pattern to Contact, Features, and Settings sections. Import
`Card, CardHeader, CardTitle, CardContent` from `@levelup/shared-ui`.

---

## Phase 3: Loading, Empty & Error States

### 3.1 Add Skeleton Loading States to All Pages (Audit: M2) — Size: L

Replace "Loading..." text strings with content-shaped `Skeleton` placeholders.

#### 3.1a DashboardPage.tsx

**File:** `apps/super-admin/src/pages/DashboardPage.tsx` **Lines:** 94-97

**Changes:**

1. Import `Skeleton, Card, CardHeader, CardContent` from `@levelup/shared-ui`
2. Replace the loading block with:

```tsx
{isLoading ? (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-1 pt-4 px-4">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </CardContent>
    </Card>
  </div>
) : ( /* existing content */ )}
```

#### 3.1b TenantsPage.tsx

**File:** `apps/super-admin/src/pages/TenantsPage.tsx` **Lines:** 163-167

**Changes:** Replace loading table cell with skeleton rows:

```tsx
{isLoading ? (
  Array.from({ length: 5 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-5 w-40" /><Skeleton className="mt-1 h-3 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
    </TableRow>
  ))
) : /* ... */}
```

#### 3.1c TenantDetailPage.tsx

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 186-192

**Changes:** Replace loading text with skeleton:

```tsx
if (isLoading) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-24" />
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### 3.1d GlobalPresetsPage.tsx

**File:** `apps/super-admin/src/pages/GlobalPresetsPage.tsx` **Lines:** 271-274

**Changes:** Replace "Loading presets..." text:

```tsx
{isLoading ? (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-2 mt-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-6 w-20 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
) : /* ... */}
```

#### 3.1e FeatureFlagsPage.tsx

**File:** `apps/super-admin/src/pages/FeatureFlagsPage.tsx` **Lines:** 174-177

**Changes:** Replace "Loading tenant flags..." text:

```tsx
{isLoading ? (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
) : /* ... */}
```

#### 3.1f SettingsPage.tsx

**File:** `apps/super-admin/src/pages/SettingsPage.tsx` **Lines:** 144-148

**Changes:** Replace "Loading configuration..." text:

```tsx
{isLoading ? (
  <div className="space-y-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <Card key={i}>
        <CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="mt-1 h-3 w-64" /></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    ))}
  </div>
) : /* ... */}
```

### 3.2 Improve Empty States with Icons and CTAs (Audit: 11.1) — Size: M

#### 3.2a TenantsPage.tsx — Empty table state

**File:** `apps/super-admin/src/pages/TenantsPage.tsx` **Lines:** 169-174

**Changes:**

```tsx
// Replace "No tenants found" cell with:
<TableRow>
  <TableCell colSpan={6} className="h-48">
    <div className="flex flex-col items-center justify-center text-center">
      <Building2 className="text-muted-foreground/50 h-10 w-10" />
      <h3 className="mt-3 text-sm font-semibold">No tenants found</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-xs">
        {searchQuery || statusFilter !== "all"
          ? "Try adjusting your search or filter criteria."
          : "Create your first tenant to get started."}
      </p>
    </div>
  </TableCell>
</TableRow>
```

#### 3.2b TenantDetailPage.tsx — Not found state

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 194-209

**Changes:** Add `Building2` icon and a more helpful message with a back button:

```tsx
if (!tenant) {
  return (
    <div className="space-y-4">
      <Link
        to="/tenants"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tenants
      </Link>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Building2 className="text-muted-foreground/50 h-10 w-10" />
        <h3 className="mt-3 text-lg font-semibold">Tenant not found</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          This tenant may have been deleted or the ID is invalid.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/tenants">View All Tenants</Link>
        </Button>
      </div>
    </div>
  );
}
```

#### 3.2c FeatureFlagsPage.tsx — Empty state

**File:** `apps/super-admin/src/pages/FeatureFlagsPage.tsx` **Lines:** 178-181

**Changes:** Similar improvement with `Building2` icon and descriptive text.

#### 3.2d GlobalPresetsPage.tsx — Empty state

**File:** `apps/super-admin/src/pages/GlobalPresetsPage.tsx` **Lines:** 276-281

**Changes:** Add `Sliders` icon to the existing empty state (already has good
text).

### 3.3 Add Error States with Alert Component (Audit: 11.1) — Size: M

Add error handling using the shared-ui `Alert` component to pages that fail
silently.

**Pattern to apply across DashboardPage, TenantsPage, TenantDetailPage,
GlobalPresetsPage, SettingsPage:**

1. Add `isError, error, refetch` from the useQuery hook
2. Add error rendering block:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@levelup/shared-ui";
import { AlertCircle } from "lucide-react";

{
  isError && (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to load data</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        {(error as Error)?.message ?? "An unexpected error occurred."}
        <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

**Files to modify:**

- `DashboardPage.tsx` — add error block after loading check
- `TenantsPage.tsx` — add error block after loading check
- `TenantDetailPage.tsx` — add error block
- `GlobalPresetsPage.tsx` — add error block
- `SettingsPage.tsx` — add error block

---

## Phase 4: Form & Interaction Improvements

### 4.1 Migrate Forms to react-hook-form + Zod (Audit: M4) — Size: XL

This is the largest single change. Migrate all form dialogs from manual
`useState` to `react-hook-form` + `Zod`.

#### 4.1a TenantsPage.tsx — Create Tenant Dialog

**File:** `apps/super-admin/src/pages/TenantsPage.tsx`

**Changes:**

1. Add imports: `useForm` from `react-hook-form`, `zodResolver` from
   `@hookform/resolvers/zod`, `z` from `zod`,
   `Form, FormField, FormItem, FormLabel, FormControl, FormMessage` from
   `@levelup/shared-ui`
2. Define Zod schema:
   ```tsx
   const createTenantSchema = z.object({
     name: z.string().min(1, "Organization name is required"),
     tenantCode: z
       .string()
       .min(1, "Tenant code is required")
       .regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers, and hyphens only"),
     contactEmail: z.string().email("Valid email address required"),
     contactPerson: z.string().optional(),
     plan: z.enum(["trial", "basic", "premium", "enterprise"]),
   });
   type CreateTenantFormValues = z.infer<typeof createTenantSchema>;
   ```
3. Replace `useState` form management with `useForm`:
   ```tsx
   const form = useForm<CreateTenantFormValues>({
     resolver: zodResolver(createTenantSchema),
     defaultValues: {
       name: "",
       tenantCode: "",
       contactEmail: "",
       contactPerson: "",
       plan: "trial",
     },
   });
   ```
4. Rewrite dialog body using `<Form>` / `<FormField>` composition pattern
5. Remove `formData`, `setFormData`, `formError`, `setFormError` state
6. Use `form.reset()` on dialog close/success

#### 4.1b TenantDetailPage.tsx — Edit Tenant & Edit Subscription Dialogs

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx`

**Changes:** Same pattern as 4.1a for both dialogs.

Edit Tenant schema:

```tsx
const editTenantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactEmail: z.string().email("Valid email required"),
  contactPhone: z.string().optional(),
  contactPerson: z.string().optional(),
  website: z.string().url("Valid URL required").optional().or(z.literal("")),
  status: z.enum(["active", "trial", "suspended", "expired"]),
});
```

Subscription schema:

```tsx
const subscriptionSchema = z.object({
  plan: z.enum(["trial", "basic", "premium", "enterprise"]),
  maxStudents: z.string().optional(),
  maxTeachers: z.string().optional(),
  maxSpaces: z.string().optional(),
  maxExamsPerMonth: z.string().optional(),
  expiresAt: z.string().optional(),
});
```

#### 4.1c GlobalPresetsPage.tsx — Preset Form Dialog

**File:** `apps/super-admin/src/pages/GlobalPresetsPage.tsx`

**Changes:** Migrate `PresetFormDialog` to react-hook-form. This is more complex
due to nested `dimensions` and `displaySettings`.

Schema:

```tsx
const presetSchema = z.object({
  name: z.string().min(1, "Preset name is required"),
  description: z.string().optional(),
  isDefault: z.boolean(),
  isPublic: z.boolean(),
  displaySettings: z.object({
    showStrengths: z.boolean(),
    showKeyTakeaway: z.boolean(),
    prioritizeByImportance: z.boolean(),
  }),
  dimensions: z.record(
    z.object({
      enabled: z.boolean(),
      weight: z.number().min(1).max(5),
    })
  ),
});
```

### 4.2 Add Confirmation for Maintenance Mode Toggle (Audit: m5) — Size: S

**File:** `apps/super-admin/src/pages/SettingsPage.tsx` **Lines:** 229-239

**Changes:**

1. Add `AlertDialog` imports (already available in shared-ui)
2. Add state:
   `const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);`
3. Modify `handleMaintenanceModeChange`:
   ```tsx
   const handleMaintenanceModeChange = (value: boolean) => {
     if (value) {
       // Enabling maintenance mode — show confirmation
       setMaintenanceConfirmOpen(true);
     } else {
       setMaintenanceMode(false);
       setIsDirty(true);
     }
   };
   ```
4. Add AlertDialog:
   ```tsx
   <AlertDialog
     open={maintenanceConfirmOpen}
     onOpenChange={setMaintenanceConfirmOpen}
   >
     <AlertDialogContent>
       <AlertDialogHeader>
         <AlertDialogTitle>Enable Maintenance Mode?</AlertDialogTitle>
         <AlertDialogDescription>
           This will prevent all non-admin users from accessing the platform.
           They will see a maintenance page instead.
         </AlertDialogDescription>
       </AlertDialogHeader>
       <AlertDialogFooter>
         <AlertDialogCancel>Cancel</AlertDialogCancel>
         <AlertDialogAction
           onClick={() => {
             setMaintenanceMode(true);
             setIsDirty(true);
             setMaintenanceConfirmOpen(false);
           }}
         >
           Enable Maintenance Mode
         </AlertDialogAction>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog>
   ```

### 4.3 Add Type-to-Confirm for Tenant Deletion (Audit: Security 9.3) — Size: S

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 582-603

**Changes:**

1. Add state: `const [deleteConfirmText, setDeleteConfirmText] = useState("");`
2. Reset on dialog open: clear `deleteConfirmText` when `setDeleteOpen(true)`
3. Modify the AlertDialog body to include a type-to-confirm input:
   ```tsx
   <AlertDialogContent>
     <AlertDialogHeader>
       <AlertDialogTitle className="flex items-center gap-2">
         <AlertTriangle className="text-destructive h-5 w-5" />
         Delete Tenant Permanently
       </AlertDialogTitle>
       <AlertDialogDescription>
         This will permanently delete "{tenant.name}" and all associated data
         including {tenant.stats?.totalStudents ?? 0} students,
         {tenant.stats?.totalTeachers ?? 0} teachers, and all subcollections.
       </AlertDialogDescription>
     </AlertDialogHeader>
     <div className="space-y-2 py-2">
       <Label>
         Type{" "}
         <code className="bg-muted rounded px-1 py-0.5 font-mono text-sm">
           {tenant.tenantCode}
         </code>{" "}
         to confirm
       </Label>
       <Input
         value={deleteConfirmText}
         onChange={(e) => setDeleteConfirmText(e.target.value)}
         placeholder={tenant.tenantCode}
       />
     </div>
     <AlertDialogFooter>
       <AlertDialogCancel disabled={deleteTenant.isPending}>
         Cancel
       </AlertDialogCancel>
       <Button
         variant="destructive"
         disabled={
           deleteTenant.isPending || deleteConfirmText !== tenant.tenantCode
         }
         onClick={() => deleteTenant.mutate()}
       >
         {deleteTenant.isPending
           ? "Deleting..."
           : "I understand, delete this tenant"}
       </Button>
     </AlertDialogFooter>
   </AlertDialogContent>
   ```
4. Import `AlertTriangle` from lucide-react.

### 4.4 Fix Feature Flags Direct Firestore Write (Audit: M7) — Size: M

**File:** `apps/super-admin/src/pages/FeatureFlagsPage.tsx` **Lines:** 61-71

**Changes:**

1. Replace direct `updateDoc` with Cloud Function call:
   ```tsx
   const updateFlags = useMutation({
     mutationFn: async ({
       tenantId,
       flags,
     }: {
       tenantId: string;
       flags: Record<string, boolean>;
     }) => {
       const { functions } = getFirebaseServices();
       const saveFn = httpsCallable(functions, "saveTenant");
       await saveFn({ id: tenantId, data: { features: flags } });
     },
     // ... rest stays the same
   });
   ```
2. Update imports: Remove `doc, updateDoc` from firestore imports, add
   `httpsCallable` from `firebase/functions`
3. Note: This requires the backend `saveTenant` function to support partial
   updates with `features` field. Verify this works with the existing Cloud
   Function.

### 4.5 Fix GlobalPresetsPage Dialog Scroll (Audit: m10) — Size: S

**File:** `apps/super-admin/src/pages/GlobalPresetsPage.tsx` **Line:** 451

**Changes:** Make the dialog header and footer sticky while only the body
scrolls:

```tsx
// Before:
<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">

// After:
<DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
  <DialogHeader className="flex-shrink-0">
    <DialogTitle>{title}</DialogTitle>
  </DialogHeader>
  <div className="flex-1 overflow-y-auto space-y-5 py-2">
    {/* form content */}
  </div>
  <DialogFooter className="flex-shrink-0">
    {/* buttons */}
  </DialogFooter>
</DialogContent>
```

---

## Phase 5: Dashboard Enhancement

### 5.1 Add Charts to Dashboard Using Recharts (Audit: M5) — Size: L

**File:** `apps/super-admin/src/pages/DashboardPage.tsx`

**Changes:**

1. Import recharts:
   `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";`
2. Compute chart data from existing `stats.tenants`:

   ```tsx
   // Users by Plan distribution (for donut chart)
   const planData = useMemo(() => {
     if (!stats?.tenants) return [];
     const plans: Record<string, number> = {};
     for (const t of stats.tenants) {
       const plan = t.subscription?.plan ?? "none";
       plans[plan] =
         (plans[plan] ?? 0) +
         (t.stats?.totalStudents ?? 0) +
         (t.stats?.totalTeachers ?? 0);
     }
     return Object.entries(plans).map(([name, value]) => ({ name, value }));
   }, [stats]);

   // Top tenants by users (for bar chart)
   const topTenants = useMemo(() => {
     if (!stats?.tenants) return [];
     return [...stats.tenants]
       .sort((a, b) => {
         const aUsers =
           (a.stats?.totalStudents ?? 0) + (a.stats?.totalTeachers ?? 0);
         const bUsers =
           (b.stats?.totalStudents ?? 0) + (b.stats?.totalTeachers ?? 0);
         return bUsers - aUsers;
       })
       .slice(0, 8)
       .map((t) => ({
         name: t.name.length > 15 ? t.name.slice(0, 15) + "..." : t.name,
         users: (t.stats?.totalStudents ?? 0) + (t.stats?.totalTeachers ?? 0),
       }));
   }, [stats]);
   ```

3. Add chart section after stat cards:
   ```tsx
   <div className="grid gap-4 md:grid-cols-2">
     <Card>
       <CardHeader>
         <CardTitle className="text-base">Top Tenants by Users</CardTitle>
       </CardHeader>
       <CardContent>
         <ResponsiveContainer width="100%" height={250}>
           <BarChart data={topTenants}>
             <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
             <XAxis
               dataKey="name"
               className="text-xs"
               tick={{ fill: "hsl(var(--muted-foreground))" }}
             />
             <YAxis
               className="text-xs"
               tick={{ fill: "hsl(var(--muted-foreground))" }}
             />
             <Tooltip />
             <Bar
               dataKey="users"
               fill="hsl(var(--primary))"
               radius={[4, 4, 0, 0]}
             />
           </BarChart>
         </ResponsiveContainer>
       </CardContent>
     </Card>
     <Card>
       <CardHeader>
         <CardTitle className="text-base">Users by Plan</CardTitle>
       </CardHeader>
       <CardContent className="flex justify-center">
         <ResponsiveContainer width="100%" height={250}>
           <PieChart>
             <Pie
               data={planData}
               innerRadius={60}
               outerRadius={100}
               dataKey="value"
               nameKey="name"
               label
             >
               {planData.map((_, index) => (
                 <Cell
                   key={index}
                   fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                 />
               ))}
             </Pie>
             <Tooltip />
           </PieChart>
         </ResponsiveContainer>
       </CardContent>
     </Card>
   </div>
   ```
4. Define chart colors:
   ```tsx
   const PLAN_COLORS = [
     "hsl(var(--primary))",
     "hsl(var(--chart-2, 160 60% 45%))",
     "hsl(var(--chart-3, 30 80% 55%))",
     "hsl(var(--chart-4, 280 65% 60%))",
     "hsl(var(--chart-5, 340 75% 55%))",
   ];
   ```

### 5.2 Make Recent Tenants Clickable (Audit: Dashboard 4.2) — Size: S

**File:** `apps/super-admin/src/pages/DashboardPage.tsx` **Lines:** 117-147

**Changes:**

1. Import `Link` from `react-router-dom`
2. Wrap each tenant row with `<Link to={`/tenants/${tenant.id}`}>`:
   ```tsx
   <Link
     key={tenant.id}
     to={`/tenants/${tenant.id}`}
     className="bg-muted/30 hover:bg-muted/50 flex items-center justify-between rounded-md p-3 transition-colors"
   >
     {/* existing content */}
   </Link>
   ```
3. Change the wrapping `<div>` to a `<Link>` and adjust from `div` to `anchor`
   semantics

### 5.3 Add Quick Actions Section (Audit: Dashboard 4.2) — Size: S

**File:** `apps/super-admin/src/pages/DashboardPage.tsx`

**Changes:** Add after the recent tenants section:

```tsx
<div className="grid gap-3 md:grid-cols-3">
  <Button variant="outline" className="h-auto justify-start py-3" asChild>
    <Link to="/tenants">
      <Plus className="mr-2 h-4 w-4" />
      <div className="text-left">
        <p className="font-medium">Create Tenant</p>
        <p className="text-muted-foreground text-xs">Add a new school</p>
      </div>
    </Link>
  </Button>
  <Button variant="outline" className="h-auto justify-start py-3" asChild>
    <Link to="/system">
      <Activity className="mr-2 h-4 w-4" />
      <div className="text-left">
        <p className="font-medium">System Health</p>
        <p className="text-muted-foreground text-xs">Monitor services</p>
      </div>
    </Link>
  </Button>
  <Button variant="outline" className="h-auto justify-start py-3" asChild>
    <Link to="/settings">
      <Settings className="mr-2 h-4 w-4" />
      <div className="text-left">
        <p className="font-medium">Settings</p>
        <p className="text-muted-foreground text-xs">Platform config</p>
      </div>
    </Link>
  </Button>
</div>
```

Import `Plus, Activity, Settings` from lucide and `Link` from react-router-dom.

---

## Phase 6: Navigation & Layout Polish

### 6.1 Add Breadcrumbs via pageTitle (Audit: M1) — Size: M

**File:** `apps/super-admin/src/layouts/AppLayout.tsx` **Lines:** 93-97

**Approach:** Use React Router's `useLocation` to derive page title from the
current path, and pass it to `AppShell` via the `pageTitle` prop.

**Changes:**

1. Create a helper function to derive page title:

   ```tsx
   function usePageTitle(): string {
     const location = useLocation();
     const path = location.pathname;

     if (path === "/") return "Dashboard";
     if (path === "/tenants") return "Tenants";
     if (path.startsWith("/tenants/")) return "Tenant Details";
     if (path === "/analytics") return "User Analytics";
     if (path === "/feature-flags") return "Feature Flags";
     if (path === "/presets") return "Evaluation Presets";
     if (path === "/system") return "System Health";
     if (path === "/settings") return "Settings";
     return "";
   }
   ```

2. Use it:
   ```tsx
   export default function AppLayout() {
     const pageTitle = usePageTitle();
     // ...
     return (
       <AppShell sidebar={sidebar} pageTitle={pageTitle}>
         <Outlet />
       </AppShell>
     );
   }
   ```

### 6.2 Enhance Sidebar Footer (Audit: M6) — Size: M

**File:** `apps/super-admin/src/layouts/AppLayout.tsx` **Lines:** 78-82

**Changes:**

1. Import: `Avatar, AvatarFallback` from `@levelup/shared-ui`,
   `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger`
   from `@levelup/shared-ui`, `LogOut, ChevronsUpDown, Shield` from lucide
2. Replace the minimal footer with a dropdown menu:
   ```tsx
   const sidebarFooter = (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <button className="hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm">
           <Avatar className="h-7 w-7">
             <AvatarFallback className="bg-primary text-primary-foreground text-xs">
               {(user?.displayName ?? user?.email ?? "SA")
                 .charAt(0)
                 .toUpperCase()}
             </AvatarFallback>
           </Avatar>
           <div className="flex-1 text-left">
             <p className="truncate text-xs font-medium">
               {user?.displayName ?? "Super Admin"}
             </p>
             <p className="text-muted-foreground truncate text-[10px]">
               {user?.email}
             </p>
           </div>
           <ChevronsUpDown className="text-muted-foreground h-3 w-3" />
         </button>
       </DropdownMenuTrigger>
       <DropdownMenuContent side="top" align="start" className="w-56">
         <DropdownMenuLabel className="flex items-center gap-2">
           <Shield className="h-3 w-3" />
           Super Admin
         </DropdownMenuLabel>
         <DropdownMenuSeparator />
         <DropdownMenuItem
           onClick={logout}
           className="text-destructive focus:text-destructive"
         >
           <LogOut className="mr-2 h-4 w-4" />
           Sign Out
         </DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
   );
   ```
3. Pass `logout` from `useAuthStore` (already available in the component).

### 6.3 Remove Redundant LogoutButton (Audit: m9) — Size: S

**Depends on:** 6.2 (sidebar footer now has logout)

#### 6.3a DashboardPage.tsx

**File:** `apps/super-admin/src/pages/DashboardPage.tsx` **Lines:** 4 (import),
46 (useAuthStore), 86-91 (LogoutButton)

**Changes:**

1. Remove `import { LogoutButton } from "@levelup/shared-ui";`
2. Remove `const { logout } = useAuthStore();` (line 46)
3. Remove the entire `<LogoutButton>` block (lines 86-91)
4. Can also simplify the header since the "Sign Out" button is gone — remove the
   `flex justify-between` wrapper if no longer needed

#### 6.3b SettingsPage.tsx

**File:** `apps/super-admin/src/pages/SettingsPage.tsx` **Lines:** 18
(LogoutButton import), 262-289 (Admin Account card)

**Changes:**

1. Remove `LogoutButton` from imports
2. Remove `LogOut` from lucide imports
3. Remove `const { logout } = useAuthStore();` (keep if still needed elsewhere)
4. Replace the Admin Account card to remove the Sign Out button:
   ```tsx
   <Card>
     <CardHeader>
       <div className="flex items-center gap-2">
         <Shield className="h-4 w-4" />
         <CardTitle className="text-base">Admin Account</CardTitle>
       </div>
     </CardHeader>
     <CardContent>
       <div>
         <p className="text-sm font-medium">
           {user?.displayName || "Super Admin"}
         </p>
         <p className="text-muted-foreground text-xs">{user?.email}</p>
       </div>
     </CardContent>
   </Card>
   ```

### 6.4 Fix Teacher Icon in UserAnalyticsPage (Audit: m8) — Size: S

**File:** `apps/super-admin/src/pages/UserAnalyticsPage.tsx` **Line:** 5
(import), 113

**Changes:**

1. Replace `TrendingUp` import with `GraduationCap`:
   ```tsx
   // Before:
   import { Users, TrendingUp, Building2, UserPlus } from "lucide-react";
   // After:
   import { Users, GraduationCap, Building2, UserPlus } from "lucide-react";
   ```
2. Update the Teachers stat card (line 113):
   ```tsx
   // Before:
   icon: TrendingUp,
   // After:
   icon: GraduationCap,
   ```

### 6.5 Login Page Branding (Audit: m1) — Size: M

**File:** `apps/super-admin/src/pages/LoginPage.tsx`

**Changes:**

1. After converting to shared-ui components (Phase 1.2a), enhance the card:
   ```tsx
   <Card className="w-full max-w-md">
     <CardHeader className="space-y-2 text-center">
       <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-xl">
         <Shield className="text-primary h-6 w-6" />
       </div>
       <CardTitle className="text-xl">LevelUp Admin</CardTitle>
       <CardDescription>Sign in to the platform console</CardDescription>
     </CardHeader>
     <CardContent>{/* form content */}</CardContent>
   </Card>
   ```
2. Import `Shield` from lucide-react
3. Add a loading spinner to the button:
   ```tsx
   <Button type="submit" className="w-full" disabled={loading}>
     {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
     {loading ? "Signing in..." : "Sign In"}
   </Button>
   ```
4. Import `Loader2` from lucide-react

### 6.6 Improve Access Denied Page (Audit: m2) — Size: S

**File:** `apps/super-admin/src/guards/RequireAuth.tsx` **Lines:** 44-52

**Changes:**

```tsx
import { ShieldX } from "lucide-react";
import { Button } from "@levelup/shared-ui";
import { Link } from "react-router-dom";

// Replace the plain text access denied with:
<div className="flex h-screen items-center justify-center">
  <div className="max-w-sm text-center">
    <ShieldX className="text-destructive/60 mx-auto h-12 w-12" />
    <h2 className="mt-4 text-lg font-semibold">Access Denied</h2>
    <p className="text-muted-foreground mt-2 text-sm">
      You need super admin privileges to access this console. Contact your
      platform administrator if you believe this is an error.
    </p>
    <Button variant="outline" className="mt-4" asChild>
      <Link to="/login">Back to Login</Link>
    </Button>
  </div>
</div>;
```

### 6.7 Fix Feature Name Labels (Audit: m4) — Size: S

**File:** `apps/super-admin/src/pages/TenantDetailPage.tsx` **Lines:** 366-369

**Changes:** Replace the regex-based label transformation with a lookup map:

```tsx
// Add at top of file or import from a constants file:
const FEATURE_LABELS: Record<string, string> = {
  autoGradeEnabled: "Auto Grade",
  levelUpEnabled: "Learning Spaces",
  scannerAppEnabled: "Scanner App",
  aiChatEnabled: "AI Chat Tutor",
  aiGradingEnabled: "AI Grading",
  analyticsEnabled: "Analytics",
  parentPortalEnabled: "Parent Portal",
  bulkImportEnabled: "Bulk Import",
  apiAccessEnabled: "API Access",
};

// Replace the label rendering:
// Before:
{
  key
    .replace(/([A-Z])/g, " $1")
    .replace("Enabled", "")
    .trim();
}

// After:
{
  FEATURE_LABELS[key] ??
    key
      .replace(/([A-Z])/g, " $1")
      .replace("Enabled", "")
      .trim();
}
```

### 6.8 Remove or Implement Error Rate Metric (Audit: m7) — Size: S

**File:** `apps/super-admin/src/pages/SystemHealthPage.tsx` **Lines:** 319-323

**Changes:** Remove the "Error Rate" metric card entirely since it permanently
shows "N/A":

```tsx
// Remove this block:
<div className="bg-muted/50 rounded-lg p-4">
  <p className="text-muted-foreground text-sm">Error Rate</p>
  <p className="text-muted-foreground text-2xl font-bold">N/A</p>
  <p className="text-muted-foreground mt-1 text-xs">No logging system yet</p>
</div>
```

Change grid from `md:grid-cols-3` to `md:grid-cols-2` on the parent div (line
288).

---

## Phase 7: Accessibility & Final Polish

### 7.1 Add `sr-only` Text to Status Indicators (Audit: A10.1) — Size: S

**Already handled:** The `StatusBadge` component (SC-1) includes
`<span className="sr-only">Status: </span>`. This covers all status badge
instances once Phase 1.3 is complete.

For health status dots in `SystemHealthPage.tsx`, add:

```tsx
// After each status dot:
<span className="sr-only">{svc.result.status}</span>
```

### 7.2 Add `aria-pressed` to Feature Flag Toggle Buttons (Audit: A10.1) — Size: S

**File:** `apps/super-admin/src/pages/FeatureFlagsPage.tsx` **Lines:** 239

**Changes:** Add `aria-pressed` to toggle buttons:

```tsx
<button
  key={flag.key}
  type="button"
  aria-pressed={isEnabled}
  aria-label={`${flag.label}: ${isEnabled ? "enabled" : "disabled"}`}
  onClick={() => toggleFlag(tenant.tenantId, flag.key, tenant.flags)}
  // ... rest stays the same
>
```

### 7.3 Add Table Captions (Audit: A10.1) — Size: S

**Already handled:** The shared-ui `Table` refactoring in Phase 2.1 includes
`<TableCaption className="sr-only">` elements.

### 7.4 Add `role="status"` to Loading Indicators (Audit: A10.1) — Size: S

**All pages:** Add `role="status"` and `aria-label` to loading skeleton
containers:

```tsx
<div role="status" aria-label="Loading...">
  {/* skeleton content */}
  <span className="sr-only">Loading...</span>
</div>
```

### 7.5 Add `aria-label` to Icon-Only Buttons (Audit: A10.2) — Size: S

**SystemHealthPage.tsx:** The refresh button should have
`aria-label="Refresh health checks"` if using an icon-only variant.

**TenantDetailPage.tsx:** Edit and Delete buttons already have text labels, so
no change needed.

### 7.6 Client-Side Pagination for Tables (Audit: C4) — Size: L

**Files:** `TenantsPage.tsx`, `UserAnalyticsPage.tsx`

**Approach:** Implement client-side pagination using state + shared-ui
`Pagination` component.

**Changes for TenantsPage.tsx:**

1. Add state:
   `const [currentPage, setCurrentPage] = useState(1); const PAGE_SIZE = 10;`
2. Compute paginated data:
   `const paginated = filtered?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);`
3. Compute total pages:
   `const totalPages = Math.ceil((filtered?.length ?? 0) / PAGE_SIZE);`
4. Reset to page 1 on filter/search change
5. Add after the table:

   ```tsx
   import {
     Pagination,
     PaginationContent,
     PaginationItem,
     PaginationLink,
     PaginationNext,
     PaginationPrevious,
   } from "@levelup/shared-ui";

   {
     totalPages > 1 && (
       <div className="flex items-center justify-between px-2 py-4">
         <p className="text-muted-foreground text-sm">
           Showing {(currentPage - 1) * PAGE_SIZE + 1}–
           {Math.min(currentPage * PAGE_SIZE, filtered?.length ?? 0)} of{" "}
           {filtered?.length ?? 0}
         </p>
         <Pagination>
           <PaginationContent>
             <PaginationItem>
               <PaginationPrevious
                 onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
               />
             </PaginationItem>
             {Array.from({ length: totalPages }, (_, i) => i + 1).map(
               (page) => (
                 <PaginationItem key={page}>
                   <PaginationLink
                     isActive={page === currentPage}
                     onClick={() => setCurrentPage(page)}
                   >
                     {page}
                   </PaginationLink>
                 </PaginationItem>
               )
             )}
             <PaginationItem>
               <PaginationNext
                 onClick={() =>
                   setCurrentPage((p) => Math.min(totalPages, p + 1))
                 }
               />
             </PaginationItem>
           </PaginationContent>
         </Pagination>
       </div>
     );
   }
   ```

Apply same pattern to `UserAnalyticsPage.tsx`.

---

## Dependency Graph

```
SC-1 (StatusBadge)  ─┐
SC-2 (StatCard)     ─┤
SC-3 (SearchInput)  ─┼── Phase 1 (Critical Fixes)
SC-4 (PageHeader)   ─┘         │
                               ▼
                    Phase 2 (Design System)
                               │
                               ▼
                    Phase 3 (Loading/Empty/Error)
                               │
                               ▼
                    Phase 4 (Forms & Interactions)
                               │
                               ▼
                    Phase 5 (Dashboard Enhancement)
                               │
                               ▼
                    Phase 6 (Navigation & Layout)
                               │
                               ▼
                    Phase 7 (Accessibility & Pagination)
```

**Phase dependencies:**

- **SC-1 → Phase 1.3:** StatusBadge must exist before replacing hardcoded badges
- **SC-2 → Phase 2.2:** StatCard must exist before replacing hand-built cards
- **SC-3 → Phase 1.2b, 1.2e:** SearchInput must exist before replacing raw
  search inputs
- **Phase 1 → Phase 2:** Components must be swapped before restyling
- **Phase 2 → Phase 3:** Table structure must use shared-ui before adding
  skeleton rows
- **Phase 6.2 → Phase 6.3:** Sidebar footer must have logout before removing
  redundant buttons
- **Phases 1-6 → Phase 7:** Accessibility pass should happen after all UI
  changes are in place

---

## Summary

| Phase                               | Items              | Size   | Audit Issues Covered           |
| ----------------------------------- | ------------------ | ------ | ------------------------------ |
| Shared Components                   | 4 new components   | S each | SC-1 to SC-4                   |
| Phase 1: Critical Fixes             | 8 items (1.1–1.4)  | S-M    | C1, C2, C3, Responsive         |
| Phase 2: Design System              | 4 items (2.1–2.4)  | S-M    | M3, M8                         |
| Phase 3: Loading/Empty/Error        | 3 groups (3.1–3.3) | M-L    | M2, 11.1                       |
| Phase 4: Forms & Interactions       | 5 items (4.1–4.5)  | S-XL   | M4, M7, m5, m10, Security 9.3  |
| Phase 5: Dashboard                  | 3 items (5.1–5.3)  | S-L    | M5                             |
| Phase 6: Navigation & Layout        | 8 items (6.1–6.8)  | S-M    | M1, M6, m1, m2, m4, m7, m8, m9 |
| Phase 7: Accessibility & Pagination | 6 items (7.1–7.6)  | S-L    | C4, A10                        |

**Total audit issues covered:** 4 Critical (C1-C4) + 8 Major (M1-M8) + 10 Minor
(m1-m10) + Accessibility + Responsive = **ALL issues from the audit**
