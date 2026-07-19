# LLM Tracking Framework Plan

Status: implementation in progress  
Scope: all server-side AI calls in LevelUp and AutoGrade  
Primary telemetry store: Supabase PostgreSQL  
Last reviewed: 2026-07-18

## Implementation status (2026-07-18)

The first production slice is implemented:

- Supabase request, attempt, reservation, counter, aggregate, pricing, and
  outbox tables are defined in
  `supabase/migrations/20260718160000_llm_tracking_foundation.sql`.
- The server-only Supabase client and metadata-only persistence adapter live in
  `packages/services/src/supabase`.
- `@levelup/ai` now emits one logical request, one row per actual provider
  attempt (including retries), and one terminal request finalization.
- Moderation, quota, circuit-open, secret/configuration, and provider failures
  receive terminal request states even when no provider attempt occurs.
- Telemetry and legacy-log failures cannot turn a successful provider response
  into a product failure; failed Supabase writes are attempted through the
  telemetry outbox and surfaced to a runtime alert hook.
- Pricing version/fallback and provider-versus-unavailable token-source metadata
  are captured.
- Tutor chat, practice evaluation, teacher authoring, question extraction, and
  answer mapping/grading now pass explicit v2 attribution.
- Answer-sheet upload persists root causation on the submission so delayed
  system tasks can recover uploader, student, and billing identities.
- The Firebase `sdk-v1` composition root enables Supabase telemetry only when
  both server credentials are configured.

Still pending from the rollout phases below:

- atomic Supabase quota reservation/finalization and real-time aggregation;
- Supabase-backed tenant/platform read APIs and dashboard migration;
- extraction parent/root correlation across rubric batches;
- legacy `functions/{autograde,levelup}` cutover to the canonical gateway;
- reconciliation/backfill, retention/anonymization jobs, and production alerts.

## 0. Storage decision

Supabase PostgreSQL is the source of truth for all new LLM requests, provider
attempts, quotas, costs, and usage summaries. Firebase remains the application's
current authentication, callable/task, and domain-data platform.

- Firebase Functions call the existing `@levelup/ai` gateway.
- The gateway writes telemetry through a server-only Supabase repository using
  `SUPABASE_SERVICE_ROLE_KEY`.
- Browser and mobile applications never receive the service-role key and
  continue to read usage through authenticated backend APIs.
- Supabase Auth and `@supabase/ssr` are not introduced for this work. Firebase
  user IDs are stored as external text identifiers in the telemetry tables.
- The supplied publishable key is reserved for a future direct-client/RLS
  design; it is not sufficient for trusted background writes.

## 1. Outcome

Build one server-authoritative LLM usage ledger that answers, without
reconstructing data from product documents:

- who caused the work, who the work was for, and which tenant pays for it;
- which feature, agent, pipeline, resource, prompt, provider, and model were
  used;
- how many provider attempts occurred and whether each succeeded, failed, or was
  cancelled;
- input, output, cached, reasoning, tool, image, and total token usage when the
  provider reports it;
- estimated cost at call time, the pricing rule used, and later reconciled cost;
- latency, retries, provider errors, quota decisions, and request correlation;
- daily/monthly spend by tenant, user, feature, purpose, model, and resource;
- current budget consumption without relying on a nightly job.

The implementation should extend the existing `@levelup/ai` gateway and migrate
the useful dimensions from `llmCallLogs` into Supabase. It should not introduce
a third LLM wrapper.

## 2. Executive findings

There is substantial existing work, but it is split across two generations and
is not currently a trustworthy ledger.

### Existing foundation worth keeping

- `packages/ai/src/gateway.ts` is the intended v1 choke point. It already
  centralizes provider access, per-tenant keys, moderation, quota checks, retry,
  circuit breaking, token extraction, cost estimation, and logging.
- `packages/ai/src/provider/gemini.ts` captures Gemini `usageMetadata`.
- `packages/ai/src/cost/{cost-tracker,llm-logger,usage-quota}.ts` implement v1
  estimation, a tenant log write, and quota pre-checks.
- `functions/sdk-v1/src/bootstrap.ts` injects the gateway into the services
  layer.
- `packages/domain/src/entities/analytics/analytics.ts` defines `LlmCallLog`,
  `DailyCostSummary`, and `MonthlyCostSummary`.
