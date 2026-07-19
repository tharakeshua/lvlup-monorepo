# LLM Operations Team Charter

Status: active operating model  
Project: Auto-LevelUp (`proj_1770737500750_ncgopleip`)  
Last reviewed: 2026-07-18

## Mission

Own the complete server-side LLM control plane across tutoring, agents, chat,
content generation, extraction, evaluation, grading, web apps, and mobile apps.
The team keeps credentials secure, attributes every call correctly, controls
tenant and platform spend, supports user BYOK, and verifies production behavior.

## Maestro roster

Team: `🤖 LLM Operations`  
Team ID: `team_1784385728524_033jee98n`

| Role                                   | Maestro team-member ID       |
| -------------------------------------- | ---------------------------- |
| LLM Operations Lead                    | `tm_1784385630267_njb3ws7dl` |
| AI Gateway and Provider Engineer       | `tm_1784385646487_7h25pfx7k` |
| API Key Security and Rotation Engineer | `tm_1784385656020_osyc2yxzi` |
| Tenant AI Controls Engineer            | `tm_1784385662833_1e36ix02y` |
| Platform AI Controls Engineer          | `tm_1784385669481_5xn1hdod7` |
| BYOK Experience Engineer               | `tm_1784385678246_eh91j8gr1` |
| LLM Telemetry and Cost Engineer        | `tm_1784385687057_p42oicyrq` |
| LLM Release and Verification Engineer  | `tm_1784385694667_wr6m3dcdm` |

The lead is the Maestro team leader. Every member has the canonical reference
paths embedded in both its identity and persistent memory.

## Required references

Every team member must read the references relevant to a task before changing
code or production configuration:

1. `docs/api-design/API-KEY-MANAGEMENT-REFERENCE.md` — credential hierarchy,
   security invariants, callable API, operations, current rollout state, and
   runbooks.
2. `docs/llm-tracking/LLM-TRACKING-FRAMEWORK-PLAN.md` — request/attempt
   telemetry, causation, attribution, cost, and Supabase model.
3. `docs/api-design/AI-EVALUATION-CORE-PLAN.md` — the unified evaluation paths
   that consume the AI gateway.
4. `docs/api-design/API-KEY-MANAGEMENT-PLAN.md` — locked product decisions and
   future phases. The implementation reference takes precedence when the plan
   and landed code differ.

No reference contains secret values. Team members must never place provider keys
in source control, Firestore documents, client bundles, logs, task reports,
screenshots, or Maestro memory.

## Team roles

### LLM Operations Lead

Accountable coordinator and final production gate. Owns architecture boundaries,
cross-workstream sequencing, risk decisions, incident coordination, and the
definition of done. The lead assigns implementation to specialist owners and
requires evidence before accepting completion.

### AI Gateway & Provider Engineer

Owns the central AI gateway, provider adapters, prompt/model registry, retries,
circuit breaking, moderation, structured output, tool calls, provider usage, and
provider compatibility. Changes must preserve exactly-once attempt telemetry and
credential-owner attribution.

### API Key Security & Rotation Engineer

Owns Secret Manager naming, writers/resolvers, key validation, versioning,
rotation, revocation, cache invalidation, rollback primitives, IAM, and audit
events. This owner never exposes plaintext after the validated server-side save
boundary.

### Tenant AI Controls Engineer

Owns tenant key status/rotate/revoke flows, tenant RBAC, tenant quotas, tenant
fallback behavior, and tenant-admin integration. A tenant key must override the
platform key when no user BYOK key is active.

### Platform AI Controls Engineer

Owns the super-admin platform key, platform fallback availability, platform
RBAC, shared budget controls, project-level Secret Manager/IAM, and platform
incident response.

### BYOK Experience Engineer

Owns per-user provider-key contracts and product surfaces for students,
teachers, and other eligible authenticated roles across web and mobile. BYOK is
self-only, masked after save, and fail-closed: an opted-in user key failure must
not silently spend tenant or platform budget.

### LLM Telemetry & Cost Engineer

Owns Supabase request/attempt telemetry, user/tenant/platform attribution,
credential-owner fields, token and estimated-cost accounting, pricing versions,
dashboards, repair/alerting, and quota inputs. Telemetry failures remain
isolated from product responses but must be observable.

### LLM Release & Verification Engineer

Owns build gates, emulator tests, Firebase function deployment, Supabase
migrations, Secret Manager/IAM preflight, authenticated production smoke tests,
rollback evidence, and the deployment matrix for all apps and LLM entry points.

## Ownership boundaries

| Area                            | Direct owner            | Mandatory reviewers      |
| ------------------------------- | ----------------------- | ------------------------ |
| Gateway/provider/model behavior | AI Gateway & Provider   | Lead, Telemetry, Release |
| Secret values, versions, IAM    | Key Security & Rotation | Lead, Release            |
| Tenant key and quota behavior   | Tenant AI Controls      | Key Security, Telemetry  |
| Platform fallback and budget    | Platform AI Controls    | Key Security, Telemetry  |
| User BYOK contracts and UX      | BYOK Experience         | Key Security, Release    |
| Supabase tokens/cost/causation  | Telemetry & Cost        | Gateway, Release         |
| Production deploy or migration  | Release & Verification  | Lead and affected owner  |

One owner edits a hot file at a time. In particular, changes to
`packages/ai/src/gateway.ts`, the prompt/model registry, the Secret Manager
resolver, and `functions/sdk-v1/src/bootstrap.ts` require explicit coordination.

## Non-negotiable invariants

- Credential precedence is `user BYOK -> tenant -> platform`.
- If an active user BYOK key fails, the request fails closed.
- A user without an active BYOK key may fall back automatically from tenant to
  platform.
- BYOK calls bypass tenant/platform quota and record
  `credential_owner = 'user'`.
- Plaintext provider keys exist only in the server request long enough to
  validate and write them to Secret Manager.
- Firestore stores only opaque secret references, masks, status, version, and
  timestamps.
- Clients receive masked metadata only and never read the server-only key
  collections directly.
- Every provider attempt records provider-reported token usage when available.
- No production-complete claim is allowed without build, test, deploy, and
  authenticated smoke evidence for the affected path.

## Standard handoff

An owner handing work to another owner or to the lead reports:

1. exact files and public contracts changed;
2. security and precedence effects;
3. migrations, secrets, IAM, or deploy steps required;
4. tests and builds run with counts/results;
5. production functions/apps deployed;
6. authenticated smoke evidence;
7. known gaps and rollback procedure.

The lead updates the implementation reference whenever behavior, deployment
state, or operational ownership changes.
