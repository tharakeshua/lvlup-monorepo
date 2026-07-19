# AIQ-W4 — Chat question surface (Surface C) restyle

Visual-only restyle of the chat-agent interview experience to
`lvlup-ai-questions-design/ai-questions/mobile/chat-question.card.html`. The
conversation **runtime is untouched** — `src/features/conversation/**`
(controller / reducer / operations / persistence / ProjectionSync) was not
modified, and every behavior contract (server-authoritative lifecycle,
retry/resume, `allowedActions` gating, exactly-once finish, no generic
check-answer) is preserved.

## Files changed (presentation layer only)

`apps/mobile-student/src/components/conversation/`

- **ConversationTranscript.tsx** — no-avatar bubbles: learner = `bg-brand`
  right-aligned `rounded-br-sm` tail; assistant = `bg-surface` + border
  left-aligned `rounded-bl-sm` tail (max-w 82%). Sending shows a mono `2xs`
  "Sending…" meta below the bubble; failed keeps the inline retry block. Typing
  indicator = three **breathing dots** (Reanimated `withRepeat` +
  `EASE.standard` / `DURATION.slow`) in a surface bubble + "…is working on this
  turn" meta. Bubbles **spring in** (`FadeInDown` learner / `FadeIn` assistant,
  `EASE.entrance`, `.reduceMotion(REDUCE_MOTION)`).
- **ConversationComposer.tsx** — `border-strong` rounded-lg row, `arrow-up` send
  button, centered mono "Sent only when you choose Send" meta. Sealed strip =
  dashed border + lock, centered.
- **ConversationModeHeader.tsx** — mono/brand eyebrow, display title, shield
  banner, **Scenario** card (map icon), **What to cover** card (compass + mono
  objective count + `target` hye-chips), full-width **starter** rows (sparkles)
  that pre-fill the composer via `controller.setDraft`.
- **ConversationScaffold.tsx** — mono `Progress · N of M turns` row + Finish
  interview affordance; early-finish modal copy aligned to design ("Finish &
  grade" / "Keep talking"). **New optional `hideHeader?: boolean`** prop
  (default false) so hosts that render their own header (W5's discuss sheet) can
  suppress the internal ModeHeader.
- **ConversationStatusCard.tsx** — token pass (rounded-lg, calm tints) for the
  finalizing → grading-pending → grading-failed states.
- **ConversationResult.tsx** — verdict card: circle-check header + score,
  `pctbar` (score %), **Key takeaway** (spark left-border, mono label, display
  body), **Feedback** list (sprout head; strengths=`check`/success,
  growth=`move-up-right`/warning), progress banner (`trending-up`), dashed
  **sealed** strip. Reads `summary` object|string, `strengths[]`,
  `weaknesses[]`, `percentage`, `progressApplied`.

`src/components/questions/ChatAgentQuestion.tsx` — **no change needed**; the
thin adapter already delegates to the restyled `ConversationScaffold`.

Shared tokens consumed from W1's `src/components/ai-question/tokens.ts`
(`DURATION`, `EASE`, `REDUCE_MOTION`) — not forked. Colors via `src/theme`
(`colors`/`palette`) + NativeWind classes.

## Gates

- `tsc --noEmit`: **0 errors**.
- Conversation reducer suite
  (`src/features/conversation/__tests__/reducer.test.ts`): **6/6 green**
  (baseline and after).
- `expo export --platform android`: **bundled OK** (mountability).
- Live headless verification (student.test@subhang.academy, AI Assessment Lab →
  "The Interview Room (Live Mock Interview)", `chat_agent_question`):
  screenshots in `apps/mobile-student/screenshots/aiq-w4/`. Captured the
  restyled intro (eyebrow/scenario/what-to-cover chips/starters), the mono
  progress row + Finish button, active transcript (assistant surface bubble +
  learner `bg-brand` bubble), the "Sending your reply" status card + mono
  "Sending…" meta, a real interviewer follow-up turn completing live, and the
  restyled failed/retry state. Script: `scripts/aiq-w4-chat-shots.mjs`
  (headless; static `dist` served via `scripts/static-serve.mjs`).

## Pending / notes

- **Completed result verdict card** and the **breathing typing indicator** are
  implemented and gate-green but a _clean_ live capture is pending — the live
  test sessions from repeated navigations were left in a dirty
  resumed/send-failed state (real runtime behavior, not a styling regression),
  and reaching a fully-graded interview needs 6 live LLM turns. Can capture on a
  fresh session when useful.
- Reanimated is already the app-wide motion driver (W1's ai-question
  components + `tokens.ts`), so the chat motion is consistent and web-safe.
