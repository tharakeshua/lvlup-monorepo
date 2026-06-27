# Teacher Settings

> The teacher's personal-preferences and (admin-only) evaluation-configuration
> surface — "set how I work and, if I'm an admin, how this tenant grades." A
> calm, form-driven settings console: profile/display, theme, notification
> preferences, and a permission-gated Evaluation settings section for
> `tenantAdmin`. It edits preferences; it never authors content or grades
> submissions, and every write goes through a callable — no direct client
> Firestore writes.

**Route** `/settings` · **Roles** `teacher` (personal sections only) ·
`tenantAdmin` (personal + Evaluation settings) · **Primary APIs**
`identity.manageNotifications` (read prefs) → `saveNotificationPreferences`
(NEW) · `evaluationSettings.get` → `v1.autograde.saveEvaluationSettings` (NEW
callable — replaces today's direct `updateDoc`) · profile read from auth-store /
`users.get` → `v1.identity.saveStudent`-class profile upsert (display-name only)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
All tokens, type, spacing, radius, elevation, motion, and components are cited
by their FOUNDATION semantic names — no new tokens or variants are introduced.
Per FOUNDATION §1, staff surfaces read **credible and focused**: restraint in
chrome, no gamification celebration chrome anywhere on this surface.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` or `tenantAdmin` in the active tenant, configuring
how the portal works for them personally and — for admins only — how the tenant
evaluates and grades.

**Job-to-be-done:** _"Set my display name, pick my theme, choose which
notifications I receive, and — if I'm an admin — tune the tenant's auto-grading,
results-release, override, and AI-confidence/quota defaults — and trust that
each change is saved safely and reversibly."_

Two distinct emotional registers do **not** apply here: this is a
single-register, staff-operational surface. It is **precise, calm,
professional** throughout. There is no XP meter, streak flame, level-up burst,
or celebratory `spark` chrome — `spark` is not used on this screen at all (it is
reserved for student gamification per FOUNDATION §1/§4). The only
`brand.primary` emphasis is the primary "Save" action per section.

**Explicitly NOT this screen's job** (FOUNDATION + domain rules):

- Authoring spaces/items (that is the SPACES area) — Evaluation settings here
  set _defaults_; they do not edit rubrics or items.
- Grading or releasing exam results (that is the EXAMS area / GradingReview) —
  the "Require override reason" / "Auto-release results" toggles set policy,
  they do not grade.
- Editing rosters, classes, students, or other users (those live in People
  surfaces).
- Tenant branding, billing, academic sessions, or feature flags (those live in
  the **admin-web** Settings, not teacher-web).
- Any client-side recompute of confidence thresholds, quota usage, or grading
  outcomes — the client only _sets_ the configuration; the server enforces it.

---

## 2. Entry points & route

**Route:** `/settings` — gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard; `specs/webapps-design.md` §4.2). It is the `Settings` item
in the `System` nav group (`navMeta.group: 'System'`, `label: 'Settings'`,
`icon: 'settings'`; not a mobile bottom-nav primary tab — reached from the
profile/overflow menu on mobile).

**Entry points:**

- The "Settings" sidebar item (`AppSidebar`, System group).
- The `Topbar` profile/avatar dropdown → "Settings".
- `CommandPalette` (⌘K) → "Go to Settings".
- The `ThemeToggle` in the `Topbar` is a shortcut to the same theme preference
  surfaced here (both write the same source — see §6).

**Reads powering it** (all via `@levelup/api-client` repositories/hooks — UI
never touches Firestore; `specs/common-api.md` §3.3):

- **Profile / display:** from `shared-stores/auth-store` (the single auth source
  of truth — `status/auth-access.md` §5.7): `firebaseUser` (email, photoURL),
  `currentMembership` (role, tenantId), display name. The membership/claims are
  read-only here except display name. `tenantId` is derived from claims
  server-side and is shown read-only, never an editable field
  (FOUNDATION/domain: tenant isolation).
- **Theme:** the persisted theme preference (`next-themes` value, persisted per
  user; mirrors the `ThemeToggle`). Local + persisted; not tenant-scoped.
- **Notification preferences:** `NotificationPreferences` for `(uid, tenantId)`
  — `enabledTypes: NotificationType[]`, optional `muteUntil`. Read via the
  notifications repo (today the prefs doc at
  `tenants/{t}/notificationPreferences/{id}`; in the rebuild behind a read
  endpoint / the notifications repo).
- **Evaluation settings (tenantAdmin only):** `evaluationSettings.get` → the
  tenant's default `EvaluationSettings` (`status/app-teacher-web.md` §2.1;
  `EvaluationSettings` type): `enabledDimensions`,
  `displaySettings{showStrengths, showKeyTakeaway, prioritizeByImportance}`,
  `confidenceConfig{confidenceThreshold (default 0.7), autoApproveThreshold (default 0.9), requireReviewForPartialCredit}`,
  `usageQuota{monthlyBudgetUsd, dailyCallLimit, warningThresholdPercent (default 80)}`,
  plus the grading-policy fields surfaced through this UI today (`autoGrade`,
  `requireOverrideReason`, `releaseResultsAutomatically`, `defaultStrictness`).
  This read is **only requested for `tenantAdmin`** — a plain teacher's bundle
  never fetches it.

**Writes (all callables — no direct client Firestore writes; this is the key fix
over today's code):**

- **Display name:** profile upsert callable (display-name-only field on the
  user/entity; `v1.identity.save*` family). Does not touch role, claims, or
  tenant.
- **Theme:** persisted theme preference write (user-scoped; via the same
  preference write the `ThemeToggle` uses). Optimistic + persisted.
- **Notification preferences:** `saveNotificationPreferences` (NEW callable) —
  upserts `enabledTypes` / `muteUntil` for `(uid, tenantId)`. (Today
  `notificationPreferences` is recipient-read + CF-create per `firestore.rules`;
  the rebuild routes the _update_ through a callable too.)
- **Evaluation settings (tenantAdmin only):**
  **`v1.autograde.saveEvaluationSettings`** — a **NEW callable** that replaces
  the current direct `updateDoc` in `SettingsPage.tsx`
  (`status/app-teacher-web.md` §1.6/§4 calls this out explicitly as a write that
  bypasses the callable layer). The callable validates the request against the
  colocated Zod schema, asserts `tenantAdmin`-or-superAdmin authorization
  server-side, derives `tenantId` from claims, applies the `save*` upsert
  convention, and writes `updatedAt` server-side. This moves the tenant-grading
  policy behind server invariants and audit (`specs/common-api.md` §3.1, §9).

> **Migration call-out (must ship with this screen):** today `SettingsPage.tsx`
> saves evaluation settings via
> `updateDoc(doc(db, 'tenants/{tenantId}/evaluationSettings', settings.id), {...})`
> directly from the browser. The rebuild **removes that direct write** and
> introduces `v1.autograde.saveEvaluationSettings` in the registry
> (`specs/common-api.md` §11 step 3 lists `saveEvaluationSettings` among the new
> callables). The client never imports `firebase/firestore` here.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar`, `Topbar` (tenant
switcher, ⌘K, `NotificationBell`, profile/`ThemeToggle`), and on mobile a
`Tabbar` (`MobileBottomNav`) replacing the sidebar. Settings owns only the
**main content region**. This is a **reading-width** surface: max content width
720 (FOUNDATION §4 reading measure) — forms read better narrow and centered.
Page gutters follow FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32). Vertical
rhythm uses `gap` from the spacing scale; sections separated by space-8/`32`.

