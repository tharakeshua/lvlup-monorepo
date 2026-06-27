# Student · Settings

> Per-screen design spec for the Auto-LevelUp **student-web** rebuild. Conforms
> to the **Lyceum** design system (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales.

---

## 1. Purpose & primary user

**Primary user:** the learner — both B2B school students (role `student`,
tenant-scoped) and B2C consumer learners (no membership, served from the
synthetic `platform_public` tenant + `user.consumerProfile`).

**Job-to-be-done:** "Put me in control of _how the app reaches me and how it
looks_ — let me tune which notifications I get and on which channels, switch
between light and dark, and handle the basics of my account (password, sign out,
install the app) — quickly, calmly, and without fear of breaking anything."

This is a **utility surface**, not a learning or gamification surface. Tone is
**clear, calm, in-control** — no celebratory bursts, no streak energy here. The
one warm note is in the copy framing ("You're all set", not "Success").

---

## 2. Entry points & route

**Route:** `/settings` (B2B student shell) and the same component under the
consumer shell (B2C). Reached from the Sidebar nav item "Settings" (gear icon)
and from the profile menu in the Topbar. On mobile it's reached from the Tabbar
overflow / profile sheet, not a primary tab.

**Reads / writes (all via `@levelup/api-client` — UI never touches Firestore
directly):**

| Action                        | API                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load notification preferences | `v1.identity.manageNotifications` (`action: 'list'`) → returns the user's `NotificationPreferences` doc; today backed by `tenants/{tenantId}/notificationPreferences/{userId}` (the repo read the legacy `useNotificationPreferences` hook performed). Wrapped in the headless `useNotificationPreferences` hook over the client. |
| Save notification preferences | `notificationPreferences.save` callable (`v1.identity.manageNotifications` with a save action, server-validated; replaces today's client `setDoc(..., { merge: true })`). Wrapped in `useSaveNotificationPreferences`.                                                                                                            |
| Theme                         | No API. `next-themes` (`useTheme`) — persisted to `localStorage`, defaults to `system`; rendered via the shared `ThemeToggle` from `shared-ui/layout`.                                                                                                                                                                            |
| Account: change password      | Firebase Auth `sendPasswordResetEmail(user.email)` via the auth adapter in `shared-firebase` (surfaced through `useAuth` / the auth store). No tenant data.                                                                                                                                                                       |
| Account: sign out             | Auth store `signOut()` → clears session, redirects to `/login` (B2B) or `/consumer` login (B2C).                                                                                                                                                                                                                                  |
| PWA install                   | `usePWAInstall` (DOM hook in `shared-hooks/web`) — captures `beforeinstallprompt`, exposes `canInstall` + `promptInstall()`. No API.                                                                                                                                                                                              |

`tenantId` is **not** passed in request bodies — the server derives it from
`ctx.activeTenantId` (consumer = `platform_public`). Preferences are
**per-user**: the read/write are keyed to the caller's `uid`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on lg; Topbar + Tabbar on
mobile). The page itself is a single **reading-width column** (max ~720, the
FOUNDATION reading measure) centered in the content region, composed of stacked
**Section** blocks, each wrapping a **Card**.

```
┌─ AppShell ───────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar (tenant/profile · theme · notifications)            │
│         ├──────────────────────────────────────────────────────────── │
│         │  ┌── content column (max ~720, centered) ───────────────┐   │
│         │  │  H1  "Settings"                                       │   │
│         │  │  sub "Tune how Lyceum reaches you and how it looks."  │   │
│         │  │                                                       │   │
│         │  │  ┌ Section: Notifications ─────────────────────────┐ │   │
│         │  │  │ Card                                            │ │   │
│         │  │  │  hdr: 🔔 "Notifications"  [Save changes ▸]      │ │   │
│         │  │  │  ── Channels ────────────────────────────────   │ │   │
│         │  │  │   Email           [Switch]                      │ │   │
│         │  │  │   Push (browser)  [Switch]                      │ │   │
│         │  │  │  ── What to notify me about ──────────────────  │ │   │
│         │  │  │   Exam results        [Switch]                  │ │   │
│         │  │  │   Achievements        [Switch]                  │ │   │
│         │  │  │   Leaderboard         [Switch]                  │ │   │
│         │  │  │   Streak reminders    [Switch]                  │ │   │
│         │  │  └─────────────────────────────────────────────────┘ │   │
│         │  │                                                       │   │
│         │  │  ┌ Section: Appearance ────────────────────────────┐ │   │
│         │  │  │ Card · 🎨 "Appearance"                          │ │   │
│         │  │  │   Theme  [ ThemeToggle: System · Light · Dark ] │ │   │
│         │  │  │   "Follows your device by default."             │ │   │
│         │  │  └─────────────────────────────────────────────────┘ │   │
│         │  │                                                       │   │
│         │  │  ┌ Section: Language (optional / flag-gated) ──────┐ │   │
│         │  │  │ Card · 🌐  Locale [Select ▾]                    │ │   │
│         │  │  └─────────────────────────────────────────────────┘ │   │
│         │  │                                                       │   │
│         │  │  ┌ Section: Install the app (PWA — conditional) ───┐ │   │
│         │  │  │ Card · 📲 "Install Lyceum"  [Install ▸] (spark) │ │   │
│         │  │  └─────────────────────────────────────────────────┘ │   │
│         │  │                                                       │   │
│         │  │  ┌ Section: Account ───────────────────────────────┐ │   │
│         │  │  │ Card                                            │ │   │
│         │  │  │   email (read-only, text.muted)                 │ │   │
│         │  │  │   [Send password reset email] (secondary)       │ │   │
│         │  │  │   ───────────────────────────                   │ │   │
│         │  │  │   [Sign out] (danger, full-width on mobile)     │ │   │
│         │  │  └─────────────────────────────────────────────────┘ │   │
│         │  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**Grid / responsive behavior:**

- **lg (≥1024):** Sidebar visible; content column centered at reading width;
  page gutters 32. Each Card full column width. Row layout for each preference:
  label block left, control right (`justify-between`).
- **md (768–1023):** Sidebar may collapse to icons (shell behavior); content
  column still centered, gutters 24. Layout unchanged.
- **sm (<640):** Sidebar replaced by Tabbar; gutters 16; cards span full width.
  Preference rows keep label-left / control-right but allow the label block to
  wrap to two lines. The danger **Sign out** Button goes full-width. The save
  affordance is a **sticky bottom bar** (see §6) rather than a header button, so
  it stays reachable with a thumb.

Spacing: `gap` 6 (24px) between Sections, `gap` 4 (16px) between Card
sub-groups, `gap` 3 (12px) between preference rows. Cards use radius.lg + e1 at
rest; section sub-headers use `text.secondary`.

---

## 4. Components used (FOUNDATION §5 only)

- **Layout / nav:** `AppShell`, `Sidebar`, `Topbar`, `Tabbar` (mobile),
  `ThemeToggle` (shared, from `shared-ui/layout`), `PWAInstallBanner` semantics
  (reused as the install Card affordance), `SkipToContent`, `RouteAnnouncer`.
- **Containers:** `Section`, `Card`, `Separator` (the divider before Sign out).
- **Primitives:** `Switch` (every notification preference), `Select` (locale, if
  enabled), `Button` — `secondary` (Send password reset), `spark` (Install — the
  single CTA accent), `danger` (Sign out); `IconButton` not needed here.
- **Data / feedback:** `Skeleton` (loading), `EmptyState` is **not** used
  (settings always has a form), `ErrorState` / `InlineAlert` (load-error
  banner), `ConfirmDialog` (Sign out confirmation), `Toast` (sonner — save
  success/failure, reset-email sent), `DefinitionList` pattern for the read-only
  account email.

**No domain/gamification components appear here** — Settings is deliberately
outside the XP/streak/mastery surfaces. `XPMeter`, `StreakFlame`, `LevelBadge`,
`Achievement`, `CelebrationBurst`, `TimerBar`, `AnswerKeyLock`, etc. are
**intentionally absent**. (See §8.)

**Proposed FOUNDATION additions:** none required. Everything composes from
existing primitives/containers. One note for the component team: the FOUNDATION
§5 `ThemeToggle` should expose a **three-state** affordance (System · Light ·
Dark) so "follow my device" is selectable — if it is currently light/dark-only,
promote the tri-state into the shared `ThemeToggle` spec rather than building a
one-off here.

---

## 5. States

| State                            | Treatment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**                      | Header renders immediately (static copy). Notification Card body shows the `SettingsPrefsSkeleton` — four rows of two stacked `Skeleton` bars (label + description) + a pill-shaped `Skeleton` standing in for each Switch, wrapped in `role="status"` + visually-hidden "Loading your preferences…". Appearance / Account Cards render normally (no async data).                                                                                                                                                                                                                                                                               |
| **Empty**                        | Not a real state — when no preferences doc exists, the API returns `DEFAULT_PREFS` (all on). The form simply renders all switches on; no empty illustration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Error (load)**                 | If `manageNotifications:list` fails, the Notification Card body shows an `InlineAlert` (status.warning, not error — it's recoverable): "We couldn't load your notification settings. Your other settings still work." with a "Try again" ghost Button that refetches. Appearance/Account remain fully usable.                                                                                                                                                                                                                                                                                                                                   |
| **Error (save)**                 | Toast (status.error) "We couldn't save that — give it another go." The local edits and `isDirty` flag are **retained** so the user can retry without re-toggling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Partial**                      | Theme + account actions work even while preferences are still loading or errored — the three Cards are independent; one failing never blocks the others.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Success (save)**               | Toast (status.success) "You're all set — preferences saved." `isDirty` clears; the Save affordance retreats.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Dirty (unsaved)**              | When any Switch changes, `isDirty = true` reveals the Save affordance (header Button on desktop, sticky bar on mobile).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Permission / role variations** | **B2B student vs B2C consumer:** identical layout. The consumer build reads/writes against `platform_public` (server-derived). The **"Leaderboard updates"** and (school-issued) channels may be hidden for B2C if leaderboard isn't a consumer feature — gate that single row on a feature flag, not on path. **Email** preference row is shown for both; **Push** depends on browser notification permission (see §6). The **Install** Card is conditional on `usePWAInstall().canInstall` (hidden once installed or unsupported). The **Language** Section is rendered only if locale support is enabled (flag); otherwise omitted entirely. |

---

## 6. Interactions & motion

- **Toggle a preference (optimistic):** flipping a `Switch` updates local state
  instantly; the thumb slides with `motion.fast` / `ease.standard`. `isDirty`
  flips on. We **do not** auto-save per toggle (avoids a burst of writes and
  surprise) — changes are explicitly committed via Save. The Switch track
  animates color (off `border.strong` → on `brand.primary`) over `motion.fast`.
- **Save:** on Save, the Button enters a loading state (spinner, label
  "Saving…"), `motion.base`. On success, Toast slides in (`ease.entrance`), Save
  affordance fades out (`motion.base`), `isDirty` clears. On failure, edits
  persist, error Toast shown. No celebratory burst — this is a calm utility
  confirmation, not a gamification moment.
- **Theme switch:** `ThemeToggle` flips the `:root` / `.dark` token set. The
  cross-fade between themes is `motion.base`; respect `prefers-reduced-motion`
  (instant swap, no fade). System option re-binds to
  `matchMedia('(prefers-color-scheme)')`.
- **Push permission coupling:** toggling **Push** on, when browser notification
  permission is `default`, triggers the native permission prompt; if the user
  denies, the Switch reverts to off and an `InlineAlert` explains "Your browser
  is blocking notifications — enable them in browser settings to turn this on."
  (Never silently leave the toggle on while blocked.)
- **Send password reset:** secondary Button → on click, fires
  `sendPasswordResetEmail`, disables briefly, Toast "Check your inbox — we sent
  a reset link to {email}." No modal needed (it's non-destructive).
- **Sign out (confirmation):** danger Button opens a `ConfirmDialog` (e3
  elevation, `ease.entrance`): "Sign out of Lyceum? You can always come right
  back." Cancel / **Sign out** (danger). Confirm → auth store `signOut()` →
  redirect. This is the only confirm-gated action.
- **Install the app:** spark Button → calls `promptInstall()` (native PWA
  prompt). On accept, the Card collapses (`motion.base`) and a Toast confirms
  "Lyceum installed — find it on your home screen." This Button is the **one**
  place spark/CTA energy is allowed on this screen (a single primary action),
  and even it stays restrained (no glow/burst — Settings is not a gamification
  surface).
- **Sticky save bar (mobile):** when dirty, a bottom bar slides up
  (`ease.entrance`, `motion.base`) with "Save changes" — slides out on
  save/discard. Honors safe-area inset.

All motion subtle; **no `CelebrationBurst` anywhere on this screen.**

---

## 7. Content & copy

**Page header**

- H1 (Fraunces): **"Settings"**
- Sub (Schibsted, text.secondary): **"Tune how Lyceum reaches you, and how it
  looks."**

**Notifications Card**

- Title: **"Notifications"** · Description: **"Choose how and when we reach you.
  You're in control — change these anytime."**
- Sub-header: **"Channels"** — Email → "Get updates in your inbox." · Push
  (browser) → "Get a nudge right in your browser."
- Sub-header: **"What to notify me about"** —
  - Exam results → "When your results are ready to view."
  - Achievements → "When you unlock a new badge — worth celebrating."
  - Leaderboard → "When your rank moves."
  - Streak reminders → "A friendly daily nudge to keep your streak alive."
- Save Button: **"Save changes"** → saving: **"Saving…"**
- Save success Toast: **"You're all set — preferences saved."**
- Save error Toast: **"We couldn't save that — give it another go."**
- Load error InlineAlert: **"We couldn't load your notification settings.
  Everything else still works — try again?"**

**Appearance Card**

- Title: **"Appearance"** · Description: **"Make Lyceum easy on your eyes."**
- Theme label: **"Theme"** · helper: **"Follows your device by default."**
  Options: **System · Light · Dark.**

**Language Card (if enabled)**

- Title: **"Language"** · Select placeholder: **"Choose your language"**.

**Install Card (if `canInstall`)**

- Title: **"Install Lyceum"** · body: **"Add Lyceum to your home screen for
  one-tap access — works offline, too."** · Button: **"Install"**. Success
  Toast: **"Lyceum installed — find it on your home screen."**

**Account Card**

- Email row: label **"Signed in as"** + the email (text.muted, read-only).
- **"Send password reset email"** (secondary) → Toast: **"Check your inbox — we
  sent a reset link to {email}."**
- **"Sign out"** (danger). Confirm dialog title **"Sign out of Lyceum?"** · body
  **"You can always come right back."** · confirm **"Sign out"** · cancel
  **"Stay signed in."**

Tone throughout: warm, plainspoken, reassuring; never "Wrong"/"Error"/"Failed"
as a bare word — always paired with a gentle next step.

---

## 8. Domain rules surfaced

- **Preferences are per-user and per-tenant-context.** Read/write keyed to the
  caller's `uid`; `tenantId`/`platform_public` derived server-side from
  `ctx.activeTenantId` — never sent in the body, never user-editable. One user's
  settings never leak across tenants (tenant isolation).
- **All data flows through `@levelup/api-client`.** No `firebase/firestore`
  `getDoc`/`setDoc` in the UI (the current `useNotificationPreferences` /
  `useSaveNotificationPreferences` inline path strings are replaced by the
  headless hooks over the client; responses Zod-validated, timestamps normalized
  at the repo edge).
- **Theme respects system + reduced-motion.** Default theme is `system` (follows
  OS `prefers-color-scheme`); the theme cross-fade and all toggle motion respect
  `prefers-reduced-motion`.
- **No gamification celebration here.** Per the global rule, the one celebratory
  `CelebrationBurst` (spring pop + marigold spark) is reserved for
  XP/streak/level-up/achievement/100% — **Settings is explicitly excluded.**
  Saving preferences gets a quiet Toast, not a burst. The spark accent appears
  only on the single Install CTA, and without glow.
- **Answer-key / timer / confidence rules are not in scope** on this screen (no
  assessment surfaces), so `AnswerKeyLock`/`TimerBar` do not appear — noted so
  reviewers confirm their absence is intentional, not an omission.
- **Sign out is the only irreversible-feeling action** and is confirm-gated;
  password reset is non-destructive (email link) and is not gated.

---

## 9. Accessibility

- **Switches labeled:** every `Switch` has an accessible name tying it to its
  visible label (label text is the control's `aria-label` / wrapped in a
  `<label>` association), plus the description as `aria-describedby`. State
  announced as on/off (not by color alone — the track color is paired with the
  rendered label + the Switch's native checked semantics).
- **Focus order:** top-to-bottom, Section by Section — header → notification
  switches (Email, Push, then the four types in visual order) → Save → theme
  toggle → locale → install → password reset → sign out. Save Button (or sticky
  bar) is reachable in the natural tab order, not orphaned.
- **Keyboard:** all controls operable without a mouse. `Switch` toggles on
  `Space`/`Enter`. `Select` follows Radix combobox keyboard semantics
  (arrow/typeahead/Esc). `ConfirmDialog` traps focus, `Esc` cancels, focus
  returns to the Sign-out trigger on close. The sticky mobile save bar is in the
  DOM order after the form so Tab reaches it.
- **ARIA / roles:** loading skeleton wrapped in `role="status"` +
  `aria-live="polite"` + visually-hidden text. Toasts announce via the Toast
  region's `aria-live`. `RouteAnnouncer` announces the page title on navigation.
  Icon-only affordances get `aria-hidden` on the icon + a text label on the
  control.
- **Contrast:** all text/background pairs meet WCAG AA in both themes (body
  4.5:1, large/UI 3:1). The danger Sign-out Button and status Toasts pair color
  with an icon + label — never status-by-color-alone.
- **Reduced motion:** `prefers-reduced-motion` removes the Switch slide, theme
  cross-fade, sticky-bar slide, dialog entrance — replaced by instant state
  changes. Honored globally via the shared reduced-motion hook.
- **Touch targets:** every Switch, Button, and Select control ≥44px on mobile.

---

## 10. Web ↔ mobile divergence (per FOUNDATION §6)

- **Save affordance:** desktop = a Save Button in the Notifications Card header
  (appears when dirty); mobile = a **sticky bottom save bar** (thumb-reachable,
  safe-area aware). Same hook, two presentations.
- **Sidebar → Tabbar:** Settings is a Sidebar item on web; on mobile it lives in
  the profile sheet / Tabbar overflow, not a primary bottom tab.
- **Hover → press:** Cards/rows have no hover affordance on mobile; press
  feedback (subtle scale/opacity at `motion.fast`) replaces hover elevation.
- **CommandPalette (⌘K):** present on web (Settings reachable via the palette);
  **absent on mobile**.
- **Theme:** web `ThemeToggle` writes `:root`/`.dark` via `next-themes`; RN
  reads the same token names through a `colorScheme` switch (System/Light/Dark
  map 1:1). Component name + props match across `shared-ui` and `ui-native`.
- **Push notifications:** web = browser `Notification` permission via
  `beforeinstallprompt` / Notification API; RN = OS push permission + token
  registration — the **same logical "Push" Switch**, different underlying
  permission flow behind one prop.
- **Install Card:** web-only (PWA `beforeinstallprompt`). On the RN app the
  Install Section is omitted (the app is already installed); the rest of the
  screen is identical.
- **Password reset / Sign out:** identical logic both platforms; `ConfirmDialog`
  renders as a centered modal on web and a bottom sheet on mobile (FOUNDATION
  container parity).

---

## 11. Claude-design prompt (ready to paste)

```
Design the STUDENT Settings screen for Auto-LevelUp's "Lyceum" design system
(Direction A — "Modern Scholarly"). Conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md
— use only its semantic color tokens (bg.canvas, bg.surface, text.primary, text.secondary,
text.muted, border.subtle, border.strong, brand.primary, spark, status.success, status.warning,
status.error), typography (Fraunces display for H1, Schibsted Grotesk for UI/body, Spline Sans
Mono for any IDs), spacing/radius (radius.lg cards, radius.md controls), elevation (e1 cards, e3
dialog), and motion tokens (motion.fast/base, ease.standard/entrance). Cite tokens, never invent.

Build a single centered reading-width column (~720px) inside AppShell (Sidebar + Topbar on
desktop, Tabbar on mobile), composed of stacked Section→Card blocks:

1. Header: H1 "Settings" + subtext "Tune how Lyceum reaches you, and how it looks."
2. Notifications Card (bell icon): a "Channels" group (Email, Push) and a "What to notify me
   about" group (Exam results, Achievements, Leaderboard, Streak reminders), each a label+
   description on the left and a Switch on the right (justify-between rows). A "Save changes"
   Button appears in the card header ONLY when a switch has changed (dirty); on mobile this
   becomes a sticky bottom save bar.
3. Appearance Card (palette icon): Theme row with a 3-state ThemeToggle (System · Light · Dark)
   and helper "Follows your device by default."
4. Install Card (conditional, spark-accent "Install" Button) — the ONLY accent CTA; no glow.
5. Account Card: read-only "Signed in as {email}", a secondary "Send password reset email"
   Button, a Separator, then a DANGER "Sign out" Button (full-width on mobile) that opens a
   ConfirmDialog ("Sign out of Lyceum? You can always come right back.").

States: skeleton for the notification rows while loading; an InlineAlert (warning, not error) if
preferences fail to load while the other cards stay usable; success/error Toasts on save; edits
are retained on save failure. Tone is calm, warm, in-control — never punitive.

Rules: this is a UTILITY surface — NO CelebrationBurst, NO XP/streak/gamification components
anywhere. Switches toggle optimistically but commit only on Save. Theme respects system +
prefers-reduced-motion. Every Switch is labeled and keyboard-operable; focus order is top-to-
bottom; the ConfirmDialog traps focus. Meet WCAG AA contrast in light AND dark; never encode
state by color alone (pair with icon + label). Provide responsive behavior at sm 640 / md 768 /
lg 1024 and note the web↔mobile divergence (save Button → sticky bar; ThemeToggle parity;
install Card web-only; ConfirmDialog → bottom sheet on mobile).
```
