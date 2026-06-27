# Parent Login

## Purpose & user

Pre-auth entry for a **parent/guardian** (Anita Sharma) connecting to their
child's school (Beacon Hill Academy). Establishes the school context first, then
authenticates the individual. Warm, scholarly, low-friction — a parent is not a
power user.

## Entry / route

- Route: `#/login` (bare, no ParentShell).
- Unauthenticated default landing. On success → `#/` (parent dashboard).

## Layout (text wireframe)

```
                 ┌──────────────────────────────────┐
                 │            [crest mark]           │
                 │        Beacon Hill Academy        │   ← brand lockup
                 │         Parent Portal             │
                 │                                   │
                 │   ● School ──── ○ Sign in         │   ← stepper hint
                 │                                   │
   STEP 1        │   School code                     │
                 │   [ BHA-204                ]       │   ← Field + Input
                 │   ( hint: from your welcome email)│
                 │   [      Continue      →   ]       │   ← primary Button
                 │                                   │
   STEP 2        │   Beacon Hill Academy · BHA-204   │   ← confirmed context chip + Change
                 │   Email   [ anita.sharma@…    ]    │
                 │   Password[ ••••••••          ]    │
                 │   [ invalid → inline error row ]   │
                 │   [        Sign in         ]       │   ← primary Button (loading variant)
                 │   Forgot password?                │   ← ghost link
                 └──────────────────────────────────┘
                  Released grades only · Answer keys never shown
```

Single centered `Card` on `--bg-canvas`, max ~440px, `--shadow-e2`.

## Components used (CORE-API)

`Card`, `Field`, `Input`, `Button`, `Icon`, `Badge`/`Chip` (school-context
pill), `Alert` (inline error pattern via Field error). Stepper rendered as local
CSS dots.

## States

- **idle / step 1**: school-code field focused, Continue enabled.
- **invalid-code**: inline `Field` error ("We couldn't find that school code")
  under Input, error-subtle row + icon+label.
- **loading**: Continue / Sign in render `loading` Button (spinner, disabled,
  label retained).
- **step 2**: code locked into a context chip with a Change ghost action;
  email + password fields.
- **success**: navigate to `#/`.
- **empty**: n/a (form screen).

## Interactions & flows

- `useState('step')` toggles `'code' | 'creds'`.
- Continue → validate code → step 2 (demo: accepts BHA-204; shows error example
  otherwise).
- Change → back to step 1, preserves entered code.
- Sign in → `go('#/')`.
- Forgot password? → ghost link (route placeholder).
- Enter submits the active step.

## Domain rules

- Released-only and answer-key-hidden are surfaced as a reassurance footnote; no
  scores rendered pre-auth.
- School code + identity are **server-derived/verified**; client never asserts
  tenant. No child data shown before auth.

## A11y

- Each Field has a `<label>`; errors use `aria-describedby` + icon+label (never
  color alone).
- Stepper conveys current step via text, not color only.
- Single `<h1>` (school name); logical tab order code → Continue, email →
  password → Sign in.
- Buttons keep visible focus ring (`--ring-focus`); `loading` sets `aria-busy`.
- Honors `prefers-reduced-motion`.
