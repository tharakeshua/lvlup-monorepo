# Learner App Shell & Navigation — Design Spec

> Conforms to **`docs/rebuild-spec/design/00-FOUNDATION.md`** ("Lyceum",
> Direction A — Modern Scholarly). Cite tokens by semantic name; do not re-paste
> scales. This is the **foundational chrome** — every other student-web screen
> renders inside it.

---

## 1. Purpose & primary user

**Primary user:** the learner — either a **B2B school student** (tenant-scoped,
role `student`) or a **B2C consumer learner** (no tenant membership, served from
the synthetic `platform_public` tenant via `user.consumerProfile`).

**Job-to-be-done:** "Give me a calm, warm home base that always tells me where I
am, where I can go next, whether I'm online, and what's new — and then gets out
of the way so I can learn." The shell is responsible for **wayfinding,
identity/context, and system status**, never for learning content itself. It
must feel like a quiet, encouraging study desk: structure at the edges, focus in
the center.

This is a single `PlatformLayout` (per `webapps-design.md §3.1`) configured two
ways — **B2B (`AppLayout`)** and **B2C (`ConsumerLayout`)** — selected by
`LearnerContext`, not by path prefix (`webapps-design.md §5.2`). The two share
100% of chrome primitives; only `navGroups`, `appName`, branding source, and a
few feature flags (roleSwitcher, store-cart) differ.

---

## 2. Entry points & route

**Entry point:** This is not a route — it is the layout element wrapping every
authed learner route. The B2B tree (`/`, `/spaces/*`, `/tests`, `/leaderboard`,
`/profile`, `/settings`, `/notifications`, `/achievements`, `/progress`) renders
inside `AppLayout`; the B2C tree (`/consumer`, `/my-spaces`,
`/consumer/spaces/*`, `/store/*`, `/profile`) renders inside `ConsumerLayout`.
Selection is made by the resolved `LearnerContext` after `RequireAuth`
(`webapps-design.md §4.2`, `onMissingMembership: 'consumerRedirect'`).

**Reads/writes that power the shell** (all via `@levelup/api-client` +
`shared-hooks/headless` — UI never touches `firebase/firestore`):

| Concern                               | Source                                                | Callable / repo                                                                                         |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Auth + memberships + active tenant    | `shared-stores/auth-store` (real-time `/users/{uid}`) | store (kept verbatim, `webapps-design.md §4.3`)                                                         |
| Tenant switch (RoleSwitcher)          | mutation                                              | `v1.identity.switchActiveTenant` → client `getIdToken(true)`                                            |
| Tenant branding (primary/accent/logo) | `useTenantBranding()`                                 | `tenant-store` subscription; B2C uses `platform_public` branding                                        |
| Tenant names for switcher             | `useTenantNames(ids)` hook                            | repo read (NOT inline `getDoc` — replaces today's layout `getDoc`, `common-api §8` / inconsistency #18) |
| Notification list + unread badge      | `useNotifications` / `useUnreadCount`                 | `v1.identity.manageNotifications` (`action: 'list'`); badge via realtime seam (`common-api §10`)        |
| Mark read / mark all read             | `useMarkRead` / `useMarkAllRead`                      | `v1.identity.manageNotifications` (`action: 'markRead'`)                                                |
| Cart badge (B2C only)                 | `useConsumerStore`                                    | local Zustand (persisted localStorage)                                                                  |

`tenantId` is derived server-side from claims; not passed in request bodies
(`common-api §4.4`).

---

## 3. Layout — wireframe-as-text

Built from **AppShell** (`§5 Navigation`): a two-region grid — fixed **Sidebar**
rail + scrollable main column with a sticky **Topbar**. Page gutters per
FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32); max content width 1200,
reading column 720. Background `bg.canvas`; sidebar + topbar surfaces
`bg.surface` separated by `border.subtle`.

