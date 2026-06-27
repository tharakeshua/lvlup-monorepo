# Tenant Detail — Cross-Tenant Management

> **Area:** ADMIN (super-admin / platform control plane) · **Route:**
> `/tenants/:tenantId` · **Audience:** `superAdmin` only. **Design system:**
> Lyceum — conforms to `docs/rebuild-spec/design/00-FOUNDATION.md`. All tokens
> cited by semantic name; no new colors/fonts/spacing/radii/motion introduced
> except where explicitly flagged as a **proposed foundation addition**.
> **Register:** serious/admin — restraint in chrome, mono for IDs and counts,
> the marigold `spark` is **not** used here (no gamification on the control
> plane). The ONE spark moment is reserved for students.

---

## 1. Purpose & primary user

**Primary user:** the platform **super-admin**
(`users/{uid}.isSuperAdmin === true` **and** ID-token claim
`role === "superAdmin"` — defense-in-depth per `auth-access.md` §1.3 /
`RequireAuth.tsx`). No tenant-admin, teacher, or student ever reaches this
route; this is the _cross-tenant_ control surface and the only place where one
operator acts on data belonging to a tenant they are not a member of.

**Job-to-be-done:** _"Open one tenant (school/institution) and operate on it
end-to-end — read its health and limits at a glance, correct its
profile/status/subscription, suspend or restore it during incidents or
non-payment, pull a data export for support/offboarding, and review exactly who
changed what."_ The screen is a single-tenant cockpit: read-heavy at the top,
action- and confirm-heavy at the bottom. Every mutation is privilege-gated
server-side and audit-logged.

**Why it matters / stakes:** actions here are blast-radius-wide — deactivating a
tenant suspends _every_ membership in it (all students + teachers lose access).
The UI must telegraph consequence (counts, confirm-to-type, server-authoritative
status) without melodrama.

---

## 2. Entry points & route

**Route:** `/tenants/:tenantId` (lazy-loaded `TenantDetailPage`, wrapped by
`RequireAuth` → `AppShell`).

**Entry points:**

- Row click / "View" from the **Tenants list** (`/tenants`).
- Deep link from the **Dashboard activity feed** and the **platform audit feed**
  (an activity row references a `tenantId`).
- Breadcrumb: `Tenants / {tenant.name}` (resolver supplies the display name).
- Direct URL / browser back. Invalid or deleted ID → not-found state (§5).

