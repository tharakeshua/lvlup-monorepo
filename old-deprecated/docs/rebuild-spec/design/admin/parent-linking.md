# Screen Spec — Parent–Student Linking (Admin)

> **Design system:** Lyceum. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All colors, type, spacing, radii,
> elevation, motion, and components are cited by their foundation token / §5
> component name — no new primitives are invented except where explicitly
> flagged as a **proposed foundation addition**.
>
> **Register:** admin / staff (the serious register) — restraint in chrome, mono
> for IDs/counts, no gamification spark, no celebratory motion. The marigold
> `spark` token is **not** used on this screen.

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` (school / academy administrator). A `staff` user
with the `canManageUsers` permission may also reach it (see §8); all other roles
are denied.

**Job-to-be-done:** "I need to associate a parent/guardian account with the
child (or children) they are responsible for, so that parent can see only their
own children's progress in the parent portal — and I need to be able to verify,
add, and remove those links with confidence that I'm not exposing the wrong
student to the wrong guardian."

This screen is deliberately **distinct from general user management**
(creating/editing/importing parents and students). It owns one concept: the
**parent ⇄ student link** and the **guardian access scope** that link grants. It
surfaces:

- which children each parent is linked to (and the reverse: which parents a
  student has);
- the flow to **invite a parent** and **link them to one or more children**;
- a **confirmation** step that makes the access consequence explicit;
- the ability to **unlink** a relationship.

**The link model (server-authoritative, bidirectional).** A link is a pair of
denormalized array memberships kept in sync server-side:

- `Parent.studentIds: string[]` (the `childStudentIds` field is `@deprecated` —
  read both, write `studentIds`).
- `Student.parentIds: string[]`.

Linking writes BOTH sides; the admin never edits one array directly in the
client. The parent's `studentIds` claim (`PlatformClaims.studentIds`) is what
the parent-portal RLS reads, so the link **is** the access grant.

---

## 2. Entry points & route

**Route:** `/users` → **Parents** tab
(`apps/admin-web/src/pages/UsersPage.tsx` + `components/users/ParentsTab.tsx`).
The linking flow is a **Drawer/Sheet** (§5) opened from:

1. **Parents tab** → a parent row's **Linked Children** cell or **Manage links**
   action → opens the drawer scoped to that parent (`parent → students`).
2. **Students tab** (`StudentsTab.tsx`) → a student row's **Parents** cell
   (`<Link2/> N`) / **Link parents** action → opens the same drawer scoped to
   that student (`student → parents`).
3. **Invite parent** primary button in the Parents tab header → opens the drawer
   in _invite-then-link_ mode (create the parent, then immediately pick
   children).

Both entry directions reuse one component; only the "anchor" entity differs.

### Common-API reads/writes (cite `specs/common-api.md`)

All data flows through `api-client` hooks — the screen never touches
`firebase/firestore` directly (common-api §2 "Key shift"). `tenantId` is derived
server-side from `ctx.activeTenantId`, never sent in the body (common-api §4.4).

**Reads**

- `useParents()` → `v1.identity.searchUsers` / list parents (tenant-scoped) —
  the Parents tab rows. Each `Parent` carries `studentIds` (link state). Uses
  the unified pagination fragment (common-api §7).
- `useStudents()` → student list endpoint (tenant-scoped) — needed to **resolve
  `studentIds` → student names** (today `ParentsTab` does this client-side via
  `students?.find(...)`) and to power the child **Combobox** search in the
  drawer. Carries `parentIds` (reverse link state).
- `useClasses()` → class list — to label which class each candidate child
  belongs to in the picker (disambiguates duplicate names).

**Writes** (all are upserts; the `save*` convention, common-api §3.1)

- **Link / unlink:** `v1.identity.saveParent` with `{ id, studentIds }` — the
  server upsert keeps the reverse `Student.parentIds` in sync and calls
  `syncMembershipClaims(uid, tenantId)` so the parent's `studentIds` claim is
  rebuilt (common-api §4.5; auth-access §2 sync primitive). The symmetric
  `v1.identity.saveStudent { id, parentIds }` is the equivalent write from the
  student-anchored direction — the client uses whichever matches the anchor.
- **Invite parent:** `v1.identity.createOrgUser` (role `parent`) — provisions
  the Auth user + `Parent` entity + membership + claims (saga + idempotency key,
  common-api §9). On success the drawer proceeds to the link step using the
  returned parent `id`.

> Caching: invalidate the **narrowest** scope — `parentKeys.list()` and
> `studentKeys.list()` only — not the whole tenant tree (common-api §5.3; fixes
> the coarse `["tenants", tenantId]` invalidation the admin-web status report
> flags in §4.7).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5): persistent `Sidebar` (Management group →
Users active) + `Topbar` (tenant switcher, search, `NotificationBell`, profile).
Page gutters: desktop 32 / tablet 24 / mobile 16 (foundation §4). Max content
width 1200.

### `/users` Parents tab (the list this flow lives on)

```
┌ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: [Tenant ▾]            [⌘K search]   [🔔]  [Admin ▾]         │
│ (Mgmt:  ├───────────────────────────────────────────────────────────────────┤
│  Users) │ Breadcrumb: Users                                                   │
│         │ H1  Users                                                           │
│         │ Tabs:  Teachers · Students · [ Parents ]                            │
│         │ ┌ Toolbar ─────────────────────────────────────────────────────┐   │
│         │ │ [Search parents…]   [Status ▾]   [Linked? ▾]   (+ Invite parent)│  │
│         │ └──────────────────────────────────────────────────────────────┘   │
│         │ ┌ DataTable (§5) ──────────────────────────────────────────────┐   │
│         │ │ Name        | Linked children            | Status | Actions   │   │
│         │ │ A. Rao      | [Maya R.] [Arjun R.] (+1)   | active | Manage… ⋮ │   │
│         │ │ J. Khan     | — Not linked —              | active | Manage… ⋮ │   │
│         │ │ …                                                            │   │
│         │ └──────────────────────────────────────────────────────────────┘   │
│         │ Pagination (DataTablePagination)                                     │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

