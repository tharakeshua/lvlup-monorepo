# Auto-LevelUp — Claude Design Orchestration Plan ("Lyceum v0")

> **Status:** ✅ APPROVED by user — handed to coordinator for execution.
> Throughput = **capped waves**. **Planner:** orchestration session
> `sess_1781935078092_91n5sahxr`. **Coordinator (executor):** main Claude Code
> session `sess_1781886414248_znb8ebrt4`. **Every agent in this plan runs on
> Opus 4.8 1M (`claude-opus-4-8[1m]`).**

This is the executable topology for designing the **entire** Auto-LevelUp
platform in claude.ai/design — every screen, every app, web + mobile — as
**interactive prototypes**, all conforming to the **Lyceum** foundation
(`00-FOUNDATION.md`), pushed into the single shared design-system project
**`lvlup-v0-design-system`** (`5d0725a6-7dec-4069-938c-6547540fed7c`).

---

## 0. Locked decisions (from the user interview)

| #   | Decision                        | Choice                                                                                                                                                                                                                                                        |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Design language**             | **Lyceum "Modern Scholarly" (Direction A)** — warm paper + ink-indigo `#423A82` + marigold `#E8972B` spark; Fraunces / Schibsted Grotesk / Spline Mono. **No** SaaS blue. The old `#3B82F6` "AutoLevelUp Design System" is reference-for-file-structure-only. |
| 2   | **Project granularity**         | **ONE shared project** `lvlup-v0-design-system`. Apps are `@dsCard group="…"` sections inside it. One token core, zero drift.                                                                                                                                 |
| 3   | **Platform scope**              | **Web + mobile in one pass** — 5 web apps + mobile (family / staff / scanner) divergent surfaces.                                                                                                                                                             |
| 4   | **Depth**                       | **Interactive prototypes** — **both** in-card interactions (tabs/accordions/drawers/inputs/hover-focus-active) **and** flow-linking of hero journeys.                                                                                                         |
| 5   | **Sequencing**                  | **Start the shared core now**, fan out **exams immediately** (specs ready), pipeline **spaces → admin → student → teacher** as each spec session finishes. Zero idle time.                                                                                    |
| 6   | **Theme / RWD**                 | **Light theme only** for v0 (dark = later pass). Web cards @ desktop (responsive noted), mobile cards @ phone viewport.                                                                                                                                       |
| 7   | **Sync-safety** (planner-owned) | **Parallelize authoring, serialize the push.** N authors write disjoint files; exactly **one** actor (`claude-design-syncer`) ever calls `DesignSync`.                                                                                                        |

---

## 1. Execution model — maestro sessions × (agent teams + dynamic workflows)

**Two tiers, per the user's directive:**

```
TIER 1 — top-level maestro sessions (each = one Claude, Opus 4.8 1M)
   spawned via `maestro session spawn`, coordinated by the main session.
        │
        ▼
TIER 2 — inside each session: a MIX of
   • dynamic workflows  (the Workflow tool: pipeline()/parallel() fan-out over screens)
   • agent teams        (the per-screen agent() calls / maestro team-members it drives)
   …both authoring + self-verifying cards IN PARALLEL on the shared filesystem.
```

The **only** serialized operation across the whole system is the final
`DesignSync` push. Everything else — every session, every workflow, every screen
agent — runs concurrently, because they all write **disjoint file paths** in one
shared build directory.

### 1.1 Top-level session roster — **11 maestro sessions, full parallelization**

10 sessions author + verify concurrently; **1** session (`S-sync`) does the
single serial push. Every authoring session internally runs **a dynamic workflow
whose per-screen `agent()` fan-out IS its Claude agent team** — so parallelism
is multiplicative: ~10 sessions × up to ~14 concurrent screen agents each.

