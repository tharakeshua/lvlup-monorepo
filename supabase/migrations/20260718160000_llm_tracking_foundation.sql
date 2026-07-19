-- Auto-LevelUp LLM telemetry foundation.
--
-- Supabase is a backend-only observability store. Application users continue to
-- authenticate with Firebase and access usage through authenticated backend APIs.
-- No anon/authenticated table policies are created by this migration.

create extension if not exists pgcrypto;

create table if not exists public.llm_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  provider text not null,
  model_pattern text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  pricing jsonb not null,
  created_at timestamptz not null default now(),
  constraint llm_pricing_rules_effective_range
    check (effective_to is null or effective_to > effective_from),
  constraint llm_pricing_rules_unique_version
    unique (version, provider, model_pattern)
);

create table if not exists public.llm_requests (
  id uuid primary key default gen_random_uuid(),
  schema_version smallint not null default 2,
  root_request_id uuid,
  parent_request_id uuid references public.llm_requests(id) on delete set null,
  trace_id text not null,

  tenant_id text not null,
  actor_user_id text not null,
  initiated_by_user_id text,
  subject_user_id text,
  billing_user_id text,
  actor_role text not null,
  initiator_role text,

  purpose text not null,
  feature text not null,
  operation text not null,
  prompt_key text not null,
  prompt_version text not null,
  agent_id text,

  resource_type text not null,
  resource_id text not null,
  related_resources jsonb not null default '{}'::jsonb,

  provider text not null,
  requested_model text not null,
  resolved_model text,
  credential_owner text not null default 'tenant',
  status text not null default 'reserved',
  attempt_count integer not null default 0,
  successful_attempt_id uuid,

  token_usage jsonb not null default
    '{"input":0,"output":0,"total":0,"source":"unavailable"}'::jsonb,
  estimated_cost_usd numeric(20, 10) not null default 0,
  reconciled_cost_usd numeric(20, 10),
  pricing_version text not null,
  latency_ms integer not null default 0,
  quota_decision jsonb,
  error jsonb,

  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,

  constraint llm_requests_schema_version check (schema_version = 2),
  constraint llm_requests_status check (
    status in (
      'reserved',
      'running',
      'succeeded',
      'failed',
      'rejected_quota',
      'rejected_moderation',
      'circuit_open',
      'cancelled'
    )
  ),
  constraint llm_requests_credential_owner check (
    credential_owner in ('platform', 'tenant')
  ),
  constraint llm_requests_attempt_count check (attempt_count >= 0),
  constraint llm_requests_estimated_cost check (estimated_cost_usd >= 0),
  constraint llm_requests_reconciled_cost check (
    reconciled_cost_usd is null or reconciled_cost_usd >= 0
  ),
  constraint llm_requests_latency check (latency_ms >= 0)
);

alter table public.llm_requests
  add constraint llm_requests_root_request_fk
  foreign key (root_request_id)
  references public.llm_requests(id)
  on delete set null;

create table if not exists public.llm_call_attempts (
  id uuid primary key default gen_random_uuid(),
  schema_version smallint not null default 2,
  request_id uuid not null references public.llm_requests(id) on delete cascade,
  root_request_id uuid not null,
  trace_id text not null,
  attempt_number integer not null,

  tenant_id text not null,
  actor_user_id text not null,
  initiated_by_user_id text,
  subject_user_id text,
  billing_user_id text,
  actor_role text not null,

  purpose text not null,
  feature text not null,
  operation text not null,
  prompt_key text not null,
  prompt_version text not null,
  agent_id text,
  resource_type text not null,
  resource_id text not null,
  related_resources jsonb not null default '{}'::jsonb,

  provider text not null,
  model text not null,
  provider_request_id text,
  status text not null,
  retryable boolean not null default false,

  tokens jsonb not null,
  cost jsonb not null,
  provider_usage jsonb,
  timing jsonb not null,
  error jsonb,

  created_at timestamptz not null default now(),
  completed_at timestamptz not null,
  expires_at timestamptz,

  constraint llm_call_attempts_schema_version check (schema_version = 2),
  constraint llm_call_attempts_number check (attempt_number > 0),
  constraint llm_call_attempts_status check (
    status in ('success', 'error', 'timeout', 'cancelled')
  ),
  constraint llm_call_attempts_unique_attempt unique (request_id, attempt_number)
);

alter table public.llm_requests
  add constraint llm_requests_successful_attempt_fk
  foreign key (successful_attempt_id)
  references public.llm_call_attempts(id)
  on delete set null;

create table if not exists public.llm_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.llm_requests(id) on delete cascade,
  tenant_id text not null,
  billing_user_id text,
  policy_version text not null,
  reserved_cost_usd numeric(20, 10) not null,
  final_cost_usd numeric(20, 10),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  expires_at timestamptz not null,
  constraint llm_usage_reservations_reserved_cost check (reserved_cost_usd >= 0),
  constraint llm_usage_reservations_final_cost check (
    final_cost_usd is null or final_cost_usd >= 0
  ),
  constraint llm_usage_reservations_status check (
    status in ('active', 'finalized', 'released', 'expired')
  )
);

create table if not exists public.llm_usage_counters (
  tenant_id text not null,
  period_type text not null,
  period_key text not null,
  logical_calls bigint not null default 0,
  provider_attempts bigint not null default 0,
  reserved_cost_usd numeric(20, 10) not null default 0,
  finalized_cost_usd numeric(20, 10) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, period_type, period_key),
  constraint llm_usage_counters_period_type check (
    period_type in ('day', 'month')
  ),
  constraint llm_usage_counters_nonnegative check (
    logical_calls >= 0
    and provider_attempts >= 0
    and reserved_cost_usd >= 0
    and finalized_cost_usd >= 0
  )
);

