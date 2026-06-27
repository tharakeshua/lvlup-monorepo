# DesignSync-Ready Card Format — authoring contract (from S-sync / claude-design-syncer)

> Every authoring agent (S-core, S-exams, all wave agents) MUST follow this so
> the single Phase-5 push into `lvlup-v0-design-system` (5d0725a6-…) is clean.
> Conventions are taken from the live `AutoLevelUp Design System` project
> (proven to render in Claude Design). **Design language = Lyceum** (ink-indigo
> `#423A82`, marigold `#E8972B`, Fraunces / Schibsted Grotesk / Spline Sans
> Mono). NO `#3B82F6`, no Plus Jakarta.

## 0. The one constant everyone shares: the namespace

Pick ONE global namespace string and use it identically in `_ds_bundle.js` and
in every card. **Use `LvlUpV0` ** (matches the manifest `namespace` field). The
bundle does `window.LvlUpV0 = { Button, Card, … }`; every card reads
`const { X } = window.LvlUpV0;`.

## 1. The `@dsCard` marker — FIRST LINE of every card file (non-negotiable)

```
<!-- @dsCard group="<Section>" viewport="WxH" name="<Card Name>" subtitle="<short desc>" -->
```

- `group` = the section bucket in the web Design System pane. Convention for
  this build:
  - Foundations → `Type` | `Colors` | `Spacing` | `Brand`
  - Components → `Components` (or finer:
    `Buttons`/`Forms`/`Data`/`Gamification`)
  - Prototype screens → the **app name** (`Exams`, `Student`, `Teacher`,
    `Admin`, `Parent`, `Family`, `Staff`, `Scanner`)
- `viewport` = `WIDTHxHEIGHT` in px. Component cards ~`700x150`–`700x300`; full
  screens `1280x820`/`1280x860`; large flows `1440x940`.
- `name`, `subtitle` = human labels for the card.
- The web pane builds its card index **from these markers** (compiled into
  `_ds_manifest.json` by the app self-check). So **do NOT hand-write
  `_ds_manifest.json`** — the marker IS the registration.

## 2. Card HTML skeleton (component or screen)

```html
<!-- @dsCard group="Components" viewport="700x260" name="Buttons" subtitle="Variants, sizes, states" -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="<REL>/styles.css" />
    <!-- REL = ../../ from components/<cat>/x.card.html; ../../ from prototypes/<app>/x.card.html -->
    <style>
      body {
        margin: 0;
        font-family: var(--font-ui);
        background: var(--bg-canvas);
        color: var(--text-primary);
        padding: 24px;
      }
      /* card-local layout only — never redefine tokens here */
    </style>
    <script
      src="https://unpkg.com/react@18.3.1/umd/react.development.js"
      integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L"
      crossorigin="anonymous"
    ></script>
    <script
      src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"
      integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm"
      crossorigin="anonymous"
    ></script>
    <script
      src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"
      integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y"
      crossorigin="anonymous"
    ></script>
    <script src="<REL>/_ds_bundle.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel">
      const { Button } = window.LvlUpV0;
      function Demo() {
        return (
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="primary">Primary</Button>
            <Button variant="spark">Spark</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        );
      }
      ReactDOM.createRoot(document.getElementById("root")).render(<Demo />);
    </script>
  </body>
</html>
```

Rules: pin the exact React 18.3.1 / Babel 7.29.0 URLs + integrity above (cards
must render fully offline-of-our-server via CDN). The inline `Demo` is JSX
compiled at runtime by babel-standalone. Cards reference components **only** off
`window.LvlUpV0` — never inline component definitions.

## 3. `_ds_bundle.js` (S-core builds ONCE; everyone else imports)

- Plain JS (NOT `text/babel`) — it’s loaded as a normal `<script src>`, so
  pre-compile any JSX (use `React.createElement` or a build step). Must be
  self-contained (no bare ES imports).
- Assigns **all** components to the single global:
  `window.LvlUpV0 = { Button, IconButton, Input, …, SpaceCard, StoryPointTrack, QuestionCard, … }`
  (full §5 inventory from 00-FOUNDATION.md).
- Reads tokens via CSS vars (don’t hardcode Lyceum hex in JS); components
  reference **semantic** tokens only.

## 4. Token / CSS layer (S-core owns `build/tokens/**`, `styles.css`, `components.css`)

- `styles.css` is the single entry every card links; it `@import`s the token +
  font layers in order.
- Two-tier per Lyceum: primitives → semantic; expose as CSS custom properties
  (`--bg-canvas`, `--text-primary`, `--brand-primary`=indigo-600,
  `--spark`=marigold-500, radius `--radius-md:10px`, warm-tinted shadows, etc.),
  with a `.dark` scope.
- `globalCssPaths` (manifest) lists these in load order — S-sync fills this at
  assembly, agents don’t.

## 5. Path partition (parallel-safe — DISJOINT paths per agent)

```
build/tokens/**, styles.css, components.css, _ds_bundle.js   ← S-core ONLY (shared core, built first)
foundations/<slug>.html                                       ← group Type/Colors/Spacing/Brand
components/<category>/<category>.card.html (+ .jsx source)     ← component cards
prototypes/<app>/<screen-slug>.card.html                      ← group="<App>", one self-contained card per screen
```

No two agents write the same file. Nobody writes `_ds_manifest.json`.

## 6. Per-card verification (every authoring agent, before declaring done)

Render the card standalone in headless Chromium (Playwright 1.58.2 + chromium
already installed; Node 25) at its `@dsCard` viewport → screenshot PNG → Read
the PNG → confirm it renders (not blank/thin), variants are visually distinct,
and colors/type match Lyceum tokens → fix & re-render until clean. Only verified
cards go into the push set.

## 7. Push (S-sync ONLY, Phase 5 / Gate E)

S-sync assembles `_ds_manifest.json` (or relies on the self-check), then ONE
`finalize_plan` (globs: `build/tokens/**`, `styles.css`, `components.css`,
`_ds_bundle.js`, `foundations/**`, `components/**`, `prototypes/**/*.html`,
`_ds_*`) → batched `write_files` (≤256/call). No other actor ever calls
DesignSync.
