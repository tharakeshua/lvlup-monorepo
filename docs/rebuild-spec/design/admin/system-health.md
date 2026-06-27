# System Health — Screen Spec (Super-Admin)

> **Design system:** Lyceum. This spec conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All colors, type, spacing, radii,
> elevation, motion, and components are cited by their Lyceum semantic token /
> §5 component name — never re-pasted hex. This is **admin tooling**: the
> serious, precision-instrument register (restraint in chrome, no student-side
> playfulness, no marigold `spark` celebration — that token is reserved for
> student gamification only). Proposed foundation additions are flagged inline
> as **[PROPOSED FOUNDATION ADDITION]**.

---

## 1. Purpose & primary user

**Primary user:** Platform **super-admin** (`isSuperAdmin === true` on
`/users/{uid}` **and** verified ID-token claim — see auth-access §1.5). This is
the cross-tenant control plane; the user operates platform-wide, not scoped to
one tenant.

**Job-to-be-done:** _"At a glance, tell me whether the platform's core
infrastructure is healthy right now, show me how reliable it's been over the
last 30 days, and flag how many errors occurred in the last 24h — so I can
decide whether to act, escalate, or stand down."_

The screen answers four questions:

1. Is the platform up right now? (overall status banner)
2. Which dependency is degraded/down? (per-service probe cards: Firebase Auth,
   Firestore, Cloud Functions, AI Grading Pipeline)
3. How reliable have we been? (30-day uptime strip)
4. How noisy is the system? (platform metrics: avg latency, total users, errors
   in 24h)

**Rebuild posture (from status `app-super-admin.md` §4.9, §5.6):** today the
page runs **live probes from the browser** and even uses `saveTenant({data:{}})`
as a Functions ping, writing a snapshot on every manual refresh. The rebuild
moves probing **server-side / scheduled** (`v1.platform.runHealthCheck`
scheduled job materializes `platformHealthSnapshots/{date}`); this screen
becomes **read-only** — it reads the latest snapshot + 30-day history + 24h
error count and never writes. This is a **server-authoritative** screen.

---

## 2. Entry points & route

- **Route:** `/system` (super-admin app), lazy-loaded, wrapped by `RequireAuth`
  → `AppShell` (`app-super-admin.md` §1.2).
- **Sidebar entry:** under the **System** nav group (alongside Settings,
  Announcements), label "System Health", `Activity` (lucide) leading icon,
  route-prefetch on hover.
- **Breadcrumb:** `Platform / System Health`.
- **Deep-link / command palette:** ⌘K → "System Health" (web only).

**Common-API reads (per `specs/common-api.md`):**

| Data                                                                        | Callable                                                                                   | Notes                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest probe results + 30-day snapshots + 24h error count + 24h total calls | `v1.analytics.getSummary` with `{ scope: 'health' }` → `HealthHistoryResponse`             | super-admin-only (be-analytics §16; common-api §3.3). Returns `{ snapshots: HealthSnapshot[], errorCount24h, totalFunctionCalls24h }`. Health scope reads `platformHealthSnapshots`, counts `gradingDeadLetter` + `llmCallLogs(status==error)` in last 24h. |
| Manual "re-probe now" (super-admin trigger)                                 | **[PROPOSED]** `v1.platform.runHealthCheck` → returns the freshly written `HealthSnapshot` | Replaces the client-side `runHealthChecks()` + `writeHealthSnapshot()` and the `saveTenant({data:{}})` Functions ping (`app-super-admin.md` §5.6). Server runs the probes, writes `platformHealthSnapshots/{date}`, returns the snapshot.                   |
| Scheduled probe (no UI)                                                     | **[PROPOSED]** scheduled function `platformHealthCheck`                                    | Writes a daily/periodic snapshot so the strip fills without any browser involvement.                                                                                                                                                                        |

**No writes from the browser.** Tenant/cost data is **derived server-side**;
this screen does not fan out `getDocs(collection("tenants"))` (kills the
direct-read coupling flagged in `app-super-admin.md` §4.1, common-api §2).

