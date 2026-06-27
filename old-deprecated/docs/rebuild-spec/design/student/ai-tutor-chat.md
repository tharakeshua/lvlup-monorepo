# AI Tutor Chat — Socratic Tutor

> **Lyceum** design system spec (Direction A — "Modern Scholarly"). Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not invent colors/fonts/spacing/radii/shadows/motion or component variants.
> Student tone: warm, patient, encouraging mentor — asks guiding questions,
> never hands over answers.

---

## 1. Purpose & primary user

**Primary user:** the **learner** — a B2B school **student** (role `student`,
tenant-scoped) _or_ a B2C **consumer** learner (no membership, served from the
synthetic `platform_public` tenant). One surface, two data sources, identical
UX.

**Job-to-be-done:** _"I'm stuck on this question / concept — help me figure it
out myself without just telling me the answer."_ The tutor is a **Socratic**
mentor: it asks guiding questions, surfaces the next small step, and nudges the
learner toward their own insight. It is keyed to a specific content **item**
(the question or material the learner is looking at) so it always has context,
and supports **multiple chat sessions per item** so a learner can keep distinct
threads ("the recursion one", "why my answer was marked partial").

Two presentations of the same conversation:

1. **Floating `ChatTutorPanel`** — a docked panel anchored bottom-right inside
   the learning view (`StoryPointViewer`, `PracticeMode`), keyed live to the
   current item.
2. **Full chat page/route** — a fuller, focused conversation surface (session
   list + thread) for when the learner wants to sit with the tutor, reachable
   from the dashboard and from "Open in full view" inside the panel.

