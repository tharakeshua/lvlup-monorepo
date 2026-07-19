-- Extend the LLM request ledger for per-user BYOK credentials.
--
-- The gateway records credential_owner='user' when it resolves an active user
-- provider key. BYOK calls bypass tenant/platform quota but remain visible for
-- attribution, token accounting, and operational diagnostics.

alter table public.llm_requests
  drop constraint if exists llm_requests_credential_owner;

alter table public.llm_requests
  add constraint llm_requests_credential_owner
  check (credential_owner in ('user', 'tenant', 'platform'));

comment on column public.llm_requests.credential_owner is
  'Credential principal used for the LLM request: user BYOK, tenant, or platform.';

create index if not exists llm_requests_credential_owner_created_idx
  on public.llm_requests (credential_owner, created_at desc);
