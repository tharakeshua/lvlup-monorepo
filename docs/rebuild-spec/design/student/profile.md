# Profile — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: **personal, proud-of-progress** — this is the
> learner's own page about _them_. Warm, never bureaucratic; precise on the
> numbers, kind in the framing.

> This screen is _identity + a proud snapshot of momentum_ — not a settings
> page. Notification toggles, theme, password, etc. live on `/settings`
> (`settings.md`). Profile shows **who you are** and **how far you've come**,
> with a small set of editable basics.

---

## 1. Purpose & primary user

**Primary user:** a learner viewing their own account — either a **B2B school
student** (role `student`, scoped to a tenant) or a **B2C consumer learner** (no
membership, served from the synthetic `platform_public` tenant via
`user.consumerProfile`). **Job-to-be-done:** _"Show me who the app thinks I am —
my name, photo, school/plan, and a proud at-a-glance of my level, streak,
badges, and spaces completed — and let me fix the basics (name, photo)
quickly."_

Two identity registers, one page:

- **B2B variant** surfaces the **identity context**: school/tenant name + code,
  role, and a `RoleSwitcher` when the learner belongs to more than one tenant.
- **B2C variant** replaces the school block with the **consumer plan** card
  (plan tier, total spend, purchases) drawn from `consumerProfile`.

The gamification numbers here are a _celebratory mirror_ of data owned elsewhere
(the gamification spec owns the canonical widgets and the one celebratory
burst). Profile **reflects** progress; it does not award it.

---

## 2. Entry points & route

**Route:** `/profile` — present in both the B2B student route tree and the B2C
consumer tree (one page, context-resolved per `LearnerContext`; route on
context, not path prefix — webapps-design §5.2 fix). Behind `RequireAuth`
(`allow=['student']`, `onMissingMembership: 'consumerRedirect'` for the B2B
tree; the consumer tree requires only an authed user with no membership).

**Entry points:** the Topbar profile avatar/menu ("View profile"), the Sidebar
"Profile" nav item (B2B) / consumer nav (B2C), and the mobile Tabbar overflow.
The Profile header's gamification widgets deep-link to `/progress` and
`/achievements`.

**Reads** (all via `@levelup/api-client` → `shared-hooks/headless`; **never
Firestore directly**; `tenantId` derived from the active-tenant claim, never the
request body):

- **`users/{uid}`** → **`UnifiedUser`** (`identity/user.ts`): `uid`,
  `displayName`, `firstName`, `lastName`, `email`, `photoURL`, `status`,
  `isSuperAdmin`, `activeTenantId`, and (B2C) `consumerProfile` (`plan`,
  `totalSpend`, `enrolledSpaceIds`, `purchaseHistory`). Sourced from the
  auth-store's real-time `/users/{uid}` snapshot (kept; auth-store is RN-ready)
  exposed via `useCurrentUser()`.
- **`userMemberships/{uid}_{tenantId}`** → **`UserMembership[]`**
  (`identity/membership.ts`): the learner's memberships, each with `role`,
  `tenantId`, `tenantCode`, `status`. Drives the school/role block +
  `RoleSwitcher`. From the auth-store (`currentMembership` + memberships list).
