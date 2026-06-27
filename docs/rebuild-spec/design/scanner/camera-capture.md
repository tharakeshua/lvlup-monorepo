# Scanner · Camera Capture (flow step 3)

> Anchored to `docs/rebuild-spec/design/00-FOUNDATION.md` (Lyceum — Modern
> Scholarly). Tokens, type, motion, and component inventory referenced, not
> re-pasted.

## 1. Purpose & primary user

- **Role:** Scanner operator (tenant membership role `scanner`, status `active`)
  using the AutoGrade intake PWA on a phone (390x844).
- **Job-to-be-done:** Capture or upload all answer-sheet pages for one student
  under one exam, building a local image set that will be reviewed and
  submitted. This is the third step of the intake flow: _Exam → Student →
  **Capture** → Review → Submit_.

## 2. Entry points & route

- **Route:** `#/scan/e/:examId/s/:studentId/capture` (flow step 3). Params:
  `{ examId, studentId }`.
- **Entry:** Reached from the student-pick screen after a roll/student is
  selected.
- **Exit:** Primary CTA "Review N images" →
  `#/scan/e/:examId/s/:studentId/review`. Back affordance → student pick.
- **Common-API reads/writes** (reference `specs/common-api.md`):
  - Reads `ctx.selectedExam` and `ctx.selectedStudent` (already resolved
    upstream from `exams` list — only `published` / `grading` exams; region
    `asia-south1`).
  - Writes captured/added images into `ctx.images` via `ctx.setImages`
    (client-side staging only — **no submission doc is written here**).
  - No network call on this screen except optional camera permission; submit
    happens later via the `uploadAnswerSheets` callable.

## 3. Layout (wireframe-as-text)

Phone body, 390px wide, vertical scroll; the SPA shell provides topbar +
Scan/Queue/History tabbar. The fixed submit bar belongs to this view.

```
┌──────────────────────────────────────────┐  ← shell topbar (not in view)
│ [‹ back]  Mid-term · Physics              │  header strip (exam name)
│           Aarav Sharma · Roll 14          │  student name + roll (muted)
├──────────────────────────────────────────┤
│  [ Camera | File upload ]  segmented      │  pill segmented control
├──────────────────────────────────────────┤
│  CAMERA mode:                             │
│   ┌────────────────────────────────────┐ │
│   │  ┌ ScanFrame dark viewfinder ┐     │ │
│   │  │  corner guides             │     │ │
│   │  │  "Align the answer sheet…" │     │ │
│   │  └────────────────────────────┘     │ │
│   └────────────────────────────────────┘ │
│   thumbnail strip · "3 captured"          │  horizontal scroll of thumbs
│   ┌────────── control bar ─────────────┐  │
│   │  [gallery]   ( ◉ big capture )  [⟳] │  │  round spark capture btn
│   └────────────────────────────────────┘  │
│                                            │
│  FILE mode:                                │
│   FileDrop "Add answer-sheet images"      │
│   hint: JPEG, PNG or PDF                   │
│   supported-format note                   │
│   thumbnail grid of added images          │
├──────────────────────────────────────────┤
│  [ Review 3 images ]   (sticky submit bar)│  disabled when 0
│  caption: compressed to max 1920px · 85%  │
└──────────────────────────────────────────┘  ← shell tabbar (not in view)
```

Responsive: single column at all widths; this is a phone-only PWA surface (no
md/lg). The capture control bar and submit bar are `position: sticky`/absolute
pinned to the body bottom.

## 4. Components used (from §5 + Scanner domain)

- Domain: **ScanFrame** (dark viewfinder + corner guides + hint), **FileDrop**
  (`title`, `hint`).
- DS: **Button** (spark round capture, primary review CTA, secondary/ghost
  controls), **IconButton** (back, gallery, flip), **Icon**, **Badge** /
  **Chip** (capture count, format note), **Alert** (`variant='error'` for
  permission denied), **Modal** (permission-denied overlay), **Tabs** pill or
  custom segmented control for mode toggle.
- Card-local layout classes prefixed `camera-` / `camera-capture-`.

## 5. States

- **Default (camera, 0 images):** viewfinder live, thumbnail strip shows empty
  hint ("No pages yet"), Review CTA disabled.
- **Capturing:** each capture tap appends a placeholder thumbnail; count badge
  increments; subtle add animation.
- **File mode:** FileDrop active on drag; added images populate a grid.
- **Permission denied:** `Alert variant='error'` title "Camera access denied"
  with body + **Try again** / **Use file upload instead** buttons. Reachable via
  a "Simulate denied" affordance (prototype) and surfaced as a Modal overlay + a
  documented state tile.