- **Linked children** cell: a wrapping row of **Chip/Tag** (§5, `pill` radius) —
  one per linked child, label = child display name. Overflow collapses to a
  `(+N)` chip. Unlinked parents show a **Badge** "Not linked" (neutral
  `status.info`, NOT color-alone — icon + text). The cell is the primary click
  target to open the linking drawer for that parent.
- **Actions** column: `IconButton` (§5) "Manage links" (link icon) + an overflow
  `⋮` (Edit profile → the separate user-management dialog; Archive). Keeping
  link management visually separate from profile editing reinforces the §1
  separation of concerns.

### Linking Drawer/Sheet (the flow)

Right-anchored **Drawer** (§5), width 480 (lg breakpoint) — wide enough for the
candidate list. It is a **3-region** vertical layout with a stepper only in
_invite-then-link_ mode:

```
┌ Drawer (480) ─────────────────────────────────────────────┐
│ Header                                                     │
│   ‹ icon › Link children to A. Rao            [✕]          │
│   Guardian access scope · this parent will see these       │
│   children's progress, results, and attendance.            │
│  (invite mode only)  ① Invite ─── ② Link ─── ③ Confirm      │
├───────────────────────────────────────────────────────────┤
│ Body (scroll)                                              │
│  ┌ Currently linked (2) ───────────────────────────────┐  │
│  │ ☑ Maya Rao      Class 8-A · Roll 14        [Unlink]  │  │
│  │ ☑ Arjun Rao     Class 6-B · Roll 09        [Unlink]  │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌ Add a child ────────────────────────────────────────┐  │
│  │ [ Combobox: search students by name / roll … ▾ ]     │  │
│  │   result rows: Avatar · Name · Class · Roll · (Add)  │  │
│  └─────────────────────────────────────────────────────┘  │
│  Pending changes: +1 add · −1 remove (InlineAlert)         │
├───────────────────────────────────────────────────────────┤
│ Footer (sticky)                                           │
│   [ Cancel ]                       [ Review & confirm → ]  │
└───────────────────────────────────────────────────────────┘
```

- **Header** uses `text.primary` (Schibsted) title + `text.secondary` scope
  sub-line. No serif display here (drawers are chrome, not hero surfaces).
