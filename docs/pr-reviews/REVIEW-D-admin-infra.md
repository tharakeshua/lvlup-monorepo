# PRREV-D — Admin / Infra / Docs / Handover PR Reviews

**Reviewer:** fe-web-admin (sess_1783966140005_pvli1wh6m) **Date:** 2026-07-13
**Scope:** PRs #26, #5, #10, #18, #15, #33 (+dup #20), #32 (+dup #19), #23
**Method:** Local analysis only (`gh pr view/diff/checks`,
`git show origin/staging`, `git diff origin/main origin/staging`). **No GitHub
posts made.**

---

## Cross-cutting finding: the shared ~70-file "staging footprint" on fork PRs

All five `tharakeshua`-fork PRs targeting `main` (#26, #5, #18, #15, and the fat
handover dups #20/#19) carry an **identical ~70-file / ~491-line out-of-scope
footprint** on top of their titular change. Verified: every footprint file
(`functions/identity/src/utils/claims.ts`,
`packages/services/src/autograde/reads.ts`,
`packages/query/src/invalidation/graph.ts`,
`packages/shared-stores/src/auth-store.ts`, `pnpm-lock.yaml`, ~30
`tsconfig.json`, …) is present in the `origin/main…origin/staging` delta.
**Conclusion:** these branches were cut from a staging-derived snapshot but
target `main` (which is behind), so their diff = _staging divergence + the one
intended fix_. The footprint also includes **committed build artifacts**
(`functions/sdk-v1/lib/index.js` and `.js.map`) — should never be in a source
PR.

**Implication:** land **#23 (staging→main sync) FIRST**; afterward each fork PR
collapses to just its titular change and can be re-reviewed cleanly (or the one
change cherry-picked directly onto staging). #10 is the only fork PR _without_
this footprint.

**Recommended merge order:** #23 → #10 → (rebased titular slices of #26/#5/#15)
→ #32/#33 after CI fix → **hold #18 until secrets removed** → close #20/#19 as
dups.

---

## PR #26 — fix(admin-web): keep SessionContext stable across Vite HMR

**Verdict: REQUEST-CHANGES (scope) — titular change is valid & wanted**

- **Titular change (`apps/admin-web/src/sdk/session.tsx`):** wraps
  `createContext<SessionState|null>` in a `globalThis.__levelupAdminSessionCtx`
  singleton so HMR module reloads don't mint a second context (which crashes
  `useAuthSession`). Diff context is `@@ -78 parseClaims` — i.e. it applies **on
  top of staging's claims-based session.tsx** (staging line 81 is still the
  plain `createContext(...)`). **Not obsolete** — staging does NOT yet have this
  guard. Pattern mirrors teacher PR #25. Correct, DEV-only, low-risk.
- **Problem:** 68 of 69 changed files are the shared staging footprint (incl.
  `functions/sdk-v1/lib/index.js`+`.map` build artifacts). Title claims one
  file.
- **Ask:** rebase onto staging so the diff is just the `session.tsx` singleton
  block, or cherry-pick that ~10-line hunk directly onto staging. Then APPROVE.

## PR #5 — chore(vite): bind admin/parent dev servers to 127.0.0.1 + strictPort

**Verdict: REQUEST-CHANGES (scope) — core change is correct**

- **Titular change:** adds `strictPort: true` + `host: "127.0.0.1"` to
  `apps/admin-web/vite.config.ts` and `apps/parent-web/vite.config.ts`. Staging
  has neither (only `port: 4568`/`4571`). Genuinely new, correct, and useful
  (Windows tools that skip IPv6 `::1`). 6 meaningful lines.
- **Scope problems:** (1) also edits `apps/student-web/vite.config.ts` and
  `apps/teacher-web/vite.config.ts` — mostly **Prettier quote reformatting**
  (`'` → `"`) plus the same host/strictPort — contradicting the "admin/parent"
  title; (2) full ~70-file staging footprint incl. build artifacts.
- **Ask:** strip footprint + reformatting; keep only the 4 vite host/strictPort
  lines (admin+parent, and student+teacher if intended, but as a deliberate
  change not a reformat). Then APPROVE.

## PR #10 — chore(ci): ignore test artifacts and document CI-green PRs

**Verdict: APPROVE (clean; only fork PR without the footprint)**

- **Deletion audit (the -115,306 lines):** verified **only artifacts deleted** —
  all 178 `apps/` deletions are under `test-results/` or `playwright-report/`;
  remaining deletions under root `playwright-report/`(24) and
  `test-results/`(9). Extensions: `dat/jpeg/txt/json/png/webm/html/trace`.
  **Zero source files** (`grep` for `/src/`, `.tsx?`, `.vue` → empty).