**Wire types** (carried forward to `api-contract` via `z.infer`):
`HealthSnapshot`, `DayHealthStatus = 'healthy' | 'degraded' | 'down'`,
`HealthHistoryResponse` (`packages/shared-types/src/analytics/health.ts`).
Per-service probe status uses the live
`ServiceStatus = 'operational' | 'degraded' | 'down'` triad.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven nav), top **Topbar** (tenant switcher is **disabled/"Platform"
pill** here — super-admin is cross-tenant, not scoped to one tenant; search,
notifications, profile). Page content sits in the AppShell main region, max
content width 1200, desktop gutter 32. Vertical rhythm between regions = spacing
`6` (24px).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [Platform ▾(locked)]      [⌘K search]  [🔔]  [avatar]  │
│ (System │────────────────────────────────────────────────────────────────│
│  active)│  Breadcrumb: Platform / System Health                           │
│         │                                                                  │
│         │  ┌─ PAGE HEADER ──────────────────────────────────────────────┐ │
│         │  │ H1 "System Health"            [↻ Re-probe now]  (Button     │ │
│         │  │ sub: "Live platform service & infrastructure status"  ghost)│ │
│         │  │ caption: "Last checked 14:32 · auto every 5 min" (mono)     │ │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         │  ┌─ OVERALL STATUS BANNER (InlineAlert/Banner, status-toned) ──┐ │
│         │  │ ◉ [icon] All Systems Operational      checked 14:32 (mono)  │ │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         │  ┌─ SERVICE PROBES — grid ────────────────────────────────────┐ │
│         │  │ lg/md: 2 cols · sm: 1 col (stacked)                         │ │
│         │  │ ┌───────────────┐  ┌───────────────┐                        │ │
│         │  │ │[icon] Firebase │  │[icon] Firestore│  StatusIndicator     │ │
│         │  │ │ Auth          │  │ Primary DB     │  (dot+icon+label)     │ │
│         │  │ │  ◉ Operational│  │  ◉ Operational │  + latency (mono ms)  │ │
│         │  │ └───────────────┘  └───────────────┘  + detail (if not OK)  │ │
│         │  │ ┌───────────────┐  ┌───────────────┐                        │ │
│         │  │ │ Cloud Functions│  │ AI Grading     │                       │ │
│         │  │ │  ◉ Operational│  │ Pipeline ⚠ Deg │                       │ │
│         │  │ └───────────────┘  └───────────────┘                        │ │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         │  ┌─ 30-DAY UPTIME (Card) ─────────────────────────────────────┐ │
│         │  │ CardTitle "30-Day Uptime History"                          │ │
│         │  │ ▮▮▮▮▮▮▯▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮  (30 day bars, Tooltip each)│ │
│         │  │ Legend: ◉Healthy ⚠Degraded ✕Down ▢No data   uptime: 99.2%  │ │
│         │  └────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         │  ┌─ PLATFORM METRICS (Card) ──────────────────────────────────┐ │
│         │  │ lg/md: 3 Stat cols · sm: 1 col                              │ │
│         │  │ [Avg Response]   [Total Users]   [Errors 24h]               │ │
│         │  │  142ms (mono)     12,480 (mono)   3 (mono, error-toned)     │ │
│         │  │  Firestore read   across 24 active  in last 24h            │ │
│         │  └────────────────────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

**Responsive (Lyceum breakpoints `sm 640 · md 768 · lg 1024`):**

- **lg (≥1024):** sidebar expanded; probes 2-col; metrics 3-col; uptime strip
  full 30 bars.
- **md (768–1023):** sidebar collapsible to icons; probes 2-col; metrics 3-col;
  gutter 24.
- **sm (<768):** sidebar → off-canvas drawer + mobile Tabbar; **all grids stack
  to 1 col**; uptime strip stays a horizontal 30-bar row (no horizontal scroll —
  bars are 2px-wide + gap `1`, fits ≥320px); page gutter 16. Page header actions
  wrap below the title; "Re-probe now" becomes a full-width-aligned IconButton +
  label.

Region order is intentional: **now → recent reliability → volume**, top to
bottom.

---

## 4. Components used (§5 inventory only)

**Navigation:** `AppShell` (sidebar + topbar), `Sidebar`, `Topbar`,
`Breadcrumb`, `CommandPalette` (⌘K, web only). On the Topbar the tenant switcher
renders as a **locked "Platform" `Badge`** (super-admin has no single active
tenant).