- **Currently linked** = `DefinitionList`/list of rows; each row is a child with
  class + roll for disambiguation and an inline **Unlink** ghost `Button`.
- **Add a child** = **Combobox** (§5) over the student list, filtered to the
  tenant. Already-linked and already-pending children are disabled in results
  (with a "Linked" badge) — you can't double-link.
- **Pending changes** = an **InlineAlert** (§5, `status.info`) summarizing
  staged adds/removes before commit (this flow batches into one `saveParent`
  write, not per-chip writes).
- **Confirm** step (step ③ or a `ConfirmDialog` from the footer) restates the
  **access consequence** in plain language before the server write (§6, §7).

### Responsive (sm / md / lg)

- **lg (≥1024, the default admin target):** DataTable as above; Drawer 480
  right-anchored, page content stays visible behind the scrim.
- **md (768–1023):** Drawer widens to ~60vw; DataTable keeps all columns but the
  toolbar filters collapse into a single **Popover** "Filters" trigger.
- **sm (<768):** Drawer becomes a **full-height bottom Sheet**. The Parents
  DataTable degrades to **stacked cards** (foundation §6 rule): each card =
  parent name (top), linked-children chips (middle), status badge + "Manage
  links" (bottom). Admin is desktop-first (see §10) — this is a
  graceful-fallback, not a primary experience.

---

## 4. Components used (from FOUNDATION §5 only)

**Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`, `CommandPalette`
(⌘K, web-only). **Containers:** `Tabs` (Teachers/Students/Parents),
`Drawer/Sheet` (the linking flow), `Popover` (collapsed filters on md),
`Modal/Dialog` + `ConfirmDialog` (commit confirmation), `Section`. **Data:**
`DataTable` (sort/filter/paginate — replaces the bespoke
`usePagination`/`useSort` in today's `ParentsTab`), `Pagination`
(`DataTablePagination`), `DefinitionList` (linked-children rows), `EmptyState`,
`Skeleton`, `Avatar`/`AvatarGroup` (parent + child rows), `Badge` (status, "Not
linked", "Linked" in results), `Chip/Tag` (linked-children cell), `Stat/KPI`
(optional "Linked / Unlinked" counts in the toolbar). **Primitives:** `Button`
(primary "Review & confirm", secondary "Cancel", ghost "Unlink",
danger-not-used-here), `IconButton` ("Manage links", row overflow), `Combobox`
(child search/add), `Checkbox` (select linked rows for bulk unlink), `Input`
(toolbar search), `Select` (Status / Linked? filters). **Feedback:** `Toast`
(sonner) for save success/failure, `InlineAlert/Banner` (pending-changes
summary, error banner), `FormFieldError`, `LoadingOverlay` (during commit).

**No domain components** from §5's gamification/assessment set are used (no
`XPMeter`, `GradePill`, `ConfidenceBadge`, etc.) — this is admin chrome.

**Proposed foundation additions (flagged):**

- **`RelationshipChip`** — a `Chip/Tag` variant carrying an avatar + label +
  inline remove (`×`), used for the linked-children cell and the staged-adds
  row. If §5's `Chip/Tag` already supports a leading avatar slot and a trailing
  dismiss affordance, no addition is needed — **prefer extending `Chip/Tag`**
  over a new component. Flagging so the foundation owner decides.
- **`LinkScopeNotice`** — the "Guardian access scope" explainer block. This is
  just an `InlineAlert` (`status.info`) with fixed copy; **no new
  token/component required** — listed only so the access-consequence messaging
  is treated as a first-class, reused element across both link directions.

---

## 5. States

### Loading (skeleton)

- Parents tab: `DataTable` body shows `Skeleton` rows (mirror today's
  `TableSkeleton columns=4`): shimmering bars for Name, Linked children (2–3
  chip-shaped blocks), Status, Actions.
- Drawer open before student list resolves: "Currently linked" rows render with
  `Skeleton` name + class; the Combobox shows a disabled `Input` with a small
  spinner.

### Empty

- **No parents in tenant:** `EmptyState` (§5) inside the tab — Fraunces title
  "No parents yet", body copy, primary `Button` **Invite parent**.
- **Parent with zero links** (in-row): "Not linked" `Badge`; the drawer's
  "Currently linked" region shows a compact `EmptyState`: "No children linked.
  Search below to add one."
- **No student search matches** in the Combobox: inline "No students match
  '<query>'." with a hint to check the Students tab.

### Error

- **List read error:** a global React Query error boundary surfaces an
  `InlineAlert/Banner` at the top of the tab (common-api §6.3 — errors must NOT
  render as empty states), with a **Retry** `Button`. Copy is driven by
  `error.details.code` → `ERROR_MESSAGES`.
- **Write error** (`saveParent` / `createOrgUser`): a `Toast` (error) + the
  footer stays in the pre-commit state with staged changes intact so the admin
  can retry. `VALIDATION_ERROR` maps field errors into `FormFieldError`;
  `PERMISSION_DENIED` / `TENANT_SUSPENDED` show a blocking `InlineAlert` in the
  drawer and disable the commit button.

### Partial

- **Optimistic, then reconcile:** staged add/remove updates the chips
  immediately; on a partial server result (e.g., one of several children no
  longer exists), the reconciled response replaces the optimistic state and a
  `Toast` notes "1 child could not be linked (no longer in this tenant)."
- **Overflow:** parents with many children show `(+N)`; full set is in the
  drawer.

### Permission-gated variations (by role)

- **`tenantAdmin`:** full read + invite + link + unlink.
- **`staff` with `canManageUsers`:** identical to tenantAdmin for this screen
  (gated by a `useCan('canManageUsers')` selector driven off
  `currentMembership.staffPermissions` — admin-web status report rec E9).
- **`staff` without `canManageUsers`:** the Users nav item is hidden; direct
  navigation renders the shared **Access Denied** panel (the `RequireAuth`
  pattern).
- **`teacher` / `student` / `parent` / `scanner`:** never reach `/users` —
  `RequireAuth` `allowedRoles={["tenantAdmin","staff"]}` redirects/denies.
- **`superAdmin`:** bypasses tenant guards but operates **within the currently
  active tenant** — cross-tenant linking is **forbidden** (see §8); the screen
  does not offer a cross-tenant child picker.

---

## 6. Interactions & motion (foundation §4 tokens)

**Open drawer:** entrance slide-in from right + scrim fade — `slow 320ms`,
`ease.entrance`. On `sm` the bottom Sheet uses the same duration/curve from the
bottom edge. Close uses `base 220ms`, `ease.exit`.

**Search & add a child:**

1. Type in the Combobox → debounced filter over the student list (results
   animate in `fast 160ms`).
2. Click **Add** on a result → the child moves into "Currently linked" as a
   **staged add** with a subtle `instant 100ms` highlight (`status.success`
   background tint at low alpha, then settle). No server call yet.
3. The result row becomes disabled + "Linked" badge.

**Unlink:** click **Unlink** on a linked row → the row marks as a **staged
removal** (strikethrough + `status.error` border-left, NOT removed from view, so
it's reversible) with an **Undo** affordance.

**Pending-changes summary:** the `InlineAlert` updates live ("+2 add · −1
remove"). The footer **Review & confirm** button enables only when there is ≥1
staged change.

**Confirm & commit (the guardrail):**

- Clicking **Review & confirm** opens the **Confirm** step / `ConfirmDialog`
  restating the access consequence and the exact deltas. This is required
  because the link **grants data access** — never silent. Confirm copy in §7.
- On confirm → single `saveParent` (or `saveStudent`) write. `LoadingOverlay` on
  the drawer footer; optimistic chip state already applied.
- **Success:** `Toast` (success) "Linked children updated for <parent>", drawer
  closes (`base 220ms` exit), the Parents row's chips reconcile from the
  invalidated `parentKeys.list()`.
- **Failure:** see §5 Error — staged state preserved.

**Invite-then-link (3-step):** Step ① collects parent name/email/phone (RHF +
zod, reusing the `createOrgUser` schema). On submit → `createOrgUser` → advances
to Step ② (link) using the new parent `id` → Step ③ confirm. The `Stepper`/step
indicator transitions `base 220ms`. The invite write is idempotent
(`idempotencyKey`) so a retried submit never creates a duplicate parent
(common-api §9).

**Reduced motion:** `prefers-reduced-motion` → all slides become opacity-only
cross-fades at `fast 160ms`; the staged-add highlight is a static border instead
of a tint sweep. No motion is load-bearing (status is always also conveyed by
icon + label + position).

---

## 7. Content & copy (precise admin tone)

**Tab label:** `Parents` **Toolbar:** search placeholder
`Search parents by name, email, or phone`; filters `Status`
(`All / Active / Archived`), `Linked?` (`All / Linked / Not linked`). **Primary
action:** `Invite parent`

**DataTable headers:** `Name` · `Linked children` · `Status` · `Actions`
**Linked-children empty cell:** `Not linked` **Row action:** `Manage links`

**Drawer header (parent-anchored):** `Link children to <Parent name>` **Drawer
header (student-anchored):** `Link parents to <Student name>` **Scope notice
(the `LinkScopeNotice`):**

> _Guardian access scope — Linked parents can view these children's progress,
> exam results, and attendance in the parent portal. They cannot see other
> students._

**Sections:** `Currently linked (<n>)` · `Add a child` **Combobox placeholder:**
`Search students by name or roll number` **Result row badge (already linked):**
`Linked` **Inline actions:** `Add` · `Unlink` · `Undo` **Pending summary
(InlineAlert):** `Pending changes: <a> to add · <r> to remove`

**Confirm dialog:**

- Title: `Confirm guardian links`
- Body:
  `You're about to give <Parent name> access to <child list> and remove access to <child list>. Linked guardians can view these children's progress and results. Continue?`
- Confirm button: `Confirm links` · Cancel: `Go back`

**Invite step copy:**

- Step ① title `Invite parent`; helper
  `We'll create a parent account and send a sign-in invite. You can link children in the next step.`