Structure is a **left in-page `Tabs` rail** (or a vertical section nav on lg)
over stacked `Section`/`Card` blocks. On sm the tabs become a horizontal
scrollable `Tabs` bar above the content.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [tenant ▾] ……… [⌘K] [🔔] [theme] [avatar]            │
│ (nav)   ├───────────────────────────────────────────────────────────────┤
│         │  MAIN  (max-w 720, centered, gutter 32)                         │
│         │  ┌─ Page header ─────────────────────────────────────────────┐ │
│         │  │ h1 "Settings"   ·  subline "Your preferences for {tenant}" │ │
│         │  └────────────────────────────────────────────────────────────┘│
│         │  ┌─ Tabs (lg: left rail / sm: top bar) ──────────────────────┐ │
│         │  │ [Profile] [Appearance] [Notifications] [Evaluation*]       │ │
│         │  └────────────────────────────────────────────────────────────┘│
│         │  ┌─ PROFILE & DISPLAY (Section / Card) ──────────────────────┐ │
│         │  │ Avatar  · Display name (Input)                             │ │
│         │  │ Email (read-only)  · Role (Badge, read-only)              │ │
│         │  │ Tenant (read-only, from claims)                          │ │
│         │  │                                   [ Save profile ]        │ │
│         │  └────────────────────────────────────────────────────────────┘│
│         │  ┌─ APPEARANCE (Section / Card) ─────────────────────────────┐ │
│         │  │ Theme: ThemeToggle  ( ○ Light  ◐ System  ● Dark )         │ │
│         │  │  (over Lyceum light↔dark semantic tokens)                 │ │
│         │  └────────────────────────────────────────────────────────────┘│
│         │  ┌─ NOTIFICATIONS (Section / Card) ──────────────────────────┐ │
│         │  │ Per-type Switch rows (enabledTypes):                      │ │
│         │  │  • At-risk alerts            [Switch]                     │ │
│         │  │  • Grading complete         [Switch]                     │ │
│         │  │  • Results released         [Switch]                     │ │
│         │  │  • Announcements            [Switch]                     │ │
│         │  │  • AI budget alerts (admin)  [Switch]                     │ │
│         │  │ Mute until: [DatePicker, optional]                       │ │
│         │  │                                   [ Save notifications ]  │ │
│         │  └────────────────────────────────────────────────────────────┘│
│         │  ┌─ EVALUATION SETTINGS  (tenantAdmin ONLY) ─────────────────┐ │
│         │  │ Banner: "Tenant-wide · applies to all teachers" (info)    │ │
│         │  │ Grading policy:                                           │ │
│         │  │  • Auto-grade submissions       [Switch]                 │ │
│         │  │  • Require override reason       [Switch]                 │ │
│         │  │  • Auto-release results          [Switch]                 │ │
│         │  │  • Default AI strictness         [Select ▾]              │ │
│         │  │ Confidence routing:                                      │ │
│         │  │  • Needs-review threshold        [Slider/Input 0–1]      │ │
│         │  │  • Auto-approve threshold        [Slider/Input 0–1]      │ │
│         │  │  • Review partial credit         [Switch]                │ │
│         │  │ AI usage quota:                                          │ │
│         │  │  • Monthly budget (USD)          [Input]                 │ │
│         │  │  • Daily call limit              [Input]                 │ │
│         │  │  • Warning threshold (%)         [Input/Slider]          │ │
│         │  │                                   [ Save evaluation ]     │ │
│         │  └────────────────────────────────────────────────────────────┘│
└─────────┴───────────────────────────────────────────────────────────────┘
```

**Region order & grid:**

1. **Page header** — `h1` "Settings" (Fraunces display) + a secondary subline
   (Schibsted, `text.secondary`): `Your preferences for {tenantName}`. No CTA in
   the header (saves live per-section).
2. **In-page Tabs** — `Tabs` with `Profile` · `Appearance` · `Notifications` ·
   `Evaluation settings` (last tab present **only** for `tenantAdmin`). On lg
   the tabs render as a left vertical rail (`grid-cols-[200px_1fr]`, `gap`
   space-8/`32`); on sm/md they collapse to a horizontal scrollable `Tabs` bar
   above a single content column. Tab state may also reflect in the URL hash
   (`/settings#notifications`) for deep-linking.