- **Real content (3 files):** `.gitignore` (adds `tmp/`, `test-results/`,
  `playwright-report/`, broader SA-JSON patterns), `docs/CI-GREEN-PRS.md`,
  `.github/workflows/README.md` link. Sensible, valuable hygiene.
- **Nits:** confirm the SA-JSON glob doesn't accidentally ignore a needed
  committed config; confirm `git rm --cached` was used (untracking, not deleting
  from other contributors' disks). Otherwise merge as-is.

## PR #18 — chore(scripts): Priya login diagnose/fix/heal helpers

**Verdict: REQUEST-CHANGES — BLOCKING (secrets + prod mutation)**

- **BLOCKING — hardcoded credentials** in all three committed scripts
  (`scripts/diagnose-priya-login.mjs`, `scripts/fix-priya-v2-login.mjs`,
  `scripts/heal-priya-access-denied.mjs`):
  - Firebase Web API key:
    `const API_KEY = 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';`
  - Passwords: `const PASSWORD = 'Test@12345';` and `password: "Teacher@123"`.
  - _(Firebase Web API keys are not "secret" like a private key — they're
    domain/rule-restricted client keys — but hardcoding one in a committed repo
    script is still poor hygiene and should be env-sourced.)_
- **BLOCKING — prod-mutating, not dry-run:** scripts call
  `auth.updateUser(uid, { password: PASSWORD, disabled: false })` against real
  users via the admin SDK — directly contradicting the PR's own test-plan claim
  ("run `--help` or dry path without mutating prod"). No `--dry-run` /
  confirmation guard.
- Also carries the ~70-file staging footprint + build artifacts.
- **Ask:** move `API_KEY`/passwords to env vars; gate every `updateUser` behind
  an explicit `--apply` flag (default dry-run); strip footprint; consider
  `scripts/ops/` + gitignore rather than committing operational one-offs. **Do
  not merge as-is.**

## PR #15 — docs(journeys): student/teacher/parent/admin journey guides

**Verdict: APPROVE-WITH-NITS (docs clean; strip footprint)**

- **Content:** `docs/journeys/{01-student..06-marketing-infra}.md`, `README.md`,
  and generated `LVLUP-JOURNEY-GUIDE.{md,html}`. **No secrets** — the guide
  explicitly points to `TEST_CREDENTIALS.md` and instructs "Do not invent
  additional secrets beyond what that file already documents." Good discipline.
- **Nits:** ~70-file staging footprint + build artifacts ride along on a docs
  PR; the committed generated `.html` is a build product (regenerate rather than
  track, ideally). Strip footprint → APPROVE.

## PR #33 — docs(qa): mobile handover backend compat + API parity _(org lvlup-gg, slim re-cut)_

**Verdict: REQUEST-CHANGES (CI red + staging overlap) — keeper of the pair**

- **Keeper of the #20/#33 pair:** 37 files, **no staging footprint** (org-repo
  re-cut). Confirmed `#33 ⊂ #20` (every #33 file is in #20; #20 adds 65
  footprint files).
- **CI FAILS:** Build, Lint, Type Check all fail (run 29233186378).
- **Staging overlap risk (HIGH):** touches
  `packages/services/src/identity/reads.ts`,
  `packages/shared-stores/src/auth-store.ts`,
  `packages/shared-services/src/auth/membership-service.ts`,
  `packages/repositories/src/views/student-summary.ts`,
  `.../levelup-content/{item,space,store}.ts` — all heavily changed on staging.
  Will conflict with / be partly superseded by #23.
- **Ask:** fix the red Build/Lint/Type Check; rebase on staging and reconcile
  the repositories/services/auth overlap before merge.

## PR #20 — fix(student-web)+docs: mobile handover … _(fork, fat duplicate)_

**Verdict: CLOSE-DUPLICATE (superseded by #33)**

- Same branch name (`fix/mobile-handover`), older (2026-07-12), fork-based.
  **Strict superset of #33** (102 files = #33's 37 + 65 staging-footprint files,
  incl. build artifacts). Adds no unique value over #33.
- **Ask:** close in favor of #33.

## PR #32 — fix(handover): client handover bundle parity and docs _(org lvlup-gg, slim re-cut)_

**Verdict: REQUEST-CHANGES (CI red + staging overlap) — keeper of the pair**