- **Partial:** N>0 images, Review CTA enabled with live count.
- **Loading:** camera initializing → skeleton/placeholder in the frame
  (documented).
- **Empty:** 0 images, Review disabled, helper copy.

## 6. Interactions & motion

- Mode toggle switches Camera ↔ File upload (no data loss; images persist across
  modes).
- Round **spark** capture button (≥64px, ≥44px target) appends one image to
  local state + `ctx.setImages`. Optimistic — thumbnail appears immediately.
- Thumbnails: tap to remove (x overlay); horizontal scroll strip in camera, grid
  in file mode.
- Review CTA disabled at 0; enabled state shows count. Navigates to review
  route.
- Motion uses `--dur-fast` / `--ease-entrance` for thumbnail insertion; respects
  reduced-motion.

## 7. Content & copy

- Header: exam name (display), `student · Roll NN` (muted, precise staff tone).
- Hint: "Align the answer sheet within the frame".
- Count: "N captured" / "N images".
- File mode: title "Add answer-sheet images", hint "JPEG, PNG or PDF", note
  "Photos are compressed to max 1920px at 85% JPEG before upload."
- Empty thumbnail strip: "No pages yet — capture or add the answer sheet."
- Permission denied: title "Camera access denied", body "AutoGrade can't reach
  the camera. Enable camera access in your browser settings, or add pages from
  your gallery instead."
- CTA: "Review N images".

## 8. Domain rules surfaced

- **Tenant isolation:** operator is gated by `tenants/{tenantId}` membership
  role `scanner`, status `active`, and `tenant.features.scannerAppEnabled`.
  Exam/student already scoped to the tenant upstream.
- **Answer-key never shown:** this screen only intakes sheet images; no key, no
  grading info is rendered to the scanner.
- **Server-side submit:** the frontend NEVER writes the submission doc. Images
  are staged locally (IndexedDB-backed queue downstream); the actual submit
  calls `uploadAnswerSheets` (server allocates submission id; duplicate guard →
  friendly "already submitted"; `failed-precondition` if exam not
  published/grading). This screen only builds the local image set.
- **Client compression** to max 1920px / 85% JPEG happens before upload
  (surfaced as a caption).
- **Offline-durable:** captures are persisted to an IndexedDB queue downstream
  so they survive tab close and retry on reconnect.

## 9. Accessibility

- Focus order: back → mode toggle → viewfinder/FileDrop → capture/add →
  thumbnails → Review CTA.
- Capture button and IconButtons have visible `aria-label`s; all touch targets
  ≥44px.
- Status is never color-alone: permission error pairs an alert-triangle/x-circle
  icon + text; capture count is text, not color.
- Segmented control is a `role="tablist"` with `aria-selected`; keyboard arrow
  navigation.
- Reduced-motion: thumbnail insert animation collapses to instant.
- Contrast: dark viewfinder hint uses `--text-on-accent`/light text on dark;
  meets AA.

## 10. Web↔mobile divergence

- This is the mobile/PWA intake surface; there is no desktop scanner equivalent.
  On native (Expo `ui-native`) the ScanFrame binds to the device camera and the
  round capture button maps to a press; on web PWA it uses `getUserMedia` (or
  the file picker fallback when denied). Component names/props match 1:1 with
  `shared-ui`; only the camera renderer differs. No command palette, no hover —
  press only.

## 11. Claude-design prompt (ready to paste)

> Build the **Camera Capture** screen for the AutoGrade mobile-scanner PWA
> (390x844), Lyceum "Modern Scholarly" design language — anchor to
> `docs/rebuild-spec/design/00-FOUNDATION.md`; use only Lyceum tokens (no raw
> hex, no Inter/Roboto, no SaaS blue/purple). Components from
> `window.LvlupV0DesignSystem_5d0725`. Header shows exam name + student name +
> roll (muted) with a back affordance. A pill segmented control toggles "Camera"
> | "File upload". Camera mode: a dark **ScanFrame** viewfinder with corner
> guides and hint "Align the answer sheet within the frame", a horizontal
> thumbnail strip with an "N captured" badge, and a control bar with a big round
> **spark** capture button (≥64px) flanked by gallery + flip IconButtons. File
> mode: a **FileDrop** titled "Add answer-sheet images" hint "JPEG, PNG or PDF"
> plus a thumbnail grid. A sticky bottom submit bar with a primary "Review N
> images" button (disabled at 0) and a caption "compressed to max 1920px at 85%
> JPEG". Include a camera-permission-denied state: `Alert variant='error'` title
> "Camera access denied" with Try again / Use file upload instead, reachable via
> a "Simulate denied" affordance and shown as a Modal. Status always icon+text,
> targets ≥44px. Answer key is never shown; frontend never writes the submission
> doc — images are staged locally only.