| #   | Session                                                                                                                       | Owns (group / paths)                                                          | Cards | Spawns when                                                   | Internal mechanism (agent team + workflow)                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **S-core**                                                                                                                    | `tokens/**`, `styles.css`, `components.css`, `_ds_bundle.js`, `components/**` | ~60   | **Now** (needs only `00-FOUNDATION.md`)                       | Dynamic workflow: `parallel()` component-author team + 1 core-CSS author; each self-verifies (render→screenshot→Read). |
| 2   | **S-exams**                                                                                                                   | `prototypes/exams/**` + intra-area flows                                      | 16    | **Now** (specs ready) — overlaps S-core, verify trails Gate A | `pipeline(author→verify→critique→linkFlows)` agent team                                                                |
| 3   | **S-spaces**                                                                                                                  | `prototypes/spaces/**` + flows                                                | 26    | When `design/spaces/` specs complete                          | same workflow shape                                                                                                    |
| 4   | **S-admin**                                                                                                                   | `prototypes/admin/**` + flows                                                 | 23    | When `design/admin/` completes                                | same                                                                                                                   |
| 5   | **S-student**                                                                                                                 | `prototypes/student/**` + flows                                               | 18    | When `design/student/` completes                              | same                                                                                                                   |
| 6   | **S-teacher**                                                                                                                 | `prototypes/teacher/**` + flows                                               | 14    | When `design/teacher/` completes                              | same                                                                                                                   |
| 7   | **S-mobile-family**                                                                                                           | `prototypes/mobile-family/**`                                                 | ~14   | After student+spaces verified (reuses their patterns + core)  | workflow + agent team (phone viewport `390x844`)                                                                       |
| 8   | **S-mobile-staff**                                                                                                            | `prototypes/mobile-staff/**`                                                  | ~12   | After teacher+exams verified                                  | workflow + agent team                                                                                                  |
| 9   | **S-mobile-scanner**                                                                                                          | `prototypes/mobile-scanner/**` + scanner capture flow                         | ~9    | After exams verified                                          | workflow + agent team (camera/offline-queue surfaces)                                                                  |
| 10  | **S-flows**                                                                                                                   | cross-area `flows/**` index + hero-journey links                              | ~10   | After areas + mobile verified                                 | single workflow + few agents                                                                                           |
| 11  | **S-sync** = **claude-design-syncer** (`tm_1781934654632_oygy9ptos`, in claude-design session `sess_1781933648080_phvyv61rr`) | `_ds_manifest.json` + **the push**                                            | —     | At Gate E                                                     | **THE ONLY serial step.** Sequential `DesignSync` calls; no other session touches DesignSync.                          |

> **Full parallelization, honestly stated:** the only true ordering constraints
> are physical — (a) a screen can't be authored before its spec file exists (→
> areas spawn as specs land, decision #5), and (b) a card can't be _verified_
> before the shared core exists (Gate A). Everything else runs at once. Sessions
> 1–6 can all be live simultaneously; 7–9 follow their source areas; 10
> consolidates; 11 pushes once.
>
> Large areas (S-spaces 26, S-admin 23) may **spawn sub-sessions** internally or
> widen their agent team if one workflow saturates the `min(16, cores−2)`
> concurrency cap.

### 1.2 Inside a typical area session (the repeatable unit)

Each area session runs **one dynamic workflow** whose body is a `pipeline()`
over its screen list — this fan-out **is** the session's agent team (every
`agent()` = one screen author, all Opus 4.8 1M):

```js
// meta.phases: Author · Verify · Critique · LinkFlows
const screens = SPECS_FOR_AREA; // e.g. exams: 16 spec files
const results = await pipeline(
  screens,
  // STAGE 1 — author: read spec → write prototypes/<app>/<slug>.card.html
  (s) => agent(authorPrompt(s), { phase: "Author", schema: CARD_SCHEMA }),
  // STAGE 2 — self-verify: render @ viewport → screenshot → Read PNG → fix → repeat≤4
  (c) => agent(verifyPrompt(c), { phase: "Verify", schema: VERIFY_SCHEMA }),
  // STAGE 3 — design critique: token-adherence, spacing, variant-distinctness, a11y
  (v) => agent(critiquePrompt(v), { phase: "Critique", schema: VERDICT_SCHEMA })
);
// STAGE 4 — intra-area flow linking (hero journeys within this area)
phase("LinkFlows");
await agent(linkFlowsPrompt(results.filter(ok)));
```