- **Keeper of the #19/#32 pair:** 52 files, all relevant (admin/parent pages,
  `apps/*/vite.config.ts`, `apps/*/sdk/session.tsx`, `docs/handover/*`,
  `docs/qa/*`, repositories/services, `qa-handover-authentic` e2e). No
  footprint. Confirmed `#32 ⊂ #19`.
- **CI:** Build ✅ and Type Check ✅ **pass**, but Lint, Unit, Integration, E2E,
  Schema Validation, Coverage, Visual all **fail** (run 29233172903).
- **Overlaps #26 & #5** (it also edits admin `session.tsx` + admin/parent
  `vite.config.ts`) and overlaps staging (`domain/rubric.ts`,
  `list-rubric-presets.ts`, `student-summary.ts`, `identity/reads.ts` all
  exist/changed on staging).
- **Ask:** fix failing lint/tests; rebase on staging; de-dupe the session/vite
  edits against #26/#5 (pick one source of truth). Valuable once green.

## PR #19 — fix(handover): admin/parent soft-fail … _(fork, fat duplicate)_

**Verdict: CLOSE-DUPLICATE (superseded by #32)**

- Same branch (`fix/client-handover-bundle`), older (2026-07-12), fork. **Strict
  superset of #32** (117 files = #32's 52 + 65 staging-footprint files, incl.
  build artifacts).
- **Ask:** close in favor of #32.

## PR #23 — "changes" (staging → main) by subhangR (repo owner)

**Verdict: APPROVE-WITH-NITS — owner's authoritative sync; merge FIRST (not a
normal review)**

- This is the **staging→main sync** in the intended direction; staging is the
  authoritative tree. It **supersedes the shared footprint** carried by every
  fork PR — landing it first is what lets the other PRs shrink to their real
  changes.
- **83 files:** `apps/mobile-teacher`(23), `packages/services`(12),
  `api-contract`(8), `repositories`(7), `query`(7), `teacher-web`(6), etc.
- **Nits / merge risk:**
  1. Bundles **6 temp scripts** `scripts/tmp-inspect-nandi{,2..6}.mjs` —
     throwaway inspection files that should not land on `main`.
  2. Includes `functions/sdk-v1/lib/*` **build artifacts** + `pnpm-lock.yaml`.
  3. **CI red:** Build / Lint / Type Check fail (runs 29207197880, 29207211937).
- **Ask (owner's call):** drop the `tmp-inspect-nandi*` scripts, confirm the
  `sdk-v1/lib` artifacts are intended, and get CI green before merging.
  Assessment: acceptable to merge as the sync once cleaned — it is the correct
  direction and unblocks the rest.

---

## Verdict summary

| PR  | Title                        | Verdict                                                                                    |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| #26 | admin-web HMR SessionContext | REQUEST-CHANGES (scope; titular change valid, not on staging)                              |
| #5  | vite 127.0.0.1 + strictPort  | REQUEST-CHANGES (scope; core 6 lines correct)                                              |
| #10 | gitignore/CI hygiene (-115k) | **APPROVE** (only artifacts deleted, 0 source)                                             |
| #18 | Priya login scripts          | **REQUEST-CHANGES — BLOCKING** (hardcoded API key + passwords, prod-mutating, not dry-run) |
| #15 | role journey guides          | APPROVE-WITH-NITS (docs clean; strip footprint)                                            |
| #33 | mobile handover (org, slim)  | REQUEST-CHANGES (CI red + staging overlap) — keeper                                        |
| #20 | mobile handover (fork, fat)  | **CLOSE-DUPLICATE** (superset of #33)                                                      |
| #32 | client handover (org, slim)  | REQUEST-CHANGES (Build/Type pass; lint/tests red; overlap) — keeper                        |
| #19 | client handover (fork, fat)  | **CLOSE-DUPLICATE** (superset of #32)                                                      |
| #23 | staging→main sync (owner)    | APPROVE-WITH-NITS — merge FIRST; drop `tmp-inspect-nandi*`, green CI                       |

**Top findings:** (1) **#18 hardcoded API key + passwords + prod-mutating
scripts = blocking.** (2) Five fork PRs bundle an identical ~70-file staging
footprint incl. committed `sdk-v1/lib` build artifacts — pure scope noise that
#23 already delivers. (3) #20/#19 are strict supersets of #33/#32 → close as
duplicates. (4) #10 deletion audit clean (artifacts only). (5) Merge #23 first
to collapse the footprint, then the rest re-review trivially.
