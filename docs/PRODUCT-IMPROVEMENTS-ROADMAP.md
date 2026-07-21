# LvlUp Product & Engineering Roadmap

**Status:** Active planning (develop)  
**Last updated:** 2026-07-21  
**Scope:** Remaining product, release, backend, frontend, and student-experience work  
**Code root:** `startup-mvp/lvlup/`

This document prioritizes remaining LvlUp work **P0 → P3**. Each item lists the goal, current state, next engineering steps, and acceptance criteria. Scaffolding stubs landed in the same commit are called out inline.

---

## How to use this roadmap

| Priority | Meaning |
| -------- | ------- |
| **P0** | Ship blocker, security/correctness, or revenue-critical path |
| **P1** | Required for a credible school pilot / production cutover |
| **P2** | High leverage; schedule after P0/P1 stabilization |
| **P3** | Polish, scale, or market expansion |

**Dependency spine:** Fix P0 identity/tenant bugs → finish sdk-v1 cutover → Supabase LLM reads → bulk import completeness → scanner module → release infra.

---

## P0 — Correctness, security, core ops

### P0-1 · Identity & tenant isolation security

| | |
| --- | --- |
| **Goal** | Every read/write is tenant-scoped; school codes resolve correctly; no cross-tenant leakage |
| **State** | Known bugs: `tenantCode` vs `code` (B-IDN-01), `joinTenant` doc-id lookup (B-IDN-02), test-session collection mismatch (SVC-1) |
| **Next** | Fix in `packages/services/src/identity/org-users.ts` + `repo-admin/tx.ts`; add regression tests; audit Firestore rules for `v2_` prefix |
| **Done when** | Dogfood tenant SUB001 + Greenwood pass join/create flows; security review sign-off on callable-only client access |

### P0-2 · Bulk import (all org roles)

| | |
| --- | --- |
| **Goal** | CSV import for teachers, students, parents, scanner accounts, and staff |
| **State** | Students + teachers wired via `BulkImportDialog` on `UsersPage` + sdk-v1 callables. Parents, scanner, staff **not** implemented |
| **Next** | Implement `bulkImportParents`, `bulkImportStaff`, `bulkImportScanners` callables (extend `runBulkImport` role mapping); dry-run + row-level errors; admin hub at `/bulk-import` |
| **Stub** | `apps/admin-web/src/pages/BulkImportPage.tsx`, `apps/admin-web/src/lib/bulk-import-callables.ts` |
| **Done when** | 500-row dry-run per entity type; idempotent re-import; audit log + notification on completion |

### P0-3 · Scanner orchestration + module (Manual Agent)

| | |
| --- | --- |
| **Goal** | Field scanner PWA: QR attach → capture answer sheets → session close → pipeline enqueue |
| **State** | `scanner` role + seed data exist; **no** `apps/scanner-web`; teacher upload path works; QR batch journey is **GAP** (`docs/requirements/EXAM-QR-BATCH-JOURNEY.md`) |
| **Next** | Admin provisioning UI; scanner session API (`startSession`, `attachQr`, `uploadPage`, `closeSession`); handwriting scope `(tenantId, examId, studentId)`; LD-01 answer-key isolation |
| **Stub** | `docs/scanner/SCANNER-MODULE.md`, `apps/admin-web/src/pages/ScannerModulePage.tsx`, `packages/services/src/scanner/orchestration.ts` |
| **Done when** | End-to-end demo: print QR → scan 3 sheets → submission appears in teacher review queue |

### P0-4 · SQL migration (Supabase telemetry) — plan only

| | |
| --- | --- |
| **Goal** | Supabase PostgreSQL as LLM ledger + future relational reads; **no fake migration in repo** |
| **State** | Foundation migration exists: `supabase/migrations/20260718160000_llm_tracking_foundation.sql`. Writes via `@levelup/ai` → `packages/services/src/supabase/llm-telemetry.ts` |
| **Next** | Phase 2: quota reservation tables + aggregation jobs; Phase 3: read APIs for admin/super-admin dashboards; **do not** duplicate schema — extend existing migration chain |
| **Done when** | Admin AI Usage reads from Supabase (not Firestore `llmCallLogs` rollups) with feature flag cutover |

### P0-5 · LLM management & per-user usage tracking

| | |
| --- | --- |
| **Goal** | Platform + tenant + **per-user** AI usage, budgets, and purpose breakdown |
| **State** | Firestore daily summaries + tenant `AIUsagePage` + super-admin `LLMUsagePage`; Supabase write path live; read path still legacy |
| **Next** | Finish `getTenantLlmUsage` / `getUserLlmUsage` Supabase reads; wire admin per-user tab; student AI quota surface |
| **Stub** | `packages/services/src/llm/usage-reads.ts`, placeholder section in admin `AIUsagePage` |
| **Done when** | Teacher/student attribution visible to tenant admin; quota enforcement uses Supabase counters |

---

## P1 — Pilot-ready release & platform

### P1-1 · CI/CD (monorepo green path)