`pipeline()` (not a barrier) means screen A can be in Critique while screen B is
still in Author — wall-clock = slowest single screen, not sum of stages.

---

## 2. Shared build directory (the clobber-free filesystem contract)

All sessions operate on **one** working copy of the repo. Safety comes from
**disjoint paths** — no two agents ever write the same file.

```
docs/rebuild-spec/design/build/
  tokens/
    lyceum.css            # primitives + semantic vars (light theme), §2 of FOUNDATION   [S-core ONLY]
    fonts.css             # @import Fraunces / Schibsted Grotesk / Spline Sans Mono      [S-core ONLY]
  styles.css              # reset + base element styles + token wiring                   [S-core ONLY]
  components.css          # class library: .btn .card .input .badge .table … (§5)        [S-core ONLY]
  _ds_bundle.js           # interaction runtime: tabs, accordion, drawer, flow-nav       [S-core ONLY]
  components/
    <component>.card.html # one showcase card per §5 component                           [S-core team]
  prototypes/
    exams/<slug>.card.html        [S-exams]      spaces/<slug>.card.html     [S-spaces]
    admin/<slug>.card.html        [S-admin]      student/<slug>.card.html    [S-student]
    teacher/<slug>.card.html      [S-teacher]
    mobile-family/<slug>.card.html  mobile-staff/<slug>.card.html  mobile-scanner/<slug>.card.html  [S-mobile]
  flows/
    <journey>.html        # flow index pages linking screens                  [area sessions + S-flows]
  .render/                # transient screenshots + .render-check.json (gitignored)
  _ds_manifest.json       # COMPILED from @dsCard markers — NEVER hand-edited  [S-sync / self-check ONLY]
```

**Ownership rule (the anti-clobber invariant):**

- `tokens/**`, `styles.css`, `components.css`, `_ds_bundle.js` → **written once
  by S-core, read-only for everyone else.** Screen cards `<link>`/`<script>`
  them; they never modify them.
- `prototypes/<app>/**` → owned exclusively by that app's session. Disjoint per
  app, disjoint per screen.
- `_ds_manifest.json` → **hazard #1.** Never written by an author agent.
  Compiled by the self-check / S-sync as the last step. One writer, ever.

### 2.1 The `@dsCard` contract (every card's first line)

```html
<!-- @dsCard group="Exams" viewport="1280x820" name="Grading Review ★" subtitle="HITL cockpit · confidence-routed · keyboard-driven" -->
```

> **Authoritative format = `SYNC-FORMAT.md`** (syncer-owned). Reconciled values:

- `group` = **capitalized** app/area name in the Design System pane: `Exams`,
  `Spaces`, `Admin`, `Student`, `Teacher`, `Parent`, `Family`, `Staff`,
  `Scanner`; plus `Components` (+ category buckets) and
  `Type`/`Colors`/`Spacing`/`Brand` for the core/foundations.
- `viewport` = **`1280x820`** full web screens (`1280x860` if unusually tall),
  **`390x844`** mobile, `700x150–700x300` component cards, `1440x940` large
  flows.
- Card is **self-contained**: imports the shared core, inlines its own screen
  markup, wires interactions via `_ds_bundle.js`, and links flow targets via
  `href`/`data-flow-target`.

---

## 3. Phase ordering & gates

