export const meta = {
  name: 'rebuild-spec',
  description: 'Audit every app/backend/domain of auto-levelup and produce a complete fresh-build spec (better design, React Native apps, common API layer)',
  phases: [
    { title: 'Status Scan', detail: 'one agent per app/backend/domain reads code & writes a status report' },
    { title: 'Spec Synthesis', detail: 'specialist agents turn status reports into spec sections' },
    { title: 'Final Assembly', detail: 'one agent assembles the complete rebuild spec document' },
  ],
}

const BASE = '/Users/subhang/Desktop/Projects/auto-levleup'
const STATUS_DIR = `${BASE}/docs/rebuild-spec/status`
const SPEC_DIR = `${BASE}/docs/rebuild-spec/specs`

const STATUS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['domain', 'reportFile', 'summary', 'coreConcepts', 'schemasAndApis', 'strengths', 'painPoints', 'rebuildNotes'],
  properties: {
    domain: { type: 'string' },
    reportFile: { type: 'string', description: 'absolute path of the markdown report written' },
    summary: { type: 'string', description: '3-5 sentence executive summary of current state' },
    coreConcepts: { type: 'array', items: { type: 'string' }, description: 'core domain concepts that MUST be preserved in a rebuild' },
    schemasAndApis: { type: 'array', items: { type: 'string' }, description: 'key entities, schemas, collections, callable functions, routes' },
    strengths: { type: 'array', items: { type: 'string' } },
    painPoints: { type: 'array', items: { type: 'string' }, description: 'tech debt, inconsistencies, design problems to fix in rebuild' },
    rebuildNotes: { type: 'array', items: { type: 'string' }, description: 'concrete recommendations for the fresh build' },
  },
}

const SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['section', 'specFile', 'summary', 'openQuestions'],
  properties: {
    section: { type: 'string' },
    specFile: { type: 'string' },
    summary: { type: 'string' },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
}

const ctx = `You are auditing the "auto-levelup" monorepo (an intelligent student learning + autograding platform). Repo root: ${BASE}.
Monorepo layout: apps/{teacher-web,student-web,admin-web,super-admin,parent-web} (Vite+React+TS), LevelUp-App/ (legacy standalone app), functions/{identity,levelup,autograde,analytics,shared} (Firebase Cloud Functions, TS), packages/{shared-types,shared-services,shared-hooks,shared-stores,shared-ui,shared-utils,tailwind-config,eslint-config}, firestore.rules + firestore.indexes.json (access model), requirements/ (per-app requirement docs incl. a planned scanner-app), docs/ (extensive existing audit reports & design plans). shared-types/src is the domain-model source of truth (identity, tenant, content, levelup, autograde, progress, analytics, gamification, notification, schemas, callable-types).
Read real code — open files, follow imports, inspect schemas/rules/routes. Do not invent. When you cite something use file paths.`