3. **Profile & display** — `Section`/`Card`: `Avatar`, display-name `Input`,
   read-only email, read-only role `Badge`, read-only tenant. Section-scoped
   `Save profile` `Button` (`brand.primary`), disabled until dirty + valid.
4. **Appearance** — `Section`/`Card`: the shared `ThemeToggle` (light / system /
   dark) over Lyceum semantic tokens. Writes immediately (no Save button needed
   — theme is an instant, reversible preference).
5. **Notifications** — `Section`/`Card`: a list of per-type `Switch` rows bound
   to `enabledTypes`, plus an optional `muteUntil` `DatePicker`. Section-scoped
   `Save notifications` `Button`.
6. **Evaluation settings (tenantAdmin only)** — a single `Section`/`Card` with
   three grouped sub-sections (Grading policy / Confidence routing / AI usage
   quota) using `Switch`, `Select`, `Slider`/`Input`. A top `InlineAlert`
   (`status.info`) states it is tenant-wide. Section-scoped `Save evaluation`
   `Button`.

Cards use radius `lg`, elevation `e1` at rest (FOUNDATION §4). Background is
`bg.canvas`; cards/panels are `bg.surface`; inset/sunken groupings (sub-section
dividers) use `bg.surface-sunken`. Inputs/buttons use radius `md`;
switches/badges use `pill`.

**Responsive summary:**

- **sm (<768):** single column; tabs become a horizontal scrollable bar; each
  section full-width; switches and their labels stack label-left / control-right
  with ≥44px touch targets. Save buttons full-width at the section foot.
- **md (768–1023):** single centered column at reading width; tabs horizontal;
  section cards comfortable.
- **lg+ (≥1024):** left vertical tab rail + content column
  (`grid-cols-[200px_1fr]`); content stays at reading width (720) centered
  within the column. The Evaluation tab's three sub-groups may use a 2-col grid
  for the numeric quota inputs.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2). No new primitives.

