# Supabase LLM Telemetry

Supabase PostgreSQL is the backend-only telemetry store for LLM requests,
provider attempts, tokens, costs, quotas, and reporting summaries.

Firebase remains the application identity provider and callable/task runtime.
Frontend applications do not connect directly to these tables.

## Configuration

The server runtime requires:

```env
SUPABASE_URL=https://fvgrillvdzuvzxpbgdem.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

Configure the service-role key as a deployment secret. Never expose it through a
`VITE_*`, `NEXT_PUBLIC_*`, or `EXPO_PUBLIC_*` variable.

The local ignored Firebase Functions environment file is:
`functions/sdk-v1/.env.lvlup-ff6fa`. A safe tracked template lives at
`functions/sdk-v1/.env.example`.

## Migration

The initial migration is:

```text
supabase/migrations/20260718160000_llm_tracking_foundation.sql
```

It creates:

- logical request and provider-attempt ledgers;
- versioned pricing rules;
- quota reservations and current counters;
- tenant, user, feature, and platform daily summaries;
- a durable telemetry outbox;
- indexes and server-only RLS posture.

Link this repository to Supabase project `fvgrillvdzuvzxpbgdem`, review the SQL,
and apply the migration using the Supabase CLI or dashboard after privileged
database access is configured.

## Application client

The server helper is:

```text
packages/services/src/supabase/client.ts
```

It requires the service-role key, disables Supabase Auth session persistence and
refresh, and is safe for long-lived Cloud Functions processes. It intentionally
rejects publishable-key-only configuration.

The gateway persistence adapter is:

```text
packages/services/src/supabase/llm-telemetry.ts
```

`functions/sdk-v1/src/bootstrap.ts` activates it only when both required
environment variables exist. The Supabase client is pinned to a Node
20-compatible release because that is the deployed Firebase Functions runtime.