const STATUS_AGENTS = [
  { key: 'app-teacher-web', label: 'teacher-web', scope: `The teacher-web app at apps/teacher-web. Map its pages (apps/teacher-web/src/pages), components, layouts, guards, routing (App.tsx), state, services it calls, and which backend callables/collections it uses. Cover teacher role capabilities: classes, students, spaces/content authoring, exams creation, grading review, LaTeX rendering, settings.` },
  { key: 'app-student-web', label: 'student-web', scope: `The student-web app at apps/student-web. Map pages, components, guards, routing, hooks, lib. Cover the student learning experience: spaces, story points, practice, exams/submissions, progress, gamification, chat/AI tutoring.` },
  { key: 'app-admin-web', label: 'admin-web', scope: `The admin-web (tenant/academy admin) app at apps/admin-web. Map pages, routing, and admin capabilities: tenant management, class management, teacher/student/parent user management, memberships, settings. Cross-reference docs/ADMIN-WEB-AUDIT-REPORT.md and requirements/admin-web.` },
  { key: 'app-super-admin', label: 'super-admin', scope: `The super-admin app at apps/super-admin. Map pages, routing, and platform-level capabilities: tenant provisioning, cross-tenant management, billing/cost, platform analytics, feature flags. Cross-reference docs/SUPER-ADMIN-AUDIT-REPORT.md and requirements/super-admin.` },
  { key: 'app-parent-web', label: 'parent-web', scope: `The parent-web app at apps/parent-web. Map pages, routing, parent role: child progress visibility, announcements/notifications, exam results. Cross-reference docs/PARENT-WEB-AUDIT-REPORT.md and requirements/parent-web.` },
  { key: 'app-legacy-and-scanner', label: 'legacy+scanner', scope: `Two things: (1) the legacy standalone LevelUp-App/ — summarize what it is, its src/apps structure, and what concepts it pioneered that the new monorepo apps inherited or still need; (2) the planned scanner-app — read requirements/scanner-app/requirements.md and describe the intended scanner role (likely OMR/exam-sheet scanning & upload for offline grading). Note overlap and what should carry forward.` },
  { key: 'be-identity', label: 'identity-fn', scope: `The functions/identity backend codebase. Map its callable functions (src/callable), triggers, scheduled jobs, notifications, utils. This owns auth, users, tenants, memberships, custom claims. Document the user/role/tenant model end to end.` },
  { key: 'be-levelup', label: 'levelup-fn', scope: `The functions/levelup backend codebase. Map callable functions (src/callable), triggers, prompts (src/prompts — the AI features), types, utils. This owns spaces, story points, question bank, answer keys, chat/agents, learning progress, test sessions.` },
  { key: 'be-autograde', label: 'autograde-fn', scope: `The functions/autograde backend codebase. Map callable functions, the grading pipeline (src/pipeline), prompts (AI evaluation), schedulers, triggers, dead-letter handling, types. This owns exams, exam questions, submissions, question-submissions, AI grading/evaluation, rubrics. Also peek at top-level autograde/ dir for the original POC.` },
  { key: 'be-analytics', label: 'analytics-fn', scope: `The functions/analytics backend codebase. Map callables (get-summary), schedulers (daily-cost-aggregation, nightly-at-risk-detection, generate-insights), triggers (on-submission-graded, on-exam-results-released, on-space-progress-updated, etc), notification-sender util. This owns insights, cost tracking, at-risk detection, notifications fan-out.` },
  { key: 'domain-model', label: 'domain-model', scope: `The domain model in packages/shared-types/src. Catalog EVERY entity/schema by area (identity, tenant, content, levelup, autograde, progress, analytics, gamification, notification), the branded ID types, and the Firestore collection structure they imply. This is the most important report — it defines the core concepts that MUST survive a rebuild. Also read docs/DOMAIN_SQL_MODEL.md and docs/domain-glossary.md.` },
  { key: 'shared-packages', label: 'shared-pkgs', scope: `The shared frontend packages: packages/shared-services, shared-hooks, shared-stores, shared-ui, shared-utils, tailwind-config. Document what each provides, the service/data-access patterns, state management (stores), the UI component library, and how apps consume them. Cross-reference docs/shared-packages.md and docs/BACKEND-SHARED-PACKAGES-AUDIT-REPORT.md.` },
  { key: 'auth-access', label: 'auth+access', scope: `The auth, roles, permissions and access-control model. Read firestore.rules (and firestore.indexes.json), database.rules.json, storage.rules, and the claims model in packages/shared-types/src/identity (claims.ts, membership.ts) and functions/identity. Document every role (super-admin, admin, teacher, student, parent, scanner), what each can access, how tenant isolation + RLS works, and weaknesses.` },
  { key: 'api-layer', label: 'api-layer', scope: `The API layer. Read packages/shared-types/src/callable-types.ts (621 lines) and enumerate ALL callable function contracts, plus how shared-services wraps them. Read API_REDESIGN.md and docs/REVIEW-UNIFIED-ARCHITECTURE-BLUEPRINT.md. Assess the current RPC/callable style and what a clean common API layer (shared by web + future React Native) should look like.` },
  { key: 'ai-features', label: 'ai-features', scope: `All AI features. Read functions/levelup/src/prompts and functions/autograde/src/prompts, any agent definitions (shared-types levelup/agent.ts, chat.ts), gemini usage (autograde/gemini-* dirs, LevelUp-App). Document: AI content generation, AI autograding/evaluation, AI tutoring/chat agents, insights generation, cost/LLM-call logging. Note models used and prompt architecture.` },
  { key: 'routing-appmgmt', label: 'routing+appmgmt', scope: `Cross-app routing, app shell/management, and navigation patterns. For each of the 5 web apps inspect App.tsx, layouts/, guards/ and describe the routing approach, route guards by role, shared layout/navigation, deployment (firebase.json hosting targets), and the start.sh / RUNNING_APPS.md dev orchestration. Identify inconsistencies across apps.` },
  { key: 'testing-infra', label: 'testing+infra', scope: `Testing & infrastructure posture. Cover Playwright e2e (playwright.config.ts, tests/e2e), vitest unit/integration/schema tests, turbo/pnpm workspace setup, CI (.github), seeding (scripts/seed-emulator), and firebase deploy flow (scripts/prepare-functions-deploy). Summarize coverage and gaps relevant to a rebuild.` },
]