```
PHASE 0  S-core: build + verify the shared Lyceum core (tokens, styles, components.css, _ds_bundle.js, component cards)
            └─ GATE A: core files exist + component cards render clean  ──┐
                                                                          ▼
PHASE 1  Fan out area sessions AS SPECS LAND (decision #5):
            S-exams  (now) ─┐
            S-spaces ───────┤ each runs its pipeline(author→verify→critique→linkFlows)
            S-admin  ───────┤ in parallel; all import the frozen core; disjoint paths
            S-student ──────┤
            S-teacher ──────┘
            └─ GATE B: every web card verified (render-check clean)  ──┐
                                                                       ▼
PHASE 2  S-mobile-family + S-mobile-staff + S-mobile-scanner (3 parallel sessions):
            divergent phone cards + scanner capture/offline-queue flow
            └─ GATE C: every mobile card verified  ──┐
                                                     ▼
PHASE 3  S-flows: cross-area hero-journey linking + flows/ index
            └─ GATE D: all flows navigable end-to-end  ──┐
                                                          ▼
PHASE 4  Manifest assembly: compile _ds_manifest.json from @dsCard markers (single actor / self-check)
            └─ GATE E: manifest = exactly the verified card set  ──┐
                                                                   ▼
PHASE 5  S-sync (claude-design-syncer) — THE ONE SERIAL PUSH:
            verify target is lvlup-v0-design-system + type DESIGN_SYSTEM →
            finalize_plan{ writes: tokens/**, styles.css, components.css, _ds_bundle.js,
                           components/**, prototypes/**/*.html, flows/**, _ds_manifest.json } →
            ONE human confirm → batched write_files (≤256/call, via localPath) → done.
```

**Gate A is hard** (core must exist before any screen can _verify_). S-exams may
begin _authoring_ markup the instant it spawns, but its Verify stage waits on
Gate A. To kill idle time, the coordinator spawns **S-core and S-exams
together**; S-exams' author stage overlaps S-core, its verify stage trails Gate
A.

Gates B–D are **soft within the push**: the single `finalize_plan` only includes
cards that passed render-check. Anything still failing is logged (no silent
truncation) and excluded from this push, queued for the next.

---

## 4. The verification step — STATIC / code-level only (NO browser) [USER-REVISED]

**User directive:** sessions **code, author, and verify** — but verification is
**static / code-level ONLY. No Chromium, no Playwright, no screenshots, no
rendering.** The user does the **visual** review directly in the **Claude Design
UI** after sync. This removes the render bottleneck entirely (so render-load is
no longer a throughput constraint — see §4b).

Each screen agent authors its card, then runs a **static self-check on the
markup/code** (no browser):

```
write prototypes/<app>/<slug>.card.html
   └─ static-verify (read the file, lint the markup):
        • tokens: Lyceum CSS-vars only — zero raw hex, no banned fonts / no #3B82F6
        • structure: valid self-contained HTML, links the shared core, correct @dsCard first line
        • completeness: all spec'd states present in markup; interactions wired via _ds_bundle.js classes/hooks
        • domain rules: AnswerKeyLock hides the key; timer marked server-authoritative; status not color-only
           └─ fix in code if any check fails → clean → emit to push set
```

The dynamic workflow shape is therefore `pipeline(author → static-verify)` (the
`critique`/`linkFlows` stages remain as code-level passes; **no render stage**).
**Visual** QA = the user, in the Claude Design UI.

---

## 4b. Throughput model — CAPPED WAVES (user-approved)

> **UPDATE:** with verification now static (§4, no Chromium), the render-load
> reason for tight capping is **gone** — there is no chromium thundering-herd at
> Gate A. Sessions can fan out more freely; the remaining real limits are the
> **Maestro session-spawn API rate** (pace spawns) and the **single serial
> DesignSync push**. Authoring sessions need only the core _paths_ (not the
> rendered core) to author, so areas can run as soon as their specs exist.

(Original rationale, now largely moot:) sessions spawn in **waves** rather than
all-at-once.

```
WAVE 1  S-core  +  S-exams                         (2 sessions; core verifies, exams authors)
WAVE 2  + up to 2–3 area sessions concurrently,    (spaces / admin / student / teacher —
        spawned as each area's specs land,          never more than ~3 area sessions live
        30–60 s apart                               at once; queue the rest)
WAVE 3  S-mobile-family + S-mobile-staff +          (after their source web areas verify, Gate B)
        S-mobile-scanner  (3 parallel)
WAVE 4  S-flows → manifest assembly → S-sync push   (consolidate → Gate E → the one serial push)
```

Coordinator throttles: **≤ ~3 authoring sessions live simultaneously**, 30–60 s
between spawns, `lsof`/dev-server check before each new wave. A finishing
session frees a slot for the next queued area.