| Region             | Component(s)                                                                                                                                                           | Notes                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell              | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`, `ThemeToggle` (Topbar instance)  | Provided by `PlatformLayout`; not rebuilt here.                                                                                                |
| Header             | Fraunces `h1`, `text.secondary` subline                                                                                                                                | No `spark`; no header CTA.                                                                                                                     |
| In-page nav        | `Tabs` (`shared-ui/primitives`)                                                                                                                                        | Left rail on lg, horizontal scroll on sm/md; `Evaluation settings` tab role-gated.                                                             |
| Section containers | `Section`, `Card` (radius `lg`, `e1`), `Separator`                                                                                                                     | One card per tab; sub-groups separated by `Separator` over `bg.surface-sunken`.                                                                |
| Forms              | `Form` (react-hook-form + `zodResolver` over the callable-schemas), `FormFieldError`                                                                                   | One RHF form per section; schema reused from `api-contract` (`specs/webapps-design.md` §7 #10 — "RHF + zodResolver reusing callable-schemas"). |
| Profile            | `Avatar`, `Input` (display name), `Label`, `Badge` (role, read-only), read-only text rows (`DefinitionList`) for email/tenant                                          | Email/role/tenant are non-editable, rendered in `text.secondary`.                                                                              |
| Appearance         | `ThemeToggle`                                                                                                                                                          | Single source with the Topbar toggle; over Lyceum light↔dark semantic tokens (FOUNDATION §2.2).                                                |
| Notifications      | `Switch` (per `NotificationType`), `Label`, `DatePicker` (`muteUntil`), `Button`                                                                                       | Switches paired with text labels — status/choice never color-alone.                                                                            |
| Evaluation (admin) | `InlineAlert`/`Banner` (`status.info` "tenant-wide"), `Switch`, `Select`, `Slider` + `Input` (thresholds), numeric `Input` (budget/limits), `Button`, `FormFieldError` | `Slider` shows the 0–1 confidence value with a mono numeric readout (Spline Sans Mono).                                                        |
| Feedback           | `Toast` (sonner), `LoadingOverlay` (none — inline button-spinner instead), `ConfirmDialog`                                                                             | Toasts on save success/failure; `ConfirmDialog` only for the high-impact Evaluation toggles (see §6).                                          |
| Loading            | `Skeleton`                                                                                                                                                             | Per-section silhouette while reads settle.                                                                                                     |
| Empty / error      | `EmptyState`, `ErrorState`/`InlineAlert`                                                                                                                               | Distinct empty vs error; the "no evaluation settings yet" first-run case is an `EmptyState` with a "Create defaults" affordance.               |

**Proposed addition — none required.** Every control composes from existing §5
primitives. The per-type notification list, the confidence sliders, and the
quota inputs are compositions of `Switch`/`Slider`/`Input`, not new components.
The numeric mono readout reuses FOUNDATION §3 mono type, not a new variant.

---

## 5. States

Each tab/section is an independent RHF form with its own read query, so the
screen supports **partial** readiness — one section loading or erroring never
blocks another.

**Loading (skeleton).** On first mount with no cached data, render the section
silhouettes in `Skeleton` (FOUNDATION §5): a header bar, the tabs rail, and
per-section field-row skeletons (label + control placeholders). The Evaluation
section skeleton renders **only for `tenantAdmin`**. The region wrapper carries
`role="status"` `aria-label="Loading settings"`. Skeleton → content crossfade
with `ease.entrance` over `base` (220ms). No full-screen spinner.

**Empty / first-run.**

- _No notification preferences yet:_ the per-type switches render at their
  server defaults (all enabled types on) — there is no "empty" form; first save
  creates the prefs doc.
- _No evaluation settings configured (tenantAdmin, first run):_ an `EmptyState`
  inside the Evaluation card — title "No evaluation defaults yet", body "Set how
  this tenant auto-grades, releases results, and routes low-confidence grades
  for review.", CTA `Create defaults` (which reveals the form pre-filled with
  the schema defaults: `confidenceThreshold 0.7`, `autoApproveThreshold 0.9`,
  `warningThresholdPercent 80`, `defaultStrictness moderate`). This replaces
  today's bare `"No evaluation settings configured for this tenant yet."` line
  (`SettingsPage.tsx`) with a real first-run flow that ends in a callable
  create.

**Error.** Distinct from empty (FOUNDATION §5 / `specs` §2.2 `ErrorState`). A
failed read renders an in-card `ErrorState`/`InlineAlert` (`status.error`,
icon + label, never color-alone) scoped to that section with a "Retry" `Button`
(ghost) that refetches just that query. A failed **save** keeps the form values
intact, surfaces a `Toast` (`status.error`) with safe copy mapped from
`error.details.code` (`specs/common-api.md` §6), and — for field-level
validation rejections (`VALIDATION_ERROR` with `validationErrors[]`) — paints
the offending fields with `FormFieldError`. A `PERMISSION_DENIED` on the
Evaluation save (e.g. a teacher who somehow reached it) surfaces a clear "You
don't have permission to change evaluation settings" and reverts. Errors are
never silently rendered as empty.

**Success.** On save success, the section's `Save` button returns from its
inline spinner to enabled-but-clean (disabled until next edit), a brief `Toast`
(`status.success`) confirms (e.g. "Profile saved", "Notification preferences
saved", "Evaluation settings saved"), and the form resets its dirty baseline to
the saved values. Theme changes apply instantly with no toast (the visible theme
flip is its own confirmation).

**Permission-gated variants by role:**

- **`teacher`:** sees **Profile**, **Appearance**, **Notifications** only. The
  **Evaluation settings** tab and section are **absent entirely** (not rendered
  disabled) and `evaluationSettings.get` is **never requested**. The
  `ai_budget_alert` notification row is also hidden (admin-only concern). No
  cross-tenant or cross-teacher data appears.
- **`tenantAdmin`:** sees all four tabs, including **Evaluation settings**,
  which it can read and save via `v1.autograde.saveEvaluationSettings`. The
  `ai_budget_alert` notification toggle is present.
- **Defense-in-depth:** even if the Evaluation UI were reached without
  permission, the callable re-asserts `tenantAdmin`-or-superAdmin server-side
  (`status/auth-access.md` §1.6) and rejects — the UI gate is UX only.

---

## 6. Interactions & motion

**Core flow (edit → per-section save).** Each section is its own RHF form; saves
are explicit and per-section (except theme, which is instant). The `Save` button
is disabled until the form is **dirty and valid** (`zodResolver` over the
colocated schema). On submit: validate client-side → call the section's callable
→ optimistic where safe → toast → reset dirty baseline.

- **Profile:** edit display name → `Save profile` calls the profile upsert
  callable. Optimistic: the new name reflects immediately in the header/avatar
  tooltip; on failure it rolls back and a `status.error` toast reports it.
  Email/role/tenant are read-only and never submitted.
- **Appearance (theme):** selecting Light / System / Dark on the `ThemeToggle`
  applies **instantly and optimistically** (CSS variables flip at
  `:root`/`.dark` over Lyceum tokens, FOUNDATION §2.2; `specs/webapps-design.md`
  §2.1) and persists the preference; this is the same write the Topbar
  `ThemeToggle` performs, so both surfaces stay in sync (one source). No Save
  button; no toast. Respects `prefers-reduced-motion` — the theme transition is
  an instant swap (no cross-fade) when reduced motion is set.
- **Notifications:** toggling per-type `Switch` rows updates local form state
  optimistically; `Save notifications` commits via
  `saveNotificationPreferences`. `muteUntil` via `DatePicker`. On failure,
  switches revert to the last saved state and a `status.error` toast reports it.
- **Evaluation settings (tenantAdmin):** edit grading policy / confidence /
  quota → `Save evaluation` calls `v1.autograde.saveEvaluationSettings`.
  - **Confirmation on high-impact toggles.** Turning **Auto-release results**
    ON, or **Auto-grade** OFF, opens a `ConfirmDialog` (FOUNDATION §5 Feedback)
    explaining the tenant-wide effect ("This applies to all teachers and future
    exams") before the change is staged — because these alter grading/release
    policy for everyone. Lower-impact fields (thresholds, budget) save without a
    confirm but are validated.
  - **Threshold guardrails.** The client pre-validates that
    `confidenceThreshold ≤ autoApproveThreshold` (the needs-review cutoff must
    not exceed the auto-approve cutoff) and shows a `FormFieldError` if
    violated, mirroring the server schema; the slider readout is mono
    (FOUNDATION §3). The client only _sets_ thresholds — the server enforces
    routing (low <0.7 → review, >0.9 → auto-accept per FOUNDATION §2.3); the UI
    never recomputes confidence outcomes.

**Motion (FOUNDATION §4 tokens, "felt not seen"):**

- Section/tab entrance: `FadeIn` with `ease.entrance` over `base` (220ms);
  switching tabs crossfades the panel over `fast` (160ms) `ease.standard`.
- Switch toggle: the thumb slides over `instant`/`fast` with `ease.standard`;
  the track color animates `border.strong` → `brand.primary` when enabled (never
  color-alone — the label states the meaning).
- Save button: an inline spinner replaces the label during the in-flight call
  (no full-screen `LoadingOverlay`).
- `ConfirmDialog` enters at `e3` elevation with `ease.entrance`; Esc / Cancel
  exits with `ease.exit`.
- **No celebratory motion.** Per FOUNDATION §4 the spring/marigold-burst moment
  is reserved for student gamification; this staff surface never uses it.
  `spark` glow is not applied to any button here.
- Respect `prefers-reduced-motion`: disable panel crossfades, switch-track
  animation easing (instant state change), and dialog transitions —
  content/state changes apply immediately.

**Feedback & freshness:** saves are confirmed by `Toast`; theme is
self-confirming. There is no live recomputation on this surface — it edits
stored configuration. After an Evaluation save, the new defaults take effect
server-side on subsequent grading; the UI does not imply retroactive re-grading
of existing submissions.

---

## 7. Content & copy

Tone: direct, professional, calm (FOUNDATION §1 staff register). Numerals
(thresholds, budget) in mono.

**Header**

- h1: `Settings`
- Subline: `Your preferences for {tenantName}.`

**Tabs:** `Profile` · `Appearance` · `Notifications` · `Evaluation settings`
(admin only)

**Profile & display (section title):** `Profile & display`

- `Display name` (Input, editable) — helper:
  `How your name appears to colleagues and in reports.`
- `Email` (read-only) — caption: `Managed by your administrator.`
- `Role` (read-only `Badge`: "Teacher" / "Tenant admin")
- `Tenant` (read-only) — caption:
  `You're signed in to {tenantName}. Switch tenants from the top bar.`