- Fields: `First name`, `Last name`, `Email` (or `Phone`), validation reusing
  the server zod schema.

**Empty states:**

- Tab: title `No parents yet`; body
  `Invite a parent to link them with their children.`; CTA `Invite parent`.
- Drawer linked region: `No children linked. Search below to add one.`

**Errors:**

- Read: `We couldn't load parents. Retry.`
- Write generic:
  `Couldn't update links. Your changes weren't saved — try again.`
- Duplicate-link guard: `<Child> is already linked to this parent.`
- Permission: `You don't have permission to manage guardian links.`
- Tenant suspended: `This tenant is suspended. Linking is disabled.`

**Success toast:** `Guardian links updated for <Parent name>.`

Tone: declarative, no exclamation marks, no emoji, no encouragement language —
staff register.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Both parent and student must belong to the
   **active tenant**. The child Combobox queries only `students` in
   `ctx.activeTenantId`; the write derives `tenantId` from claims (common-api
   §4.4), never from the body. A `tenantAdmin` cannot link a parent to a student
   in another tenant, and **super-admin does not get a cross-tenant child
   picker** here — cross-tenant control-plane work lives in the super-admin app,
   not this screen.
2. **The link is a server-authoritative, bidirectional, denormalized pair.**
   `Parent.studentIds` ↔ `Student.parentIds` are kept in sync by the server
   upsert; the client never writes one side directly. Read both `studentIds` and
   the `@deprecated childStudentIds` for back-compat; always **write
   `studentIds`** (parent.ts).