phase('Status Scan')
log(`Scanning ${STATUS_AGENTS.length} domains across apps, backend, domain model, auth, API, AI, routing, testing...`)

const statusResults = (await parallel(STATUS_AGENTS.map(d => () =>
  agent(
    `${ctx}\n\nYOUR ASSIGNMENT (${d.label}): ${d.scope}\n\nProduce a thorough STATUS report and WRITE it as markdown to ${STATUS_DIR}/${d.key}.md. The report must cover: (1) what currently exists & how it's architected, (2) the entities/schemas/collections/APIs/routes involved (with file paths), (3) strengths worth keeping, (4) pain points / tech debt / inconsistencies, (5) concrete recommendations for a fresh rebuild that keeps core concepts but improves design and supports a common API layer + future React Native apps. Be concrete and cite file paths. After writing the file, return the structured summary.`,
    { label: d.label, phase: 'Status Scan', schema: STATUS_SCHEMA }
  )
))).filter(Boolean)

log(`Status scan complete: ${statusResults.length}/${STATUS_AGENTS.length} reports written. Synthesizing spec sections...`)

const statusIndex = statusResults.map(r =>
  `### ${r.domain}\nreport: ${r.reportFile}\nsummary: ${r.summary}\ncoreConcepts: ${(r.coreConcepts||[]).join('; ')}\nschemasAndApis: ${(r.schemasAndApis||[]).join('; ')}\npainPoints: ${(r.painPoints||[]).join('; ')}\nrebuildNotes: ${(r.rebuildNotes||[]).join('; ')}`
).join('\n\n')

const SPEC_AGENTS = [
  { key: 'domain-and-data', label: 'spec:domain+data', title: 'Domain Model & Data Architecture', read: ['domain-model', 'auth-access', 'be-identity'],
    focus: `Define the canonical domain model for the fresh build: all core entities, relationships, branded IDs, the Firestore (or proposed DB) collection/document model, multi-tenant isolation, and the access/permission model by role. Preserve every core concept identified in status reports. Recommend any consolidation/cleanup.` },
  { key: 'common-api', label: 'spec:common-api', title: 'Common API Layer', read: ['api-layer', 'shared-packages', 'be-identity', 'be-levelup', 'be-autograde', 'be-analytics'],
    focus: `Design the unified common API layer consumed by ALL clients (5 web apps + new React Native apps). Define API surface (resources/endpoints or typed callables), auth flow, a shared typed client SDK in packages/, error model, pagination, and how it maps to existing callables. This is central to the rebuild.` },
  { key: 'backend-services', label: 'spec:backend', title: 'Backend Services & Cloud Functions', read: ['be-identity', 'be-levelup', 'be-autograde', 'be-analytics', 'ai-features'],
    focus: `Spec the backend service architecture for the rebuild: identity, levelup (content/learning), autograde (exams/grading pipeline), analytics. Triggers, schedulers, dead-letter/reliability, and how AI calls + cost logging fit. Recommend boundaries and any restructuring.` },
  { key: 'ai-spec', label: 'spec:ai', title: 'AI Features', read: ['ai-features', 'be-levelup', 'be-autograde', 'be-analytics'],
    focus: `Spec all AI features for the rebuild: content generation, autograding/evaluation, AI tutoring/chat agents, insights & at-risk detection. Define prompt architecture, model selection (default to latest Claude / Gemini as used), cost & call logging, and guardrails. Keep core capabilities, improve structure.` },
  { key: 'webapps-design', label: 'spec:web+design', title: 'Web Apps & Design System', read: ['app-teacher-web', 'app-student-web', 'app-admin-web', 'app-super-admin', 'app-parent-web', 'shared-packages', 'routing-appmgmt'],
    focus: `Spec the rebuilt web apps (teacher, student, admin, super-admin, parent) with a better, consistent design system: shared UI component library, design tokens (Tailwind), routing & role guards, app shell/navigation, and per-app page inventory mapping to the common API. Call out current inconsistencies to eliminate.` },
  { key: 'mobile-rn', label: 'spec:react-native', title: 'React Native Apps', read: ['app-student-web', 'app-teacher-web', 'app-legacy-and-scanner', 'shared-packages', 'api-layer', 'auth-access'],
    focus: `Spec NEW React Native (Expo) apps: which roles get mobile apps (student & teacher likely; scanner app for OMR/exam-sheet scanning), navigation, shared logic reuse with web via the common API layer + shared packages, offline/sync needs (esp. scanner), push notifications, and a shared cross-platform design language. This is a net-new addition the user explicitly requested.` },
  { key: 'platform-infra', label: 'spec:platform', title: 'Platform, Auth, Roles & Infra', read: ['auth-access', 'routing-appmgmt', 'testing-infra', 'be-identity'],
    focus: `Spec the platform foundations: auth & session, roles/permissions/claims matrix (super-admin, admin, teacher, student, parent, scanner), tenant provisioning, monorepo & build tooling (turbo/pnpm), CI/CD & deploy, testing strategy (unit/integration/e2e/seeding), and environments. Establish the rebuild's non-functional foundation.` },
]