```
┌──────────────────────── lg ≥1024 ────────────────────────────────────┐
│ [Offline/PWA/SW banners — full-bleed, above everything, when active]   │
├──────────────┬────────────────────────────────────────────────────────┤
│ SIDEBAR 248px │ TOPBAR  (sticky, h ~56, bg.surface, border-b subtle)    │
│ bg.surface    │  [Breadcrumb / page title ····]  [⌘K hint] [Theme] [🔔] │
│ border-r      ├────────────────────────────────────────────────────────┤
│ subtle        │ MAIN  (bg.canvas, gutter 32, max-w 1200)                │
│               │   ┌──────────────────────────────────────────────┐     │
│ [logo/brand]  │   │ #main-content  (SkipToContent target)        │     │
│  ── nav ──    │   │   <Outlet> wrapped in PageTransition          │     │
│  Dashboard    │   │                                              │     │
│  My Spaces    │   │                                              │     │
│  Tests        │   │                                              │     │
│  Leaderboard  │   │                                              │     │
│  Profile      │   │                                              │     │
│  Settings     │   └──────────────────────────────────────────────┘     │
│  ── footer ── │                                                          │
│ [RoleSwitcher]│                                                          │
│ [avatar ▾]    │                                                          │
└──────────────┴────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg ≥1024:** persistent sidebar rail (248px), full Topbar with
  breadcrumb/title + ⌘K affordance, Theme, NotificationBell. No bottom Tabbar.
- **md 768–1023:** sidebar collapses to an off-canvas **Drawer/Sheet** opened
  from a Topbar hamburger IconButton; main column goes full width; Topbar keeps
  Theme + bell. Bottom Tabbar still hidden (drawer covers nav).
- **sm <768:** **no sidebar**; Topbar shows brand/logo + bell + avatar; primary
  nav moves to the fixed bottom **Tabbar** (`MobileBottomNav`, ≥44px touch
  targets, safe-area inset). ⌘K CommandPalette is **absent**. `hasBottomNav`
  reserves bottom padding so content never hides behind the Tabbar.

**B2B vs B2C divergence (same regions, different fill):**

- B2B sidebar/Tabbar: Dashboard · My Spaces · Tests · Leaderboard · Profile ·
  Settings (Tabbar = Home/Spaces/Tests/Rank/Profile). Footer shows
  **RoleSwitcher** (only when ≥2 student memberships) + avatar menu.
- B2C sidebar/Tabbar: My Learning · Store · (Cart, conditional) · Profile. **No
  RoleSwitcher** (no memberships). Cart entry appears only when `cartCount > 0`,
  with count in label + Tabbar `badge`.

---

## 4. Components used

All from FOUNDATION §5. Navigation primitives:

- **AppShell** — sidebar + topbar frame, `hasBottomNav` flag.
- **Sidebar** — role-driven nav rendered from the route manifest's `navMeta`
  (`webapps-design.md §3.2`); `isActive` computed once via longest-prefix match
  in the shell (no per-app reinvention).
- **Topbar** — hosts breadcrumb/title slot, ⌘K affordance, ThemeToggle,
  NotificationBell, avatar.
- **Tabbar** (`MobileBottomNav`) — mobile bottom nav, badge support.
- **RoleSwitcher** — switch across student memberships (B2B only).
- **CommandPalette (⌘K)** — web-only global nav/search (open with ⌘K / Ctrl-K).
- **Breadcrumb** — page-context trail (Topbar).

Primitives / containers / feedback:

- **Button**, **IconButton** (hamburger, theme, bell), **Avatar / AvatarGroup**,
  **DropdownMenu/Popover** (avatar menu, notifications), **Drawer/Sheet** (md
  collapsed nav), **Badge** (unread count, cart count), **Skeleton** (shell
  skeleton), **Toast (sonner)** (mark-read confirmations, errors),
  **InlineAlert/Banner** (offline / PWA install / SW update), **Tooltip**
  (icon-button labels, ⌘K hint).

Shell-specific layout primitives (FOUNDATION §5 names; mapped to
`shared-ui/layout` in `webapps-design.md §2.2`): **SkipToContent**,
**RouteAnnouncer**, **RouteErrorBoundary** (per route), **PageLoader** (Suspense
fallback), **OfflineBanner**, **PWAInstallBanner**, **SWUpdateNotification**,
**ThemeToggle**, **NotificationBell**, **PageTransition**.

**Gamification:** none rendered at rest in the shell. The shell only **hosts**
`CelebrationBurst` as a portal target so feature screens can fire the one
celebratory moment over the chrome (see §8).
`XPMeter`/`StreakFlame`/`LevelBadge` belong to Dashboard/Profile, not the shell.

**No proposed FOUNDATION additions.** Every element maps to an existing §5
component.

---

## 5. States

The shell renders **before** page content resolves, so it owns the outermost
loading/error envelope.

- **Booting (auth resolving):** `auth-store.initialize()` pending → full-screen
  **PageLoader** (centered brand mark on `bg.canvas`, subtle `motion.base`
  fade). No sidebar flash.
- **Shell ready, route loading:** sidebar + Topbar render immediately (chrome is
  cheap); the main column shows the route's **PageLoader / Skeleton** inside
  `RouteErrorBoundary` while the lazy chunk + data resolve.
- **Empty:** the shell is never "empty" — it always has nav. Empty states live
  in pages.
- **Error (route-level):** **RouteErrorBoundary** catches a thrown route and
  renders an `ErrorState` (warm copy, "Try again" + "Back to Dashboard")
  **inside** the shell — sidebar/Topbar stay intact so the learner is never
  stranded. A global React Query error boundary surfaces non-empty-state errors
  as a Toast (`common-api §6.3`).
- **Partial:** NotificationBell renders its list independently of the page; if
  notifications fail, the bell shows a quiet "Couldn't load updates" inside the
  popover while the rest of the shell works. RoleSwitcher shows tenant **ids**
  as a graceful fallback if `useTenantNames` is still resolving.
- **Success:** active nav item highlighted (`brand.primary` text +
  `bg.surface-sunken` pill, left `border.focus` accent); breadcrumb/title
  reflects route; bell shows unread `Badge` (count, capped "9+").

**Permission / context-gated variations:**

- **B2B student (has membership):** full B2B nav, RoleSwitcher visible iff ≥2
  student memberships, branding from active tenant.
- **B2C consumer (no membership):** B2C nav, **no RoleSwitcher**, branding from
  `platform_public`, Cart entry conditional on `cartCount`.
- **Mid-switch (RoleSwitcher):** while `switchActiveTenant` + token refresh
  runs, sidebar footer shows a small inline spinner and disables further
  switching; on success the whole tree re-resolves under the new tenant's
  branding.

---

## 6. Interactions & motion

Motion stays **subtle** everywhere in the shell (FOUNDATION §4) — the shell is
chrome, not celebration.

- **Nav click / active change:** active-pill transitions with `motion.fast`
  (160ms) using `ease.standard`; hover on a sidebar item lifts background to
  `bg.surface-sunken` at `motion.instant`. Sidebar links **prefetch** their lazy
  chunk on hover/focus (`usePrefetch`, manifest-derived).
- **Route transition:** `PageTransition` cross-fades the main column on
  `pathname` change at `motion.page` (420ms) `ease.entrance` — gentle, not a
  slide. Honors reduced-motion (instant swap).
- **Mobile drawer (md):** Sheet slides in `ease.entrance` / out `ease.exit` at
  `motion.base`; backdrop fades.
- **NotificationBell:** popover opens with `e2` elevation at `motion.fast`.
  Clicking a notification is **optimistic** — the row marks read instantly and
  the badge decrements before the `manageNotifications(markRead)` round-trip; on
  failure it reverts and shows a Toast. "Mark all read" zeroes the badge
  optimistically.
- **RoleSwitcher:** selecting a tenant shows immediate pending state; no
  celebratory motion.
- **ThemeToggle:** light/dark flips CSS variables with a `motion.base` color
  transition; icon does a quiet `motion.fast` rotate.
- **CommandPalette (⌘K):** opens centered with `e3` elevation + backdrop at
  `motion.fast`; type-to-filter nav destinations and (B2B) spaces; Enter
  navigates. Closes on Esc.
- **Banners (offline / PWA / SW update):** slide down from top at `motion.base`;
  never abrupt. Offline banner is persistent while offline; PWA + SW banners are
  dismissible.
- **CelebrationBurst (hosted, not owned):** when a feature screen fires
  XP/streak/level-up/achievement, the **spring pop + marigold `spark` burst**
  renders over the shell via a portal. This is the **one** celebratory moment —
  the shell itself never animates celebratorily. Respects
  `prefers-reduced-motion` (no burst; quiet confirmation instead).

---

## 7. Content & copy

Warm, encouraging, human (FOUNDATION §7 point 3). Display headings in Fraunces;
nav labels/body in Schibsted Grotesk; any counts/badges in Spline Sans Mono.

- **Sidebar appName:** B2B "Student" → prefer the **tenant/school name** when
  branding is present; B2C "LevelUp".
- **Nav labels (B2B):** Dashboard · My Spaces · Tests · Leaderboard · Profile ·
  Settings. **(B2C):** My Learning · Store · Cart (n) · Profile.
- **Mobile Tabbar labels (short):** Home · Spaces · Tests · Rank · Profile
  (B2B); Home · Store · Cart · Profile (B2C).
- **Avatar menu:** name + email; "Settings", "Sign Out".
- **NotificationBell — header:** "Updates". **Empty:** "You're all caught up.
  Nice work." **Loading:** skeleton rows. **Error (partial):** "We couldn't load
  your updates right now — try again in a bit." **Footer action:** "See all
  updates".
- **RoleSwitcher label:** "Switch school" with current school name; helper
  "You're learning at {school}."
- **Offline banner:** "You're offline — your progress is saved and will sync
  when you're back." (reassuring, never alarming).
- **PWA install banner:** "Add LevelUp to your home screen for quick,
  full-screen study." Actions: "Add" / "Not now".
- **SW update notification:** "A fresh version is ready." Action: "Refresh".
- **Route error (inside shell):** Title (Fraunces) "Let's try that again." Body
  "Something hiccupped loading this page — it's not on you." Actions: "Try
  again" / "Back to Dashboard".
- **⌘K hint (Topbar, lg):** muted "Search ⌘K".
- **Skip link:** "Skip to main content".

Never punitive: errors are framed as the app's hiccup, not the learner's
mistake.

---

## 8. Domain rules surfaced

- **Tenant isolation (primary shell rule):** B2B chrome is tenant-scoped —
  branding, nav, notifications, and RoleSwitcher options all derive from the
  active tenant claim (`tenants/{tenantId}/...`). B2C chrome derives from
  `platform_public` + `user.consumerProfile`. The shell selects context via
  `LearnerContext`, **not** path prefix (`webapps-design.md §5.2`), and never
  lets a B2C user see B2B tenant nav (or vice-versa). RoleSwitcher only ever
  lists the user's own student memberships; switching goes through
  `switchActiveTenant` + forced token refresh (`common-api §4.2`).
- **Answer-key never shown:** not a shell surface, but the shell must never
  deep-link (via notification `actionUrl` or CommandPalette) into a server-only
  answer-key route. Notification action URLs are server-provided and constrained
  to learner-safe destinations; the **AnswerKeyLock** visual is a page concern,
  not chrome.
- **Timer is server-authoritative:** the shell hosts but does not drive timed
  tests. It must **not** interrupt an in-progress timed test — e.g., the SW
  update banner should defer/soft-prompt rather than force-refresh mid-test, and
  route-transition prefetch must not navigate away from an active `TimerBar`.
  The countdown is never client-trusted; the shell respects that boundary by
  staying out of the test runner's way.
- **Gamification = one celebratory moment:** the shell is the **portal host**
  for `CelebrationBurst` (spring pop + marigold `spark`) but renders zero
  celebratory motion itself. All other shell motion stays subtle per FOUNDATION
  §4. Reduced-motion suppresses the burst.
- **All data via `@levelup/api-client`:** shell reads (notifications, tenant
  names, branding) go through repos/registry; UI never touches Firestore.
  Replaces today's inline `getDoc` for tenant names with `useTenantNames(ids)`
  (`common-api §8`, inconsistency #18).

---

## 9. Accessibility

- **Skip link:** `SkipToContent` is the first focusable element; jumps focus to
  `#main-content`. Visible on focus only.
