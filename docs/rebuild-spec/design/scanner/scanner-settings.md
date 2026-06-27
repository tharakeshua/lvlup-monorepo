# Scanner · Settings

Anchors to Lyceum (Modern Scholarly). See `00-FOUNDATION.md` §7 and the Lyceum
token/component reference — tokens are referenced, not duplicated here.

## 1. Purpose & user

A lightweight preferences + account screen for the **scanner** operator
(front-desk / invigilation staff). It lets them confirm _who they are signed in
as_ and which school, tune capture defaults that affect every scan (camera,
alignment guides, image quality), see how much offline work is buffered on the
device, set the app theme, and sign out cleanly at end of shift. It is
intentionally shallow: no exam config, no answer keys, no grading — the scanner
has zero authoring power.

## 2. Entry / route

- Route: `#/settings` — reached via the **gear / settings** IconButton in the
  shell topbar (present on every signed-in screen).
- Reached from: `nav.go('#/settings')` from the topbar gear.
- Exit: `nav.back()` (topbar back) returns to the prior tab; **Sign out**
  confirm → `nav.go('#/login')`.
- Settings sits _outside_ the three primary tabs (Scan / Queue / History); the
  tabbar stays visible but no tab is "active" for this screen.

## 3. Layout sketch (390×844, body only — shell paints topbar + tabbar)

```
┌───────────────────────────────┐
│ Settings                      │  page title (display)
│ ┌ Card · Profile ───────────┐ │
│ │ 👤 Profile                │ │  card-head: icon + title
│ │ ( SD )  Scan Desk         │ │  Avatar(initials) + name
│ │ Signed in as · scan.desk  │ │  DefinitionList
│ │ School · Crestford School │ │
│ │ Role · Scanner            │ │
│ └───────────────────────────┘ │
│ ┌ Card · Capture prefs ─────┐ │
│ │ 📷 Capture preferences    │ │
│ │ Default to rear camera [●]│ │  Switch (on)
│ │ Show alignment guides  [●]│ │  Switch (on)
│ │ Image quality  [Standard▾]│ │  Select
│ │ Compressed to max 1920px… │ │  note
│ └───────────────────────────┘ │
│ ┌ Card · Offline storage ───┐ │
│ │ 💾 Offline storage        │ │
│ │ Queued uploads      3     │ │  Stat row
│ │ On-device storage  4.2 MB │ │  Stat row
│ │ [ Clear completed ]       │ │  Button secondary
│ └───────────────────────────┘ │
│ ┌ Card · Appearance ────────┐ │
│ │ 🎨 Appearance             │ │
│ │ [System][Light][Dark]     │ │  segmented (aria-pressed)
│ └───────────────────────────┘ │
│ ┌ Card · Account ───────────┐ │
│ │ 🔑 Account                │ │
│ │ [ Send password reset ]   │ │  Button secondary
│ │ [ Sign out ]  (danger)    │ │  → confirm Modal
│ └───────────────────────────┘ │
└───────────────────────────────┘
   Sign out → Modal:
   "Sign out of the scanner?"
   footer: [Stay] [Sign out]
```

Body scrolls; no sticky bar.

## 4. Components used

- DS: `Card`, `Avatar{initials}`, `DefinitionList{items}`,
  `Switch{checked,onChange}`, `Select{options}`, `Field{label,hint}`,
  `Stat{label,value}`, `Button{variant,block,leadingIcon}`,
  `Modal{open,onClose,title,footer}`, `Icon`.
- Local: `SettingsView({nav,params,ctx})`; helpers `SettingCard` (card-head +
  body wrapper), `SwitchRow` (label + Switch with linked id), `ThemeToggle`
  (segmented buttons w/ `aria-pressed`), `SignOutModal`.

## 5. States

- **Default / populated** — all five cards visible; switches default rear-camera
  ON, alignment-guides ON; image quality = Standard; theme = System.
- **Switch toggled** — local `useState` flips; `ctx.toast({variant:'success'})`
  confirms "Preference saved".
- **Image quality changed** — Select updates; toast "Saved · High quality" /
  "Saved · Standard".
- **Offline storage** — `Queued uploads` = `ctx.queue.length`; storage figure
  derived/mock. "Clear completed" removes `done` items from the queue (via
  `ctx.setQueue`), toast confirms; disabled when nothing completed.
- **Theme** — segmented control; exactly one segment `aria-pressed=true`; sets
  `data-theme` on document and toasts.
- **Password reset** — Button → toast "Reset link sent" (mock; no field shown —
  scanner identity is known server-side).
- **Sign-out confirm** — danger Button opens Modal (local `useState`); footer
  ghost **Stay** dismisses, danger **Sign out** clears session and
  `nav.go('#/login')`.

## 6. Interactions

- Toggle any Switch → optimistic local update + success toast.
- Change image-quality Select → update + toast; note clarifies on-device
  compression (max 1920px, 85%).
- Tap **Clear completed** → drop `done` queue items, toast count cleared;
  disabled if none.
- Tap a theme segment → set theme, `aria-pressed` moves, toast.
- Tap **Send password reset** → toast (mock send).
- Tap **Sign out** → open confirm Modal → **Sign out** runs
  `ctx.clearSession?.()` then `nav.go('#/login')`; **Stay** / scrim / Esc
  dismiss.
- All controls keyboard-reachable; Switches and segments are real buttons/inputs
  with labels.

## 7. Domain rules surfaced

- **Tenant model**: profile (name, school, code, username) reads from
  `ctx.scanner`, scoped to this scanner's tenant. No tenant switching here; the
  scanner belongs to exactly one school.
- **Answer key never shown**: this screen exposes _zero_ exam/answer-key/grading
  surface. The scanner role has no authoring or key-visibility capability
  anywhere in the app, and Settings deliberately offers none.
- **Capture prefs are device-local**: camera/guides/quality/theme persist on
  this device only (not server policy); they affect capture & upload payload
  (compression) but never grading.
- **Sign-out clears session**: signing out drops the local auth session and any
  in-memory scanner identity, then routes to `#/login`. Queued-but-unsent
  captures remain on device (durable queue) and are not silently uploaded under
  a different session — they require re-auth to resume.

## 8. Accessibility

- Each card-head is an `h2`/labelled heading; cards form a clear landmark order.
- Every Switch has a programmatically linked `<label htmlFor>`; toggle state
  announced by the native checkbox.
- Theme segmented control uses `role`-appropriate `<button>`s with
  `aria-pressed`; the active segment is conveyed by state + visual fill, not
  color alone.
- Role/identity in the DefinitionList is plain text (no color-only meaning).
- Modal: labelled title, focus-trappable, scrim + Esc + Stay all dismiss;
  destructive action is a distinct danger button with explicit label.
- All targets ≥44px; toasts are polite live-region announcements.

## 9. Web ↔ mobile note

Mobile-first PWA screen (390px). On larger viewports the same content renders as
a two-column settings page (left nav: Profile / Capture / Storage / Appearance /
Account; right detail pane) or stacked Sections in a centered 640px column, with
the sign-out confirm becoming a centered Modal. Capture preferences that are
meaningful only on a phone (rear camera, alignment guides) are hidden or
disabled on desktop; theme, profile, storage, and account actions are identical
across form factors. The answer-key-secrecy and single-tenant rules hold on
every form factor.