- Firestore rules already make `llmCallLogs` server-write-only.
- Tenant and platform usage screens already exist:
  `apps/admin-web/src/pages/AIUsagePage.tsx`,
  `apps/mobile-admin/src/screens/insights/AiUsageCostScreen.tsx`, and
  `apps/super-admin/src/pages/LLMUsagePage.tsx`.
- `v1.analytics.getCostSummary` is the existing tenant summary read seam.
- The legacy `@levelup/shared-services/ai` stack contains useful metadata
  concepts: purpose, operation, role, resource type/id, nested token/cost
  breakdowns, and per-call logging.

### Critical gaps

1. **Two independent AI stacks are deployed.** Legacy
   `functions/{autograde,levelup}` use `LLMWrapper` from
   `packages/shared-services`; `functions/sdk-v1` uses `@levelup/ai`. They use
   different schemas, prices, quota settings, paths, and timestamp formats.

2. **The v1 raw log and both roll-up implementations disagree.** The v1 logger
   writes flat fields such as `inputTokens`, `outputTokens`, `costUSD`,
   `functionName`, and an ISO `createdAt`. The legacy analytics scheduler reads
   nested `tokens.input`, `cost.total`, and `purpose`, and queries with
   Firestore `Timestamp` bounds. The v1 service roll-up reads
   `_kind: "llmCallLog"` rows from the generic tenant store, while the gateway
   writes the dedicated `llmCallLogs` collection. Neither is a correct consumer
   of the v1 ledger.

3. **V1 loses dimensions it already knows.** `AiRequest.purpose`, context role,
   `resourceType`, and `resourceId` are not written by
   `packages/ai/src/cost/llm-logger.ts`. Only `functionName`, optional `userId`,
   `examId`, and `spaceId` survive.

4. **Background work is attributed to `"<system>"` or `"system"`.** Answer
   mapping/grading and chat summarization/insight extraction therefore cannot be
   charged or analyzed by the initiating/subject user. A single `userId` field
   cannot distinguish actor, initiator, beneficiary, and payer.

5. **Retries are collapsed into one row.** The gateway logs one logical result
   after `withRetry`; it cannot report actual provider attempt count, attempt
   latency, or a failed attempt that preceded a success. A provider attempt can
   also incur usage even when the logical request ultimately fails.

6. **Pre-provider outcomes are invisible.** Moderation rejection, quota
   rejection, an open circuit, and secret-resolution failures happen outside the
   provider-call logging block. They cost no LLM tokens but are operationally
   important AI requests.

7. **Successful-call logging is not actually best-effort.** The success path
   awaits `logLLMCall` without isolating an audit write failure. A completed
   provider call can appear to the caller as failed, encouraging a retry and
   duplicate spend.

8. **Quota enforcement is stale and race-prone.** The check-then-call sequence
   is non-atomic. The monthly summary fast path can omit current-day raw spend,
   and concurrent requests can all pass before any result is logged.

9. **Pricing is duplicated and inconsistent.** `packages/ai` and
   `packages/shared-services` contain different prices for the same model names.
   Neither log records a pricing version or effective date, so a historical
   estimate cannot be reproduced.

10. **The platform dashboard performs an N-tenant fan-out.** Super-admin usage
    calls `getCostSummary` once per tenant. There is no canonical platform
    roll-up/read API and no per-user ledger view.

11. **The existing index is stale.** `firestore.indexes.json` indexes
    `taskType`, but the canonical v1 schema writes `functionName` and no
    `taskType`.

## 3. Current AI call inventory

The inventory below is the coverage baseline. CI must fail if a new provider
call or gateway call is added without a registered feature and attribution
policy.

