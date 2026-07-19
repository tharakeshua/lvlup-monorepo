# PR Review — Batch C (teacher-web + e2e)

Reviewer: `fe-web-teacher` (worker) · Local analysis only — **no GitHub posts**.
PRs: #25, #24, #8, #7, #6, #16, #17 · Author: `tharakeshua` (fork) · All target
`main`.

---

## ⚠️ Batch-wide blocker: shared poisoned base (applies to ALL 7 PRs)

Every one of these branches sits on the **same unrelated churn base**. This is
not "main is behind staging" — I diffed each branch against **staging** (the
authoritative branch) and the identical ~491-line noise footprint is present vs
staging too. So the branches diverge from _both_ main and staging.

The shared noise (present in all 7, verbatim) includes:

- `pnpm-lock.yaml` — **825** changed lines
- `packages/shared-services/src/auth/auth-callables.ts` (+125) — a **competing
  re-implementation** of callable wiring (`switchActiveTenant` →
  `v1-identity-switchActiveTenant`, `targetTenantId` rename) plus mass
  single→double-quote reformatting (prettier-config drift). Staging already did
  this work differently; merging would clobber it.
- `packages/shared-services/src/auth/{membership-service,tenant-lookup}.ts`,
  `firebase/collection-prefix.ts`, `firebase/index.ts` — auth-seam rewrites
- `packages/shared-stores/src/auth-store.ts` — teacher-web **dropped**
  shared-stores in the SDK migration, but student/admin/parent still consume it
  → risk of regressing them
- `packages/shared-utils/src/{web-vitals.ts (+122), pdf.ts}`,
  `shared-ui/...markdown/MarkdownWithMath.tsx`
- `packages/shared-hooks/src/queries/*` (useAuthHooks, useItemMutations,
  useProgress, useTestSessions, usePerformanceTrends, useChatSessions),
  `use-api-error.ts`
- ~10 `packages/*/tsconfig.json` bumps, `functions/sdk-v1/lib/index.js{,.map}`
  (built artifact), `functions/identity/src/**`, `packages/services/src/**`
  (autograde/identity/repo-admin), `.env.production` files, `README.md`,
  `.gitignore`, mobile `.eslintrc.js`/`package.json`

**Consequence:** merging any of these PRs to `main` would drag in a large,
unreviewed, staging-divergent rewrite of the auth/SDK seam and revert staging
work. The _actual_ intended fix in each PR is a tiny teacher-web subset (2–5
files).

**Batch recommendation:** Do **not** merge any branch as-is. For the PRs whose
core fix has value (#24, #8, #7, and #25/#6 with changes), **cherry-pick the
intended teacher-web files onto a fresh branch cut from `staging`** and open
new, clean PRs targeting `staging` (staging is authoritative; these all wrongly
target `main`). Verdicts below are therefore **REQUEST-CHANGES (extract onto
clean staging base)** unless the core fix is itself obsolete/wrong.

---

## PR #25 — fix(teacher-web): keep SessionContext stable across Vite HMR

`fix/teacher-session-hmr-context` · +2657 / −884 · 101 files · **CONFLICTING**

**Verdict: REQUEST-CHANGES** (extract onto clean staging base; also de-scope)

- Built on top of staging's new `SessionProvider`/`useAuthSession` (references
  `GetMeLike`, `meRepo`, `useAuthSession`) — so it is **NOT
  obsolete/superseded** by staging; staging's `session.tsx` still uses a plain
  `createContext` with **no HMR guard**, so the titular fix is genuinely new.