phase('Spec Synthesis')

const specResults = (await parallel(SPEC_AGENTS.map(s => () => {
  const reads = s.read.map(k => `${STATUS_DIR}/${k}.md`).join(', ')
  return agent(
    `${ctx}\n\nThe status-scan phase is done. Here is the index of ALL status reports:\n\n${statusIndex}\n\nYOUR ASSIGNMENT: write the "${s.title}" section of the fresh-build spec. Focus: ${s.focus}\n\nFirst READ these detailed status reports for ground truth: ${reads} (read others from ${STATUS_DIR}/ if useful). Then WRITE a complete, implementation-grade spec section as markdown to ${SPEC_DIR}/${s.key}.md. Requirements: keep ALL core concepts from current system intact, improve the design, and ensure everything is compatible with a single common API layer shared by web + new React Native apps. Include concrete schemas/contracts/diagrams-as-text/component lists where relevant, and a short migration note from the current code. After writing, return the structured summary.`,
    { label: s.label, phase: 'Spec Synthesis', schema: SPEC_SCHEMA }
  )
}))).filter(Boolean)

log(`Spec synthesis complete: ${specResults.length}/${SPEC_AGENTS.length} sections written. Assembling final document...`)

phase('Final Assembly')

const specIndex = specResults.map(r => `- ${r.section} -> ${r.specFile}\n  summary: ${r.summary}\n  openQuestions: ${(r.openQuestions||[]).join('; ')}`).join('\n')

const final = await agent(
  `${ctx}\n\nAll status reports are in ${STATUS_DIR}/ and all spec sections are in ${SPEC_DIR}/. Spec sections written:\n${specIndex}\n\nYOUR ASSIGNMENT: assemble the COMPLETE fresh-build specification document. READ every file in ${SPEC_DIR}/ (and consult ${STATUS_DIR}/ as needed). Then WRITE a single cohesive master document to ${BASE}/docs/rebuild-spec/COMPLETE-REBUILD-SPEC.md with this structure:\n1. Executive Summary (what the platform is, current state in one page, the rebuild vision).\n2. Current-State Status Overview (concise per app + backend + domain, linking to the status reports).\n3. Core Concepts To Preserve (the non-negotiable domain concepts).\n4. Target Architecture (monorepo, common API layer, backend services, data model, multi-tenant + roles/permissions matrix).\n5. Domain Model & Data Architecture.\n6. Common API Layer (the shared typed client for web + React Native).\n7. Backend Services & Cloud Functions.\n8. AI Features.\n9. Web Apps & Design System.\n10. New React Native Apps (student, teacher, scanner).\n11. Platform, Auth, Roles & Infra.\n12. Migration / Build Roadmap (phased plan to build fresh with core concepts intact).\n13. Open Questions & Risks.\nUse cross-references to the detailed section files rather than duplicating everything verbatim, but make the master doc self-sufficient as a reading. After writing, return JSON {specFile, summary, sectionCount}.`,
  { label: 'final-assembler', phase: 'Final Assembly',
    schema: { type: 'object', additionalProperties: false, required: ['specFile', 'summary', 'sectionCount'], properties: { specFile: { type: 'string' }, summary: { type: 'string' }, sectionCount: { type: 'number' } } }
  }
)

return {
  statusReports: statusResults.length,
  specSections: specResults.length,
  master: final,
  statusDir: STATUS_DIR,
  specDir: SPEC_DIR,
}