- Button: `Save profile`

**Appearance (section title):** `Appearance`

- Label: `Theme`
- Options: `Light` · `System` · `Dark` — helper:
  `Applies instantly across the portal.`

**Notifications (section title):** `Notifications`

- Intro: `Choose which alerts you receive in this tenant.`
- Rows (label · description):
  - `At-risk alerts` · `When a student in your classes is flagged at risk.`
  - `Grading complete` · `When AI grading finishes for an exam you manage.`
  - `Results released` · `When exam results are released to students.`
  - `Announcements` · `Tenant announcements from your administrator.`
  - `AI budget alerts` _(admin only)_ ·
    `When this tenant nears its monthly AI budget.`
- `Mute until` (optional `DatePicker`) · helper:
  `Pause all notifications until this date.`
- Button: `Save notifications`

**Evaluation settings — tenantAdmin only (section title):**
`Evaluation settings`

- Info banner:
  `Tenant-wide — these defaults apply to all teachers and future exams in {tenantName}.`
- **Grading policy** (group label):
  - `Auto-grade submissions` ·
    `Grade submissions automatically with AI when they arrive.`
  - `Require override reason` ·
    `Make teachers enter a reason when overriding an AI grade.`
  - `Auto-release results` ·
    `Release results to students automatically once grading completes.`
  - `Default AI strictness` (`Select`: `Lenient` / `Moderate` / `Strict`) ·
    `The default grading strictness for new exams.`
- **Confidence routing** (group label):
  - `Needs-review threshold` (Slider/Input, 0–1, default `0.70`) ·
    `Grades below this confidence are flagged for human review.`
  - `Auto-approve threshold` (Slider/Input, 0–1, default `0.90`) ·
    `Grades above this confidence are auto-approved.`
  - `Review partial-credit grades` ·
    `Always send partial-credit grades for human review.`
