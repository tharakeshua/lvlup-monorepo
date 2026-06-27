# Assembly Phase — Interactive SPA prototypes (web + mobile)

> Goal: assemble the 115 standalone screen cards into **8 navigable
> interactive-SPA app prototypes** in Claude Design — each a single
> self-contained card with a persistent app shell + client-side **hash router**
> (sidebar/tabbar switches views in place, like a real running app). Locked
> decisions: **Interactive SPA per app**, **web + mobile**. All sessions Opus
> 4.8 1M. Lyceum + the compiled `window.LvlupV0DesignSystem_5d0725` component
> library are the source of truth.

## App inventory (8 SPAs)

| App                   | Card group          | Shell                    | Source screens                    | Viewport |
| --------------------- | ------------------- | ------------------------ | --------------------------------- | -------- |
| **web-teacher** ⭐REF | `App-Teacher`       | sidebar+topbar           | teacher 17 + spaces 24 + exams 16 | 1440x940 |
| web-admin             | `App-Admin`         | sidebar+topbar           | admin tenant-admin 19             | 1440x940 |
| web-super-admin       | `App-SuperAdmin`    | sidebar+topbar           | admin super-admin 12              | 1440x940 |
| web-student           | `App-Student`       | sidebar/topbar (learner) | student B2B subset                | 1440x940 |
| web-parent            | `App-Parent`        | sidebar/topbar           | parent ⚠GAP→generate              | 1440x940 |
| mobile-family         | `App-MobileFamily`  | bottom tab-bar           | student+parent (phone)            | 390x844  |
| mobile-staff          | `App-MobileStaff`   | bottom tab-bar           | teacher+admin (phone)             | 390x844  |
| mobile-scanner        | `App-MobileScanner` | linear/minimal           | scanner ⚠GAP→generate             | 390x844  |

## The SPA card contract (every app card)

- `@dsCard group="App-<Name>" viewport="<W>x<H>" name="<App> — App" subtitle="Interactive SPA · hash-routed"`
  on line 1.
- Self-contained: links ONLY `../../styles.css` + `../../_ds_bundle.js` (the
  compiled component lib) + React/Babel/lucide CDN, exactly like the screen
  cards. Components from `window.LvlupV0DesignSystem_5d0725`.
- **App shell** persists across routes: web = `Sidebar` (role nav groups) +
  `Topbar` (tenant switcher, search, notifications, profile); mobile = bottom
  `Tabbar` (3–5 primary tabs) + lightweight top bar.
- **Hash router**: small inline React router on `window.location.hash`
  (`#/dashboard`, `#/exams`, `#/exams/:id/grade`). Sidebar/tab items set the
  hash; active state reflects the route. Deep/detail screens (item-editor,
  grading-review) = sub-routes or drawers/modals over the parent view.
- **Views** = the screen bodies, reused from the existing
  `build/prototypes/<area>/<slug>.card.html` cards (lift the inner markup into a
  view component; don't re-author from scratch). Not every one of 57 screens
  must be a flat view — model the real **nav hierarchy** from
  `specs/webapps-design.md` per-app route manifests: primary nav destinations
  are views; detail screens are sub-routes/modals; rarely-used ones can be stubs
  that link.
- **Role**: web-teacher/admin/super-admin/student/parent each render their
  role's nav only. Merged mobile apps (`family`=student+parent,
  `staff`=teacher+admin) include a **role switcher** that swaps the nav set.
- Lyceum only: zero raw hex, no #3B82F6/banned fonts, AA contrast, real lucide
  icons.

## Inputs each assembly session reads

`00-FOUNDATION.md` (nav components, layout) · `CORE-API.md` (component
props/namespace) · `specs/webapps-design.md` (app shell, **per-app route
manifests + page inventories**, nav structure) · `status/routing-appmgmt.md`
(routing/guards/nav patterns) · the area screen cards in
`build/prototypes/<area>/` (view source) · `SPEC-MANIFEST.md` (area→app mapping)
· and (after WAVE A) **`build/app/ASSEMBLY-KIT.md`** (the reference pattern to
copy).

## Execution — ONE SESSION PER APP (8 parallel), each a dynamic workflow + agent team

No reference-gating: spawn **all 8 app sessions** (each Opus 4.8 1M). Each app
is done **separately and in full**. Every session MUST use a **dynamic
Workflow + agent team** internally (e.g. `pipeline`/`parallel`: one agent per
nav-section/view to lay out + assemble, a composer agent to stitch the shell +
hash-router into the single SPA card). All sessions share the SPA card contract
above + `ASSEMBLY-PLAN.md` so the 8 apps stay consistent.

### Per-app deliverables (every session)

1. **COMPLETE ROUTE TREE — figured out, sketched, laid out.** Write
   `build/app/<app>/ROUTE-TREE.md`: the app's full navigation/route hierarchy —
   every nav group, every route + sub-route, every modal/drawer, every flow
   (entry → … → exit) — with **EACH source screen mapped to a node**. This is
   the primary thinking artifact; produce it FIRST.
2. **NO ORPHANS (hard rule).** Every screen in the app's source set MUST appear
   in the route tree as a route, sub-route, tab, modal, or drawer. The session
   must emit an explicit coverage checklist: `<screen> → <route node>` for 100%
   of its screens. Zero unplaced screens. **No component/screen left without a
   tree.**
3. **Interactive SPA card** — `build/app/<app>/App-<Name>.card.html`
   implementing the tree: persistent shell (web sidebar+topbar / mobile
   tab-bar), hash router, all primary views, sub-route/modal detail screens,
   working nav with active states, role switcher for merged mobile apps, and the
   **flows wired** (CTAs/links route correctly). Views lift markup from existing
   `build/prototypes/<area>/*.card.html` (don't re-author screens).
4. **Hand off to S-sync** (`sess_1781936453199_lvd32960o`) for the incremental
   push to `lvlup-v0`.

### The two GAP apps generate their screens first (inside their own session)

- **web-parent / mobile-family** need the **parent** screen set — the parent
  session generates specs → `design/parent/*.md` + cards →
  `build/prototypes/parent/*.card.html` (parent-dashboard, child-progress,
  child-exam-results-released, child-space-progress, announcements,
  multi-child-switcher, notifications, parent-settings) BEFORE building its
  tree + SPA.
- **mobile-scanner** generates the **scanner** screen set (scanner-login,
  select-exam, select-student, camera-capture w/ guide frame, capture-review,
  upload-queue offline/durable, submit-confirm, scan-history, scanner-settings)
  BEFORE its tree + SPA.

### Sync

S-sync pushes each app's `ROUTE-TREE.md` is local-only (reference); it pushes
the `App-*.card.html` SPAs (+ any new parent/scanner screen cards + sources) to
`lvlup-v0` incrementally as each app hands off — user reviews the navigable
apps + their flows in the canvas.

## Notes

- Phase-2 core extensions (DistributionChart/Stepper/Meter…) remain
  independently held; assembly uses screens as-is (inline-composed extensions
  render fine). Promote later, or fold in if convenient.
- No browser/Chromium — static/code verify only; user does visual review in the
  Claude Design UI.
- Sync-safety unchanged: authoring sessions write disjoint paths; only S-sync
  calls DesignSync.