| Product path                      | Logical operation(s)                                      | Current stack                               | Current user attribution                                   |
| --------------------------------- | --------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Question-paper extraction         | question pass; batched rubric pass                        | v1 `ctx.ai.generate`                        | teacher/caller                                             |
| Legacy question extraction        | full; single-question re-extract                          | legacy `LLMWrapper`                         | teacher/caller                                             |
| Answer-sheet scouting             | answer mapping                                            | v1 and legacy pipelines                     | system only                                                |
| Answer grading                    | one call per question                                     | v1 Evaluation/AutoGrade and legacy pipeline | system only in pipeline; learner in interactive evaluation |
| Practice subjective answer        | unified evaluation                                        | v1 gateway                                  | learner                                                    |
| Timed-test subjective answer      | unified evaluation through `scoreOne`                     | v1 gateway                                  | learner                                                    |
| Tutor chat                        | one reply per learner turn                                | v1 and legacy                               | learner                                                    |
| Legacy long-chat summarization    | conversation summary                                      | legacy wrapper                              | system, though caused by learner                           |
| Legacy learning-signal extraction | post-turn insight extraction                              | legacy wrapper                              | system, though caused by learner                           |
| Teacher AI content draft          | content generation                                        | v1 gateway                                  | teacher                                                    |
| Agentic chat question             | prompt exists (`agentChat`) but the full loop is not live | future v1 gateway                           | must carry learner + agent/session                         |
| Analytics insights                | prompt purpose exists, current scheduler is deterministic | future v1 gateway if enabled                | system + subject student                                   |

No client-side direct Gemini call was found. Keeping provider SDKs server-only
is a required invariant.

## 4. Canonical vocabulary

Tracking needs stable controlled dimensions, not arbitrary strings from call
sites.

### Purpose

Coarse billable category:

- `question_extraction`
- `rubric_generation`
- `answer_mapping`
- `answer_grading`
- `answer_evaluation`
- `tutor_chat`
- `agent_chat`
- `conversation_summarization`
- `learning_insight_extraction`
- `content_generation`
- `analytics_insight_generation`
- `other`

### Feature

Product surface, for example:

- `autograde.question_paper`
- `autograde.answer_sheet`
- `levelup.practice`
- `levelup.timed_test`
- `levelup.tutor`
- `levelup.agent_question`
- `levelup.authoring`
- `analytics.insights`

### Operation

A stable code-level action such as `questions.extract`,
`questions.generate_rubrics`, `answer.map`, `answer.grade`, `practice.evaluate`,
`chat.reply`, or `content.generate`. Operation names are registered alongside
prompt keys and may not be invented ad hoc at call sites.

### Attribution

Never overload a single `userId`.

- `actorUserId`: identity executing the current service; may be `"<system>"`.
- `initiatedByUserId`: human whose action created the root work.
- `subjectUserId`: learner/person the model output is about.
- `billingUserId`: user to whom product usage is allocated. This is usually the
  initiator for chats/authoring and the subject learner for per-student grading,
  with an explicit policy per operation.
- `tenantId`: mandatory payer/security boundary.
- `actorRole` and `initiatorRole`: captured independently.

For an answer-sheet pipeline started by a scanner, for example:

- actor during grading: `"<system>"`;
- initiator: scanner/teacher who uploaded the sheet;
- subject and billing user: the student owning the submission;
- root resource: submission;
- parent resource: exam.

## 5. Target architecture

```text
callable / task / trigger / scheduler
                |
                v
       UsageContext builder
 (auth + root causation + resource)
                |
                v
       one @levelup/ai gateway
        |        |         |
 quota reserve  request    provider attempts
        |       ledger     (retry/fallback)
        |        |         |
        +--------+---------+
                 |
          finalize usage/cost
                 |
        durable aggregation task
          /       |        \
 tenant/day   user/day   platform/day
                 |
        Supabase PostgreSQL
                 |
       callables + dashboards
```

Only `packages/ai/src/provider/*` may import a provider SDK. A lint rule and a
CI search enforce that invariant. Legacy functions must either delegate to this
gateway during migration or be removed according to the existing functions
cleanup plan.

## 6. Canonical data model

Use relational request and attempt tables. A logical request row makes rejected
requests and retry groups visible; an append-only attempt table is the financial
usage ledger. JSONB is limited to bounded provider usage, related resources,
sanitized errors, and small breakdown maps.

The initial schema migration is
`supabase/migrations/20260718160000_llm_tracking_foundation.sql`.

### 6.1 `public.llm_requests`

One row per product-level AI request.