- **Core fix is reasonable.** The `globalThis.__levelupTeacherSessionCtx`
  singleton is a valid, framework-agnostic HMR pattern to stop Provider/consumer
  splitting across hot-reloaded module instances (`useAuthSession` "must be used
  within SessionProvider"). DEV-only, low risk.
  `apps/teacher-web/src/sdk/session.tsx`.
- **Scope creep (title says HMR only):** the diff also bundles two substantial,
  unrelated behavioral changes:
  1. `authErrorMessage` rewrite to prefer `err.message` over the generic
     fallback.
  2. `resolveTenantIdForSchoolLogin` + ghost-tenant membership fallback +
     `loading` (`isPending`/`isFetching && !me`) rework — a real **GRN001
     legacy-vs-`v2_` tenant-code drift** fix that flashes "Access Denied" after
     school login. This is valuable but is a _different_ PR (session/login
     correctness), not "HMR context."
- **Action:** split into (a) the ~15-line HMR guard and (b) the
  login/tenant-drift fix; land each on a clean staging-based branch. The
  tenant-drift fix should be reviewed alongside PRREV login work for the same
  GRN001 seam.

---

## PR #24 — fix(teacher): coerce legacy rubric presets so list renders in DEV

`fix/teacher-rubric-presets-coerce` · +2741 / −891 · 105 files · **CONFLICTING**

**Verdict: REQUEST-CHANGES** (extract onto clean staging base — core fix is
GOOD, keep it)

- **Core fix is well-architected and worth keeping.**
  - `packages/domain/src/entities/content/rubric.ts`: new
    `coerceUnifiedRubric()` placed in **domain (the SSOT / inter-team seam)** —
    correct location. Maps legacy seed shapes (`totalPoints` + `{key,label}`
    dims) → strict `UnifiedRubric` (holistic when no dims, else
    dimension_based). Additive, safe.
  - `packages/api-contract/src/callables/levelup/list-rubric-presets.ts`: wraps
    items in `z.preprocess(coerce…, RubricPresetSchema)` so DEV
    `validateResponses` stops dropping the whole list on a 200.
  - `packages/services/src/levelup/agents-presets.ts`: server
    `projectRubricPreset` now coerces at projection too (was `rubric ?? {}` →
    invalid).
  - `apps/teacher-web/src/pages/RubricPresetsPage.tsx`: adds `isError`/`retry`
    UI + null-safe render (`preset.rubric?.scoringMode`, category fallback).
    Good.
- **Nit:** coercion is applied in _both_ the server projection and the client
  response `preprocess`. If the server always coerces, the client preprocess is
  effectively dead for the live path — but it is defensible belt-and-suspenders
  (api-contract validates on both ends; guards seed/emulator/legacy direct
  reads).
- **Nit:** `coerceUnifiedRubric` touches the domain/api-contract SSOT seam —
  make sure the SDK-coord/backend team is aware (cross-team seam), though it is
  purely additive.
- **Action:** extract the 4 core files onto a clean staging branch; keep the
  fix.

---

## PR #8 — fix(teacher-web): expand SP after create and always open item editor

`fix/teacher-space-editor-add-item-ux` · +1674 / −505 · 68 files · MERGEABLE

**Verdict: REQUEST-CHANGES** (extract onto clean staging base — core UX fix is
sound)

- Single real file: `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`.
- **Core fix is good UX:** after adding a story point, expand it + switch to the
  Content tab; after adding an item, **always** open the editor (with a locally
  synthesized `UnifiedItem` fallback when the reload misses the fresh row);
  clearer "Add Question"/"Add Material" labels + an always-visible add-item row.
- **Nits (low severity):**
  - Defensive `{ space }` envelope unwrap (`"space" in spaceRaw`) is **dead
    code** against staging's `@levelup/query` `spaceRepo.get` (returns
    `SpaceView` with `title`). Harmless but signals uncertainty about the repo
    contract — prefer trusting the typed hook.
  - The synthesized fallback item is cast `as UnifiedItem` from wizard-local
    state; if the server assigns/normalizes fields, the just-opened editor
    briefly shows client-side values until next reload. Acceptable (editor is
    about to be filled).
- **Action:** extract the one file onto a clean staging branch.

---

## PR #7 — fix(teacher-web): persist QP images mid-wizard + clearer extract UX

`fix/teacher-exam-extract-persist-ux` · +1706 / −497 · 69 files · MERGEABLE

**Verdict: REQUEST-CHANGES** (extract onto clean staging base + verify
field/contract seam)

- Real files:
  `apps/teacher-web/src/pages/exams/{ExamCreatePage,ExamDetailPage}.tsx`.
- **Core intent is sound:** persist a draft before leaving the metadata step (so
  `requestUploadUrl`/extract have an `examId`); persist `questionPaperImages` +
  `status: "question_paper_uploaded"` right after upload so Extract works if the
  teacher leaves mid-wizard; ExamDetail promotes
  `draft → question_paper_uploaded` before extract, gates Extract via
  `canExtractQuestions`, adds empty-state CTA + toasts + error handling. All
  reasonable.