- **AI usage quota** (group label):
  - `Monthly budget (USD)` (Input, `0` = unlimited)
  - `Daily call limit` (Input, `0` = unlimited)
  - `Warning threshold (%)` (Input/Slider, default `80`) ·
    `Warn when usage reaches this share of the budget.`
- Button: `Save evaluation settings`

**Confirm dialogs (Evaluation):**

- Auto-release ON: title `Release results automatically?`, body
  `Students will see their results as soon as grading completes — across all teachers and future exams. You can turn this off later.`,
  confirm `Turn on auto-release`, cancel `Cancel`.
- Auto-grade OFF: title `Turn off auto-grading?`, body
  `New submissions won't be graded by AI automatically; teachers will grade them manually. This applies tenant-wide.`,
  confirm `Turn off auto-grading`, cancel `Cancel`.

**First-run empty (Evaluation):** title `No evaluation defaults yet`, body
`Set how this tenant auto-grades, releases results, and routes low-confidence grades for review.`,
CTA `Create defaults`.

**Validation copy (FormFieldError):**

- Display name empty: `Enter a display name.`
- Thresholds out of order:
  `The needs-review threshold can't be higher than the auto-approve threshold.`
- Threshold out of range: `Enter a value between 0 and 1.`
- Budget/limit negative: `Enter 0 or a positive number.`

**Success toasts:** `Profile saved` · `Notification preferences saved` ·
`Evaluation settings saved` **Error toasts:**
`Couldn't save your changes. Try again.` (generic);
`You don't have permission to change evaluation settings.` (PERMISSION_DENIED).
**Read error (per section):** title `Couldn't load {section}`, body
`Something went wrong fetching this.`, action `Retry`.

---

## 8. Domain rules surfaced

- **Tenant isolation.** Everything is scoped to the caller's active tenant;
  `tenantId` is **derived from claims server-side, never a form field**
  (`specs/common-api.md` §4.4) — it is shown read-only in Profile but is never
  submitted. Notification preferences and evaluation settings are
  `(tenant)`-scoped; switching tenants in the `Topbar` reloads this screen
  against the new active tenant. No cross-tenant data appears.
- **Evaluation settings are admin-only and tenant-scoped.** The Evaluation
  section/tab and its read (`evaluationSettings.get`) are gated to
  `tenantAdmin`; the save (`v1.autograde.saveEvaluationSettings`) re-asserts
  `tenantAdmin`-or-superAdmin authorization server-side (`status/auth-access.md`
  §1.6). A plain teacher never sees or fetches it.
- **Writes via callables, not direct Firestore.** Every save on this screen goes
  through a callable — the **explicit fix** over today's `SettingsPage.tsx`,
  which writes evaluation settings via a direct client `updateDoc`
  (`status/app-teacher-web.md` §1.6/§4.x, `specs/webapps-design.md` §7 #8 and
  §5.1). The client never imports `firebase/firestore` here. `updatedAt` is set
  server-side; the `save*` upsert convention applies (`specs/common-api.md`
  §3.1).
- **Server-authoritative enforcement.** The client only _sets_ configuration
  values; it never enforces or recomputes them. Confidence thresholds drive the
  server's HITL grading routing (FOUNDATION §2.3: low <0.7 → human review, >0.9
  → auto-accept); quota/budget enforcement (`assertQuota`,
  `dailyCostAggregation` budget thresholds) lives server-side
  (`status/be-analytics.md` schedulers; `specs/common-api.md` §9). The UI
  mirrors the server defaults (0.7 / 0.9 / 80%) but does not implement the
  rules.
- **Results-release & override policy.** "Auto-release results" sets the
  `releaseResultsAutomatically` policy and "Require override reason" sets the
  override-reason requirement consumed by the EXAMS/GradingReview flow — they
  are policy switches here, not grading actions. Releasing/grading happens in
  the EXAMS area.
- **Answer keys never client-side.** This surface configures _how_ grading runs;
  it never reads or displays answer keys, rubrics, or per-question content
  (those are server-protected, `firestore.rules` answer-key deny-all; merged
  only via `items.getForEdit` in authoring).
- **Notification types are a shared enum.** The per-type switches bind to
  `NotificationType` values from `shared-types`; `ai_budget_alert` is
  admin-relevant and only shown to admins. Preferences write `enabledTypes` /
  `muteUntil` only (no claim or role mutation).
- **Profile edits are scoped.** The display-name save touches only the display
  name; it never changes role, claims, `classIds`, or tenant (those are
  admin/identity-callable concerns with claims-sync, `status/auth-access.md`
  §4.5) — so editing settings here can never alter access.
- **Operational, not authoring/grading.** Per the brief, this screen edits
  preferences and tenant grading _defaults_; it does not author content or grade
  submissions.

---

## 9. Accessibility

Conforms to FOUNDATION §2 (contrast) and §4 (reduced-motion), and
`specs/webapps-design.md` §2.4.

- **Landmarks & focus order:** `SkipToContent` first; then `Topbar`, `Sidebar`,
  then `main`. Within `main`: header → `Tabs` (tablist) → active panel's fields
  in DOM order (top to bottom) → the section `Save` button. Tab order matches
  visual order at every breakpoint.