```ts
interface LlmRequest {
  schemaVersion: 2;
  requestId: string;
  rootRequestId: string;
  parentRequestId?: string;
  traceId: string;

  tenantId: string;
  actorUserId: string;
  initiatedByUserId?: string;
  subjectUserId?: string;
  billingUserId?: string;
  actorRole: string;
  initiatorRole?: string;

  purpose: LlmPurpose;
  feature: LlmFeature;
  operation: LlmOperation;
  promptKey: string;
  promptVersion: string;
  agentId?: string;

  resource: { type: string; id: string };
  related: {
    examId?: string;
    submissionId?: string;
    questionId?: string;
    spaceId?: string;
    storyPointId?: string;
    itemId?: string;
    chatSessionId?: string;
    testSessionId?: string;
  };

  provider: string;
  requestedModel: string;
  resolvedModel?: string;
  status:
    | "reserved"
    | "running"
    | "succeeded"
    | "failed"
    | "rejected_quota"
    | "rejected_moderation"
    | "circuit_open"
    | "cancelled";
  attemptCount: number;
  successfulAttemptId?: string;
  usage: CanonicalTokenUsage;
  estimatedCostUsd: number;
  reconciledCostUsd?: number;
  pricingVersion: string;
  latencyMs: number;
  error?: SanitizedError;
  createdAt: string;
  completedAt?: string;
}
```

This row is operational state and a request-level summary. Cost aggregation uses
successful/billable attempt rows, not this summary, so retries cannot be
accidentally counted twice.

### 6.2 `public.llm_call_attempts`

One append-only row per actual provider request.

Required additions to the current schema:

```ts
interface LlmCallAttempt {
  schemaVersion: 2;
  attemptId: string;
  requestId: string;
  rootRequestId: string;
  traceId: string;
  attemptNumber: number;

  tenantId: string;
  actorUserId: string;
  initiatedByUserId?: string;
  subjectUserId?: string;
  billingUserId?: string;
  actorRole: string;

  purpose: LlmPurpose;
  feature: LlmFeature;
  operation: LlmOperation;
  promptKey: string;
  promptVersion: string;
  agentId?: string;
  resourceType: string;
  resourceId: string;
  related: LlmRelatedResources;

  provider: string;
  model: string;
  providerRequestId?: string;
  status: "success" | "error" | "timeout" | "cancelled";
  retryable: boolean;

  tokens: {
    input: number;
    output: number;
    cachedInput?: number;
    reasoning?: number;
    tool?: number;
    image?: number;
    total: number;
    source: "provider" | "estimated" | "unavailable";
  };
  cost: {
    inputUsd: number;
    outputUsd: number;
    cachedInputUsd?: number;
    otherUsd?: number;
    estimatedTotalUsd: number;
    reconciledTotalUsd?: number;
    currency: "USD";
    pricingVersion: string;
  };

  timing: { providerLatencyMs: number; totalAttemptMs: number };
  error?: SanitizedError;
  createdAt: string;
  completedAt: string;
}
```

Provider-specific raw usage may be stored in a bounded, allowlisted
`providerUsage` object. Prompts, responses, answer text, and image bytes must
never be copied into usage telemetry.

### 6.3 Aggregates

Use normalized aggregate tables rather than an unbounded `byUser` map:

- `public.llm_tenant_daily`
- `public.llm_user_daily`
- `public.llm_feature_daily`
- `public.llm_platform_daily`
- `public.llm_usage_counters`
- `public.llm_usage_reservations`

Tenant summaries retain bounded `by_purpose` and `by_model` JSONB maps. User
summaries contain total calls/tokens/cost plus a bounded purpose breakdown.
Longer-range and high-cardinality queries use indexed request/attempt rows or
SQL views.

The existing Firebase `costSummaries` documents may remain as a temporary
compatibility projection until all clients read the Supabase-backed APIs.

## 7. Request lifecycle

1. The service builds a typed `LlmUsageContext`. Required attribution is derived
   from auth and the authoritative resource document, never trusted from a
   client.
2. The gateway inserts `public.llm_requests` before moderation/quota/provider
   work.
3. Quota service atomically reserves:
   - one logical call slot;
   - an estimated maximum cost based on model pricing, estimated input, and
     `maxTokens`.
4. Moderation, circuit, secret, and configuration failures finalize the request
   with a non-billable status.