| | |
| --- | --- |
| **Goal** | PR → typecheck → unit tests → selective e2e → deploy previews |
| **State** | Partial GitHub Actions; `docs/CI-GREEN-PRS.md` exists |
| **Next** | Matrix: `packages/services`, `functions/sdk-v1`, each Vite app; emulator smoke on develop; block merge on P0 test suite |
| **Done when** | `develop` deploys Firebase hosting + functions on tag |

### P1-2 · Domain, email, and transactional comms

| | |
| --- | --- |
| **Goal** | Custom domains per app, SPF/DKIM, password reset, exam notifications, parent digests |
| **State** | Firebase default domains; email templates partial |
| **Next** | Map branded domains → hosting; Resend/SendGrid; template registry in `@levelup/services/notification` |
| **Done when** | Greenwood pilot on branded URLs; deliverability > 95% in seed test |

### P1-3 · Tenant isolation hardening (release gate)

| | |
| --- | --- |
| **Goal** | Defense in depth beyond callables: Storage rules, signed URLs, impersonation audit |
| **State** | Callable-only `v2_` prefix; Storage rules need exam/submission audit |
| **Next** | Rule review per bucket path; penetration test on IDOR; impersonation session TTL |
| **Done when** | Documented threat model + no open Storage paths in QA scan |

### P1-4 · Play Store / App Store (mobile)

| | |
| --- | --- |
| **Goal** | Expo apps in store listings |
| **State** | Expo projects exist; store metadata not finalized |
| **Next** | EAS build profiles; privacy policy; screenshot pipeline; deep links to school code join |
| **Done when** | Internal TestFlight + Play internal track for one pilot school |

---

## P2 — Backend depth & teacher/student product

### P2-1 · MCP agents & agent personas

Configurable tutor/grader/author personas via MCP tool surface. **State:** Agent config panels in teacher space editor; no MCP server.

### P2-2 · Search (users, content, submissions)

Fast tenant-scoped search. **State:** Client-side filter on list pages only.

### P2-3 · File storage & policy

Consistent upload paths, retention, answer-key segregation (LD-01). **State:** Ad-hoc Storage paths per feature.

### P2-4 · Multimodality (student answer composer)

Unified multimodal answer bundle per `docs/design/ai-questions/00-cohesive-experience.md`. **Stub:** Vertical split in `QuestionAnswerer`.

### P2-5 · Progress calculation & submission history

Server-authoritative progress recompute + student attempt history on all surfaces.

### P2-6 · Teacher content generation

AI-assisted item/story-point generation with cost attribution and publish gates.

### P2-7 · Batch grading architecture

EOD batch jobs for exam submissions + teacher batch review. **State:** Real-time pipeline + `BatchGradingPage`; no EOD scheduler.

### P2-8 · Frontend performance (all web apps)

LCP < 2.5 s, route-level code split, list virtualization.

### P2-9 · Loaders & render optimization

Consistent skeletons, suspense boundaries, no layout shift.

---

## P3 — Scale & polish

### P3-1 · Student AI usage per user (self-service)

Students see personal AI tutor usage vs school allowance on Profile/Settings.

### P3-2 · Post-exam auto-learning space

Auto-create remediation space from wrong answers (QR journey stage 8).

### P3-3 · Parent/scanner dedicated web apps

Evaluate PWA vs native scanner; share `@levelup/shared-ui` shell.

---

## Scaffolding index (this commit)

| Artifact | Type | Notes |
| -------- | ---- | ----- |
| `docs/PRODUCT-IMPROVEMENTS-ROADMAP.md` | Plan | This file |
| `docs/scanner/SCANNER-MODULE.md` | Plan | Scanner orchestration stub spec |
| `apps/admin-web/src/pages/BulkImportPage.tsx` | UI stub | CSV hub for all entity types |
| `apps/admin-web/src/lib/bulk-import-callables.ts` | Client stub | TODO callables for parents/staff/scanner |
| `apps/admin-web/src/pages/ScannerModulePage.tsx` | UI stub | Admin scanner ops placeholder |
| `packages/services/src/scanner/orchestration.ts` | Service stub | Session orchestration TODOs |
| `packages/services/src/llm/usage-reads.ts` | Service stub | Supabase read TODOs |
| `apps/student-web/.../QuestionAnswerer.tsx` | UX | lg+ vertical split question \| answer |

---

## Suggested sprint order (next 4 weeks)

1. **Week 1:** P0-1 identity fixes + P0-2 parents/staff/scanner bulk import callables  
2. **Week 2:** P0-3 scanner session API + admin provisioning; P0-5 usage read service  
3. **Week 3:** P1-1 CI/CD + P1-2 domain/email  
4. **Week 4:** P2-8/P2-9 frontend perf + P2-4 multimodal composer phase 1  

---

## Related docs

- `startup-mvp/LVLUP_BRIEF.md` — product brief & architecture spine  
- `docs/llm-tracking/LLM-TRACKING-FRAMEWORK-PLAN.md` — telemetry detail  
- `docs/requirements/EXAM-QR-BATCH-JOURNEY.md` — scanner / batch grading journey  
- `docs/design/ai-questions/` — student answer UX north star  