## 5. Concurrency, scale & cost

- **Cards (estimate):** ~60 component + 97 web + ~35 mobile divergent + ~10 flow
  indexes ≈ **~200 cards**, each render-verified.
- **Per-workflow concurrency cap:** `min(16, cores−2)` simultaneous agents;
  `pipeline()` queues the rest. Each area session has its own cap, so
  cross-session parallelism multiplies throughput.
- **Spawn pacing (from memory / prior runs):** add **30–60 s between
  `maestro session spawn`** calls to respect Maestro API rate limits; check the
  dev server / `lsof` isn't being saturated by render processes.
- **No silent caps:** if any card is dropped from a push (still failing after 4
  iterations), it's `log()`-ged by name and carried to the next push — never
  silently omitted.

---

## 6. Sync-safety — the single push, in detail (planner-owned, decision #7)

1. **Only `claude-design-syncer` (`tm_1781934654632_oygy9ptos`) ever calls
   `DesignSync`.** It already holds the claude.ai design-scope login.
2. Pre-flight: `get_project` on `5d0725a6-7dec-4069-938c-6547540fed7c` → assert
   `type: PROJECT_TYPE_DESIGN_SYSTEM` and `canEdit`. (Type is immutable at
   creation; never push to a non-design-system project.)
3. `list_files` → structural diff vs the build dir. **Incremental, never
   wholesale-replace.**
4. `finalize_plan` with **glob writes** (`prototypes/**/*.html`,
   `components/**`, `tokens/**`, `_ds_*`, …), `localDir` = the build dir →
   **one** human confirm.
5. `write_files` in batches ≤256, using **`localPath`** (bytes never enter model
   context).
6. `_ds_manifest.json` is assembled from `@dsCard` markers **before** finalize
   and included in the write set — never edited by N agents.
7. If coverage is ever sharded later (the 80–120-screen fallback), the core
   (`tokens/**`, `components.css`, `_ds_bundle.js`) stays the **one** shared
   source; only prototype sets shard into sibling projects referencing it.
   **Start single.**

---

## 7. Hand-off checklist (planner → coordinator)

The coordinator (`sess_1781886414248_znb8ebrt4`) executes by:

1. **Spawn S-core** (now) → it builds + verifies the shared Lyceum core into
   `build/`. Optionally ping claude-design session
   `sess_1781933648080_phvyv61rr` (offered to author the core token bundle
   first).
2. **Spawn S-exams** (now, in parallel; verify trails Gate A).
3. **Watch the 4 spec sessions**
   (`design-spaces`/`design-admin`/`design-student`/`design-teacher`); **spawn
   the matching area session** the moment each area's specs complete.
4. Each area session runs its `pipeline(author→verify→critique→linkFlows)`
   dynamic workflow (its agent team), all Opus 4.8 1M.
5. **Spawn S-mobile** after the web areas it reuses are verified (Gate B).
6. **Spawn S-flows** for cross-area journeys (Gate C).
7. **Assemble `_ds_manifest.json`** (single actor, Gate E).
8. **Trigger the single push** via `claude-design-syncer` (Phase 5) — one
   `finalize_plan`, one confirm, batched `write_files`.
9. Report completion; surface any cards excluded from the push for a follow-up
   pass.

**Pacing & safety reminders for execution:** 30–60 s between session spawns;
storageState/`lsof` hygiene if render processes pile up; never let two actors
touch `DesignSync` or `_ds_manifest.json`.

---

## 8. Open follow-ups (post-v0, not blocking)

- Dark-theme pass (tokens already define it; re-render every card in dark).
- Responsive intermediate breakpoints (sm/md) beyond desktop+phone.
- Promote any `(proposed)` components surfaced by the specs (e.g.
  `AnswerSheetViewer`, `ExtractionProgress`, `PipelineStatusBadge`,
  `DistributionChart`) into `00-FOUNDATION.md` §5 before their first use.
- Shard prototype sets into `web-prototypes` / `mobile-prototypes` siblings
  **only if** the single pane/manifest becomes unwieldy at ~200 cards.

```

```