**Containers / layout:** `Section` (page header region), `Card` (overall banner,
each service probe, uptime card, metrics card), CSS grid via `gap`.

**Primitives:** `Button` — **secondary** variant for "Re-probe now" (NOT
`spark`; spark/CTA glow is student-only). `IconButton` for the compact mobile
re-probe. `Tooltip` on each uptime bar and on each metric's info affordance.

**Data:** `Stat`/`KPI` ×3 (Avg Response, Total Users, Errors 24h — mono
numerics, `tabular-nums`). `Skeleton` (loading). `EmptyState` (no snapshots
yet). `Badge` (the locked "Platform" pill; the per-day uptime legend chips).
`DefinitionList` (probe detail rows on a degraded/down card).

**Feedback:** `InlineAlert/Banner` — the **overall status banner** (variants:
success / warning / error tone, see §5). `Toast` (sonner) for re-probe
success/failure. `LoadingOverlay` is **not** used (we keep the page interactive
and skeleton individual regions instead).

### Proposed foundation additions

- **`StatusIndicator`** **[PROPOSED FOUNDATION ADDITION]** — a small, reusable
  status atom = **filled dot + status icon + text label**, taking a `status` of
  `operational|degraded|down|no-data` and mapping to `status.success` /
  `status.warning` / `status.error` / `text.muted` respectively. Used on every
  probe card and (compact) per uptime bar. Rationale: Lyceum §2.3 mandates
  "never status-by-color-alone — always pair with icon + label," but §5 has no
  single atom that enforces it; today the live code re-implements dot+icon+label
  ad hoc in three places. Adding `StatusIndicator` to §5 (Data group) makes the
  rule structural. **Sizes:** `sm` (inline, dot 6px + 12px icon), `md` (card,
  dot 8px + 16px icon). **a11y:** the label text is the source of truth; the
  icon is `aria-hidden`; never the dot alone.
- **`UptimeStrip`** **[PROPOSED FOUNDATION ADDITION]** — a horizontal row of N
  day-bars (each a `Tooltip` trigger), driven by `DayHealthStatus | 'no-data'`.
  It is essentially a constrained `Timeline`/heatmap; if the team prefers, model
  it as a variant of the existing **`Timeline`** component instead of a new
  entry. Bars: width 2 (spacing token), height 32, radius `sm`, `gap 1`.

No new colors/fonts/radii/shadows/motion are introduced — both additions compose
entirely from existing tokens.

---

## 5. States

All numerics render in `Spline Sans Mono` (`tabular-nums`) so digits don't
jitter on refresh.

**Loading (skeleton):**

- Page header renders immediately (static title + disabled "Re-probe now").
- Overall banner → `Skeleton` (dot + 48-char line) inside a neutral `Card`
  (`bg.surface`, `border.subtle`, no status tone until resolved).
- 4 probe cards → `Skeleton` icon tile (40px, radius `lg`) + two text lines
  each.
- Uptime strip → 30 `Skeleton` bars (height 32, width 2, radius `sm`).
- 3 metric stats → label visible, value → `Skeleton` (32×64).
- Re-probe button shows the `RefreshCw` icon spinning (`fast`/`base` motion,
  respecting reduced-motion → static).