**Reads (powering the screen) — via `specs/common-api.md` callables (rebuild
replaces today's direct Firestore `getDoc(doc(db,"tenants",id))`):** | Need |
Rebuild callable (`api-contract`) | Notes | |---|---|---| | Tenant document
(profile, status, subscription, features, settings, stats, deactivation) |
`v1.identity.getTenant` (`tenantOverride: tenantId`) | Super-admin cross-tenant
read; replaces `useTenantDetail`'s raw `getDoc`. Validated client-side against
the `Tenant` schema (no more `as Tenant`). Query key
`tenantKeys.detail(tenantId)`. | | Per-tenant audit log |
`v1.identity.listPlatformActivity` (`tenantOverride: tenantId`, `action?`,
`PageRequest`) | Cursor-paginated (§7 fragment) — replaces the fake "first 20"
in `TenantAuditLogCard`. Requires the
`platformActivityLog(tenantId, action, createdAt desc)` composite index. | |
Cost/budget snapshot (optional cross-ref) | `v1.analytics.getSummary`
(`scope: "platform"`, `tenantOverride`) | Read-only cost panel; deep-links to
billing spec. |

**Writes — super-admin callables (all server-gated on `isSuperAdmin`,
rate-limited, audited via the unified audit log):** | Action | Callable | UI
surface | |---|---|---| | Edit profile + status | `v1.identity.saveTenant`
(`id`, `data{...}`) | Edit dialog | | Edit subscription/limits |
`v1.identity.saveTenant` (`id`, `data.subscription{...}`) | Subscription card →
dialog (full plan/billing UI lives in **super-admin-billing** spec;
cross-reference) | | Deactivate (soft) | `v1.identity.deactivateTenant`
(`tenantId`, `reason?`) → `{ membershipsSuspended }` | Lifecycle card +
destructive confirm | | Reactivate | `v1.identity.reactivateTenant` (`tenantId`)
→ `{ membershipsReactivated }` | Lifecycle card | | Data export |
`v1.identity.exportTenantData` (`tenantId`, `format`, `collections[]`) →
`{ downloadUrl, expiresAt }` | Export card |

> **Domain note carried from §8:** `tenantId` is normally derived from the
> caller's active-tenant claim and omitted from request bodies. **This screen is
> the exception** — every call passes an explicit `tenantOverride` / `tenantId`
> because the super-admin is operating cross-tenant. That override is itself an
> audited signal.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(super-admin nav: Overview / Platform / System groups; "Tenants" active) +
**Topbar** (no tenant switcher for super-admin — they are global; search,
notifications, profile, ⌘K command palette). Content region = `bg.canvas`, max
content width 1200, desktop gutter 32. Vertical rhythm between regions:
`space.6` (24).

```
┌─ AppShell ──────────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [⌘K search]              [bell] [super-admin avatar ▾]     │
│ (Plat-  ├──────────────────────────────────────────────────────────────────  │
│  form   │  Breadcrumb:  Tenants  ›  Acme Public School                        │
│  nav)   │                                                                      │
│         │  ‹ Back to Tenants                                                   │
│         │  ┌── HEADER ROW ───────────────────────────────────────────────┐    │
│         │  │ H1  Acme Public School   [Badge: status]   ⟨ID SUB001 mono⟩ │    │
│         │  │ contact@acme.edu                  [Edit]  [Deactivate ⚠]     │    │
│         │  └─────────────────────────────────────────────────────────────┘    │
│         │  ┌── KPI STRIP (4× Stat/KPI) ──────────────────────────────────┐    │
│         │  │ [Students] [Teachers] [Exams] [Spaces]   (mono numerals)     │   │
│         │  └─────────────────────────────────────────────────────────────┘    │
│         │  ┌─ Subscription ───────────┐  ┌─ Contact Information ─────────┐     │
│         │  │ DefinitionList + Edit Plan│  │ DefinitionList (email/phone…) │    │
│         │  └───────────────────────────┘  └───────────────────────────────┘   │
│         │  ┌─ Features (chip grid) ───────────────────────────────────────┐   │
│         │  │ ◍ AutoGrade  ◍ LevelUp  ○ Scanner  ◍ AI Chat  …  (on/off)    │    │
│         │  └─────────────────────────────────────────────────────────────┘    │
│         │  ┌─ Settings (DefinitionList) ──────────────────────────────────┐   │
│         │  │ Gemini key set · Default AI model · Timezone · Locale        │    │
│         │  └─────────────────────────────────────────────────────────────┘    │
│         │  ┌─ Tenant Lifecycle (danger) ──┐  ┌─ Data Export ──────────────┐    │
│         │  │ explanatory copy             │  │ [collection chips] [fmt▾]  │    │
│         │  │ [Deactivate ⚠] / [Reactivate]│  │ [Export] → signed link 1h  │    │
│         │  └──────────────────────────────┘  └────────────────────────────┘   │
│         │  ┌─ Audit Log (Timeline + filter) ──────────────────────────────┐   │
│         │  │ [Action filter ▾]                                            │    │
│         │  │ • Tenant Updated  by super@… — 20 Jun 2026, 14:02            │    │
│         │  │ • Tenant Deactivated  …                       [Load more]     │   │
│         │  └─────────────────────────────────────────────────────────────┘    │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Grid & responsive (foundation breakpoints
`sm 640 · md 768 · lg 1024 · xl 1280`):**

- **lg / xl (desktop — primary target):** 12-col content grid. KPI strip = 4
  across. Paired cards (Subscription+Contact, Lifecycle+Export) = 2-col
  (`md:grid-cols-2`). Features = up to 4-col chip grid. Audit log full-width.
- **md (tablet):** KPI strip 2×2; paired cards stack to 1-col; features 3-col;
  header actions stay inline.
- **sm (mobile, secondary — admin is desktop-first, §10):** everything stacks to
  a single column; header actions wrap below the title; KPI strip becomes 2-col
  then 1-col; lifecycle + export stack; audit timeline single column. Touch
  targets ≥44px.

---

## 4. Components used — from FOUNDATION §5 only

**Navigation:** `AppShell` (sidebar + topbar), `Sidebar` (role-driven,
super-admin manifest), `Topbar` (search, notifications, profile, ⌘K),
`Breadcrumb`, `CommandPalette` (⌘K, web-only). **Containers:** `Card` (lg
radius, `e1` at rest), `Panel`/`Section` for grouping, `Modal/Dialog` (Edit,
Subscription — `e3`), `Tooltip`. **Primitives:** `Button` (`secondary` for
Edit/Export, `danger` for Deactivate, `ghost` for "Back"/"Load more"),
`IconButton`, `Input`, `Select` (status, export format, audit action filter),
`Combobox` (export collections multi-select — see note), `Switch` is **not**
used (features are read-only here; toggling lives in `/feature-flags`).
**Data:** `Stat/KPI` (the 4 count tiles, mono numerals), `DefinitionList`
(Subscription, Contact, Settings), `Timeline` (audit log), `Badge` (tenant
status; audit action category), `Chip/Tag` (feature on/off, export collection
selection), `Skeleton`, `Pagination`/cursor "Load more", `EmptyState` (audit
empty, not-found). **Feedback:** `Toast` (sonner — success/result counts),
`InlineAlert/Banner` (deactivated-tenant banner; export-ready link region),
`ConfirmDialog` (deactivate — type-to-confirm), `FormFieldError`,
`LoadingOverlay` (none full-screen; per-action pending only).

**Proposed foundation additions (flagged):**

1. **`StatusBadge` → standardize as a `Badge` variant set keyed to
   `TenantStatus`** (`active`, `trial`, `suspended`, `expired`, `deactivated`).
   Map to existing semantic tokens — **no new colors**:
   `active`→`status.success`, `trial`→`status.info`,
   `suspended`→`status.warning`, `expired`/`deactivated`→`status.error`. Each
   badge MUST carry an icon + text label (never color-alone, §9). Recommend
   adding this status→token mapping table to FOUNDATION §2.3 rather than
   inventing a component.
2. **`TypeToConfirmField`** — the "type `{tenantCode}` to confirm"
   destructive-gate pattern (used by the deactivate flow). Composes `Input` +
   `FormFieldError` only; propose registering it as a named composite in §5
   Feedback so every destructive admin action reuses one accessible
   implementation.

No other new components. The today-code's ad-hoc emerald feature pills and raw
`bg-muted` blocks are replaced by `Chip` + `DefinitionList` reading semantic
tokens.

---

## 5. States

**Loading (skeleton):** mirror today's `TenantDetailPage` skeleton, composed
from `Skeleton`: header (back-link bar + title + subtitle lines), 4 KPI tiles,
then 2 paired card skeletons, features grid, audit rows (5 line-pairs with a
leading dot). Cards keep `e1`/`border.subtle`; skeleton fills use `bg.inset`. No
layout shift between skeleton and loaded (reserve heights).

**Empty / partial:**

- **Audit log empty:** `EmptyState` with `ScrollText`-style icon (mono/muted),
  title "No audit log entries yet", subtext "Actions on this tenant will appear
  here." (`text.secondary`).
- **Optional fields empty:** Contact phone/person/website, subscription limits,
  settings show an em-dash `—` (`text.muted`) — never a blank or a guessed
  value. "Unlimited" is rendered explicitly when a subscription limit is unset
  (server-authoritative meaning, not absence).
- **Partial load:** the tenant doc and the audit log are independent queries —
  if the tenant loads but the audit query errors, the tenant cockpit renders
  normally and only the Audit card shows an inline error with **Try again**
  (degrade per-region, never blank the whole page). Cost panel (analytics) is
  also independent and degrades the same way.

**Error:**

- **Tenant load failed:** full-region `InlineAlert` (variant=error,
  `status.error`) with the server `error.details.message` and a **Try again**
  action (refetch). Back-to-Tenants link remains. Maps the `api-contract` error
  envelope (§6): show `ERROR_MESSAGES[code]`; `PERMISSION_DENIED` → "You don't
  have access to this tenant." (should not occur for a real super-admin;
  surfaces a claim/guard drift).
- **Not found / deleted:** `EmptyState` (`Building2` icon) — "Tenant not found",
  "This tenant may have been deleted or the ID is invalid.", primary button
  "View All Tenants".
- **Mutation errors:** non-blocking `Toast` (error) + inline `Alert` inside the
  relevant dialog (edit/subscription) using the typed `error.details.code`.
  `TENANT_SUSPENDED`/`INVALID_TRANSITION`/`RATE_LIMITED` surface their recovery
  hint.

**Success:** loaded cockpit; mutations resolve to a success `Toast` with the
**server-returned count** (e.g. "Tenant deactivated — 142 memberships
suspended"), and React Query invalidates `tenantKeys.detail(tenantId)` +
`tenantKeys.list()` so status/badge/KPIs refresh from the server
(server-authoritative).

**Permission-gated variations by role:** there is exactly **one** role here —
`superAdmin`. The `RequireAuth` guard (Firestore flag **and** claim) blocks
everyone else before render; the route never mounts for
tenant-admin/teacher/student/parent. There is no read-only or reduced variant —
if you can see this screen, you can act on it. (Tenant-admins manage _their own_
tenant through the tenant-admin app's settings screens, never this cross-tenant
route.) The **server** re-checks `isSuperAdmin` on every callable regardless of
UI, so a spoofed client still fails. A **deactivated** tenant renders a
persistent top `InlineAlert` banner ("This tenant is deactivated — memberships
are suspended") and the Lifecycle card swaps Deactivate → Reactivate;
Edit/Export remain available (you can still correct and export a deactivated
tenant).

---

## 6. Interactions & motion (FOUNDATION §4 motion tokens)

**Page entry:** content fades/translates in with `ease.entrance` over `page`
(420ms); cards stagger subtly (≤2 steps) — restrained, no spark burst. Respect
`prefers-reduced-motion`: cross-fade only, no translate.

**Edit tenant (Dialog):**

- Open: `Modal/Dialog` scales/fades in `base` (220ms) `ease.standard`, `e3`,
  backdrop dim. Focus moves to first field.
- Fields: name, contactEmail (validated email), contactPhone, contactPerson,
  website (validated URL), **status** `Select` — options
  `active · trial · suspended · expired · deactivated`. **Fix carried from
  status report §10:** the status select MUST include `deactivated` (today's
  `EditTenantDialog` omits it) to match `TenantStatus`; selecting
  `deactivated`/`suspended` here is privilege-gated server-side and audited.
- Submit: button enters pending ("Saving…", `disabled`), no optimistic mutation
  of status (status is server-authoritative and may trigger membership
  side-effects). On success: dialog closes (`fast` exit), success `Toast`, query
  invalidation refreshes the header badge.

**Subscription (Dialog):** plan `Select`
(`trial · basic · premium · enterprise`; `free`/`enterprise` per `TenantPlan`),
numeric limit inputs (empty = "Unlimited"), expiry `DatePicker`. Saves via
`saveTenant({data.subscription})`. **Cross-reference:** full billing cycle /
billing email / period / Razorpay invoicing belongs to the
**super-admin-billing** spec; this card edits limits + plan only and links out.

**Deactivate (destructive, confirm-heavy — the marquee flow):**

1. Click **Deactivate** (`Button danger`) in header or Lifecycle card → opens
   `ConfirmDialog` (`AlertTriangle` icon in `status.error`).
2. Dialog states consequence with **live counts pulled from `tenant.stats`**:
   "This will suspend all memberships for _{name}_ — {totalStudents} students
   and {totalTeachers} teachers. Data is preserved; the tenant can be
   reactivated later."
3. **Type-to-confirm gate:** the confirm button stays `disabled` until the
   operator types the exact `{tenantCode}` (mono) into the `TypeToConfirmField`.
   This is the deliberate friction for a wide-blast action.
4. Confirm → `deactivateTenant({tenantId, reason})`. **No optimistic update** —
   server is authoritative for membership suspension and the resulting status.
   Button shows "Deactivating…". On success: `Toast` "Tenant deactivated —
   {membershipsSuspended} memberships suspended", dialog closes, status badge
   flips to `deactivated`, deactivated banner appears, Lifecycle card swaps to
   Reactivate. (Header-triggered delete dialog additionally navigates back to
   `/tenants`.)
5. Motion: confirm dialog uses `base`/`ease.standard`; the destructive button
   never animates celebratorily.

**Reactivate:** single confirm is lighter (no type-to-confirm — restoring is
non-destructive). On success: `Toast` "Tenant reactivated —
{membershipsReactivated} memberships restored".

**Data export:**

- Toggle collection `Chip`s
  (`students · teachers · classes · exams · submissions`); choose format
  (`csv · json`); **Export** disabled when zero collections selected.
- Click → "Exporting…" pending. On success: render a result region
  (`InlineAlert` info) with a download link — **"Download export (expires in 1
  hour)"** — pointing at the signed Storage URL, plus a `Toast` "Export ready —
  {recordCount} records". The link is explicitly time-boxed; re-export
  regenerates.

**Audit log:**

- `Action filter` `Select` (`All Actions` + the known action labels: Tenant
  Created/Updated/Deactivated/Reactivated, User Created, Users Bulk Imported);
  changing it resets to first page and refetches (server-side filter + composite
  index).
- **Real cursor pagination** (§7 fragment): "Load more" (`ghost` button) appends
  the next page using `nextCursor`; remove today's fake "Showing first 20"
  label. New rows animate in `fast`, `ease.entrance`.

**Feedback discipline:** every mutation → exactly one `Toast`; errors also
inline where a form is open. Optimistic updates are **avoided** for any action
with server-side side effects (status, lifecycle, subscription); only
pure-cosmetic local toggles (export chip selection, audit filter) are instant.

---

## 7. Content & copy (precise admin tone)

**Header:** H1 = `tenant.name` (Fraunces display). Status `Badge` text =
capitalized status. ID = `tenant.tenantCode` in `Spline Sans Mono`. Subtitle =
`contactEmail`. Back link: "‹ Back to Tenants".

**Buttons:** "Edit", "Deactivate", "Reactivate Tenant", "Edit Plan", "Export",
"View All Tenants", "Try again", "Load more", "Cancel", "Save Changes", "Save
Subscription".

**KPI labels:** "Students", "Teachers", "Exams", "Spaces" (counts from
`tenant.stats`, mono).

**Subscription DefinitionList:** Plan · Max Students · Max Teachers · Max Spaces
· Max Exams/Month · Expires. Unset numeric limit → "Unlimited"; unset expiry →
"No expiry".

**Contact:** Email · Phone · Contact Person · Website (each unset → "—").

**Features:** label = humanized flag key with "Enabled" stripped (e.g.
"AutoGrade", "LevelUp", "Scanner App", "AI Chat", "AI Grading", "Analytics",
"Parent Portal", "Bulk Import", "API Access"); state shown as on/off chip with
**icon + label** (check / dash), not color alone. Empty: "No features
configured."

**Settings:** "Gemini Key Set" (Yes/No) · "Default AI Model" · "Timezone" ·
"Locale" (unset → "—").

**Lifecycle copy:**

- Active state: "Deactivating will suspend all user memberships. Data is
  preserved."
- Deactivated state: "Reactivating will restore all suspended memberships."

**Deactivate confirm:** Title "Deactivate Tenant?" · Body "This will suspend all
user memberships for **{name}** — {students} students and {teachers} teachers.
Users lose access until the tenant is reactivated. Data is preserved." · Gate
label "Type `{tenantCode}` to confirm" · Confirm button "I understand —
deactivate this tenant" · Cancel "Cancel".

**Export:** card title "Data Export"; result link "Download export (expires in 1
hour)"; toast "Export ready — {n} records".

**Audit log:** title "Audit Log"; filter placeholder "All Actions"; row = action
label + category badge + "by {actorEmail}" (+ `metadata.displayName`/`role` when
present) + formatted timestamp; empty "No audit log entries yet".

**Error copy (from `ERROR_MESSAGES`):** load fail "We couldn't load this
tenant."; not found "Tenant not found · This tenant may have been deleted or the
ID is invalid."; permission "You don't have access to this tenant.";
rate-limited "Too many requests — try again shortly."

Tone throughout: declarative, consequence-forward, no exclamation, no playful
copy. State _what happens_ and _to whom_.

---

## 8. Domain rules surfaced

1. **Tenant isolation is the hard rule — this screen is the sanctioned
   cross-tenant exception.** Only `superAdmin` may read/act on a tenant they
   aren't a member of, and every such call carries an explicit
   `tenantOverride`/`tenantId` that is itself audited (per common-api §4.4). No
   other role can reach this surface.
2. **RBAC, defense-in-depth, server-authoritative.** UI guard (`isSuperAdmin`
   Firestore flag **and** `role:superAdmin` claim) is convenience; the
   **server** re-checks `isSuperAdmin` on `getTenant`, `saveTenant`,
   `deactivateTenant`, `reactivateTenant`, `exportTenantData`,
   `listPlatformActivity`. Status, subscription, and features are
   **privilege-gated server-side** (a tenant-admin cannot self-upgrade —
   `save-tenant.ts`). The client never trusts its own copy of status; it
   re-reads after every mutation.
3. **Soft lifecycle, never hard-delete from the UI.** "Delete" in this product
   is a relabeled **deactivate** (audit C3): it suspends all memberships and
   preserves data; it is reversible via reactivate. Any future GDPR/offboarding
   hard-purge is a separate, explicitly-flagged `deleteTenant` flow (status
   report §5.5) and is **out of scope** for the default destructive action here.
4. **Token revocation on lifecycle (auth-access §5).** Deactivation must call
   `revokeRefreshTokens(uid)` for affected members + `syncMembershipClaims` so
   suspended users lose access promptly (closing the ~1h stale-claim window).
   The UI's success copy reflects the server's `membershipsSuspended` count —
   not a client guess.
5. **Audit logging is mandatory and surfaced.** Every mutation writes to the
   unified audit log (`logTenantAction` + platform activity); the Audit card on
   this very screen reads it back. The audit filter requires the
   `platformActivityLog(tenantId, action, createdAt desc)` composite index
   (status report §4.6 — must ship in `firestore.indexes.json`).
6. **Quota / limits / cost.** Subscription limits
   (`maxStudents`/`maxTeachers`/`maxSpaces`/`maxExamsPerMonth`) are the enforced
   quota source; "Unlimited" means unset, not "no enforcement bug". Cost/budget
   cross-reference is read-only here and lives fully in the
   **super-admin-billing** spec.
7. **Export is signed + time-boxed.** Export produces a 1-hour signed Storage
   URL; the UI never embeds tenant data inline and always re-states the expiry.
   (Storage RLS hardening is an auth-access concern; the URL is the only
   client-visible handle.)
8. **Answer keys / secrets never shown.** Even cross-tenant, the super-admin
   never sees answer keys (`AnswerKeyLock` domain rule applies platform-wide) or
   the raw Gemini key — Settings shows only "Gemini Key Set: Yes/No" (the secret
   lives in Secret Manager, `tenant-{id}-gemini`).
9. **Type erosion fixed at the boundary.** Reads are validated against the
   `Tenant` schema in `api-client` (dev), replacing the silent `as Tenant` casts
   so schema drift fails loudly.

---

## 9. Accessibility (WCAG AA)

- **Focus order (top→bottom, logical):** Back link → Edit →
  Deactivate/Reactivate → KPI tiles (non-interactive, skipped) → Subscription
  "Edit Plan" → Contact (static) → Features (static chips) → Settings (static) →
  Lifecycle action → Export chips → format `Select` → Export button → result
  link → Audit filter `Select` → audit rows / "Load more". No focus trap outside
  dialogs.
- **Dialogs:** `Modal/Dialog` and `ConfirmDialog` trap focus, restore focus to
  the trigger on close, close on `Esc` and backdrop click (Cancel),
  `aria-labelledby`/`aria-describedby` wired to title/description. Destructive
  confirm button is **not** the default focus — focus lands on the
  type-to-confirm field; the operator must type and then tab to the
  disabled-until-valid confirm button.
- **Keyboard:** all actions reachable/operable by keyboard; `Select`s follow
  listbox semantics (arrow keys, type-ahead); export chips are toggle `Button`s
  with `aria-pressed`; "Load more" is a real button. ⌘K command palette is
  keyboard-first (web only).
- **ARIA / SR:** status `Badge` exposes its text label (status word) — not
  conveyed by color; KPI tiles use `aria-label="Students: 142"`; the deactivated
  banner is an `role="status"`/`aria-live="polite"` region; mutation toasts
  announce via `aria-live`; the audit timeline is an ordered list with each
  row's action, actor, and time read in sequence.
- **Never status-by-color-alone (§2.3):** tenant status, feature on/off, and
  audit categories ALL pair a token color with an **icon + text label**. The
  feature on/off dot is decorative only; the word ("AutoGrade") + state
  ("On"/"Off") carries the meaning.
- **Contrast:** all text/UI pairs meet AA (4.5:1 body, 3:1 large/UI) using the
  semantic tokens; mono IDs on `bg.inset` verified; `status.error` text/icon on
  `bg.surface` ≥4.5:1.
- **Reduced motion:** `prefers-reduced-motion` → drop entrance
  translate/stagger, dialogs cross-fade only, audit "Load more" appends without
  slide. No motion is required to understand any state.
- **Hit targets:** ≥44px on touch; destructive action keeps comfortable spacing
  from benign actions to avoid mis-taps.

---

## 10. Web ↔ mobile divergence

**This is a web/desktop-first admin surface.** The super-admin control plane is
a `super-admin` web SPA (PWA-capable); there is **no native React Native build**
of this screen. State this explicitly: the control plane is operated from a
desktop browser.

Responsive behavior is _within web_ only:

- **Desktop (lg/xl):** full multi-column cockpit as wireframed; ⌘K
  `CommandPalette` available (web-only — no command palette on mobile per §6
  cross-platform rule).
- **Tablet (md):** 2-col paired cards collapse to 1-col; KPI 2×2; header actions
  remain inline.
- **Mobile web (sm, secondary):** single-column stack; header actions wrap; KPI
  2-col→1-col; the audit `Timeline` (already a list) is mobile-friendly as-is —
  **no** web-table→stacked-card transform is needed because this screen uses
  `DefinitionList`/`Timeline`/`Stat` rather than a `DataTable`. Hover
  affordances (prefetch, tooltips) degrade to tap/long-press; destructive
  type-to-confirm is identical (the friction is intentional on every form
  factor).
- No offline mutation queue: lifecycle/export actions require connectivity
  (they're server-authoritative); offline shows the standard PWA banner and
  disables mutations.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp "Lyceum" design system. Read and
conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md — do NOT invent colors,
fonts, spacing, radii, shadows, motion, or component variants; compose ONLY from the
§5 component inventory and cite tokens by semantic name (brand.primary, bg.surface,
bg.canvas, text.primary/secondary/muted, border.subtle, status.success/warning/error/info,
e1/e3, motion base/fast/page, ease.standard/entrance). The marigold `spark` accent is
gamification-only and MUST NOT appear here — this is the SERIOUS admin register.

SCREEN: "Tenant Detail — Cross-Tenant Management", route /tenants/:tenantId, audience
super-admin ONLY (platform control plane). Render inside AppShell (left Sidebar +
Topbar with search/notifications/profile/⌘K; NO tenant switcher — super-admin is global).

LAYOUT (desktop-first, max width 1200, gutter 32, vertical gap 24):
1. Breadcrumb "Tenants › {name}" + "‹ Back to Tenants".
2. Header row: Fraunces H1 {tenant.name} + status Badge (icon+label, mapped:
   active→status.success, trial→status.info, suspended→status.warning,
   expired/deactivated→status.error) + tenantCode in Spline Sans Mono; right-aligned
   secondary "Edit" + danger "Deactivate".
3. KPI strip: 4 Stat/KPI tiles (Students/Teachers/Exams/Spaces) with mono numerals.
4. Two-col: Subscription (DefinitionList: Plan, Max Students/Teachers/Spaces/Exams-per-month
   → "Unlimited" when unset, Expires → "No expiry"; "Edit Plan" opens dialog) +
   Contact Information (DefinitionList; unset → "—").
5. Features: chip grid, each chip = icon + label + On/Off (NEVER color-alone).
6. Settings DefinitionList: Gemini Key Set (Yes/No — never the raw key), Default AI
   Model, Timezone, Locale.
7. Two-col danger zone: Tenant Lifecycle (explanatory copy; danger "Deactivate" or, when
   deactivated, "Reactivate Tenant") + Data Export (collection chips students/teachers/
   classes/exams/submissions, format csv/json Select, Export button → signed link
   "Download export (expires in 1 hour)").
8. Audit Log: Timeline with an Action-filter Select + cursor "Load more"; rows show
   action label + category Badge + "by {actorEmail}" + timestamp.

CRITICAL FLOWS:
- Deactivate = destructive, confirm-heavy: ConfirmDialog states blast radius with live
  counts ({students} students, {teachers} teachers), requires TYPE-TO-CONFIRM of the
  exact tenantCode (mono) before the danger button enables. NO optimistic update —
  server-authoritative; success Toast shows server count "…{n} memberships suspended".
- Reactivate = lighter single confirm (no type-to-confirm).
- A deactivated tenant shows a persistent top InlineAlert banner and swaps Deactivate→Reactivate.

STATES: skeleton (no layout shift), per-region degrade (tenant loads even if audit/cost
errors), not-found EmptyState, inline error + Try again, empty audit EmptyState. Only one
role (superAdmin) — no read-only variant; server re-checks isSuperAdmin on every call.

A11Y: status/feature/audit category by icon+label not color; dialogs trap+restore focus,
Esc=Cancel, focus lands on the type-to-confirm field (not the destructive button); KPIs
aria-labelled; banner aria-live; AA contrast; honor prefers-reduced-motion (cross-fade only).

TONE: precise, consequence-forward, no playful copy, no exclamation. Mono for IDs/counts.
Desktop/tablet/mobile-web responsive (admin is web-only; ⌘K is web-only); no native build.

Output: a single React + Tailwind screen using Lyceum tokens/components, with the Edit,
Subscription, and Deactivate-confirm dialogs, all states, and the audit timeline.
```