The emotional job: make asking for help feel **safe and encouraging**, never
like admitting failure. The tutor celebrates effort ("Nice — you're really
close") and reframes mistakes as steps ("Let's look at that part again
together").

---

## 2. Entry points & route

**Floating panel** (no route of its own — overlays the learning view):

- "Ask the tutor" / `TutorChatBubble` trigger inside `StoryPointViewer`
  (`/spaces/:spaceId/story-points/:storyPointId`) and `PracticeMode`
  (`/spaces/:spaceId/practice/:storyPointId`), keyed to the active `itemId`.
- Inline `chat_agent_question` item type (the tutor _is_ the question) embeds
  the same composer + thread.
- **Never** mounted inside a live `TimedTest` runtime (see §8).

**Full chat page:**

- **Route (B2B):** `/tutor` and `/tutor/:itemId` (deep-link to an item's
  threads).
- **Route (B2C):** `/consumer/tutor`(`/:itemId`) — same page component, resolved
  through `LearnerContext` (data source tenant vs `platform_public`); route on
  context, not path prefix (`webapps-design.md` §5.2). _(This wires up the
  currently-unrouted `ChatTutorPage` — `app-student-web.md` §4 dead-pages.)_
- Entry: Sidebar "Tutor", dashboard "Ask your tutor" card, "Open in full view"
  from the floating panel, CommandPalette (⌘K) "Ask the tutor…".

**Reads** (via `@levelup/api-client` `ChatRepo` + realtime seam — UI never
touches Firestore directly):

- `ChatRepo.listItemSessions({ itemId })` → `ChatSession[]` for this item
  (ordered `updatedAt` desc), each with a message preview + count — powers the
  session list. Standardized on `userId` ownership (`ai-spec.md` §5.3; resolves
  the `studentId`/`userId` rules mismatch).
- `ChatRepo.getSession({ sessionId })` → full `ChatSession` with `messages[]`
  and `learningInsights` metadata.
- **Streaming subscription** (realtime-contract seam, `common-api.md` §9):
  `subscribe('chat.turnStream', { sessionId, turnId }, cb)` delivers incremental
  tutor tokens (SSE / Gemini streaming) for the typing UX. RN and web subscribe
  identically.

**Writes:**

- `v1.levelup.sendChatMessage` → posts the learner turn and streams back the
  Socratic reply (default model, temp 0.7). Server runs the three-call model:
  `ai.chat.sendTurn` (reply), `ai.chat.summarize` (history > 20 messages, cached
  on session), and fire-and-forget `ai.chat.extractSignals` →
  `learningInsights.{conceptsTouched, masterySignals, struggleSignals}` (which
  feed C10 insights). Sending with no `sessionId` creates a new session.
- **Pre-LLM safety gate:** every turn passes `ai.safety.moderate` (regex
  pre-filter + model pass) server-side _before_ the LLM call; the durable
  per-user abuse limiter (50 msg/hr, `ai-spec.md` §2.6/§8) is enforced
  server-side. The client surfaces the verdict (§5 error/blocked states) but
  never decides it.

---

## 3. Layout — wireframe-as-text

References `AppShell` (`shared-ui/layout`) for the full-page route; the floating
panel overlays on top of whatever learning page is mounted.

### 3.1 Floating `ChatTutorPanel` (web, inside learning view)

```
                                              ┌─ Panel (e1→e2 on focus, radius.lg, bg.surface,
                                              │   border.subtle), anchored bottom-right,
                                              │   width ~384px, height min(500px, 70vh) ─┐
                                              │  HEADER  [Bot]  AI Tutor   [Sessions(n)]  │
                                              │          ……………………………… [⤢ full] [– min] [✕]│
                                              ├───────────────────────────────────────────┤
                                              │  THREAD (scroll, role="log",               │
                                              │    aria-live="polite")                     │
                                              │    ┌ tutor TutorChatBubble (left) ┐         │
                                              │    └────────────────────────────┘          │
                                              │              ┌ learner bubble (right) ┐     │
                                              │              └───────────────────────┘      │
                                              │    ┌ tutor … typing indicator ┐             │
                                              ├───────────────────────────────────────────┤
                                              │  COMPOSER  [Textarea ………………] [Send ▸]      │
                                              │  helper: "Guides you — won't give answers"  │
                                              └───────────────────────────────────────────┘
```

- **Minimized:** collapses to a single `TutorChatBubble`-styled pill ("AI
  Tutor", `Bot` icon, `spark`-tinted dot if an unread streamed reply arrived)
  bottom-right, e2. Tap to restore.
- **Session-list view** (in-panel, replaces thread): "New session" button + list
  of `ChatSession` rows (message count + last-message preview), active row
  marked with `brand.primary` left border + `indigo-50` fill. Header swaps title
  for a "‹ Back" affordance.

### 3.2 Full chat page (`/tutor`)

`AppShell` with content region split:

```
┌ AppShell: Sidebar | Topbar ─────────────────────────────────────────────┐
│ ┌ Sessions rail (lg: 280px) ─┐ ┌ Conversation column (reading ~720) ────┐│
│ │ [＋ New conversation]        │ │ HEADER: item context chip + AnswerKey- ││
│ │ ── Threads ──                │ │   Lock note ("answers stay hidden")    ││
│ │ ◦ session row (preview,      │ │ ────────────────────────────────────── ││
│ │   count, updated)            │ │ THREAD (role="log", aria-live)         ││
│ │ ◦ active (indigo-50 fill)    │ │   tutor / learner TutorChatBubbles      ││
│ │ ◦ …                          │ │   typing indicator                      ││
│ │                              │ │ ────────────────────────────────────── ││
│ │                              │ │ COMPOSER: Textarea (auto-grow) + Send   ││
│ └──────────────────────────────┘ └─────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg ≥ 1024:** full page = two columns (sessions rail + conversation).
  Floating panel = docked bottom-right, width 384.
- **md 768–1023:** sessions rail collapses to a "Threads (n)" Popover/Sheet
  trigger above the conversation; conversation goes full content width. Floating
  panel keeps docked behavior.
- **sm < 768 (mobile):** the floating panel becomes a **full-screen `Sheet`**
  (`shared-ui/primitives`) sliding up from the bottom; the full page is a single
  column with a top "Threads" Sheet trigger. Composer pinned to the bottom
  safe-area; on keyboard open, thread scrolls to keep the latest turn visible.
  Page gutters per FOUNDATION §4 (mobile 16).

Spacing uses gap utilities (FOUNDATION §4): thread gap `3`(12px) between turns,
composer padding `3`, header padding-x `4`/y `3`.

---

## 4. Components used (FOUNDATION §5)

**Domain:**

- `TutorChatBubble` — the tutor/learner message bubble (role-styled: tutor left
  on `bg.surface-sunken`, learner right on `brand.primary`/`text.on-accent`).
  Renders message body through `ContentRenderer` (Markdown + KaTeX) so the tutor
  can show formatted/math guidance.
- `AnswerKeyLock` — the server-only guard visual; shown in the full-page header
  and as an inline reassurance line in the empty state, making the absence of
  answers legible ("Answers stay hidden — I'll help you find them").
- `InsightCard` _(full page, optional)_ — surfaces `learningInsights` ("Concepts
  we touched", "What clicked", "Where to revisit") _after_ a session has
  signals, on the conversation header.

**Navigation / containers:**

- `AppShell`, `Sidebar`, `Topbar`, `Tabbar` (mobile), `CommandPalette` —
  full-page chrome.
- `Drawer`/`Sheet` — mobile full-screen panel; **Panel** primitive — the
  floating web panel.
- `Popover` — md "Threads" session-list trigger.
- `Card` — session rows; `Tooltip` — icon-button labels.

**Primitives / data / feedback:**

- `Textarea` — the composer (auto-grow, Enter-to-send / Shift+Enter newline).
- `Button` (primary "Send" as `IconButton`; `ghost` for header actions;
  `secondary`/`outline` "New conversation"), `IconButton`
  (minimize/close/full-view).
- `Badge`/`Chip` — item-context chip ("Q3 · Recursion"), session message count.
- `Skeleton` — thread + session-list loading.
- `EmptyState` — no-messages / no-sessions.
- `InlineAlert`/`Banner` — moderation-blocked + rate-limited notices.
- `Toast` (sonner) — transient send failures with retry.
- `Avatar` / `Bot` glyph — tutor identity marker on tutor bubbles.

**Proposed FOUNDATION additions:**

- **`StreamingDots` / typing indicator** — a small three-dot "tutor is
  thinking/typing" affordance used while the reply streams. The current code
  hand-rolls bouncing dots; it should be promoted to a named,
  reduced-motion-aware foundation micro-component (subtle motion only — NOT a
  celebratory burst) so web and RN render identically. Flagging it rather than
  inventing a variant silently.

_(No new colors/fonts/radii/shadows are introduced; everything else composes
from §2/§3/§4.)_

---

## 5. States

- **Loading (skeleton):** session list → 3–4 `Skeleton` rows; thread → 2 muted
  bubble `Skeleton`s. `bg.surface`/`border.subtle`; no spinner-on-blank.
- **Empty — no messages (fresh session):** centered `EmptyState` — `Bot` glyph
  (in `brand.primary` at low opacity), Fraunces title "Let's work through this
  together", body "Ask me anything about this question — I'll guide you, not
  give it away," plus an inline `AnswerKeyLock` reassurance line. Optional 2–3
  starter chips ("I'm stuck on where to start", "Why was my answer partial?",
  "Explain the idea simply").
- **Empty — no sessions for item:** session list shows only "Start a
  conversation" with the same warm framing.
- **Partial / streaming:** learner turn appears immediately (optimistic, §6);
  tutor bubble shows the `StreamingDots` indicator, then fills token-by-token
  via the streamed subscription into a live `aria-live="polite"` region.
- **Success:** completed tutor turn renders fully through `ContentRenderer`;
  thread auto-scrolls to the latest (unless the learner has scrolled up — then a
  "↓ New reply" affordance appears instead of yanking them down).
- **Error — send failed (network/transport):** the optimistic learner bubble
  gets a subtle `status.error` left-edge + "Couldn't send — Retry" affordance;
  `Toast` mirrors it. Message text is preserved in the composer/bubble so
  nothing is lost.
- **Error — moderation blocked:** `InlineAlert` (`status.warning`, not
  `status.error` — non-punitive) above the composer: "Let's keep things focused
  on your learning — try rephrasing your question." The blocked turn is not
  added to the thread.
- **Error — rate-limited (abuse limiter):** `InlineAlert` (`status.info`):
  "You've asked a lot of great questions! Take a short breather and I'll be
  ready again soon." Composer disabled with a soft countdown if the server
  returns one.
- **Permission / role-gated:** B2B student vs B2C consumer differ only in data
  source (`LearnerContext`); copy and chrome identical. The tutor is **disabled
  and visually absent** during any active timed test (§8). Consumer learners on
  `platform_public` see the same tutor for store/enrolled spaces.

---

## 6. Interactions & motion

- **Open / close panel:** Panel enters with a `motion.base` (220ms)
  `ease.entrance` slide-up+fade; exits `motion.fast` `ease.exit`. Mobile `Sheet`
  uses the same tokens. On open, **focus moves to the composer `Textarea`**; on
  close, focus returns to the trigger.
- **Send:** Enter (no Shift) or the Send `IconButton`. The learner bubble is
  **optimistically appended** instantly (`motion.fast` fade-in) and the composer
  clears; Send disables while a turn is in flight. On server reject
  (moderation/rate-limit), the optimistic bubble is rolled back into the error
  state (§5) — no silent loss.
- **Streaming reply:** tutor `StreamingDots` appear (subtle looped opacity,
  `motion.base`), then text streams in. New tokens append without layout jank;
  the `aria-live` region announces the settled reply (not every token — see §9).
- **Switching sessions:** selecting a session row cross-fades the thread
  (`motion.fast`); active row marked with `brand.primary` border + `indigo-50`
  fill.
- **New conversation:** clears `activeSessionId`; first sent message creates the
  session server-side and the row appears in the rail (`motion.fast`).
- **Confirmations:** none required for sending. _No destructive delete in v1_;
  if a "clear conversation" is added later it routes through `ConfirmDialog`.
- **Motion discipline:** this surface gets **no `CelebrationBurst`** —
  celebratory `spark` motion is reserved for gamification
  (XP/streak/level-up/achievement, FOUNDATION §4). The tutor stays calm and
  subtle throughout. All motion respects `prefers-reduced-motion` (streaming
  dots → static "Thinking…"; slides → instant).

---

## 7. Content & copy

Warm, patient mentor — guiding questions, effort-celebrating, never cold.

- **Panel title:** "AI Tutor". **Full-page title (Fraunces):** "Your tutor".
- **Composer placeholder:** "Ask your tutor anything…"
- **Composer helper (always visible):** "I guide you to the answer — I won't
  just give it away."
- **Empty (no messages) title:** "Let's work through this together"
- **Empty body:** "Ask me anything about this question — where you're stuck,
  what's confusing, or how to start. I'll ask the right questions to help you
  get there yourself."
- **AnswerKeyLock line:** "Answers stay hidden — that's on purpose. The win is
  _you_ figuring it out."
- **Starter chips:** "I'm not sure where to start" · "Why was my answer marked
  partial?" · "Explain this idea simply" · "Give me a hint, not the answer"
- **Sessions header:** "Threads" / "New conversation".
- **Session row preview:** last message text (truncated) + "{n} messages".
- **Typing indicator (reduced-motion text):** "Tutor is thinking…"
- **Send failed:** "Couldn't send that — Retry" (toast: "Hmm, that didn't go
  through. Tap retry.")
- **Moderation blocked:** "Let's keep this focused on your learning — try
  rephrasing your question."
- **Rate-limited:** "You've asked a lot of great questions! Take a short
  breather — I'll be ready again in a moment."
- **Insights (post-session, optional):** "What we touched" · "Where to revisit"
  — framed as next steps, never grades.

Tone rule: when the learner is wrong, the tutor reframes ("Let's look at that
part again" / "You're close — what happens if…"), never "Wrong" / "Incorrect".

---

## 8. Domain rules surfaced

- **Socratic — never hands over the answer.** The tutor guides with questions
  and hints; it must **never reveal the stored correct answer** for an
  assessment item. The system prompt (`tutor.v1`) enforces this server-side; the
  UI reinforces it with the always-visible composer helper and the
  `AnswerKeyLock` reassurance line.
- **Answer-key is server-only and unreadable by clients.** Correct answers live
  in the server-only `answerKeys` subcollection denied by `firestore.rules` to
  all clients — the tutor surface physically cannot read them and never displays
  them. `AnswerKeyLock` makes that absence legible.
- **Pre-LLM safety / moderation gate.** Every turn is moderated server-side
  _before_ the LLM call (`ai.safety.moderate`: regex pre-filter + model pass;
  verdict persisted). The client renders the verdict (warning/blocked) but never
  makes the safety decision.
- **Abuse rate-limit is server-authoritative.** The durable per-user limiter (50
  msg/hr) lives server-side (Firestore/Redis), not in client memory; the UI only
  reflects a returned limit.
- **No tutor during a live timed test.** The tutor is disabled/absent inside the
  `TimedTest` runtime so it can't be used to extract help on a graded, timed
  assessment. Post-submission, the learner may ask the tutor about the item
  (still no answer key).
- **Tenant isolation / context.** Sessions are read tenant-scoped
  (`tenants/{tenantId}/chatSessions`) for B2B; B2C reads come from
  `platform_public` + `user.consumerProfile` via `LearnerContext`. Ownership
  standardized on `userId` (schema + rules aligned, `ai-spec.md` §5.3).
- **All data through `@levelup/api-client`.** `ChatRepo` reads +
  `v1.levelup.sendChatMessage` writes; responses Zod-validated, timestamps
  normalized to epoch-ms at the repo edge. UI never touches `firebase/firestore`
  (replaces the inline path strings in today's `useChatTutor.ts`).
- **Learning signals (C7 → C10).** `learningInsights` extracted per session feed
  the insights pipeline; surfaced here only as encouraging next-steps, never as
  scores or judgments.

---

## 9. Accessibility

- **Roles / live region:** thread is `role="log"` `aria-live="polite"`
  `aria-atomic="false"`. Stream tokens into a buffer and announce the
  **settled** reply (or coarse chunks), not every token, to avoid screen-reader
  spam. Typing indicator announces "Tutor is thinking" once.
- **Focus management:** opening the panel/Sheet moves focus to the composer;
  closing returns focus to the trigger. Switching to the session-list view moves
  focus to "New conversation"; selecting a session returns focus to the
  composer. Focus is trapped within the mobile full-screen `Sheet` (Esc closes,
  returns focus).
- **Keyboard:** Enter = send, Shift+Enter = newline, Esc = close/minimize.
  Session rows are real `button`s, arrow-navigable in the rail; Send and all
  header icon-buttons reachable in a logical tab order (composer → Send → header
  actions).
- **Labels:** every icon-button has an `aria-label` ("Send message", "Minimize
  chat", "Close chat", "Open in full view", "Show threads"). Tutor vs learner
  turns are distinguished by an accessible name ("Tutor said…", "You said…"),
  not color alone.
- **Contrast:** tutor bubble (`text.primary` on `bg.surface-sunken`) and learner
  bubble (`text.on-accent` on `brand.primary`) meet WCAG AA; status notices pair
  icon + label (never color-only). `ContentRenderer` math/code inherit
  AA-compliant pairs.
- **Reduced motion:** `prefers-reduced-motion` replaces streaming dots with
  static "Thinking…", disables slide/cross-fade (instant), and disables
  auto-scroll yank (uses the "New reply" affordance). No celebratory motion
  exists here to suppress.
- **Targets:** all interactive controls ≥44px touch target (FOUNDATION §4).

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Container:** web = docked floating **Panel** (bottom-right, 384px) +
  two-column full page → mobile = full-screen **`Sheet`** sliding from bottom +
  single-column page with a "Threads" Sheet trigger.
- **Session list:** web rail (lg) / Popover (md) → mobile Sheet-over-Sheet or a
  top segmented "Threads" trigger.
- **Input affordances:** hover header actions → press; Tooltips (web) → omitted
  on mobile (labels via `aria-label`). Enter-to-send on web; mobile shows an
  explicit Send button (Return inserts newline on soft keyboards).
- **⌘K CommandPalette** present on web ("Ask the tutor…"), absent on mobile —
  entry via bottom `Tabbar` "Tutor" + in-view trigger.
- **Streaming transport identical:** both subscribe via the same
  `subscribe('chat.turnStream', …)` realtime seam (SSE / Firestore listener);
  only the renderer differs (`shared-ui` vs `ui-native`), component
  **names/props match 1:1**.
- **Keyboard insets:** mobile pins the composer to the safe-area and reflows the
  thread on keyboard open; web has no such concern.

---

## 11. Claude-design prompt

```
Design the "AI Tutor Chat" screen for the Auto-LevelUp STUDENT (learner) web app,
strictly conforming to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md (Direction A — "Modern Scholarly").
Do NOT invent colors, fonts, spacing, radii, shadows, motion, or component
variants — compose only from FOUNDATION §2/§3/§4/§5 and cite tokens by semantic
name (bg.surface, bg.surface-sunken, bg.canvas, text.primary, text.on-accent,
brand.primary, spark, border.subtle, border.focus, status.warning, status.info,
status.error, radius.lg/md/pill, e1/e2, motion.base/fast, ease.entrance/exit).
Fonts: Fraunces (display titles/empty-state), Schibsted Grotesk (UI/body/labels),
Spline Sans Mono (any numerics/IDs).

Build TWO presentations of one Socratic tutor conversation:
1. A docked floating ChatTutorPanel (bottom-right, ~384px, height min(500px,70vh))
   that overlays the learning view, keyed to a content item — with a minimized
   pill state and an in-panel session-list view.
2. A full chat page (route /tutor, /tutor/:itemId) inside AppShell: a left
   sessions rail (lg 280px) + a reading-width conversation column.

Use these FOUNDATION §5 domain/components by name: TutorChatBubble (tutor left
on bg.surface-sunken, learner right on brand.primary/text.on-accent; body via
ContentRenderer for Markdown+KaTeX), AnswerKeyLock (reassurance that answers stay
hidden), InsightCard (optional post-session learning signals), AppShell, Sidebar,
Topbar, Tabbar, CommandPalette, Sheet/Drawer, Panel, Popover, Textarea composer
(Enter-to-send, Shift+Enter newline, auto-grow), Button/IconButton, Badge/Chip
(item-context chip), Skeleton, EmptyState, InlineAlert, Toast, Tooltip, Avatar/Bot.
Propose a reduced-motion-aware StreamingDots typing indicator as a FOUNDATION
addition (do not silently invent it).

Behaviors: optimistic learner bubble on send; server-streamed Socratic reply
typed into an aria-live="polite" role="log" thread; multi-session-per-item with a
session list; warm encouraging empty/error copy; moderation-blocked (status.warning)
and rate-limited (status.info) inline notices; subtle motion only (NO CelebrationBurst
— that is gamification-only).

Hard domain rules to honor visually and in copy:
- The tutor is SOCRATIC: it guides with questions/hints and NEVER reveals the stored
  correct answer or answer key. Keep an always-visible composer helper ("I guide you —
  I won't just give it away") and an AnswerKeyLock line.
- The tutor is disabled/absent during a live timed test.
- Safety moderation + abuse rate-limit are server-authoritative; the UI only reflects
  verdicts, never decides them.
Tone: warm, patient mentor; celebrate effort; reframe mistakes as steps ("Let's look
at that again"), never "Wrong".

States to render: loading skeleton, empty (no messages / no sessions), streaming/
partial, success, send-error (retry), moderation-blocked, rate-limited.
Responsive: lg two-column/docked panel; md collapses sessions to a Popover;
sm < 768 → full-screen Sheet + single column, composer pinned to safe-area.
Accessibility: focus to composer on open / back to trigger on close, focus trap in
mobile Sheet, Enter/Shift+Enter/Esc keys, aria-labels on all icon buttons, AA
contrast, prefers-reduced-motion (static "Thinking…", no slide/auto-scroll-yank).
Data flows through @levelup/api-client only (ChatRepo reads + v1.levelup.sendChatMessage
write + a chat.turnStream realtime subscription) — never touch Firestore in the UI.
```