- **⚠️ Correctness risk to verify (field-name seam):** `ExamCreatePage`
  **writes** `questionPaperImages: paths`, but `ExamDetailPage` **reads**
  `exam.questionPaper?.images?.length` to compute `hasQuestionPaper` /
  `canExtractQuestions`. These are the request-shape vs view-shape twins. If the
  exam **view** does not map `questionPaperImages` → `questionPaper.images`,
  then `hasQuestionPaper` is false and the new Extract CTA never renders — the
  fix silently no-ops. Must confirm the view mapping before landing.
- **⚠️ Contract dependency:** the mid-wizard
  `saveExam.mutateAsync({ data: { questionPaperImages, status }})` requires the
  `saveExam` callable/contract to **accept** both `questionPaperImages` and
  `status`. Per known parity gaps (memory: teacher-web needs new backend
  callables — saveExamQuestion etc.), verify the contract does not strip these,
  else the persist is a no-op. Flag to SDK-coord/backend.
- **Action:** extract the 2 files onto a clean staging branch; verify the two
  seams above.

---

## PR #6 — fix(teacher-web): soft-fail getSummary 403s on dashboard/class pages

`fix/teacher-softfail-class-summary-403` · +1707 / −505 · 71 files · MERGEABLE

**Verdict: REQUEST-CHANGES** (masks the escalated P2 for assigned classes +
architecture smell)

- Real files: `ClassAnalyticsPage.tsx`, `ClassDetailPage.tsx` (+ unrelated Radix
  Select fixes, see below). Coordinator context: **`getSummary` 403 is a KNOWN
  escalated backend P2.**
