# GitHub PR Index — Fork → Upstream

**Snapshot:** 2026-07-13 (via `gh pr list`, authenticated)  
**Fork:** `tharakeshua/lvlup-monorepo`  
**Upstream:** `subhangR/lvlup-monorepo`  
**Local remotes:** `fork` → tharakeshua, `origin` → subhangR

---

## Open PRs into upstream (`subhangR/lvlup-monorepo`)

| #      | Title                                                                             | Head                                       | URL                                                |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **4**  | fix: W0 identity P0s + B-IDN-03 + CI unblock for main                             | `tharakeshua:main`                         | https://github.com/subhangR/lvlup-monorepo/pull/4  |
| **5**  | chore(vite): bind admin/parent dev servers to 127.0.0.1 with strictPort           | `chore/vite-ipv4-strictport-admin-parent`  | https://github.com/subhangR/lvlup-monorepo/pull/5  |
| **6**  | fix(teacher-web): soft-fail getSummary 403s on dashboard/class pages              | `fix/teacher-softfail-class-summary-403`   | https://github.com/subhangR/lvlup-monorepo/pull/6  |
| **7**  | fix(teacher-web): persist QP images mid-wizard + clearer extract UX               | `fix/teacher-exam-extract-persist-ux`      | https://github.com/subhangR/lvlup-monorepo/pull/7  |
| **8**  | fix(teacher-web): expand SP after create and always open item editor              | `fix/teacher-space-editor-add-item-ux`     | https://github.com/subhangR/lvlup-monorepo/pull/8  |
| **9**  | fix(student-web): auto-switch or pick school when membership missing              | `fix/student-require-auth-school-picker`   | https://github.com/subhangR/lvlup-monorepo/pull/9  |
| **10** | chore(ci): ignore test artifacts and document CI-green PRs                        | `chore/ci-gitignore-hygiene`               | https://github.com/subhangR/lvlup-monorepo/pull/10 |
| **11** | fix(student-web): shared B2B/B2C space path helpers for breadcrumbs               | `fix/student-b2b-b2c-space-paths`          | https://github.com/subhangR/lvlup-monorepo/pull/11 |
| **12** | fix(identity): scope getClass to teacher claim classIds + tests                   | `fix/identity-getclass-teacher-scope`      | https://github.com/subhangR/lvlup-monorepo/pull/12 |
| **13** | fix(autograde): nondestructive dead-letter resolve + missing submissionId guard   | `fix/autograde-dead-letter-nondestructive` | https://github.com/subhangR/lvlup-monorepo/pull/13 |
| **14** | fix(repositories): unwrap getSpace/progress/store listing wire envelopes          | `fix/repos-unwrap-wire-envelopes`          | https://github.com/subhangR/lvlup-monorepo/pull/14 |
| **15** | docs(journeys): add student/teacher/parent/admin journey guides                   | `docs/role-journey-guides`                 | https://github.com/subhangR/lvlup-monorepo/pull/15 |
| **16** | test(e2e): add teacher QA swarm critical Playwright suite                         | `test/e2e-teacher-qa-swarm-critical`       | https://github.com/subhangR/lvlup-monorepo/pull/16 |
| **17** | test(e2e): add teacher full QA final/priya/retest Playwright suites               | `test/e2e-teacher-full-qa-suites`          | https://github.com/subhangR/lvlup-monorepo/pull/17 |
| **18** | chore(scripts): Priya login diagnose/fix/heal helpers                             | `chore/scripts-priya-login-ops`            | https://github.com/subhangR/lvlup-monorepo/pull/18 |
| **19** | fix(handover): admin/parent soft-fail UX, repo parity, docs and authentic e2e     | `fix/client-handover-bundle`               | https://github.com/subhangR/lvlup-monorepo/pull/19 |
| **20** | fix(student-web)+docs: mobile handover route/envelope repairs and QA compat notes | `fix/mobile-handover`                      | https://github.com/subhangR/lvlup-monorepo/pull/20 |
| **21** | fix(student-web): repair route conflicts, envelope unwraps, and tenant guards     | `fix/mobile-backend-parity`                | https://github.com/subhangR/lvlup-monorepo/pull/21 |
| **22** | fix(auth): v2\_ membership reads, collection prefix, targetTenantId               | `fix/p0-auth-membership-v2`                | https://github.com/subhangR/lvlup-monorepo/pull/22 |
| **23** | changes _(upstream staging → main, author subhangR)_                              | `staging`                                  | https://github.com/subhangR/lvlup-monorepo/pull/23 |
| **24** | fix(teacher): coerce legacy rubric presets so list renders in DEV                 | `fix/teacher-rubric-presets-coerce`        | https://github.com/subhangR/lvlup-monorepo/pull/24 |
| **25** | fix(teacher-web): keep SessionContext stable across Vite HMR                      | `fix/teacher-session-hmr-context`          | https://github.com/subhangR/lvlup-monorepo/pull/25 |
| **26** | fix(admin-web): keep SessionContext stable across Vite HMR                        | `fix/admin-session-hmr-context`            | https://github.com/subhangR/lvlup-monorepo/pull/26 |

**Handover-critical P0 HMR:**

| Fix                                  | PR                               | Status |
| ------------------------------------ | -------------------------------- | ------ |
| Teacher SessionContext HMR singleton | **#25**                          | OPEN   |
| Admin SessionContext HMR singleton   | **#26** (also in **#19** bundle) | OPEN   |

---

### PR #4 details (mega / handover-relevant)

- **Reviewer requested:** `kushal10`
- **Head:** `tharakeshua:main` @ `32d72d3` (snapshot)
- **Scope:** W0 identity P0s, B-IDN-03, CI lint/typecheck/build unblock
- **Client impact if unmerged:** Upstream `main` lacks these fixes; demos should
  use fork tip / topic branches

---

## Recommended maintainer actions

1. Review + merge **PR #4** (identity/CI) and topic PRs needed for demo (#19
   handover docs, #22 auth, #25 teacher HMR, #26 admin HMR).
2. Approve Actions for fork PRs if checks are waiting on first-time contributor
   approval (`docs/CI-GREEN-PRS.md`).
3. Grant **ActAs** on `lvlup-ff6fa@appspot.gserviceaccount.com` so Functions
   deploy does not depend on laptop impersonation.

---

## How to refresh this index

```bash
gh pr list --repo subhangR/lvlup-monorepo --state open --limit 50
gh pr list --repo tharakeshua/lvlup-monorepo --state open
```