**Empty (no snapshots yet — fresh platform / scheduler hasn't run):**

- Overall banner still shows the _live_ `getSummary(scope:'health')` latest
  probe if present; if there is genuinely no probe data, show `EmptyState` in
  the uptime card and metrics: title _"No health data yet"_, body _"The platform
  health probe hasn't recorded a snapshot. Run a probe to capture the first
  reading."_, primary action = "Re-probe now" (`Button` secondary).
- Uptime strip: all 30 bars render in the `no-data` style (`bg.inset` /
  `text.muted` toned) with tooltip "No data".

**Partial (some probes succeed, some fail / history loads after live probe):**

- Live probe section and history section load **independently** (two queries).
  If history is slow, probe cards + banner render first; uptime strip +
  Errors-24h stay skeleton.
- A single degraded/down probe → that card flips to warning/error tone with a
  `DefinitionList` detail row (e.g. _"No tenants with AI configured"_,
  _"Functions endpoint unreachable"_); the overall banner derives from the
  **worst** probe (`down` > `degraded` > `operational`).
- If `getSummary` returns snapshots but the live re-probe fails, keep showing
  last-known probe cards with a subtle "stale" caption _"Showing last server
  snapshot — re-probe failed"_ + a retry `Button`.

**Error (the health read itself fails):**

- Top-of-page `InlineAlert/Banner` (error tone): title _"Couldn't load system
  health"_, body = mapped `error.details.code` message (common-api §6.3
  `useApiError`), inline "Try again" `Button` (link/ghost). Below it, regions
  render their last cached values if any, otherwise skeleton→empty. A global
  React Query error boundary catches non-recoverable failures (common-api §6.3)
  rather than rendering as a silent empty state.

**Success:**

- Overall banner success-toned: _"All Systems Operational"_ + checked-at
  timestamp (mono).
- 4 probe cards green-toned (`status.success`) with latency in ms (mono) where
  available.
- Uptime strip filled; computed uptime % shown (e.g. "99.2% uptime, 30d").
- 3 metric stats populated.

**Permission-gated variations by role:**

- This screen is **super-admin only**. `RequireAuth` denies unless
  `isSuperAdmin === true` **and** the ID-token claim verifies (auth-access §1.5;
  defense-in-depth, app-super-admin §1.3). There is **no tenant-admin variant**
  of `/system` — tenant-admins never see platform health (cross-tenant data). A
  tenant-admin who deep-links `/system` is bounced to their tenant dashboard
  with a "not authorized" toast; the route is also absent from their Sidebar
  manifest.