- **Route announcements:** `RouteAnnouncer` writes the new page title to an
  `aria-live="polite"` region on every `pathname` change so screen-reader users
  hear navigation.
- **Focus order:** Skip link → Sidebar nav (or Topbar hamburger on md) → Topbar
  actions (⌘K, Theme, Bell, avatar) → main content. On mobile: Topbar → main →
  bottom Tabbar.
- **Keyboard:** all nav items are real links (Enter/Space activate); Tabbar
  items keyboard-reachable; avatar + bell are menu buttons with arrow-key
  navigation and Esc-to-close; CommandPalette is fully keyboard-driven (⌘K open,
  type, ↑/↓, Enter, Esc); drawer traps focus while open and restores on close.
- **ARIA:** sidebar `role="navigation"` with `aria-label="Primary"`; active item
  `aria-current="page"`; icon-only buttons (hamburger, theme, bell) have
  `aria-label`s; unread badge exposes a text label ("3 unread updates"), never
  color-only; banners use `role="status"` (offline/SW) or `role="alert"` only
  when truly urgent.
- **Contrast:** all nav text/background, badge, and banner pairs meet WCAG AA
  (4.5:1 body, 3:1 UI) per FOUNDATION §2.3; status (offline/online, unread)
  always pairs icon + label, never color alone — including under tenant-branding
  overrides (branding only swaps `brand.primary`/`spark`/logo, never breaks the
  AA-checked neutral text pairs).