- **Tabs semantics:** the in-page `Tabs` use proper
  `role="tablist"`/`role="tab"`/`role="tabpanel"` with `aria-selected` and
  arrow-key navigation between tabs; the active panel is associated via
  `aria-labelledby`. The role-gated `Evaluation settings` tab is omitted from
  the DOM for non-admins (not merely hidden), so it's never reachable.
- **Forms & errors:** every field has an associated `Label` (`htmlFor`);
  `Switch` rows expose an accessible name from their label + description;
  `FormFieldError` messages are linked via `aria-describedby` and the field gets
  `aria-invalid` on validation failure; the form announces submission state.
  Read-only fields (email, role, tenant) are marked `readonly`/`aria-readonly`
  and explained by their captions.
- **Sliders:** confidence `Slider`s expose `aria-valuemin/max/now` and
  `aria-valuetext` (the mono numeric readout), and are operable by arrow keys;
  the readout is text, not color.
- **Status never by color alone (FOUNDATION §2):** switch state, info/error
  banners, and validation all pair color with text/icon. The "tenant-wide"
  `InlineAlert` carries an info icon + text; error states carry an alert icon +
  text.
- **Keyboard:** every control (inputs, switches, select, sliders, date picker,
  save buttons, retry, confirm dialog) is reachable by Tab/Shift-Tab and
  operable by keyboard, with a visible focus ring (`border.focus`, the
  FOUNDATION focus ring `0 0 0 3px`). `ConfirmDialog` traps focus while open and
  returns focus to the trigger on close; Esc cancels.
- **Contrast:** all text/background pairs use semantic tokens meeting WCAG AA
  (4.5:1 body, 3:1 large/UI), in both light and dark Lyceum themes; `text.muted`
  reserved for non-essential captions that still meet AA at size.
- **Reduced motion:** `prefers-reduced-motion` disables tab/panel crossfades,
  switch-track easing (instant state change), skeleton crossfade, and dialog
  transitions — state changes apply immediately. The theme switch becomes an
  instant swap with no transition.
- **Live regions:** save success/failure toasts and per-section read errors are
  announced politely; a hard save failure's `ErrorState`/toast uses
  `role="alert"`. Theme change announces the new theme to assistive tech.

---

## 10. Web↔mobile divergence (RN parity)

Component names/props match 1:1 between `shared-ui` (web) and `ui-native`
(mobile) per FOUNDATION §6; only the renderer differs. The same headless hooks
(notification-prefs read/save,
`evaluationSettings.get`/`saveEvaluationSettings`, profile/theme) over
`@levelup/api-client` power both. Note: a full evaluation-settings editor is
**teacher/admin-web** scope; the learner RN app's Settings is the student-facing
variant — these RN notes apply to the staff settings surface where a staff RN
client exists.

- **Shell:** web uses `Sidebar` + `Topbar`; RN uses a header + `Tabbar`.
  Settings is reached from a profile/overflow entry on mobile, not a primary
  bottom tab.
