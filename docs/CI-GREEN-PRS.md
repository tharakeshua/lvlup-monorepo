# Keeping PRs CI-green (100-PR campaign)

Short checklist so fork PRs stay reviewable and Actions stay green.

## Before you open a PR

1. **Stay on a topic branch** from current `origin/main` (or the campaign base).
   Do not commit on `main` if other agents are stacking work there.
2. **Never stage build / test junk:**
   - `functions/*/lib/**` rebuild noise (tracked deploy artifacts — restore with
     `git restore -- functions/*/lib` before commit)
   - `tmp/`, `tmp-*/`, `.ci-logs/`
   - `test-results/`, `playwright-report/`, `blob-report/`, `.lighthouseci/`
   - Service-account JSON (`*service-account*`, `*firebase-adminsdk*`,
     `serviceAccount*.json`)
3. **Run the same gates CI runs first** (fastest signal):

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm exec turbo run typecheck
pnpm run build
```

Optional but recommended for packages you touched:

```bash
pnpm exec turbo run typecheck --filter=@levelup/<pkg>...
pnpm exec prettier --check "path/you/changed/**/*.{ts,tsx,js,jsx,json,md}"
```

4. **Keep the diff small.** Prefer one concern per PR (gitignore, lint config,
   single bugfix). Mixed app + functions + seed scripts PRs are hard to review
   and fail CI for unrelated reasons.
5. **Do not force-push** to shared campaign branches. Do not merge to `origin`
   from the fork unless a maintainer asks.

## What CI expects

See `.github/workflows/ci.yml`. Required path to green `All Checks Complete`:

| Job                                        | Local equivalent                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Lint                                       | `pnpm run lint` + Prettier check                                                 |
| Type Check                                 | `pnpm --filter @levelup/shared-types build` then `pnpm exec turbo run typecheck` |
| Build                                      | `pnpm run build`                                                                 |
| Unit / integration / e2e / visual / schema | `pnpm run test:ci`, Playwright, etc.                                             |

Fix failures in the package your PR owns. Do not drive-by rewrite apps other
lanes are editing (teacher / parent / admin / student).

## Fork PRs and Actions approval

On many orgs, **first-time contributors and fork PRs need a maintainer to
approve workflow runs** (GitHub “Approve and run workflows”).

If your PR shows checks stuck on **Awaiting approval** / **Expected — Waiting
for status to be reported**:

1. Comment on the PR: `@maintainer please approve Actions for this fork PR`.
2. Maintainer: open the PR → **Actions** / checks banner → **Approve and run
   workflows**.
3. Re-run failed jobs after approval if the first run never started.

Maintainers can also allow a fork once under **Settings → Actions → General →
Fork pull request workflows from outside collaborators**.

## Campaign hygiene

- One PR ≈ one commit message theme (`fix(ci): …`, `chore(gitignore): …`).
- After local builds, restore `functions/*/lib` so rebuilt JS does not land in
  the PR.
- Prefer opening CI-only PRs (gitignore, workflow docs, eslint config) early —
  they unblock every later PR.
- Push to `fork` only (`git push -u fork HEAD`). Open the PR against
  `subhangR/lvlup-monorepo` with base `main` (or the campaign target branch).