- The **"Re-probe now"** action requires the same super-admin gate server-side
  (`v1.platform.runHealthCheck` re-checks `ctx.isSuperAdmin`); the button is
  never shown to non-super-admins (they can't reach the route anyway).

---

## 6. Interactions & motion (§4 tokens)

- **Initial load:** regions fade/slide in with `ease.entrance` over `base`
  (220ms), staggered top-to-bottom by `instant` (100ms) increments.
  Reduced-motion → instant opacity, no translate.
- **Re-probe now:** click → button enters loading (icon spins, `RefreshCw`,
  continuous; reduced-motion → static icon + "Checking…" label), button
  disabled. This is the **one** mutation-shaped action: calls
  `v1.platform.runHealthCheck` (server probes + writes snapshot), then both
  queries invalidate.
  - **No optimistic update** — health is server-authoritative; we never fake
    "operational" before the server confirms. The cards stay on last-known
    values (slightly dimmed, `text.secondary` caption "re-probing…") until the
    real result arrives, then cross-fade (`fast` 160ms, `ease.standard`).
  - **Success:** banner + cards + strip update; `Toast` (sonner, success tone)
    "Health re-probed — All systems operational" (or the worst status).
    Checked-at timestamp updates.
  - **Failure:** `Toast` (error tone) "Re-probe failed — {mapped message}";
    cards revert to last-known with the stale caption; button re-enabled.
- **Status change feedback:** when a probe transitions operational→degraded/down
  on refresh, the affected card border + tone change with a `fast` color
  transition only — **no celebratory motion, no marigold burst** (that's
  reserved for student XP/streak/level-up per §4). Admin chrome stays calm and
  serious.
- **Uptime bar hover/focus:** `Tooltip` opens on hover (`instant` delay) and on
  keyboard focus, showing `YYYY-MM-DD · {status}` (or "No data"). Tooltip uses
  elevation `e2`.
- **Metric info:** optional `Tooltip` on each Stat explaining the source
  ("Firestore read latency", "errors = gradingDeadLetter + llmCallLogs
  status==error, 24h").
- **Auto-refresh:** the screen polls `getSummary(scope:'health')` on a gentle
  interval (e.g. every 5 min, matching the scheduled probe cadence; **not** the
  old `staleTime:0` per-keystroke posture). A small "auto every 5 min" caption
  sets the expectation. No background spinner; updates cross-fade.
- **Confirmations:** none needed — re-probe is non-destructive, read-only-effect
  (it only writes a health snapshot). No `ConfirmDialog`.

---

## 7. Content & copy (precise admin tone)

**Page header**

- H1: `System Health`
- Sub: `Live platform service and infrastructure status`
- Caption (mono): `Last checked {HH:MM} · auto every 5 min`
- Action button: `Re-probe now` (loading label: `Probing…`)

**Overall status banner** (derived from worst probe)

- operational → `All Systems Operational`
- degraded → `Some Services Degraded`
- down → `Service Disruption Detected`
- Trailing (mono): `checked {HH:MM:SS}`

**Service probe cards** (name · description)

- `Firebase Auth` — `Authentication service`
- `Firestore` — `Primary database`
- `Cloud Functions` — `Serverless compute`
- `AI Grading Pipeline` — `Gemini AI evaluation`
- Status labels: `Operational` / `Degraded` / `Down` (paired with dot + icon).
- Latency suffix (mono): `{n} ms`.
- Detail rows (degraded/down, from probe `detail`): e.g.
  `No authenticated user`, `Functions endpoint unreachable`,
  `No tenants with AI configured`, `Cannot reach Firestore`.

**30-Day Uptime**

- CardTitle: `30-Day Uptime History`
- Legend: `Healthy` · `Degraded` · `Down` · `No data`
- Summary (mono): `{pct}% uptime · last 30 days`
- Bar tooltip: `{YYYY-MM-DD} · {Healthy|Degraded|Down|No data}`

**Platform Metrics**

- CardTitle: `Platform Metrics`
- `Avg Response Time` — value `{n} ms` — sub `Firestore read latency`
- `Total Users` — value `{n}` — sub `across {n} active tenants`
- `Errors (24h)` — value `{n}` (error-toned if >0) — sub
  `{n} errors in the last 24 hours`

**Empty state**

- Title: `No health data yet`
- Body:
  `The platform health probe hasn't recorded a snapshot. Run a probe to capture the first reading.`
- Action: `Re-probe now`

**Error state**

- Banner title: `Couldn't load system health`
- Body: the mapped error message (e.g.
  `You don't have permission to view platform health.` for `PERMISSION_DENIED`;
  `Health service is temporarily unavailable.` for transport failure).
- Action: `Try again`
- Stale caption: `Showing last server snapshot — re-probe failed`

Tone throughout: factual, terse, no exclamation, no emoji, no encouragement
language. This is the diagnostic register.

---

## 8. Domain rules surfaced

1. **Super-admin only / cross-tenant.** `/system` is platform control-plane.
   Access requires `isSuperAdmin === true` **and** verified `superAdmin`
   ID-token claim (auth-access §1.5; defense-in-depth in `RequireAuth`,
   app-super-admin §1.3). No tenant-admin path exists. The Topbar tenant
   switcher is locked to a "Platform" pill — super-admin is **not** scoped to
   one tenant (tenant isolation is a hard rule for tenant-scoped roles;
   super-admin is the explicit cross-tenant exception, and even it reads only
   _aggregate_ health, never one tenant's learner data here).
2. **Server-authoritative values.** All health status, latency, uptime, and
   error counts are produced by the server (`v1.platform.runHealthCheck`
   scheduled probe → `platformHealthSnapshots`; `getSummary(scope:'health')`
   aggregation). The browser **never computes** status and **never writes**
   snapshots (closes the client-driven-probe debt, app-super-admin §4.9 / §5.6).
   The page is read-only except the explicit super-admin re-probe trigger.
3. **No tenant PII / no learner data.** Health metrics are counts and latencies
   only (`HealthSnapshot.services`, `errorCount24h`, `totalFunctionCalls24h`,
   aggregate `totalUsers`/`activeTenants`). No per-student, per-submission, or
   answer-key data appears — the answer-key isolation invariant (rules deny-all
   on `answerKeys/**`) is upheld trivially since this screen never touches
   content.
4. **Error count provenance is auditable & bounded.** `errorCount24h` =
   `gradingDeadLetter` + `llmCallLogs(status==error)` in the last 24h
   (be-analytics §16). The metric's tooltip states this provenance so the number
   is interpretable, not magic.
5. **Audit logging.** A super-admin manual re-probe is a platform action;
   `v1.platform.runHealthCheck` writes a best-effort audit entry (consistent
   with the `logTenantAction` + `writePlatformActivity` pattern on every
   super-admin mutation, app-super-admin §1.4). Scheduled probes are
   system-actor and don't pollute the human audit feed.
6. **Rate limiting.** `getSummary` is `rateTier:'read'`; `runHealthCheck` is
   throttled server-side (`enforceRateLimit`) so a super-admin can't hammer
   probes — the button also debounces while in-flight.
7. **Status-by-color-alone is forbidden** (foundation §2.3) — enforced
   structurally via the proposed `StatusIndicator` (dot **+** icon **+** text);
   see §9.

---

## 9. Accessibility (WCAG AA)

- **Contrast:** all status text/background pairs use Lyceum semantic tokens that
  meet AA (4.5:1 body, 3:1 large/UI). Status-toned banner/card backgrounds
  (`status.success/warning/error` at their tinted surface) carry text in the
  matching strong token; never rely on the tint alone.
- **Never status-by-color-alone (§2.3, hard rule):** every status is conveyed
  three ways — **filled dot + status icon + visible text label** via
  `StatusIndicator`. The 30-day uptime bars additionally encode status in their
  `Tooltip` text and an `aria-label` per bar (`"2026-06-12: Degraded"`), so a
  screen-reader or color-blind user gets the state without color. The legend
  repeats icon + label.
- **Focus order:** Topbar → Sidebar (System active) → page H1 → "Re-probe now" →
  overall banner → each probe card (top-left→bottom-right) → each uptime bar
  (left→right, all keyboard-focusable Tooltip triggers) → each metric Stat.
  Logical, top-to-bottom, left-to-right.
- **Keyboard:** "Re-probe now" is a real `button` (Enter/Space). Uptime bars are
  focusable (`tabindex=0`, `role="img"` with `aria-label`) and reveal their
  `Tooltip` on focus, not just hover. ⌘K opens CommandPalette (web). No keyboard
  trap.
- **ARIA / live regions:** the overall status banner is `role="status"`
  `aria-live="polite"` so a status change (operational→degraded) is announced
  after a re-probe without stealing focus. Loading skeletons carry
  `aria-busy="true"` on their region; `aria-hidden` on decorative icons/dots.
  The re-probe button uses `aria-live` text "Probing…/Done".
- **Reduced motion:** `prefers-reduced-motion` → no slide/stagger entrance, the
  `RefreshCw` spinner becomes a static icon + text "Checking…", color
  transitions become instant. No parallax, no marigold burst (none exists here
  anyway).
- **Touch targets:** ≥44px — re-probe button and the (mobile) uptime bars get an
  enlarged hit area even though the bar is visually 2px wide.

---

## 10. Web ↔ mobile divergence

**Admin is primarily web/desktop.** The super-admin control plane is a desktop
tool; `/system` is designed for a wide viewport with the AppShell sidebar.

- **No dedicated native (Expo/RN) super-admin app** is in scope — the
  super-admin app is web-only. There is therefore **no `ui-native` parity
  requirement** for this screen; the §5 component parity rule applies to the
  cross-app domain components, not to this platform-only page.
- **⌘K CommandPalette is web-only** (foundation §6) — the route is reachable via
  palette on web; on small viewports there is no palette, navigation is via the
  off-canvas Sidebar drawer / mobile Tabbar.
- **Responsive (small-viewport web, e.g. admin on a phone browser):** grids
  collapse to a single column (probes 2→1, metrics 3→1); the uptime strip stays
  a single horizontal 30-bar row (2px bars fit ≥320px, no horizontal scroll);
  page-header actions wrap and "Re-probe now" compacts toward an
  `IconButton`+label; hover-only affordances (uptime Tooltip) also trigger on
  tap/focus. Sidebar → drawer; Topbar tenant "Platform" pill persists.
- **No press-vs-hover divergence beyond the standard mapping** (hover → press
  for the uptime tooltips), since there is no native client.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "System Health" screen for Auto-LevelUp's SUPER-ADMIN web app,
using the Lyceum design system. Read and conform EXACTLY to docs/rebuild-spec/design/
00-FOUNDATION.md — do NOT invent colors, fonts, spacing, radii, shadows, motion, or
component variants. Compose only from Lyceum semantic tokens and the §5 component
inventory, citing tokens by semantic name (bg.surface, border.subtle, text.primary,
status.success/warning/error, text.muted). This is ADMIN tooling: the serious,
precision-instrument register — restraint in chrome, NO student gamification, and the
marigold `spark` token is FORBIDDEN here (it's reserved for student XP/streak/level-up).

ROLE: Platform super-admin (cross-tenant). Route /system, rendered inside AppShell
(left Sidebar with "System Health" active under the System group; Topbar tenant switcher
shown as a LOCKED "Platform" Badge because super-admin is not scoped to one tenant).

PURPOSE: At a glance show (1) overall platform status now, (2) per-service probe status,
(3) 30-day uptime, (4) 24h error count.

DATA (read-only, server-authoritative): from v1.analytics.getSummary({scope:'health'})
returning HealthHistoryResponse { snapshots: HealthSnapshot[], errorCount24h,
totalFunctionCalls24h }. HealthSnapshot = { date 'YYYY-MM-DD', status
'healthy'|'degraded'|'down', services: Record<name,{status,latencyMs?}>, checkedAt }.
Live per-service probes (Firebase Auth, Firestore, Cloud Functions, AI Grading Pipeline)
each have status 'operational'|'degraded'|'down', optional latencyMs, optional detail.
The ONLY action is a super-admin "Re-probe now" button (calls server, never optimistic).

LAYOUT (top→bottom, max-width 1200, desktop gutter 32, region gap 24):
1. PageHeader: H1 "System Health" (Fraunces), sub "Live platform service and
   infrastructure status", mono caption "Last checked HH:MM · auto every 5 min",
   secondary Button "Re-probe now" with a refresh icon (spins while probing).
2. Overall status banner (InlineAlert/Banner) toned success/warning/error by the WORST
   probe; role="status" aria-live="polite"; trailing mono "checked HH:MM:SS".
   Labels: "All Systems Operational" / "Some Services Degraded" /
   "Service Disruption Detected".
3. Service probes grid (lg/md 2-col, sm 1-col): a Card per service with a muted 40px
   icon tile (radius lg), name + description, and a StatusIndicator (filled dot + status
   icon + text label — NEVER color alone), mono latency "{n} ms", and a detail row on a
   degraded/down card.
4. "30-Day Uptime History" Card: a horizontal strip of 30 day-bars (height 32, width 2,
   radius sm, gap 1), each a focusable Tooltip trigger with aria-label "YYYY-MM-DD:
   {status}"; legend Healthy/Degraded/Down/No data; mono "{pct}% uptime · last 30 days".
5. "Platform Metrics" Card (lg/md 3-col, sm 1-col): three Stat/KPI — Avg Response Time
   "{n} ms" (sub "Firestore read latency"), Total Users "{n}" (sub "across {n} active
   tenants"), Errors (24h) "{n}" error-toned if >0 (sub "{n} errors in the last 24
   hours"). All numerics in Spline Sans Mono, tabular-nums.

STATES: skeleton loading per region; empty ("No health data yet" + Re-probe now);
partial (probes load before history; worst-probe drives banner; stale caption if
re-probe fails); error banner ("Couldn't load system health" + Try again); success.
Super-admin only — no tenant-admin variant.

MOTION (foundation §4): entrance ease.entrance over 220ms, staggered 100ms top→bottom;
status color transitions fast 160ms ease.standard; refresh icon spins; NO celebratory
motion. Respect prefers-reduced-motion (static icon + "Checking…", instant transitions).

ACCESSIBILITY: WCAG AA contrast; status conveyed by dot+icon+label (never color alone);
banner role="status" aria-live; uptime bars keyboard-focusable with aria-label; logical
focus order; reduced-motion handled.

PROPOSE (flag as foundation additions, compose from existing tokens only): a reusable
StatusIndicator atom (dot+icon+label, status→status.success/warning/error/text.muted)
and an UptimeStrip (or a Timeline variant). Output clean component code using Lyceum
tokens; admin tone — factual, terse, no emoji.
```