- **In-page Tabs → stacked sections + segmented control / accordion:** the left
  tab rail (lg web) becomes a top segmented control or a single scrolling list
  of `Accordion`/`Section` blocks on RN (FOUNDATION §6 "table/rail on web →
  stacked on mobile").
- **No ⌘K on mobile:** `CommandPalette` is web-only (FOUNDATION §6); the
  deep-link to a settings tab is reached via navigation, not the palette.
- **Hover → press:** any web hover affordance maps to press/active on RN; the
  `ThemeToggle`, switches, and buttons become native pressables.
- **Controls:** `DatePicker` uses the native date picker on RN; `Slider` uses
  the native slider; `Select` uses a native picker/sheet. `ConfirmDialog`
  becomes a native action sheet/alert. `Switch` maps to the native switch — same
  prop surface.
- **Theme:** web flips CSS variables at `:root`/`.dark`; RN reads a
  `colorScheme` switch over the same token names (`specs/webapps-design.md`
  §2.1) — the `ThemeToggle` behaves identically.
- **Motion:** web `FadeIn`/`ease.entrance`; RN uses spring/Reanimated
  equivalents for entrance only — still no celebratory burst on this staff
  surface.
- **Same callable contract:** profile, theme, notification-prefs, and
  evaluation-settings writes use the identical callables/registry on both
  platforms; only the transport adapter differs (`specs/common-api.md` §5).

---

## 11. A Claude-design prompt

```text
You are generating the **Teacher Settings** screen for the Auto-LevelUp teacher-web
portal. Conform EXACTLY to the "Lyceum / Modern Scholarly" design system defined in
docs/rebuild-spec/design/00-FOUNDATION.md and to this spec
(docs/rebuild-spec/design/teacher/teacher-settings.md). Do NOT invent colors, fonts,
spacing, radius, elevation, or component variants — compose only from FOUNDATION tokens
and the shared-ui inventory, citing semantic token names (bg.canvas, bg.surface,
bg.surface-sunken, text.primary/secondary/muted, brand.primary, status.success/warning/
error/info, border.subtle/strong/focus). Fonts: Fraunces (display/h1), Schibsted Grotesk
(UI/body/labels), Spline Sans Mono (numeric threshold/budget readouts). Radius lg on
cards, md on inputs/buttons, pill on switches/badges. Elevation e1 at rest, e3 on dialogs.
Do NOT use the `spark` accent anywhere on this screen.

ROUTE: `/settings`  ROLES: teacher (Profile, Appearance, Notifications) | tenantAdmin
(adds Evaluation settings). TONE: precise, credible, calm — a staff preferences console.
NO XP/streak/celebration chrome.

BUILD a reading-width (max-w 720), centered settings page inside AppShell/PlatformLayout
main region (desktop gutter 32, section gap 32) with:
1. Header: Fraunces h1 "Settings" + secondary subline "Your preferences for {tenantName}."
2. In-page Tabs: Profile | Appearance | Notifications | Evaluation settings.
   The Evaluation settings tab renders ONLY for tenantAdmin (omit from DOM otherwise).
   lg: left vertical tab rail (grid-cols-[200px_1fr]); sm/md: horizontal scrollable Tabs.
3. PROFILE & DISPLAY (Section/Card): Avatar, "Display name" Input (editable), read-only
   Email + Role Badge + Tenant (from claims, never editable); "Save profile" button
   (brand.primary), disabled until dirty+valid.
4. APPEARANCE (Section/Card): ThemeToggle (Light/System/Dark) over Lyceum light↔dark
   semantic tokens — applies INSTANTLY, no Save button, no toast.
5. NOTIFICATIONS (Section/Card): per-type Switch rows (At-risk alerts, Grading complete,
   Results released, Announcements, and AI budget alerts [admin-only]) bound to
   NotificationPreferences.enabledTypes, plus an optional "Mute until" DatePicker;
   "Save notifications" button.
6. EVALUATION SETTINGS (tenantAdmin ONLY, Section/Card): an info InlineAlert
   ("Tenant-wide — applies to all teachers and future exams in {tenantName}."), then three
   groups separated by Separator over bg.surface-sunken:
   • Grading policy: Switches "Auto-grade submissions", "Require override reason",
     "Auto-release results"; Select "Default AI strictness" (Lenient/Moderate/Strict).
   • Confidence routing: Sliders+Input "Needs-review threshold" (default 0.70) and
     "Auto-approve threshold" (default 0.90) with mono numeric readouts; Switch
     "Review partial-credit grades". Validate needs-review ≤ auto-approve (FormFieldError).
   • AI usage quota: numeric Inputs "Monthly budget (USD)" (0=unlimited), "Daily call
     limit" (0=unlimited), "Warning threshold (%)" (default 80).
   "Save evaluation settings" button. Turning Auto-release ON or Auto-grade OFF opens a
   ConfirmDialog explaining the tenant-wide effect before staging the change.

DATA: profile/role/tenant from the auth store (tenant read-only, derived from claims);
theme persisted per user (same source as the Topbar ThemeToggle); notification prefs read
via the notifications repo; evaluation settings via evaluationSettings.get (REQUESTED ONLY
for tenantAdmin). WRITES are callables — NEVER direct client Firestore writes: profile
upsert, theme preference, saveNotificationPreferences (NEW), and
v1.autograde.saveEvaluationSettings (NEW — this REPLACES the current direct updateDoc).
tenantId is derived server-side from claims and is never a field. The client only SETS
config; the server enforces confidence routing and quota.

STATES: per-section Skeleton silhouettes on load (Evaluation skeleton only for admins);
PARTIAL readiness (each section is its own RHF form + query); first-run Evaluation
EmptyState ("No evaluation defaults yet" → "Create defaults" pre-filled with schema
defaults 0.7/0.9/80/moderate); per-section ErrorState with Retry distinct from empty;
save success Toast (status.success), save failure Toast (status.error) with field-level
FormFieldError on VALIDATION_ERROR and a clear PERMISSION_DENIED message on the Evaluation
save. For a plain teacher, OMIT the Evaluation tab/section and the AI-budget notification
row entirely (do not render disabled).

FORMS: one react-hook-form per section using zodResolver over the shared callable-schemas;
Save buttons disabled until dirty+valid; on save reset the dirty baseline.

MOTION: FadeIn (ease.entrance, base 220ms) on entrance; tab-panel crossfade over fast
160ms; switch thumb slide over instant/fast; inline button spinner during save (no
full-screen overlay); ConfirmDialog at e3 with ease.entrance/exit. Honor
prefers-reduced-motion (instant state changes, instant theme swap). No celebratory motion.

A11y: SkipToContent; proper tablist/tab/tabpanel semantics with arrow-key nav; every field
labeled with FormFieldError linked via aria-describedby and aria-invalid on error; sliders
expose aria-valuetext (mono readout); status never by color alone (icon+text); visible
FOUNDATION focus ring; ConfirmDialog traps and restores focus; WCAG AA contrast in both
themes; reduced-motion honored.

Deliver clean React + Tailwind composing @levelup/shared-ui components (Tabs, Section,
Card, Separator, Form/FormFieldError, Input, Label, Switch, Select, Slider, DatePicker,
Avatar, Badge, ThemeToggle, InlineAlert/Banner, ConfirmDialog, Button, Skeleton,
EmptyState, ErrorState, Toast). Every write goes through a callable — this screen edits
preferences and tenant grading DEFAULTS; it does not author content or grade submissions.
```
