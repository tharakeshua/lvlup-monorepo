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

## Upstream

https://github.com/subhangR/lvlup-monorepo