create table if not exists public.llm_tenant_daily (
  tenant_id text not null,
  usage_date date not null,
  logical_calls bigint not null default 0,
  provider_attempts bigint not null default 0,
  successful_calls bigint not null default 0,
  failed_calls bigint not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric(20, 10) not null default 0,
  reconciled_cost_usd numeric(20, 10),
  by_purpose jsonb not null default '{}'::jsonb,
  by_model jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (tenant_id, usage_date)
);

create table if not exists public.llm_user_daily (
  tenant_id text not null,
  billing_user_id text not null,
  usage_date date not null,
  logical_calls bigint not null default 0,
  provider_attempts bigint not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric(20, 10) not null default 0,
  by_purpose jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (tenant_id, billing_user_id, usage_date)
);

create table if not exists public.llm_feature_daily (
  tenant_id text not null,
  feature text not null,
  usage_date date not null,
  logical_calls bigint not null default 0,
  provider_attempts bigint not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric(20, 10) not null default 0,
  computed_at timestamptz not null default now(),
  primary key (tenant_id, feature, usage_date)
);

create table if not exists public.llm_platform_daily (
  usage_date date primary key,
  active_tenants bigint not null default 0,
  logical_calls bigint not null default 0,
  provider_attempts bigint not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric(20, 10) not null default 0,
  reconciled_cost_usd numeric(20, 10),
  by_tenant jsonb not null default '{}'::jsonb,
  by_purpose jsonb not null default '{}'::jsonb,
  by_model jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create table if not exists public.llm_telemetry_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  attempt_id uuid,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint llm_telemetry_outbox_status check (
    status in ('pending', 'processing', 'processed', 'failed')
  ),
  constraint llm_telemetry_outbox_attempts check (attempts >= 0)
);

create index if not exists llm_requests_tenant_created_idx
  on public.llm_requests (tenant_id, created_at desc);
create index if not exists llm_requests_tenant_billing_user_created_idx
  on public.llm_requests (tenant_id, billing_user_id, created_at desc);
create index if not exists llm_requests_tenant_feature_created_idx
  on public.llm_requests (tenant_id, feature, created_at desc);
create index if not exists llm_requests_tenant_status_created_idx
  on public.llm_requests (tenant_id, status, created_at desc);
create index if not exists llm_requests_root_request_idx
  on public.llm_requests (root_request_id);

create index if not exists llm_call_attempts_request_idx
  on public.llm_call_attempts (request_id, attempt_number);
create index if not exists llm_call_attempts_tenant_completed_idx
  on public.llm_call_attempts (tenant_id, completed_at desc);
create index if not exists llm_call_attempts_tenant_model_completed_idx
  on public.llm_call_attempts (tenant_id, model, completed_at desc);
create index if not exists llm_call_attempts_tenant_status_completed_idx
  on public.llm_call_attempts (tenant_id, status, completed_at desc);

create index if not exists llm_usage_reservations_active_expiry_idx
  on public.llm_usage_reservations (expires_at)
  where status = 'active';
create index if not exists llm_telemetry_outbox_pending_idx
  on public.llm_telemetry_outbox (available_at, created_at)
  where status in ('pending', 'failed');

alter table public.llm_pricing_rules enable row level security;
alter table public.llm_requests enable row level security;
alter table public.llm_call_attempts enable row level security;
alter table public.llm_usage_reservations enable row level security;
alter table public.llm_usage_counters enable row level security;
alter table public.llm_tenant_daily enable row level security;
alter table public.llm_user_daily enable row level security;
alter table public.llm_feature_daily enable row level security;
alter table public.llm_platform_daily enable row level security;
alter table public.llm_telemetry_outbox enable row level security;

revoke all on table public.llm_pricing_rules from anon, authenticated;
revoke all on table public.llm_requests from anon, authenticated;
revoke all on table public.llm_call_attempts from anon, authenticated;
revoke all on table public.llm_usage_reservations from anon, authenticated;
revoke all on table public.llm_usage_counters from anon, authenticated;
revoke all on table public.llm_tenant_daily from anon, authenticated;
revoke all on table public.llm_user_daily from anon, authenticated;
revoke all on table public.llm_feature_daily from anon, authenticated;
revoke all on table public.llm_platform_daily from anon, authenticated;
revoke all on table public.llm_telemetry_outbox from anon, authenticated;

grant all on table public.llm_pricing_rules to service_role;
grant all on table public.llm_requests to service_role;
grant all on table public.llm_call_attempts to service_role;
grant all on table public.llm_usage_reservations to service_role;
grant all on table public.llm_usage_counters to service_role;
grant all on table public.llm_tenant_daily to service_role;
grant all on table public.llm_user_daily to service_role;
grant all on table public.llm_feature_daily to service_role;
grant all on table public.llm_platform_daily to service_role;
grant all on table public.llm_telemetry_outbox to service_role;

comment on table public.llm_requests is
  'One logical product-level AI request. Contains metadata only; never prompts, responses, answers, or media.';
comment on table public.llm_call_attempts is
  'Append-only ledger of actual provider attempts, including retries and normalized token/cost metadata.';
comment on table public.llm_usage_reservations is
  'Concurrency-safe budget reservations finalized or released when an LLM request terminates.';
