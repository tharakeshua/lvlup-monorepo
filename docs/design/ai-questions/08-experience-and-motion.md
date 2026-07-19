# 08 · Experience, Motion & Delight — requirements

**Owner mandate:** the UI must be _excellent_ — beautiful, creative, innovative,
magical, futuristic — with **delightful feedback effects and motion**. Answering
and interacting with a question should be **enjoyable, fun, and responsive**.
There must be a **shared visual/motion palette** for all actions (uploading
images, recording, attaching, submitting, receiving feedback) so the whole thing
feels like one crafted system. This is a first‑class requirement, not
polish‑if‑time.

This doc defines that experience layer. It applies to **every** surface in
[07-design-surfaces.md](07-design-surfaces.md) and every type in 01–06. Claude
Design should treat motion and feel as part of the spec, not an afterthought.

---

## 1. Experience principles

1. **Responsive & alive.** Every tap, every state change acknowledges the user
   within ~100ms with motion/haptics. Nothing feels dead or laggy. Optimistic UI
   wherever safe.
2. **Enjoyable & fun.** Micro‑interactions reward action — a satisfying record
   pulse, a smooth part‑card fly‑in, a celebratory but tasteful feedback reveal.
3. **Magical & futuristic — within Lyceum.** The wow comes from _motion, light,
   and craft_, not from breaking the warm scholarly palette. Think "an
   intelligent surface that responds to you," not neon sci‑fi. Subtle gradients,
   soft glows (the `SpaceCover` radial‑glow motif already exists), fluid
   transitions, tasteful particle/shimmer accents at key moments.
4. **Cohesive action palette.** All actions share one motion + color vocabulary
   (see §3). Uploading an image, recording audio, and submitting an answer
   should feel like members of the same family.
5. **Calm, not chaotic.** Delight is restrained and purposeful. Motion guides
   attention and confirms outcomes; it never blocks, never nauseates, always
   respects reduced‑motion.

---

## 2. Signature moments (design these to feel special)

- **The Evaluating state (~8s)** — the brand's hero moment. A living, "thinking"
  animation: the answer gently lifts/settles as read‑only; an intelligent
  shimmer or aurora sweeps in indigo; rotating rubric‑aware hints fade through.
  It should make 8 seconds feel considered, even anticipated. (Surface F.)
- **The Feedback reveal (Surface G)** — a choreographed entrance: verdict +
  score animate in first, then the percentage bar _fills_, then rubric bars
  stagger‑fill, then sections cascade. Positive verdicts get a tasteful
  celebration (confetti/spark burst in marigold + brand — restrained). Growth
  verdicts get a warm, encouraging entrance, never a harsh red slam.
- **Score & rubric bars** — animate from 0 to value with easing; mono numerals
  tick up. Deeply satisfying.
- **Adding a part** (image/audio) — the part‑card **flies into the stack** with
  a soft spring; a subtle glow confirms upload success; failure shakes gently
  and offers retry.
- **Record control** — idle → recording is a live, breathing pulse with the
  level meter feeding a fluid waveform; stopping snaps to a crisp preview card.
- **Focus mode entry** — the composer **expands to full screen** with a smooth,
  physical transition (the page "opens up"); exiting collapses back. This is the
  "freedom to write" moment — make it feel like clearing your desk.
- **Submit** — the button gives a confident press response + haptic, morphs into
  the evaluating state (shared element, not a jarring screen swap).
- **Send a chat message** (chat question + discuss layer) — bubble springs in
  from the composer; assistant "typing/turn‑active" is a lively, characterful
  indicator.

---

## 3. The shared action palette (one system for all actions)

A single vocabulary every action draws from, so uploading, recording, attaching,
discussing, and submitting all feel related.

- **Color roles for actions:** brand indigo `#423A82` = primary/commit actions
  (submit, send); spark/marigold `#E8972B` = capture/create actions (record,
  camera, add) and celebration accents; success/warning/error retain their
  semantic roles for outcomes. Define one **action‑accent gradient** (indigo →
  indigo‑400, with an optional marigold spark) reused across capture
  affordances, progress fills, and the evaluating aurora.
- **Motion primitives (define once, reuse):**
  - _Press:_ scale‑down 0.97 + subtle brightness, spring back.
  - _Enter:_ fade + rise 8–12px with spring (part‑cards, feedback sections,
    bubbles).
  - _Fill:_ eased 0→value for bars/rings, ~600–900ms.
  - _Pulse:_ breathing loop for active/recording/thinking states.
  - _Shimmer/aurora:_ the signature "AI is thinking" sweep.
  - _Celebrate:_ restrained spark/confetti burst on strong success.
  - _Shake:_ short horizontal shake for errors/failed uploads.
- **Haptics:** light on tap/attach, medium on submit, success notification on
  positive feedback, warning on error. (Expo Haptics.)
- **Timing & easing:** standardize a small set (fast 120ms, base 240ms,
  expressive 400–600ms; spring for physical moves, ease‑out for reveals). One
  easing token set for the whole feature.
- **Iconography & shape:** consistent capture/action icons, consistent pill/card
  radii from the Lyceum scale; consistent glow treatment.

---

## 4. Per‑surface motion notes

| Surface          | Signature motion                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| A · Answer page  | capability affordances gently invite (subtle idle motion); part‑cards fly in; prompt collapses smoothly as you write |
| B · Focus mode   | physical full‑screen expand/collapse; word‑count breathes near target                                                |
| C · Code editor  | smooth dark‑surface transition; starter code settles in                                                              |
| D · Audio        | breathing record pulse; live waveform; crisp stop→preview                                                            |
| E · Image        | camera/library sheet; captured tile springs onto the board; tap‑to‑zoom hero transition                              |
| F · Evaluating   | the aurora/thinking hero; rotating hints; answer lifts read‑only                                                     |
| G · Feedback     | choreographed cascade; bars fill; tasteful celebration on success                                                    |
| H · History      | attempts list in; improving‑trend spark                                                                              |
| I · Discuss chat | drawer springs up; bubbles + typing indicator                                                                        |
| J · Pure chat    | lively turn‑active indicator; bubbles spring; completion result reveal                                               |

---

## 5. Responsiveness & performance

- Interactions acknowledge within ~100ms; use optimistic UI for attach/send.
- Motion runs on the native driver (Reanimated) — 60fps, never blocks
  JS/network.
- Never let network latency freeze the UI: uploads and submits animate
  independently of their promises.
- Skeletons/placeholders for any load, never blank flashes.

## 6. Accessibility & guardrails (non‑negotiable)

- **Respect `prefers-reduced-motion`** — provide calm cross‑fades instead of
  large movement; celebrations reduce to a quiet state change. Nothing essential
  is conveyed by motion alone.
- No flashing that risks photosensitivity.
- Delight never delays: a user can always proceed without waiting for an
  animation to finish.
- All the color/motion still meets contrast and icon+label redundancy from
  [00 §7](00-cohesive-experience.md#7-cross-cutting-states).

## 7. Suggested tech (for implementation, later)

`react-native-reanimated` (motion), `expo-haptics` (haptics),
`@shopify/react-native-skia` or SVG for the aurora/shimmer + waveform,
`lottie-react-native` for a couple of signature loops if desired. Not binding on
Claude Design — but design with these capabilities assumed available.

---

**For Claude Design:** treat this doc as part of every surface's spec. Deliver
the resting layout **and** describe the entrance/interaction/feedback motion for
each state, drawing from the one shared action palette (§3). Beautiful,
creative, magical — inside the warm Lyceum world.
