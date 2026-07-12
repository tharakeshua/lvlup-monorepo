# GitHub PR Index — Fork → Upstream

**Snapshot:** 2026-07-12 (via GitHub REST API)  
**Fork:** `tharakeshua/lvlup-monorepo`  
**Upstream:** `subhangR/lvlup-monorepo`  
**Local remotes:** `fork` → tharakeshua, `origin` → subhangR

---

## Open PRs into upstream (`subhangR/lvlup-monorepo`)

| # | Title | Head → Base | Author | Draft | Updated (UTC) | URL |
|---|-------|-------------|--------|-------|---------------|-----|
| **4** | fix: W0 identity P0s + B-IDN-03 + CI unblock for main | `tharakeshua:main` → `subhangR:main` | tharakeshua | no | 2026-07-12T16:23:45Z | https://github.com/subhangR/lvlup-monorepo/pull/4 |

**Search total open PRs on upstream:** 1

### PR #4 details (handover-relevant)

- **Reviewer requested:** `kushal10`
- **Head SHA (at snapshot):** `32d72d318c5eb993ecd418c8ca9a52b9cced5e84`
- **Base SHA:** `6d78a34b3f3a0c4001aa3c24bfaa70dcf63b306e`
- **Merged:** no
- **Scope (from PR body):** W0 identity P0s (digitalTestSessions, tenantCode, joinTenant), B-IDN-03 saveStudent cleanup, CI lint/typecheck/build unblock
- **Client impact if unmerged:** Upstream `main` lacks these fixes; demos from fork tip / local branches may diverge from what a clone of `subhangR/lvlup-monorepo` gets

---

## Open PRs on the fork repo itself

API `GET /repos/tharakeshua/lvlup-monorepo/pulls?state=open` → **empty list** (`[]`).

Feature work may exist only as **local / unpushed branches** (e.g. workspace was on `fix/admin-qa-wave` during packing). Treat those as **not yet reviewable on GitHub** until the push agent lands PRs.

---

## Recommended maintainer actions

1. Review + merge **PR #4** (or request changes) so CI/Deploy run on upstream `main`.
2. Expect additional PRs shortly for teacher/student/admin QA fixes and docs/handover once the GitHub push agent finishes consolidating branches.
3. Grant **ActAs** on `lvlup-ff6fa@appspot.gserviceaccount.com` so Functions deploy does not depend on laptop impersonation (see `CLIENT-HANDOVER.md` §6C).

---

## How to refresh this index

```bash
# Prefer GitHub CLI when installed:
gh pr list --repo subhangR/lvlup-monorepo --state open
gh pr list --repo tharakeshua/lvlup-monorepo --state open

# Or API:
curl -sS -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/subhangR/lvlup-monorepo/pulls?state=open"
```
