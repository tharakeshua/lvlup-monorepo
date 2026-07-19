# W3 MEDIA — handoff (audio + image_evaluation end-to-end)

Owner: aiq-w3-media. Status: **client feature + backend seam built, all local
gates green, prod evaluation E2E PROVEN.** Nothing committed.

## 1. What shipped (client) — `apps/mobile-student/src/features/answer-media/**`

W1 consumes these; W1 renders the parts-stack shell + wires submit.

| Export                                                                            | What                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAnswerParts({ scope:{spaceId,itemId}, initialParts?, onChange?, disabled? })` | The controller. Returns `{ parts, uploading, hasError, error, clearError, micDenied, cameraDenied, addPhoto, addFromCamera, addAudio, remove, retry, recorder, stopRecordingAndAttach }`. Upload lifecycle uploading→ready→error, retry from retained localUri, never loses a part on failure. |
| `useAudioRecorder()`                                                              | expo-av HIGH_QUALITY record lifecycle: `{ isRecording, durationMs, level, permissionDenied, start, stop, cancel }`, 3-min cap, live meter.                                                                                                                                                     |
| `useAnswerMediaUpload()`                                                          | `upload(file, scope)` → `{ storagePath, mimeType, sizeBytes }` via `storageRepo.uploadImage({ kind:'answer-media', spaceId, itemId, contentType, body })`.                                                                                                                                     |
| `RecordStage`                                                                     | D1 idle (breathing spark button) / D2 recording (timer + blinking dot + live waveform + pulsing stop). Reduced-motion safe.                                                                                                                                                                    |
| `Waveform`                                                                        | static + live (`level`-driven) bar meter.                                                                                                                                                                                                                                                      |
| `AudioPartCard`                                                                   | waveform + play/pause local clip + duration; failed→retry.                                                                                                                                                                                                                                     |
| `ImagePartCard`                                                                   | 60px thumb (local preview) + name + tap-to-view; failed→retry.                                                                                                                                                                                                                                 |
| `AnswerPartStack`                                                                 | dispatches parts to the right card by kind.                                                                                                                                                                                                                                                    |
| `CaptureRow` / `CaptureButton`                                                    | `.cap` pill actions (Camera / Photo library / Re-record / Add note).                                                                                                                                                                                                                           |
| `PermissionBanner`                                                                | mic/camera denied warn banner + Open Settings deep link.                                                                                                                                                                                                                                       |

Model + wire conversion come from W1's canonical
`components/ai-question/answer-bundle.ts` (imported, not redefined).
`toAnswerBundle(text, parts)` delegates to `toWireAnswer`.

## 2. Exact payload shapes (for W1 + W2)

**AnswerPart** (canonical seam, W1-owned):
`{ id, kind:'image'|'audio', storagePath, mimeType, name?, sizeBytes?, durationSec?, status:'uploading'|'ready'|'error', localUri? }`.
`storagePath` is `""` until `status==='ready'`.

**Submit — `v1.levelup.recordItemAttempt`** (strict contract, no top-level
media): `answer` rides the media inside itself.

```
answer = { text: string, mediaUrls: string[] }   // when ≥1 ready part
answer = "<text>"                                  // legacy string, text-only
// mediaUrls = ready parts' storagePaths, in stack order
```

**Preview/practice eval — `v1.levelup.evaluateAnswer`** (HAS a top-level media
field):

```
{ spaceId, storyPointId?, itemId, answer:{text}|string, mediaUrls?: string[], mode?:'practice'|'preview' }
```

**Returned `StoredEvaluation`** (verified live, for W2's FeedbackResult):

```
{ score, maxScore,
  summary: { keyTakeaway, overallComment },        // OBJECT (tolerate string too)
  strengths: string[], weaknesses: string[],
  structuredFeedback: { scoping[], tradeoffs[], scalability[], communication[] }
      // each item: { severity:'critical'|'major'|..., message, suggestion }
}
```

## 3. Backend seam ADDED (uncommitted — **W1 owns the vc9 deploy**)

The blocker: **no `requestUploadUrl` kind authorized a student**
(`item-media`=item.write/TEACHERISH,
`answer-sheet`=answerSheets.upload/SCANNERISH). This is the live Issue4b gap —
media could be captured but never uploaded → never evaluated. Fix adds a
student-usable kind:

| File                                                       | Change                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/access/src/actions.ts`                           | + action `answerMedia.upload` (union + array)                                                                                                                                                                            |
| `packages/access/src/policy.ts`                            | + rule `answerMedia.upload: { roles: STUDENT_ONLY, tenantScoped, ownershipCheck:'self' }`                                                                                                                                |
| `packages/api-contract/src/callables/autograde/fold.ts`    | + `answer-media` to the `requestUploadUrl` kind enum                                                                                                                                                                     |
| `packages/repositories/src/views-and-storage-auth/seam.ts` | + `answer-media` to `UploadKind`                                                                                                                                                                                         |
| `packages/services/src/autograde/request-upload-url.ts`    | authorize `answer-media` via `answerMedia.upload`; `buildScopedPath(t, input, uid)` → `tenants/{t}/spaces/{s}/items/{i}/answers/{uid}/{stamp}.ext`; `extFor` now handles audio content-types (m4a/mp3/wav/ogg/webm/flac) |

