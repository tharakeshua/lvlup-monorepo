# Parent Settings

**Route:** `#/settings` · **View:** `SettingsView` · **Shell:** Parent shell,
active nav = `settings` **Persona:** Anita Sharma (parent), Beacon Hill Academy
(`BHA-204`).

## 1. Purpose

Lets a parent manage their own account scope: review read-only profile/identity,
tune which notifications they receive, pick an appearance theme, see which
children are linked to them, and sign out. Parents have **no** authoring power —
identity (name, email, role, school) is derived from auth claims and shown
read-only. Only notification preferences and theme are editable.

## 2. Layout wireframe

```
Settings                                         (page header + sub)
┌─────────────────────────────────────────────────────────────┐
│ Profile (Panel)                                              │
│   Avatar AS · DefinitionList: Name / Email / Role / School   │  read-only
├─────────────────────────────────────────────────────────────┤
│ Notification preferences (Panel)                             │
│   Switch · Exam results released                             │
│   Switch · At-risk alerts                                    │
│   Switch · Weekly digest                                     │
│   Switch · Announcements                                     │
│   [Save preferences] (disabled until dirty)  → success Toast │
├─────────────────────────────────────────────────────────────┤
│ Appearance (Panel)   Theme: ( Light | Dark | System ) Select │
├─────────────────────────────────────────────────────────────┤
│ Linked children (Panel)                                      │
│   Aarav Sharma · Grade 9      Diya Sharma · Grade 7          │
├─────────────────────────────────────────────────────────────┤
│ Account (Panel)            [ Log out ] (danger) → #/login    │
└─────────────────────────────────────────────────────────────┘
```

## 3. Components

- `Panel` ×5 (Profile, Notification preferences, Appearance, Linked children,
  Account).
- `DefinitionList` — Name, Email, Role, School (read-only identity).
- `Avatar` — parent (AS) and per-child initials.
- `Switch` ×4 — notification toggles, each paired with a label + helper text +
  `Icon`.
- `Select` — theme (Light / Dark / System).
- `Button` — primary `Save preferences` (dirty-gated); danger `Log out`.
- `Toast` / `Alert` — success confirmation after save; states-rail error
  example.
- `Icon`, `Badge` (at-risk watch chip on Diya), `AtRiskBadge`.

## 4. States

- **Default / pristine:** all switches reflect saved server values; Save button
  **disabled**.
- **Dirty:** any switch toggled flips `dirty=true`; Save enabled.
- **Saved:** on Save, persist, reset `dirty=false`, surface a success `Toast`
  ("Preferences saved").
- **Theme:** applies instantly (no save), independent of notification dirty
  state.
- **Error (states rail):** save failed → `Alert variant="error"` with Retry.
- **Loading (states rail):** per-row `Skeleton`.

## 5. Flows

- Toggle any notification Switch → Save enables → click Save → Toast success →
  Save disables.
- Theme Select → applies immediately.
- Linked-children rows are informational (links to `#/children`).
- `Log out` (danger) → `go('#/login')`.

## 6. Domain rules

- Identity (name/email/role/school) is **read-only**, derived from claims —
  never editable here.
- Parents see only their own linked children; released-only data, no answer keys
  anywhere.
- Notification prefs are per-parent. At-risk watch surfaced on Diya for context
  only.
- No tenant/admin controls — parent scope is strictly self + linked children.

## 7. Accessibility

- One `<h1>` ("Settings"); each Panel titled, forming a logical heading order.
- Switches use `aria-labelledby` + `aria-describedby` tying label and helper
  text.
- Save button `disabled` communicates pristine state; Toast uses polite live
  region.
- Theme group is a labelled control; danger Log out has clear accessible name.
- All status colors paired with icon + text label (no color-only meaning).
  Focus-visible rings via tokens; `prefers-reduced-motion` respected.