- **Tenant display name** for each membership → via a `useTenantNames(ids)` hook
  (no raw `getDoc` in the page; webapps-design §5.1 fix #18). The active
  tenant's branding/name comes from the tenant-store.
- **`studentLevels/{userId}`** → **`StudentLevel`** (level, currentXP,
  xpToNextLevel, totalXP, tier, achievementCount) — via the gamification repo
  behind api-client (`v1.levelup.getStudentLevel`, or folded into
  `v1.analytics.getSummary { scope: 'student' }`). Powers the `LevelBadge` +
  level/tier stat.
- **`studentProgressSummary`** → **`StudentProgressSummary`** via
  `v1.analytics.getSummary { scope: 'student' }`: `overallScore`,
  `levelup.streakDays`, `levelup.totalPointsEarned`, `levelup.spacesCompleted`
  (or completion count derived from `progress.allSpaces`). Powers streak +
  spaces-completed + overall-score stats.
- **`studentAchievements`** count → for the "achievements earned" stat and link
  to `/achievements`.

**Writes:**

- **Edit basic profile fields** (display name; `firstName`/`lastName`) → through
  the api-client to an identity save callable (`v1.identity.saveStudent` for
  B2B, or a `saveUserProfile`/profile-update path for the unified user doc).
  **No raw `updateProfile` / `updateDoc` from the UI** (resolves the current
  page's direct `firebase/auth` `updateProfile` + `window.location.reload()`
  anti-pattern).
- **Profile photo upload** → request a signed upload URL via
  `v1.identity.uploadTenantAsset` (`assetType: 'profile_photo'`), PUT the file
  to the returned URL, then persist the returned `photoURL` through the same
  profile-save callable. The api-client returns a resolvable **HTTPS URL** (one
  resolution point), not a Storage path. **No `window.location.reload()`** — the
  real-time `users/{uid}` snapshot propagates the new `photoURL` reactively.

Email, role, tenant, plan, and all gamification values are **read-only** on this
screen.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile, per `learner-app-shell.md`). Single reading column, **max
content width 720** (this is an identity/reading surface, not a dense
dashboard), centered, page gutters 16/24/32 (mobile/tablet/desktop), vertical
rhythm `gap` space-6 between regions. Page on `bg.canvas`; cards on `bg.surface`
with `border.subtle` + `e1`; radius `lg`.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER — IDENTITY                                             │
│  ┌─────────┐  Fraunces h2  "Maya Chen"                        │
│  │ Avatar  │  text.secondary  maya@school.edu                 │
│  │  80px   │  Chip: role "Student"  ·  status "Active"        │
│  │ [camera]│  (Avatar has hover/focus camera overlay = edit)  │
│  └─────────┘  Button(ghost) "Edit profile" ▸                  │
├──────────────────────────────────────────────────────────────┤
│ AT-A-GLANCE STATS  (StatCard grid: 1 / 2 / 4 cols)           │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                 │
│  │LevelBdg│ │ 🔥 12  │ │  7     │ │  4      │                 │
│  │ Lv. 7  │ │ streak │ │ badges │ │ spaces  │                 │
│  │ Gold   │ │  days  │ │ earned │ │ done    │                 │
│  └────────┘ └────────┘ └────────┘ └────────┘                 │
│   → /progress    → /progress   → /achievements  → /spaces      │
├──────────────────────────────────────────────────────────────┤
│ IDENTITY CONTEXT                                             │
│  ── B2B variant ──────────────────────────────────────────   │
│  Card "Your school"                                          │
│   DefinitionList:  School  Northbridge Academy (NBA-204)     │
│                    Role    Student                            │
│                    Joined  Mar 2026                           │
│   [ RoleSwitcher ]  (only if >1 active membership)           │
│  ── B2C variant ──────────────────────────────────────────   │
│  Card "Your plan"                                            │
│   DefinitionList:  Plan        Pro                            │
│                    Spaces      6 enrolled                     │
│                    Total spent ₹2,940                         │
│   Button(spark) "Explore the store" ▸  (link to /store)      │
├──────────────────────────────────────────────────────────────┤
│ ACCOUNT BASICS  (DefinitionList, read-mostly)                │
│   Display name   Maya Chen                                    │
│   Email          maya@school.edu   (read-only, muted)        │
│   Member since   March 2026                                  │
│   Button(ghost) "Manage settings" ▸  (link to /settings)     │
└──────────────────────────────────────────────────────────────┘
```

**Edit mode** (Drawer/Sheet on mobile, inline Modal/Dialog on `md+`): a small
RHF form — Avatar with FileDrop/camera affordance, `Input` Display name,
optional First/Last name. Email shown disabled with a "Managed by your school" /
"Sign-in email" helper. Footer: `Button(primary)` Save · `Button(ghost)` Cancel.

**Responsive behavior:**

- **sm (<640):** single column; stats grid → 1 col stacked (or 2×2). Identity
  header stacks avatar above name. Edit opens a bottom **Drawer/Sheet**.
  RoleSwitcher → full-width Select.
- **md (768):** stats grid 2 cols; edit opens a centered **Modal/Dialog**.
  DefinitionLists two-column (term/description).
- **lg (1024+):** stats grid up to 4 cols on one row; reading column stays
  capped at 720 and centered — never stretches to full shell width.

---

## 4. Components used (FOUNDATION §5 only)

- **Layout/nav:** `AppShell`, `Sidebar`/`Topbar`/`Tabbar`, `RoleSwitcher` (B2B,
  multi-membership).
- **Primitives:** `Avatar` (with edit overlay), `Button` (primary / ghost /
  spark variants), `Input`, `FileDrop` (photo), `Select` (RoleSwitcher
  fallback), `Chip`/`Tag` (role, status, plan).
- **Containers:** `Card`, `Section`, `Modal/Dialog` (md+ edit), `Drawer/Sheet`
  (mobile edit).
- **Data:** `DefinitionList` (school/plan/account basics), `Stat/KPI`
  (`StatCard` — streak, badges, spaces, overall score), `Skeleton` (loading),
  `EmptyState` (no progress yet), `Badge`.
- **Domain:** `LevelBadge` (level + tier + XP-to-next), `StreakFlame` (streak
  days), `Achievement` count surfaced as a `StatCard` linking to
  `/achievements`. `XPMeter` may appear compact in the LevelBadge stat
  (canonical widget owned by gamification spec).
- **Feedback:** `Toast` (sonner) for save confirmation, `FormFieldError`,
  `LoadingOverlay`/inline spinner during upload, `InlineAlert` for upload/save
  errors.

**Proposed FOUNDATION additions:** none required — the screen composes entirely
from existing primitives, containers, data, and domain components. (`Avatar`
already implies an editable/upload affordance per its §5 anatomy; no new
component needed.)

---

## 5. States

- **Loading (skeleton):** `Skeleton` avatar circle (80px) + two text bars for
  name/email; a row of 4 `StatCard` skeletons; one card skeleton for the
  identity-context block. `role="status"`, `aria-label="Loading your profile"`,
  visually-hidden "Loading…". Identity (name/email/photo) often resolves first
  from the auth-store snapshot while gamification reads are still in flight —
  show **partial** (real header + skeleton stats), don't block the whole page.
- **Empty / new learner:** stats render real zeros framed kindly —
  `EmptyState`-style microcopy inside the stat region: _"Your stats start here —
  finish your first lesson to light up your streak."_ `StreakFlame` shows `0`
  with an unlit flame, `LevelBadge` shows `Lv. 1`. Never an empty void; never
  punitive.
- **Error:** if gamification/summary reads fail but identity loads, show the
  identity sections normally and an `InlineAlert` (status.warning) in the stats
  region: _"We couldn't load your stats just now."_ + Retry. A full-page error
  only if `users/{uid}` itself is unavailable → `ErrorState` with Retry. Errors
  surface distinctly from empty (global RQ error boundary; common-api §6.3).
- **Partial:** header live, stats skeleton — as above. Or RoleSwitcher present
  but tenant-name lookup pending → show tenant code, fill name when
  `useTenantNames` resolves.
- **Success:** full layout; entering edit mode and saving returns to the read
  view with a success Toast.
- **Permission / role-gated variations:**
  - **B2B student:** "Your school" card with school name + code + role +
    `RoleSwitcher` (if >1 active membership). Display-name edit may be
    **disabled** when the tenant manages identity (email always read-only) —
    show "Managed by your school" helper instead of an editable field.
  - **B2C consumer:** "Your plan" card (plan/total spend/enrolled count) instead
    of school; no `RoleSwitcher`; display name + photo freely editable; spark
    CTA to `/store`.
  - **Multi-membership B2B:** `RoleSwitcher` lists each tenant; switching fires
    `v1.identity.switchActiveTenant` and re-resolves the page under the new
    tenant context.

---

## 6. Interactions & motion

- **Page entry:** sections fade/slide in subtly (`motion.base`,
  `ease.entrance`), small stagger top→bottom. Subtle only — **no celebratory
  burst on this surface** (the burst is owned exclusively by gamification; §8).
- **Edit profile:** "Edit profile" opens Modal (`md+`) / Drawer (mobile) with
  `ease.entrance` `motion.base`; focus moves to the first field. Inline RHF
  validation (display name non-empty, sane length); `FormFieldError` on blur.
- **Save (optimistic):** on Save, optimistically reflect the new display name in
  the header; fire `Button` loading state; on success show `Toast` (success)
  _"Profile updated"_ and close. On failure, roll back the optimistic value and
  show `InlineAlert` with the mapped error message; keep the sheet open so edits
  aren't lost.
- **Photo upload:** clicking the Avatar overlay opens the file picker /
  `FileDrop`. Validate client-side (image type, ≤2MB) → if invalid, Toast
  (error) _"Pick an image under 2MB."_ While uploading: avatar shows a subtle
  progress ring / dimmed overlay (`motion.fast`), "Uploading…" helper text. On
  success the real-time `users/{uid}` snapshot swaps the photo in **reactively**
  — **no full-page reload**. Toast (success) _"New photo — looking good!"_.
- **RoleSwitcher:** selecting another tenant shows a brief `LoadingOverlay` on
  the page while `switchActiveTenant` rebuilds claims + the token refreshes,
  then re-renders under the new context. Confirm only if there are unsaved edits
  (`ConfirmDialog`: _"Discard your changes and switch?"_).
- **Stat tap:** stats are links — pressing/clicking a `StatCard` navigates
  (`motion.fast` press feedback): level/streak → `/progress`, badges →
  `/achievements`, spaces → `/spaces`.
- Respect `prefers-reduced-motion`: replace fades/slides with instant opacity;
  no spinners that imply motion beyond a static "Uploading…" state.

---

## 7. Content & copy

- **Header:** the learner's `displayName` in **Fraunces** (h2); `email` in
  `text.secondary`. Role chip "Student"; status chip "Active" (only surface
  non-active status if relevant).
- **Stats labels:** "Level" (with tier, e.g. "Gold"), "Day streak", "Badges
  earned", "Spaces completed". If you include overall score: "Overall score"
  (e.g. "82%"). Keep numerics in **Spline Sans Mono**.
- **Identity context (B2B):** card title **"Your school"**; DefinitionList
  terms: "School", "Role", "Joined". School shows name + code (e.g. "Northbridge
  Academy · NBA-204").
- **Identity context (B2C):** card title **"Your plan"**; terms: "Plan"
  (Free/Pro/Premium), "Spaces", "Total spent". Spark CTA: **"Explore the store
  ▸"**.
- **Account basics:** "Display name", "Email", "Member since". Email helper:
  _"This is the email you sign in with."_ (B2C) / _"Managed by your school."_
  (B2B managed).
- **Edit form:** title **"Edit your profile"**; fields "Display name", "First
  name" (optional), "Last name" (optional); Save / Cancel.
- **Empty stats:** _"Your stats start here — finish your first lesson to light
  up your streak."_
- **Errors:**
  - Stats failed: _"We couldn't load your stats just now. Your progress is safe
    — try again."_ + Retry.
  - Photo too big: _"Pick an image under 2MB."_
  - Save failed: _"That didn't save. Give it another try?"_
  - Profile unavailable: _"We're having trouble loading your profile. Please try
    again."_
- **Confirmations (Toast):** _"Profile updated"_, _"New photo — looking good!"_.
- Tone throughout: it's **their** page — second person, warm, proud. Numbers
  exact; framing generous.

---

## 8. Domain rules surfaced

- **Tenant isolation (B2B/B2C split):** B2B reads are tenant-scoped
  (`tenants/{tenantId}/…`) with `tenantId` from the active claim; B2C identity
  context comes from `user.consumerProfile` + `platform_public`. The same
  `/profile` page resolves which variant via `LearnerContext` — **never branch
  on path prefix**. The "Your school" vs "Your plan" card is the visible
  manifestation of this rule.
- **Gamification owns the one celebratory moment — Profile only mirrors it.**
  The `LevelBadge`/`StreakFlame`/badge counts here are **read-only
  reflections**; the spring-pop + marigold `spark` `CelebrationBurst` is
  reserved for the gamification surfaces and the live award events. **Do not
  fire a burst on Profile load** (FOUNDATION §4; gamification spec §8). Motion
  on this screen stays subtle.
- **No answer keys, no assessment internals here** — Profile surfaces aggregate
  progress only; it never exposes correctness data, stored answers, or anything
  from the server-only `answerKeys` subcollection (out of scope but the global
  rule stands: clients physically cannot read it).
- **All data flows through `@levelup/api-client`** — typed callable registry +
  repos, Zod-validated, timestamps normalized to epoch-ms at the repo edge. The
  page must not import `firebase/firestore`, `firebase/auth` (`updateProfile`),
  or `firebase/storage` directly (removes the current page's direct-SDK upload +
  `window.location.reload()` debt).
- **Identity values are server-authoritative & validated:** role, tenant, plan,
  level, streak are read-only; editable basics (name, photo) round-trip through
  a validated callable (`v1.identity.saveStudent` / profile save +
  `uploadTenantAsset`), so the server remains the source of truth and
  claims/branding stay consistent.

---

## 9. Accessibility

- **Focus order:** skip-to-content → header (avatar edit button, then "Edit
  profile") → stat links in reading order → identity-context card (RoleSwitcher)
  → account basics → "Manage settings". Logical and linear.
- **Avatar edit:** the camera overlay is a real `<button>` with
  `aria-label="Change profile photo"`, keyboard-focusable (not hover-only); a
  visible focus ring (`border.focus`, 3px) — the edit affordance must not depend
  on hover.
- **Edit modal/drawer:** focus trapped while open, focus returns to the trigger
  on close, `Esc` closes (with unsaved-changes `ConfirmDialog`). Labels
  associated with inputs; `FormFieldError` linked via `aria-describedby`;
  disabled email field has an accessible helper.
- **Stats:** each `StatCard` link has an accessible name including value + label
  (e.g. "Level 7, Gold — view progress"). Never encode tier/streak by color
  alone — pair with icon + text label (FOUNDATION §2 contrast rule).
- **Live regions:** upload progress and save/error states announced via
  `aria-live="polite"`; sonner Toasts are announced. Loading skeleton wrapped in
  `role="status"`.
- **Contrast:** all text/background pairs meet WCAG AA; mono numerics on
  `bg.surface` at body or large sizes pass; tier chips use icon+label, not
  hue-only.
- **Reduced motion:** honor `prefers-reduced-motion` — fades become instant, the
  upload "progress ring" becomes a static "Uploading…" label.
- **Touch targets:** ≥44px for avatar edit, stat cards, RoleSwitcher, and edit
  buttons on mobile.

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = Topbar + bottom **Tabbar**;
  Profile typically reached via Tabbar overflow / avatar menu.
- **Edit affordance:** web opens an inline **Modal/Dialog** (`md+`); mobile
  opens a bottom **Drawer/Sheet**. Avatar edit is **hover-revealed camera
  overlay on web**, an always-visible camera badge on the avatar on **mobile
  (press)** — never hover-gated on touch.
- **Stats grid:** web shows up to 4 `StatCard`s in a row; mobile stacks to 1–2
  columns.
- **Photo capture:** mobile `FileDrop`/picker can offer **camera capture** in
  addition to library; web is file-picker/drag-drop.
- **RoleSwitcher:** web = dropdown/popover; mobile = full-width `Select`/action
  sheet.
- **No ⌘K** CommandPalette on mobile; the Topbar profile menu is the entry path
  there.
- Components are name/prop-identical across `shared-ui` (web) and `ui-native`
  (mobile); only the renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the STUDENT "Profile" screen (route /profile) for the Auto-LevelUp learner web app.
Conform EXACTLY to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
(Direction A — "Modern Scholarly"). Do NOT invent colors, fonts, spacing, radii, shadows,
or component variants — compose only from FOUNDATION §2/§3/§4/§5 and cite tokens by semantic
name (bg.canvas, bg.surface, text.primary/secondary, brand.primary, spark, border.subtle,
status.success/warning, radius.lg, e1, motion.base/fast, ease.entrance).

Tone: personal, proud-of-progress — it's the learner's own page. Warm, second person,
precise on numbers, kind in framing.

Purpose: an identity + proud progress snapshot (NOT a settings page). Show:
- Identity header: 80px Avatar (with keyboard-accessible "change photo" camera overlay),
  displayName in Fraunces (h2), email in text.secondary, role + status chips, an "Edit
  profile" ghost Button.
- At-a-glance StatCards (grid 1/2/4 cols): LevelBadge (level + tier + XP-to-next),
  StreakFlame (streak days), achievements-earned count, spaces-completed — each a link
  (→ /progress, /progress, /achievements, /spaces).
- Identity-context card with TWO variants resolved by LearnerContext:
  • B2B "Your school" — DefinitionList (School name+code, Role, Joined) + RoleSwitcher
    when the learner has >1 active membership.
  • B2C "Your plan" — DefinitionList (Plan, enrolled Spaces, Total spent from consumerProfile)
    + a spark Button "Explore the store".
- Account basics DefinitionList (Display name, read-only Email, Member since) + link to /settings.

Use ONLY FOUNDATION §5 components: AppShell, Avatar, Button (primary/ghost/spark), Input,
FileDrop, Card, Section, Modal/Dialog (md+ edit) / Drawer-Sheet (mobile edit), DefinitionList,
StatCard, LevelBadge, StreakFlame, Chip/Tag, Skeleton, EmptyState, InlineAlert, Toast,
RoleSwitcher.

Layout: single reading column, max-width 720, centered, gutters 16/24/32. Cards on bg.surface,
border.subtle + e1, radius lg. Responsive: stats 1 col (sm) → 2 (md) → 4 (lg); edit = bottom
Drawer on mobile, centered Modal on md+; avatar camera overlay hover-revealed on web,
always-visible on mobile (press).

States: skeleton loading (identity may resolve before stats → partial OK); empty/new learner
shows real zeros with the kind line "Your stats start here — finish your first lesson to light
up your streak."; stats-load error = InlineAlert (status.warning) + Retry, distinct from empty;
success = full layout. Edit mode = RHF form (Display name required; First/Last optional; Email
disabled with "Managed by your school"/"Sign-in email" helper), Save (optimistic) + Cancel.

Domain rules to honor:
- B2B vs B2C resolved by LearnerContext, NOT path prefix; "Your school" vs "Your plan".
- Gamification widgets here are READ-ONLY mirrors — NO CelebrationBurst on Profile load;
  motion stays subtle.
- All data via @levelup/api-client (no firebase/firestore, no firebase/auth updateProfile,
  no window.location.reload). Photo upload = uploadTenantAsset signed URL → PUT → persist
  returned HTTPS photoURL via profile-save callable; the real-time users/{uid} snapshot
  refreshes the avatar reactively.

Accessibility: logical focus order; avatar edit is a real keyboard-focusable button with
aria-label; edit modal traps focus, Esc closes (confirm if unsaved), inputs labeled,
FormFieldError via aria-describedby; StatCard links have value+label accessible names;
upload/save announced via aria-live; honor prefers-reduced-motion; ≥44px touch targets;
WCAG AA contrast, never color-only status.

Deliver a desktop (lg) and a mobile (sm) frame, read view + edit Drawer/Modal, plus the
skeleton, empty, and stats-error states.
```
