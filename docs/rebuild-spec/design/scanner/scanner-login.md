# Scanner — Login

Anchored to `design/00-FOUNDATION.md` (Lyceum "Modern Scholarly"). Do not
re-paste tokens; cite them.

## 1. Purpose & primary user

Role: **Scanner operator** (front-desk / exam-room staff with membership role
`scanner`). Job-to-be-done: authenticate fast on a shared or personal phone so
they can start capturing answer sheets. This is the app's only public, pre-auth
screen — it must be unambiguous, forgiving of typos, and reassuring about scope
("scanner access only").

## 2. Entry points & route

- Route `#/login` — **public, no app shell** (no topbar, no tabbar).
- Entry: cold app open with no valid session; or after sign-out / session expiry
  redirect.
- Reads/writes (live contract, see `specs/common-api.md`):
  - Auth = **tenant CODE + username + password**. Server resolves membership →
    must be role `scanner`, status `active`.
  - Gated server-side on `tenant.features.scannerAppEnabled`; region
    `asia-south1`.
  - On success the client holds `ctx.scanner {name, initials, school, code}` and
    routes to `#/scan`.

## 3. Layout (wireframe-as-text)

Single column, 390px, vertically centered-ish with generous top padding. No
responsive breakpoints (mobile-only PWA).

```
┌ 390 ─────────────────────────────┐
│  [hero]                          │
│   ◆ AutoGrade brand mark         │
│   AutoGrade Scanner   (Fraunces) │
│   Capture answer sheets —        │
│   grade in minutes.              │
│                                  │
│  [form card]                     │
│   Field: School code  (mono)     │
│   Field: Username                │
│   Field: Password [👁 show/hide] │
│   (Alert — only on error)        │
│   [ Sign in ]      (block, spark)│
│                                  │
│  Scanner access only · ask your  │
│  admin to enable.                │
└──────────────────────────────────┘
```

## 4. Components used (§5 + KIT domain)

`Field`, `Input` (school code uses `--font-mono`), `IconButton` (password
show/hide), `Button` (variant `spark`, `block`, `loading`), `Alert` (variant
`error`), `Icon` (lucide). Brand mark = local layout square with `scan-line`
glyph. No DataTable / nav components (pre-auth).

## 5. States

- **Default**: empty form, primary CTA enabled.
- **Validating (client)**: empty submit → per-`Field` `error` text under each
  blank field ("Required").
- **Submitting**: `Button loading`, inputs disabled, no Alert.
- **Error — not found**: code `BAD` →
  `Alert variant="error" title="School code not found"` + school-code `Field`
  error. (server: `not-found`)
- **Error — invalid credentials**: wrong user/pass →
  `Alert variant="error" title="Invalid credentials"`. (server:
  `unauthenticated`)
- **Error — feature disabled**: tenant `scannerAppEnabled=false` →
  `Alert title="Scanner app is disabled for this school"` (copy surfaced, role
  guidance in footer).
- **Success**: `ctx.toast({variant:'success'})` then `nav.go('#/scan')`.
- No empty/partial list states (form screen).

## 6. Interactions & motion

- Show/hide password toggles `type` via `IconButton` (icon `eye` / `eye-off`),
  label updates for SR.
- Submit on button click or `Enter` in any field (form `onSubmit`).
- Clearing a field clears its inline error on next keystroke; Alert clears on
  resubmit.
- Loading uses Button's built-in spinner (`--dur-base`, `--ease-standard`);
  respects reduced-motion via DS.
- Mock rule: any code accepted except `BAD` → not-found; blank username/password
  → invalid credentials.

## 7. Content & copy

- Wordmark: **AutoGrade Scanner**. Purpose line: "Capture answer sheets — grade
  in minutes."
- Labels: "School code" (placeholder `CRST`, hint "Ask your admin"), "Username",
  "Password".
- CTA: "Sign in". Footer: "Scanner access only · ask your admin to enable."
- Errors precise, non-blaming: "School code not found", "Invalid credentials".

## 8. Domain rules surfaced

- **Tenant model**: login is by tenant CODE (not email domain); scanners are
  scoped to one tenant — code is first-class and shown in mono.
- **Role/feature gating**: only `scanner` role on a tenant with
  `scannerAppEnabled` may proceed; footer sets expectation.
- **Answer-key never exposed**: irrelevant pre-auth but reinforced by scope
  copy.
- **Server-authoritative submit** (downstream): nothing here writes domain docs;
  auth only.

## 9. Accessibility

- Focus order: school code → username → password → show/hide → Sign in. Logical
  and DOM-ordered.
- Each `Field` `label` is associated; errors via `field__error` with
  `alert-circle` icon (icon + text, never color-alone).
- Show/hide is a real `<button>` with dynamic `aria-label`. Touch targets ≥44px
  (IconButton + block CTA).
- Alert pairs icon + title text; `--status-error` never sole signal. Contrast
  per Lyceum semantic tokens.
- Reduced-motion honored by DS spinner.

## 10. Web↔mobile divergence

Mobile-only PWA; rendered at 390px inside the scanner shell. No desktop variant.
The card demos it in the phone frame **without** a Tabbar (login is outside the
tab shell).

## 11. Claude-design prompt

> Build the **AutoGrade Scanner login** screen (Lyceum / Modern Scholarly, see
> 00-FOUNDATION). Mobile 390px, public, no app shell. Hero with brand-mark
> square + "AutoGrade Scanner" wordmark in Fraunces + one-line purpose.
> React-hook form (useState) with three `Field`s — School code (mono `Input`,
> placeholder CRST), Username, Password with `IconButton` show/hide. Block
> `spark` `Button` "Sign in" with loading state. Inline `Field` errors for
> blanks; `Alert variant="error"` for "School code not found" (code BAD) and
> "Invalid credentials". On success call ctx.toast and nav.go('#/scan'). Footer:
> "Scanner access only · ask your admin to enable." Tokens only, no hex; status
> = icon + label; targets ≥44px.