3. **The link IS the access grant → claims must re-sync.** `saveParent` (and
   `saveStudent`) must call `syncMembershipClaims(uid, tenantId)` so the
   parent's `PlatformClaims.studentIds` — which the parent-portal RLS reads —
   reflects the new link (common-api §4.5; auth-access §4.2/§5 stale-claims
   gap). Until refresh, parent-portal access may lag ≤1h; on **unlink**, the
   server should `revokeRefreshTokens(uid)` to close the window (auth-access rec
   #5) so a removed guardian loses access promptly. Surface this as: unlink
   takes effect immediately server-side; the parent is signed out / re-tokened.
4. **RBAC gating.** Only `tenantAdmin` (or `staff` with `canManageUsers`) may
   manage links; enforced in three layers — `RequireAuth` guard (UX), the
   callable's `assertTenantAdminOrSuperAdmin` (auth), and Firestore rules as
   defense-in-depth (parents are `write: TenantAdmin/staff-perm`, memberships
   are `write: if false`). The UI gates the **Invite** and **Unlink** controls
   off `useCan('canManageUsers')`.
5. **Audit logging.** Every link/unlink and every invite is a mutating call →
   writes to the single audit-log collection (`/tenants/{t}/auditLogs`,
   best-effort, non-blocking — common-api §9; identity report rec #9 single
   collection name). The action records actor, parent id, added/removed student
   ids.
6. **Idempotency.** `createOrgUser` (invite) and the batched `saveParent` accept
   an `idempotencyKey` so retries never duplicate the parent or double-apply a
   link (common-api §9).
7. **No quota/cost/answer-key surfaces here.** This screen touches none of: AI
   cost budgets, exam answer-keys (never shown anywhere), grading confidence, or
   timers. (Stated explicitly to keep the screen scoped.) Parent-portal
   **feature flag** (`tenant.features.parentPortal`) _may_ gate whether linking
   is meaningful — if `parentPortal` is disabled, show an `InlineAlert`:
   _"Parent portal is off for this tenant; links won't grant access until it's
   enabled in Settings."_ (a `assertFeatureEnabled`-adjacent UX hint, not a hard
   block on linking).
8. **Server-authoritative everything.** Link counts, the linked-children list,
   status, and the claim are all server truth; optimistic UI is reconciled
   against the server response (§5 Partial).

---

## 9. Accessibility (WCAG AA)

- **Focus order (drawer):** open → focus the drawer heading / close button →
  "Currently linked" rows (each Unlink reachable) → "Add a child" Combobox →
  staged-changes alert → footer Cancel → primary Confirm. Focus is **trapped**
  in the drawer/Sheet; on close, focus returns to the originating row control
  (the "Manage links" IconButton). The Confirm dialog traps focus and returns it
  to the footer button on dismiss.
- **Keyboard:** Combobox fully operable — `↑/↓` to move through results, `Enter`
  to Add, `Esc` to close the listbox (a second `Esc` closes the drawer). Linked
  rows: `Tab` to the Unlink button, `Enter`/`Space` to stage removal, with an
  adjacent **Undo** that is keyboard-reachable. DataTable rows: the
  linked-children cell and Manage-links button are real `<button>`s, not
  click-only divs (today's `ParentsTab` uses an `IconButton` already; the cell
  trigger must also be a button).
