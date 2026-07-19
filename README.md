# LvlUp Monorepo (Auto LevelUp)

Intelligent multi-tenant student learning + AutoGrade platform.

**Canonical location in AI Brain:** `AI_Brain_Startup/startup-mvp/lvlup/`  
**Sibling product (do not mix):** `startup-mvp/quillmorph/`  
**Brain brief:** [`../LVLUP_BRIEF.md`](../LVLUP_BRIEF.md) · **Idea node:**
[`../../data/ideas/levelup_product_node.json`](../../data/ideas/levelup_product_node.json)

## Quick links

| Doc                                                      | Purpose                             |
| -------------------------------------------------------- | ----------------------------------- |
| [RUNNING_APPS.md](./RUNNING_APPS.md)                     | Ports + credentials (emulator path) |
| [DATA-MODEL-FIX-PLAN.md](./DATA-MODEL-FIX-PLAN.md)       | Domain / Firestore foundation plan  |
| [API_REDESIGN.md](./API_REDESIGN.md)                     | Callable API consolidation plan     |
| [docs/rebuild-spec/status/](./docs/rebuild-spec/status/) | SDK v1 rebuild reviews              |

## Stack

- **Apps:** React/Vite web + Expo mobile (`apps/*`)
- **Backend:** Firebase Functions (`functions/sdk-v1` target; legacy modules
  still present)
- **SSOT types:** `packages/domain` (Zod)
- **Package manager:** pnpm 9 + Turbo

## Deploy (Firebase)

Project: `lvlup-ff6fa` · Hosting targets: admin / teacher / student / parent /
super-admin / website

```bash
# All 6 web apps → Firebase Hosting
pnpm run deploy:hosting

# Cloud Functions only (preserves prepare/cleanup exit codes)
pnpm run deploy:functions

# Functions + hosting
pnpm run deploy:all
```

**CI secrets (GitHub Environment `production`):** set either `FIREBASE_TOKEN`
(`firebase login:ci`) or `FIREBASE_SERVICE_ACCOUNT` (service-account JSON).
Empty token is why Hosting previously failed while Preview stayed skipped.

Live sites after hosting deploy:

- https://lvlup-ff6fa-admin.web.app
- https://lvlup-ff6fa-teacher.web.app
- https://lvlup-ff6fa-student.web.app
- https://lvlup-ff6fa-parent.web.app
- https://lvlup-ff6fa-super-admin.web.app
- https://lvlup-ff6fa-website.web.app

## Upstream

https://github.com/lvlup-gg/lvlup-monorepo (canonical) · legacy:
https://github.com/subhangR/lvlup-monorepo