- **Reduced motion:** `prefers-reduced-motion` disables PageTransition
  cross-fade, banner slides, and any CelebrationBurst portal animation —
  replaced with instant state changes.
- **Touch targets:** Tabbar and all mobile controls ≥44px (FOUNDATION §4).

---

## 10. Web↔mobile divergence (FOUNDATION §6)

| Aspect                  | Web                                                          | Mobile (Expo / `ui-native`)                                 |
| ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Primary nav             | Persistent left **Sidebar** (lg); off-canvas **Drawer** (md) | Bottom **Tabbar** (`MobileBottomNav`), no rail              |
| Topbar                  | Breadcrumb/title + ⌘K + Theme + Bell + avatar                | Compact header: brand/logo + Bell + avatar; no breadcrumb   |
| **CommandPalette (⌘K)** | Present (web-only)                                           | **Absent** — no ⌘K; search lives in-page                    |
| Hover affordances       | Hover prefetch + hover active states                         | **Press** states; prefetch on tab focus/mount               |
| RoleSwitcher            | Sidebar footer dropdown                                      | Sheet/action-sheet from profile/header                      |
| Notifications           | Popover from bell                                            | Full-screen sheet or notifications tab                      |
| Branding injection      | CSS custom properties at `PlatformLayout` boundary           | NativeWind theme switch over the same token names           |
| PWA/SW/offline banners  | PWA install + SW update + offline banners                    | No PWA banner; OTA-update prompt + native offline indicator |