Path is uid-pinned server-side → a learner can only write their own answer
prefix; authoring kinds stay teacher-scoped. **Rebuild dist before deploy**:
`@levelup/access`, `@levelup/api-contract`, `@levelup/repositories` (mobile +
services consume dist, not src).

## 4. Tests (all green)

- `packages/services/src/autograde/request-upload-url.answer-media.test.ts`
  **(NEW, 4/4)** — student grant + uid-scoped path, audio mime round-trip
  (.m4a), teacher PERMISSION_DENIED, spaceId/itemId required.
- Unchanged & green: access 6/6, api-contract 151/151, repositories 58/58,
  services autograde 90/90, `media-eval-seam.regression` 3/3 (media→gateway
  parts, correct mimes, cross-tenant drop), `ai-image-seam` 11/11 (FIX-1
  path→bytes).
- Mobile tsc: `src/features/answer-media/**` = 0 errors (remaining 4 are W1
  `ai-question/*` + W4 `ConversationTranscript`).

## 5. PROD E2E — evaluation half PROVEN live (`scripts/w3-media-e2e.mjs`)

Against prod (tenant_subhang AI Lab), as `student.test@subhang.academy`, real
Gemini via `v1.levelup.evaluateAnswer`:

- **IMAGE** (item `...0376b3dc11`): uploaded a synthesized PNG of
  `2x+3=7 → x=2`. Gemini returned: _"the submission contains a step-by-step
  solution to a basic algebra equation (2x + 3 = 7)"_ — **the model saw the
  image bytes.**
- **AUDIO** (item `...4439a720c1`): uploaded `say`-TTS m4a explaining binary
  search. Gemini returned: _"the audio contains a brief definition of binary
  search"_ — **the model heard the audio bytes.**

Both scored 0 (the real questions want an ER diagram / a behavioral STAR answer,
not what I synthesized) — which _proves_ the grader distinguished my media
content from the expected answer. `VERDICT: IMAGE ✓ / AUDIO ✓`. Full transcript
→ `scripts/w3-media-e2e.result.json`.

**The upload leg** (student PUT via the client) needs the §3 `answer-media` kind
DEPLOYED. After W1's vc9 deploy, the client `useAnswerParts` →
`storageRepo.uploadImage({kind:'answer-media'})` completes the loop; the
evaluation half above already confirms the rest.

## 6. Bonus finding for content owner (conv-content)

The AI-Lab "image_evaluation" item asks for a **library-management ER diagram**;
the "audio" item is a **behavioral STAR** question (handle a technical
disagreement). Just flagging in case the seed intent was a
math/technical-explanation pairing.
