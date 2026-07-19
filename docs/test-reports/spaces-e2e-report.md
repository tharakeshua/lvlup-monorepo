# Teacher Spaces QA Gate — 2026-07-18

## Result

Focused deterministic gate: **PASS**

- Teacher Spaces Playwright: 4/4 passed.
- Teacher Spaces Vitest: 47/47 passed.
- Content authoring service Vitest: 6/6 passed.
- API contract: 3/3 passed.
- Domain boundary: 3/3 passed.
- Repository seams and analytics: 9/9 passed.
- Query analytics: 1/1 passed.
- Teacher typecheck: passed.
- Teacher production build: passed.
- Scoped Spaces lint: 0 errors, 2 hook warnings.

## Browser coverage

- Unauthenticated `/spaces` protection and redirect.
- Mobile (375 × 812) and desktop (1280 × 800) overflow checks.
- WCAG 2.1 A/AA axe scan with no critical or serious violations.
- Keyboard focus order and Enter submission.
- Deterministic network-offline failure, retained input, and retry availability.
- Browser-runtime import of the real authoring model graph.
- All 15 question and 7 material preview types.
- Story-point reorder and duplicate section remapping.

## Service and model coverage

- Canonical create, reopen, validate, and save matrix for every supported item
  type.
- Permission denial before student-authored writes.
- Partial item move while preserving payload.
- Publish → draft → republish lifecycle.
- Publish-readiness failure, command-only soft delete, contracts, legacy
  normalization, structural reorder/duplicate, preview summaries, and rubric
  modes.

## Exclusions and environment findings

- No authenticated destructive Firebase E2E was run because no local Firebase
  emulator or deterministic authenticated fixture was available.
- The repository requires Node 20; this host ran Node 25.6.1 and emitted engine
  warnings.
- Ambient `NODE_ENV=production` breaks Vite dev JSX
  (`_jsxDEV is not a function`). The scoped Playwright web server pins
  `NODE_ENV=development`; production build is unaffected.
- The 250-item duplicate pagination test did not complete within 90 seconds on
  Node 25 and was stopped. The smaller deep-copy test was not reported as a
  failure; rerun the pagination case on the supported Node 20 toolchain.
- Full Teacher lint executes after the command repair but has four unrelated
  existing unused-variable errors outside Spaces. Scoped Spaces lint has only
  two existing hook warnings in `ItemEditor.tsx` and `StoryPointEditor.tsx`.
- The production build warns about chunks over 800 kB; build output is otherwise
  successful.