5. Each retry/fallback provider invocation writes one attempt row. Attempt
   logging is isolated from the product response:
   - a telemetry outage cannot turn a successful provider response into a failed
     product request;
   - failed telemetry is placed on a durable outbox/Cloud Task for repair;
   - it is never silently swallowed.
6. Provider usage is normalized. Missing usage is explicitly marked
   `unavailable`; zero is not used to mean unknown.
7. The reservation is finalized atomically with actual estimated cost and
   released on non-billable outcomes.
8. An idempotent aggregation task applies the attempt delta to tenant, user,
   feature, and platform summaries.
9. A nightly reconciliation job recomputes the previous day from the append-only
   attempt ledger and repairs drift.

`requestId` is generated once at the product boundary and propagated through
Cloud Tasks. Retry task deliveries reuse the same logical request/root ids and
create deterministic attempt ids where possible.

## 8. Attribution propagation by workflow

### Tutor and agent chats

- Human reply request: actor, initiator, subject, and billing user are the
  learner.
- Summarization and learning-signal child calls inherit `rootRequestId`,
  `initiatedByUserId`, `subjectUserId`, and `billingUserId` from the chat turn;
  actor remains system.
- Record `chatSessionId`, item/story point/space, and `agentId`.
- Each agent turn is a separate logical request. Tool-loop provider calls are
  separate attempts/child requests, correlated to the turn.

### Practice and timed tests

- Learner is initiator, subject, and billing user.
- Include item, story point, space, test session, and attempt identifiers.
- Deterministic grading emits no LLM request; product analytics can separately
  record that it used the deterministic path.

### Question extraction and teacher authoring

- Teacher/scanner is initiator and billing user.
- Rubric batches are child requests under the extraction root request.
- Include exam/question or story point/space resources and prompt version.

### Answer-sheet grading

- Uploading teacher/scanner is initiator.
- Submission owner is subject and default billing user.
- Cloud Task actor is system.
- Mapping is one child request; each question grade is another child request.
- Preserve `submissionId`, `examId`, `questionId`, and student identity through
  the task payload or reload it from the submission.
- Manual retry creates a new root action linked to the original failed request
  and records the retrying teacher as initiator.

### Scheduled insight generation

- Actor is system.
- Subject and billing user are the student.
- `initiatedByUserId` is absent unless the scheduler was manually invoked.

## 9. Cost and token accounting

### Pricing catalog

Create one effective-dated server package/table:

```ts
type PricingRule = {
  version: string;
  provider: string;
  modelPattern: string;
  effectiveFrom: string;
  effectiveTo?: string;
  tiers: Array<{
    maxInputTokens?: number;
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
    cachedInputPerMillionUsd?: number;
    reasoningPerMillionUsd?: number;
  }>;
};
```

Every attempt snapshots `pricingVersion`. Updating prices must not rewrite
history. Unknown models create an alert and use a conservative fallback
explicitly marked `pricingFallback: true`.

### Estimated versus reconciled cost

- `estimatedCostUsd` is computed immediately from provider usage and the
  effective pricing rule.
- `reconciledCostUsd` is populated later from provider billing export when
  available.
- Dashboards label estimated and reconciled values; finance totals prefer
  reconciled cost.
- BYO-key tenants are still tracked. Add
  `credentialOwner: "platform" | "tenant"` so platform cash cost and tenant
  consumption can be reported separately.

### Token semantics

- Preserve provider categories rather than forcing all usage into input/output.
- `total` should use provider total when supplied; otherwise derive it and mark
  the derivation.
- Unknown usage is `source: "unavailable"`, not zero.
- Store counts as integers and money at higher precision than UI display.

## 10. Quotas and budgets

Unify the three current settings shapes (`usageConfig`, `settings.usageQuota`,
and subscription budget fields) into one canonical tenant config:

```ts
interface AiUsagePolicy {
  enabled: boolean;
  monthlyBudgetUsd?: number;
  dailyLogicalCallLimit?: number;
  dailyProviderAttemptLimit?: number;
  perUserDailyCallLimit?: number;
  warningThresholdPercent: number;
  credentialOwner: "platform" | "tenant";
  enforcementMode: "observe" | "soft" | "hard";
}
```

Use transactionally updated reservation/counter rows for the enforcement path.
Nightly summaries are reporting data, never the sole enforcement source. The
reservation transaction prevents concurrent calls from all passing the same
remaining budget.