- **Judgement: the client soft-fail as written _masks_ the P2, not just the
  unassigned-class case.** `activeClassId = selectedClassId || classes[0]?.id`,
  then the query does `summaryRepo.getClass(activeClassId)` and swallows
  `PERMISSION_DENIED` → returns `null` for **any** class, including the
  teacher's **own assigned** class. So when the real P2 causes an assigned class
  to 403, the teacher silently sees "No analytics… (or it isn't assigned to
  you)" instead of a surfaced error — the backend bug becomes invisible. That is
  the wrong trade: swallowing should be scoped to classes the teacher is
  demonstrably **not** assigned to (e.g. only when the class isn't in the
  teacher's assigned set), and the backend P2 remains the real fix.
- **Architecture smell (regression to legacy pattern):** the fix **bypasses the
  SDK hook** `useClassSummary` and hand-rolls a `useQuery` reaching into
  `useRepos()` via `repos as unknown as { summaryRepo: { getClass } }`. This
  defeats the `@levelup/query` layer's typing/invalidation. If a soft-fail is
  wanted it belongs **in the repo/hook layer** (or as a hook option), not an
  `unknown`-cast in the page. Also note `retry:false, throwOnError:false`
  already suppress propagation, making the try/catch partly redundant.
- **Out-of-scope bundled fixes (unrelated to 403):** the diff also carries Radix
  `Select` empty-`value` fixes — `QuestionBankEditor.tsx` (`""`→`"__none__"`
  Bloom's), `RubricPresetPicker.tsx` (`""`→`"__all__"`),
  `SpaceSettingsPanel.tsx` (`!(title ?? "").trim()`). These are individually
  **correct** (Radix Select forbids empty-string values — matches our
  lessons-learned), but they belong in a separate "Select empty-value" PR, not
  the 403 soft-fail.
- **Action:** either fix the backend P2 (preferred) or re-scope the soft-fail to
  truly-unassigned classes and push it into the SDK layer. Split the Radix fixes
  out. Extract onto clean staging base.

---

## PR #16 — test(e2e): teacher QA swarm critical Playwright suite

`test/e2e-teacher-qa-swarm-critical` · +2095 / −491 · 70 files · MERGEABLE

**Verdict: REQUEST-CHANGES** (poisoned base + suite-hygiene issues; low merge
value as-is)

- Adds `tests/e2e/teacher-qa-swarm-critical.{config,spec}.ts` (442-line spec,
  Priya/GRN001 critical paths). No test artifacts (`.png`/reports) committed —
  good.
- **Auth pattern:** does **not** use the requested `storageState` pattern. It
  does a live UI login. **Mitigated** by `workers:1` + `mode:"serial"` + a
  single shared `Page` logged in once at the top — so it's ~1 Firebase Auth
  login per full run, not a rate-limit storm. Still, storageState is the house
  standard; convert.
- **⚠️ Artifact hygiene:** spec writes screenshots + `qa-swarm-report.json` to
  repo-root `tmp/`. `.gitignore` on this branch ignores `*.tmp` and
  `tmp-e2e-chaitanya/` but **NOT `tmp/`** → running the suite drops untracked
  files under `tmp/` that can be accidentally committed. Add `tmp/` to
  `.gitignore` or write outside the repo.
- Reads as a one-off QA-swarm scratch script (inline
  `login`/`settle`/`snap`/`record` helpers, console-logged PASS/FAIL) rather
  than a curated regression suite.
- **Action:** if kept, extract the 2 spec files onto a clean staging branch,
  convert to storageState, gitignore `tmp/`. Coordinate with #17 (overlap).

---

## PR #17 — test(e2e): teacher full QA final/priya/retest Playwright suites

`test/e2e-teacher-full-qa-suites` · +3259 / −491 · 74 files · MERGEABLE

**Verdict: REQUEST-CHANGES / lean CLOSE — substantial overlap with #16 +
throwaway QA scripts**

- Adds three suites: `teacher-full-qa-final` (281), `teacher-full-qa-priya`
  (898), `teacher-full-qa-retest` (393) — all live Priya/GRN001 teacher-web QA.
- **Overlap with #16 (asked to check):** heavy. All four suites (#16 + these
  three) target the same Priya/GRN001 critical teacher paths with duplicated
  inline `login`/`settle`/screenshot/report scaffolding.
  `teacher-full-qa-retest`'s header literally says it re-tests "SpaceEditor
  useAuthSession + QuestionBank SelectItem" — i.e. it is a **manual verification
  script for the fixes in #8 and #6**, not an independent regression asset.
  `teacher-full-qa-final` is a post-rebuild smoke. These are session-scratch QA
  outputs, not a maintainable suite.
- Same issues as #16: no `storageState` (live login), writes reports/screenshots
  to non-ignored `tmp/`, poisoned base.
- **Action:** do not land three overlapping throwaway suites. If any e2e
  coverage is wanted, consolidate #16 + #17 into **one** curated teacher
  critical-path suite on a clean staging branch (storageState, shared helpers,
  `tmp/` gitignored). Otherwise CLOSE #17 as superseded by a consolidated suite;
  at minimum close the redundant `final`/`retest` scratch suites.

---

## Summary table

| PR  | Title                             | Core fix quality                         | Verdict                                                     |
| --- | --------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| #25 | SessionContext HMR stability      | Good (but bundles 2 unrelated fixes)     | REQUEST-CHANGES — split + clean staging base                |
| #24 | Coerce legacy rubric presets      | **Good** — keep                          | REQUEST-CHANGES — extract onto clean staging base           |
| #8  | Expand SP + always open editor    | Good UX                                  | REQUEST-CHANGES — extract onto clean staging base           |
| #7  | Persist QP images mid-wizard      | Sound intent; verify field/contract seam | REQUEST-CHANGES — extract + verify seams                    |
| #6  | Soft-fail getSummary 403          | **Masks escalated P2** + arch smell      | REQUEST-CHANGES — re-scope / fix backend instead            |
| #16 | QA swarm critical suite           | Throwaway QA script                      | REQUEST-CHANGES — clean base + storageState + gitignore tmp |
| #17 | Full QA final/priya/retest suites | Throwaway, overlaps #16                  | REQUEST-CHANGES / lean CLOSE — consolidate                  |

**Cross-cutting actions for coordinator:**

1. **None of the 7 should merge to `main` as-is** — all carry the shared
   staging-divergent auth/SDK-seam rewrite base (825-line lockfile churn incl.).
2. Retarget the keepers (#24, #8, #7, and split #25) at **`staging`**,
   cherry-picking only the intended teacher-web/domain/api-contract files.
3. #6: prefer fixing the backend `getSummary` P2; if a client stopgap is kept,
   scope it to truly-unassigned classes and push it into the SDK layer (not an
   `unknown`-cast in the page). Split its Radix-Select fixes out.
4. #7: verify the `questionPaperImages` (write) ↔ `questionPaper.images` (view)
   mapping and that `saveExam` accepts `questionPaperImages`+`status`
   (SDK-coord/backend).
5. Consolidate #16+#17 into one curated suite; add `tmp/` to `.gitignore`.