- **ARIA:** drawer = `role="dialog"` `aria-modal="true"` `aria-labelledby` the
  heading + `aria-describedby` the scope notice (so screen readers announce the
  access consequence on open). Combobox follows the ARIA combobox pattern
  (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-controls`
  → listbox). The linked-children chips expose
  `aria-label="Linked: <child name>, <class>"`. The pending-changes alert is an
  `aria-live="polite"` region so staged deltas are announced. Result rows
  already linked use `aria-disabled` + visible "Linked" text (not
  disabled-by-color-alone).
- **Status never by color alone (foundation §2.2):** "Not linked" = neutral
  badge **with text + icon**; staged add = `status.success` tint **+ "to add"
  label + check icon**; staged remove = `status.error` border **+
  strikethrough + "to remove" label**. Active/Archived status uses Badge text,
  not hue alone.
- **Contrast:** all pairs meet AA — `text.primary` on `bg.surface` (warm white),
  `text.secondary` for the scope sub-line (≥4.5:1), chip text on
  `paper-100`/`indigo-50` fills ≥4.5:1. Mono IDs/roll numbers
  (`Spline Sans Mono`) at `sm` with `+0.01em` tracking remain legible. Touch
  targets ≥44px (foundation §4) on the `sm` Sheet.
- **Reduced motion:** see §6 — opacity-only, nothing load-bearing.
- **Announcements:** save success/failure routed through the existing
  route-announcer / `aria-live` toast region, not color-only toast.

---

## 10. Web↔mobile divergence

**Admin is primarily web/desktop.** This screen is designed for the admin-web
app on a desktop viewport; there is **no dedicated React Native admin app**.
State this explicitly: the canonical experience is `lg` (≥1024).

- **⌘K CommandPalette** (Topbar) is **web-only** — there is no command palette
  on mobile/RN (foundation §6). A "Link parent to student" command entry may
  exist in ⌘K on web only.
- **Hover affordances** (row hover, prefetch on link hover) collapse to
  **press** on touch; the linked-children cell and Manage-links control must be
  tappable, not hover-revealed.
- **DataTable → stacked cards** on `sm` (foundation §6 rule), and the Drawer →
  **bottom Sheet** on `sm`. These are the only responsive structural changes;
  column set and copy are otherwise identical.
- The component **names/props are shared with `ui-native`** (foundation §6) so
  that _if_ a future RN admin/companion surface ever needs a read-only "view
  linked children" view, the `Chip/Tag`, `Drawer/Sheet`, and `Combobox` map 1:1
  — only the renderer differs. No RN write flow is specified here.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing one admin screen for Auto-LevelUp using the "Lyceum" design system.
FIRST read docs/rebuild-spec/design/00-FOUNDATION.md and conform EXACTLY: use only its color
tokens (semantic names like bg.surface, text.primary, text.secondary, border.subtle,
brand.primary, status.success, status.error, status.info — NEVER raw hex, NEVER the marigold
`spark` token here), its type families (Fraunces display, Schibsted Grotesk UI/body, Spline Sans
Mono for IDs/roll numbers/counts), its spacing/radius/elevation/motion tokens, and ONLY the §5
component inventory. Do NOT invent new components; if something seems missing, compose from §5 or
flag it as a proposed foundation addition. This is the ADMIN serious register: restrained chrome,
no gamification, no celebratory motion.

SCREEN: Parent–Student Linking (tenantAdmin). Route /users → Parents tab + a linking Drawer/Sheet.

Build:
1. The Parents tab as a DataTable: columns Name · Linked children · Status · Actions. The
   "Linked children" cell is a wrapping row of Chip/Tag (avatar + child name), overflow collapses
   to (+N); unlinked parents show a neutral "Not linked" Badge (icon + text, never color alone).
   Toolbar: search Input, Status Select, "Linked?" Select, primary "Invite parent" Button.
2. A right-anchored Drawer/Sheet (480px on lg, bottom Sheet on sm) for linking, with regions:
   header (title + a status.info InlineAlert "Guardian access scope" notice describing exactly
   what access the link grants), "Currently linked (n)" list rows (avatar · name · class · roll ·
   ghost "Unlink"), an "Add a child" Combobox searching students by name/roll, a live
   aria-live "Pending changes: +a · −b" InlineAlert, and a sticky footer (Cancel · primary
   "Review & confirm").
3. A ConfirmDialog that restates the access consequence and exact add/remove deltas before commit.
4. An optional 3-step invite-then-link variant (Invite → Link → Confirm) with a Stepper.

States to render: loading (Skeleton rows + drawer skeletons), empty ("No parents yet" EmptyState
with Invite CTA; "No children linked" in-drawer), error (InlineAlert banner with Retry — errors
must NOT look like empty states), staged/partial (optimistic chips: status.success "to add" tint,
status.error strikethrough "to remove", with Undo), success Toast.

Interactions/motion (foundation §4): drawer slide-in slow 320ms ease.entrance; staged-add highlight
instant 100ms; respect prefers-reduced-motion (opacity-only). Optimistic staging that batches into a
SINGLE save on confirm — never per-chip writes.

Domain rules to honor visually: tenant isolation (child picker is current-tenant only; no
cross-tenant linking, not even for super-admin); the link is a server-authoritative bidirectional
pair (Parent.studentIds ↔ Student.parentIds) that grants parent-portal access, so the confirm step
is mandatory; unlink takes effect immediately; RBAC gates Invite/Unlink off canManageUsers.

Accessibility: focus trap + return-focus in drawer/dialog, full keyboard Combobox (ARIA combobox
pattern), aria-modal dialog labelled by heading and described by the scope notice, aria-live pending
summary, status never by color alone, WCAG AA contrast, ≥44px touch targets on the sm Sheet.

Web-only: ⌘K CommandPalette and hover affordances (press on touch). DataTable → stacked cards and
Drawer → bottom Sheet at sm. Admin is desktop-first.

Tone: precise, declarative staff copy — no emoji, no exclamation, no encouragement language.
Output the screen composed entirely from Lyceum tokens and §5 components, citing tokens by semantic
name.
```