Quota decisions should be recorded on the request row and exposed as metrics:
allowed, warned, rejected, reserved amount, final amount, and policy version.

## 11. APIs and dashboards

### APIs

Extend analytics contracts with:

- `getLlmUsageSummary`: tenant-scoped daily/monthly totals with filters for
  purpose, feature, model, user, and status;
- `listLlmRequests`: tenant admins, paginated, metadata only;
- `getLlmRequest`: request + attempt timeline, with sanitized errors;
- `getPlatformLlmUsage`: super-admin platform roll-up without N-tenant fan-out;
- `exportLlmUsage`: asynchronous CSV/Parquet export for a bounded range;
- `getMyAiUsage` only if learner-facing usage is a product requirement.

Do not allow clients to query raw Supabase telemetry tables directly. Server
callables apply tenant override rules, field projection, and least privilege.

### Tenant admin

Add:

- spend/tokens/calls by day;
- breakdown by feature, purpose, model, and user;
- top costly users/resources;
- successful, failed, retried, quota-rejected, and usage-unavailable counts;
- budget/reservation state and projected month-end consumption;
- request drill-down with correlation ids and sanitized failure details.

### Super admin

Add:

- platform and per-tenant estimated/reconciled spend;
- platform-key versus BYO-key usage;
- pricing-fallback and missing-usage alerts;
- provider/model error and latency trends;
- tenants approaching/exceeding quotas;
- aggregation lag and telemetry delivery health.

## 12. Security, privacy, and retention

- Server-only writes for requests, attempts, counters, and summaries.
- Enable RLS on every telemetry table, grant access only to `service_role`, and
  create no `anon` or `authenticated` policies while Firebase remains the user
  identity provider.
- Tenant admins see only their tenant. Staff access requires an explicit
  `canViewAiUsage` permission rather than the broad analytics permission.
- Raw prompts, completions, student answers, rubrics, and media are excluded.
- Error messages are classified and sanitized; stack traces and secret/provider
  payloads remain in restricted operational logging, not tenant-visible
  telemetry.
- Hash or omit provider request ids if they could expose provider account
  details.
- Suggested retention: raw requests/attempts 180 days, user-level daily
  aggregates 13 months, tenant/platform monthly aggregates 7 years. Make these
  policy values, add TTL fields, and confirm with product/legal before
  implementation.
- Deletion/anonymization jobs must remove user identifiers while retaining
  tenant-level financial aggregates where legally required.

## 13. Rollout plan

### Phase 0 — pin the contract and expose current breakage

1. Add schema-contract tests using a real v1 logger output as the roll-up input.
2. Add an emulator smoke test: invoke one stubbed tutor/evaluation call, assert
   one request, one attempt, correct attribution, and non-zero aggregate.
3. Add counters/alerts for telemetry write failures and aggregation lag.
4. Freeze additions to the legacy wrapper.

Exit: tests demonstrate the current mismatch and define the v2 telemetry
contract.

### Phase 1 — enrich the v1 gateway ledger

1. Add typed `LlmUsageContext`, controlled enums, request/root/parent ids,
   prompt version, and full resource/user attribution.
2. Split logical request recording from provider attempt recording.
3. Move retry iteration into an instrumented provider runner so every attempt is
   visible.
4. Record pre-provider rejection outcomes.
5. Make telemetry delivery durable and unable to change a successful product
   response into an error.
6. Replace duplicate pricing tables with the versioned catalog.

Exit: every v1 provider invocation produces a complete correlated ledger entry.

### Phase 2 — propagate causation through product workflows

1. Tutor/practice/timed-test/content call sites.
2. Extraction root plus rubric-batch child calls.
3. Submission upload -> mapping -> question grading Cloud Task chain.
4. Chat summary/insight child calls.
5. Future agentic chat and scheduled insight contexts.

Persist root causation on durable domain resources (`submission`, `chatSession`,
extraction job) so retries and delayed tasks can reconstruct it.

Exit: no production v1 row uses only `"<system>"` when a human or student can be
authoritatively identified.

### Phase 3 — real-time counters and correct aggregation