Component **names and props match 1:1** across `shared-ui` (web) and
`ui-native`; only the renderer differs. The route manifest feeds both the web
`<Routes>` renderer and the RN `react-navigation` renderer
(`webapps-design.md §3.2`).

---

## 11. Claude-design prompt

```
Design the LEARNER APP SHELL & NAVIGATION for the Auto-LevelUp student web app.
Conform strictly to the "Lyceum" design system (Direction A — Modern Scholarly) in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, spacing,
radii, shadows, motion, or component variants — compose ONLY from FOUNDATION §2–§5
and cite tokens by semantic name.

CONTEXT: This is the chrome every other student screen renders inside. It is ONE
configurable PlatformLayout rendered two ways, selected by LearnerContext (not path):
  • B2B student (tenant-scoped, role `student`): nav = Dashboard, My Spaces, Tests,
    Leaderboard, Profile, Settings. Sidebar footer shows a RoleSwitcher (only if the
    user has ≥2 student memberships) + an avatar menu.
  • B2C consumer (no membership, platform_public tenant): nav = My Learning, Store,
    Cart (conditional, shows count), Profile. NO RoleSwitcher.

BUILD from FOUNDATION §5 components ONLY: AppShell (sidebar + topbar), Sidebar
(role-driven, isActive via longest-prefix match, hover-prefetch), Topbar (breadcrumb/
title slot, ⌘K affordance, ThemeToggle, NotificationBell with unread Badge, avatar
DropdownMenu), Tabbar (MobileBottomNav), RoleSwitcher, CommandPalette (⌘K, web-only),
plus SkipToContent, RouteAnnouncer, RouteErrorBoundary, PageLoader, OfflineBanner,
PWAInstallBanner, SWUpdateNotification, PageTransition.

TOKENS: bg.canvas app background; bg.surface for sidebar + topbar; border.subtle
separators; active nav item = brand.primary text + bg.surface-sunken pill + border.focus
accent; unread + cart Badge use neutral surface (count in Spline Sans Mono); Fraunces
for any display titles, Schibsted Grotesk for nav/labels. Elevation e2 for popovers,
e3 for the command palette. Motion stays SUBTLE: nav active = motion.fast/ease.standard,
route transition = motion.page/ease.entrance cross-fade, drawer = ease.entrance/exit.
The shell renders ZERO celebratory motion itself — it only hosts CelebrationBurst as a
portal target for feature screens (the one marigold spark moment).

RESPONSIVE: lg ≥1024 persistent 248px sidebar + full topbar, no bottom tabbar;
md 768–1023 sidebar collapses to an off-canvas Drawer opened by a topbar hamburger;
sm <768 no sidebar, bottom Tabbar (≥44px targets, safe-area inset), NO ⌘K.

STATES: full-screen PageLoader while auth resolves; chrome renders immediately while the
route's Skeleton/PageLoader fills the main column inside RouteErrorBoundary; route errors
render a warm ErrorState INSIDE the shell (sidebar/topbar intact); NotificationBell loads
independently with empty ("You're all caught up. Nice work.") and partial-error states;
RoleSwitcher falls back to tenant ids while names resolve.

TONE: warm, encouraging, never punitive. Offline = "You're offline — your progress is
saved and will sync when you're back." Route error title (Fraunces) = "Let's try that
again." with body "Something hiccupped loading this page — it's not on you."

DOMAIN RULES: tenant isolation (B2B chrome derives from active tenant claim + branding
override of brand.primary/spark/logo; B2C from platform_public); never deep-link into
answer-key routes; never force-refresh (SW update banner) mid timed-test; gamification
burst is the ONE celebratory moment, reduced-motion suppresses it. All shell data flows
through @levelup/api-client (notifications via v1.identity.manageNotifications, tenant
names via useTenantNames) — UI never touches Firestore.

A11Y: SkipToContent first in tab order → #main-content; RouteAnnouncer aria-live polite
on route change; sidebar role="navigation" aria-label="Primary"; active item
aria-current="page"; icon buttons have aria-labels; unread shown as text not color-only;
WCAG AA contrast preserved under branding overrides; prefers-reduced-motion disables
transitions and the burst.

Deliver: desktop (lg) shell with sidebar + topbar + active state, the md collapsed-drawer
state, and the sm bottom-Tabbar state — for BOTH the B2B and B2C nav configurations.
```