1. Implement atomic quota reservation/finalization.
2. Build idempotent aggregation tasks from attempt rows.
3. Build tenant/user/feature/platform daily and monthly projections.
4. Rebuild the nightly job as a reconciliation job over the exact canonical
   fields and ISO timestamp convention.
5. Backfill Firebase v1 raw rows into Supabase where possible; mark missing
   dimensions `unknown`.
6. Add PostgreSQL indexes for actual filters and remove the stale Firestore
   `taskType` index after compatibility reads end.

Exit: raw-ledger totals equal summary totals for sampled days and quota state
includes in-flight/current-day usage.

### Phase 4 — APIs and UI

1. Add canonical tenant and platform callables.
2. Move existing admin/mobile/super-admin screens to the new APIs.
3. Remove the super-admin N-tenant fan-out.
4. Add per-user/feature/request drill-down and telemetry-health indicators.
5. Keep projecting old `costSummaries` until all consumers migrate.

Exit: admins can reconcile any displayed total to request/attempt rows.

### Phase 5 — legacy cutover

1. Route remaining legacy endpoints through an adapter over `@levelup/ai`, or
   remove them per `docs/functions-cleanup/FUNCTIONS-CLEANUP-PLAN.md`.
2. Stop legacy `LLMWrapper` writes and legacy daily-summary increments.
3. Backfill or archive unprefixed `tenants/*/llmCallLogs` into the Supabase
   ledger.
4. Remove
   `packages/shared-services/src/ai/{llm-wrapper,llm-logger,cost-tracker,usage-quota}.ts`
   after all imports are gone.
5. Delete the superseded legacy daily cost scheduler.

Exit: one gateway, one schema, one pricing catalog, one quota policy, one set of
roll-ups.

## 14. Test strategy and acceptance criteria

### Unit/contract

- all purposes/operations require an attribution policy;
- all provider usage shapes normalize correctly, including missing categories;
- price selection is effective-date and tier aware;
- retry attempts share a request id and have monotonic attempt numbers;
- error sanitization never stores prompts, responses, secrets, or media;
- reservation finalize/release is idempotent;
- aggregation applies each attempt exactly once.

### Integration/emulator

- tutor, practice, timed test, content generation, extraction, mapping, grading,
  chat child calls, and quota rejection;
- callable, Cloud Task retry, scheduler, and trigger actor contexts;
- concurrent calls at the remaining budget boundary;
- telemetry Supabase outage after a provider success;
- nightly reconciliation repairs a deliberately corrupted aggregate;
- tenant and super-admin authorization, including tenant override.

### Production invariants

- 100% of provider calls originate in `packages/ai/src/provider/*`;
- 100% of completed logical AI requests have a terminal `public.llm_requests`
  row;
- 100% of provider attempts have an attempt row or a durable telemetry outbox
  item;
- at least 99.9% have provider-reported token usage; exceptions are explicitly
  `unavailable`, never silently zero;
- raw daily attempt cost and reconciled daily summary differ by less than an
  agreed rounding tolerance;
- no unattributed system rows for workflows with a resolvable subject/initiator;
- aggregation lag and failed telemetry delivery are monitored and alerted.

## 15. Recommended implementation slices

| Slice       | Main files                                                                   | Deliverable                                                    |
| ----------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Schema      | `packages/domain`, `packages/api-contract`                                   | request/attempt/summary schemas and filters                    |
| Gateway     | `packages/ai`                                                                | lifecycle, attempt instrumentation, pricing, quota reservation |
| Persistence | `packages/services/src/supabase`, `supabase/migrations`                      | Supabase client plus request/attempt/counter/summary repos     |
| Attribution | `packages/services` + Cloud Task payloads                                    | root causation across every workflow                           |
| Aggregation | `packages/services/src/analytics`, `functions/sdk-v1`                        | task aggregation + nightly reconciliation                      |
| Reads       | `packages/services/src/analytics`, `packages/repositories`, `packages/query` | tenant/platform/user APIs                                      |
| UI          | admin, mobile-admin, super-admin                                             | reliable summaries and drill-down                              |
| Cutover     | legacy function codebases, shared-services                                   | remove parallel telemetry stack                                |

The first implementation PR should cover Phase 0 and the schema portion of Phase
1 only. Avoid combining ledger changes, quota enforcement, backfill, and UI
migration in one deployment.
