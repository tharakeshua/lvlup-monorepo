# API Key Management, Rotation & Per-User BYOK — Decisions + Implementation Plan

Owner-approved 2026-07-18. Workstream session `sess_1784379509216_pqiah0pqm`
(coordinator `sess_1784368194906_0wpwk01dn`). This is the SSOT for the
key-management workstream. Grounded in the real code as it stands on `staging`.

---

## 0. Owner decisions (locked)

| #   | Topic                     | Decision                                                                                                                                                                                                                                                     |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Resolution precedence** | `user BYOK → tenant → platform`. If a user **has** a key, use it; if that key itself fails (invalid/quota/provider error) → **surface an error**, never silently spend tenant/platform budget. If the user has **no** key → tenant → platform auto-fallback. |
| 2   | **Eligibility**           | All roles may BYOK (student, parent, teacher, staff, tenantAdmin). Age/consent gating deferred (not built this iteration).                                                                                                                                   |
| 3   | **Providers**             | Gemini (`google`) only now. Schema is **provider-agnostic** (`provider` field) so OpenAI/Anthropic add later with no migration.                                                                                                                              |
| 4   | **Cost / quota**          | BYOK usage **bypasses** tenant/platform quota. Telemetry records `credential_owner='user'` + `billingUserId` for visibility only; the quota pre-check is skipped for BYOK calls.                                                                             |
| 5   | **Rotation**              | Manual only. New value = new Secret Manager version (resolver reads `versions/latest`). Prior version kept for a grace window then disabled. Rollback = re-enable prior version. No scheduled/cron rotation.                                                 |
| 6   | **Auth**                  | RBAC + permission + audit log on every key op. **No** step-up re-auth this iteration.                                                                                                                                                                        |
| 7   | **UI surfaces**           | Full backend + contracts, **plus** per-user BYOK settings (student-web, teacher-web, mobile-student, mobile-teacher), admin-web tenant-key management, super-admin platform keys. Minimal but production-ready.                                              |
| 8   | **Test creds**            | mobile-teacher `.env` smoke-autologin left as-is this workstream (deferred).                                                                                                                                                                                 |

---

## 1. What already exists (do not rebuild)

- **Tenant Gemini key**: value in GCP Secret Manager `tenant-{tenantId}-gemini`;
  `tenant.settings.geminiKeyRef` holds only the ref. Written by `saveTenant`
  (plaintext `geminiApiKey` on the wire → `createSecretWriter`).
- **Platform key**: `levelup-default-gemini` (resolver tries it first today).
- **Resolver / writer**: `packages/ai/src/secrets/secret-manager.ts`
  (`createSecretResolver`, `createSecretWriter`, `secretNameFor`). Env override
  `LEVELUP_AI_KEY`/`GEMINI_API_KEY` short-circuits SM for emulator/dev.
  Per-tenant in-process cache + `invalidate(tenantId)`.
- **Gateway**: `packages/ai/src/gateway.ts` —
  `moderate → checkUsageQuota → circuit → getApiKey → provider.call(retry) → telemetry`.
  Already carries `ctx.credentialOwner: "platform" | "tenant"` and writes it to
  telemetry.
- **Telemetry**: Supabase `llm_requests` / `llm_call_attempts` (migration
  `20260718160000_llm_tracking_foundation.sql`) already have a
  `credential_owner` column + `billing_user_id`. Sink:
  `packages/services/src/supabase/llm-telemetry.ts`. **We extend the enum with
  `'user'`; we do NOT build new telemetry.**
- **RBAC**: `packages/access/src/policy.ts` — one
  `authorize(ctx, action, resource)`; roles
  superAdmin/tenantAdmin/staff/teacher/student/parent/scanner.
- **Contract**: `defineCallable` in `packages/api-contract`; `saveTenant` is
  `authoritySensitive`.

## 2. Gaps this workstream closes

Per-user BYOK (schema, storage, resolution, contracts, UI); provider-agnostic
key model; explicit precedence with no-silent-fallback-on-user-key; manual
rotation + revocation + rollback; per-user secret writer/resolver;
`credential_owner='user'` + quota bypass; RBAC actions + audit for key ops;
validation; cache invalidation on rotate/revoke; admin + super-admin + per-user
UIs.

---

## 3. Architecture

### 3.1 Secret Manager naming (opaque refs only in DB)

- Tenant: `tenant-{tenantId}-gemini` (unchanged).
- Platform: `levelup-default-gemini` (unchanged).
- **User BYOK (new)**: `user-{userId}-{provider}` (e.g. `user-abc123-google`).
  User-global (a user's own key follows them across tenants). DB stores only
  this ref + a masked hint, never the value.

### 3.2 Domain: `UserProviderKey` (new entity, metadata only)

`packages/domain/src/entities/identity/user-provider-key.ts`

```
UserProviderKeySchema = {
  id,                 // `${userId}:${provider}`
  userId,
  provider,           // enum: 'google' (extensible)
  secretRef,          // Secret Manager secret name — opaque, never the value
  maskedKey,          // e.g. "AIza…4f2c" (first4…last4)
  status,             // 'active' | 'invalid' | 'revoked'
  enabled,            // user's opt-in to actually use it
  label?,             // optional user label
  createdInTenantId,  // audit only
  version,            // increments on each rotation
  validatedAt,        // last provider-side validation
  lastUsedAt?,
  createdAt, updatedAt,
}
```

Never contains the key value. `KeyProviderSchema = z.enum(['google'])` lives in
`enums/` so contract + services share it.

### 3.3 Storage

Top-level Firestore collection `userProviderKeys/{userId}:{provider}`
(server-only; rules deny all client access — reads go through callables that
return the masked projection). Repo: `UserProviderKeyRepo` in
`packages/repositories` + admin impl.

### 3.4 Resolution precedence (gateway)

Replace the platform-first branch in `createSecretResolver.getApiKey` semantics
with an explicit precedence resolver invoked by the gateway **before** the quota
check, because BYOK must skip quota:

New gateway flow:

```
resolveCredential(ctx) → { owner: 'user'|'tenant'|'platform', apiKey, provider }
  1. if ctx has a usable user BYOK key (status active + enabled):
       owner='user'  → on ANY failure downstream, DO NOT fall back (surface error)
  2. else tenant key (tenant-{tenantId}-gemini) → owner='tenant'
  3. else platform key (levelup-default-gemini) → owner='platform'
if owner !== 'user':  checkUsageQuota(...)   // BYOK bypasses quota
else:                 skip quota
provider.call(...)
credentialOwner = owner   // flows to telemetry
```

The resolver gains a `getCredential(ctx)` that returns `{ owner, apiKey }`; the
current tenant/platform fallback stays intact for the non-BYOK path. User-key
lookups are injected via a `UserKeyLookup` port (services provide the
repo-backed impl; `ai` package stays free of Firestore per lint-boundaries).

### 3.5 Per-user secret writer/resolver

Generalize `secret-manager.ts`:

- `userSecretNameFor(userId, provider)` helper (SSOT, mirrors `secretNameFor`).
- `createUserSecretWriter` (create-or-add-version; returns ref) — reused for
  create + rotate.
- `createUserSecretResolver` (read `versions/latest`; per-(user,provider)
  cache + `invalidate`).
- `disablePriorVersions(ref, keepLatest)` + `enableVersion(ref, version)` for
  rotate grace + rollback.

### 3.6 Telemetry

- Extend `LlmRequestRecord.credentialOwner` / `LlmAttemptRecord` type to
  `'platform' | 'tenant' | 'user'`.
- Migration `2026071819xxxx_llm_credential_owner_user.sql`: doc-only (the column
  is free text `text`), add a CHECK/comment noting `'user'` is valid + optional
  index on `(credential_owner)`. No data change.
- Gateway sets `credentialOwner` from the resolved owner (not just
  `ctx.credentialOwner ?? 'tenant'`).

### 3.7 Validation

`validateProviderKey(provider, key)` in `packages/ai` — a cheap live call
(Gemini: `models.list` / a 1-token generate). Called by the save-key service
**before** persisting; on failure the key is rejected (never stored).
Emulator/no-network → skip with `validated:false` + status `active` (dev).

### 3.8 RBAC actions (new, in `policy.ts`)

```
"userKey.manage": { roles: "any-authed", tenantScoped: true, ownershipCheck: "self" }   // BYOK: your own keys only
"tenantKey.manage": { roles: ["tenantAdmin"], tenantScoped: true }                        // tenant provider keys
"platformKey.manage": { roles: "super-admin-only", tenantScoped: false }                  // platform fallback keys
```

Audit: every create/rotate/revoke writes a `keyAudit` event (no secret) — reuse
the existing platform activity / audit log writer.

### 3.9 Contracts (new callables, `packages/api-contract`)

Module `identity` (keys grouped in `callables/identity/keys.ts`):

- `v1.identity.saveUserProviderKey` (authed, self) —
  `{ provider, apiKey, label?, enabled? }` → validates + stores, returns masked
  projection. `authoritySensitive`.
- `v1.identity.listUserProviderKeys` (authed, self) → masked list.
- `v1.identity.setUserProviderKeyEnabled` (authed, self) —
  `{ provider, enabled }`.
- `v1.identity.deleteUserProviderKey` (authed, self) — `{ provider }` (revoke +
  disable secret).
- `v1.identity.rotateTenantKey` (tenantAdmin) — `{ provider, apiKey }` → new
  version + grace-disable prior; `authoritySensitive`.
- `v1.identity.revokeTenantKey` (tenantAdmin) — `{ provider }`.
- `v1.identity.getTenantKeyStatus` (tenantAdmin) →
  `{ provider, present, maskedKey?, version, status, updatedAt }`.
- `v1.identity.savePlatformKey` / `getPlatformKeyStatus` (super-admin) —
  platform fallback key. (Tenant key create still also works via existing
  `saveTenant.geminiApiKey`; the new callables add rotate/revoke/status + masked
  display.)

### 3.10 Services (`packages/services/src/identity/keys.ts`)

`saveUserProviderKey`, `listUserProviderKeys`, `setUserProviderKeyEnabled`,
`deleteUserProviderKey`, `rotateTenantKey`, `revokeTenantKey`,
`getTenantKeyStatus`, `savePlatformKey`, `getPlatformKeyStatus`. Each:
`authorize(...)` → validate (where applicable) → SM write → repo upsert (masked
meta) → `secretResolver.invalidate(...)` → audit.

### 3.11 UI (minimal, production-ready)

- **student-web / teacher-web** (`@levelup/query` hooks `useUserProviderKeys`,
  `useSaveUserProviderKey`, …): Settings → "AI / API Keys" panel: add key
  (validated), masked display, enable toggle, remove.
- **mobile-student / mobile-teacher**: same panel in Settings.
- **admin-web**: Tenant → "API Keys" tab: status/masked/version, rotate, revoke.
- **super-admin**: "Platform Keys": platform fallback key status + save.

---

## 4. Phasing (implementation order)

- **P1 — Backend core (this session):** domain entity + enum; secret-manager
  per-user + rotate/rollback helpers; resolver `getCredential` precedence +
  quota-bypass in gateway; `credential_owner='user'`; repos; services;
  contracts; RBAC actions; validation; audit; wiring in
  `functions/sdk-v1/bootstrap`; unit tests; build+test green.
- **P2 — Query hooks + web UI:** `@levelup/query` hooks; student-web +
  teacher-web + admin-web + super-admin panels.
- **P3 — Mobile UI:** mobile-student + mobile-teacher panels.
- **P4 — Migration + deploy:** SM/rules deploy, telemetry migration apply,
  smoke, docs.

UI phases parallelize by app-owner once P1 freezes the contract.

## 4b. Execution checklist (exact files, full stack)

**Coordination note:** LLM-Tracking session already shipped
`levelup-default-gemini` platform-default + tenant fallback in
`secret-manager.ts` / `shared-services` / `functions/autograde` and is deploying
the bridge to sdk-v1 prod. My changes INTEGRATE (never replace) that platform
secret. Do not edit paused packages (`ai`, `services`, `domain`, `api-contract`,
`functions/sdk-v1`) during their deploy.

**Done (additive, green):**

- `packages/domain/src/enums/keys.ts` (new) — `KEY_PROVIDERS`, `KEY_STATUSES`,
  `CREDENTIAL_OWNERS`.
- `packages/domain/src/entities/identity/user-provider-key.ts` (new) — entity +
  view + `userProviderKeyId`/`maskKey`.
- barrels: `enums/index.ts`, `entities/identity/index.ts`.

**P1 backend (blocked on unpause):**

- `packages/ai/src/secrets/secret-manager.ts` — ADD `userSecretNameFor`,
  `createUserSecretWriter`, `createUserSecretResolver`, `disablePriorVersions`,
  `enableVersion`. Keep `PLATFORM_GEMINI_SECRET_NAME`, `secretNameFor`,
  `createSecretResolver`, `createSecretWriter` intact.
- `packages/ai/src/secrets/validate.ts` (new) —
  `validateProviderKey(provider, key)` cheap live call; emulator/no-project →
  `{ validated:false, ok:true }`.
- `packages/ai/src/telemetry/types.ts` —
  `credentialOwner: 'platform'|'tenant'|'user'`.
- `packages/ai/src/gateway.ts` — inject `userKeyLookup?: UserKeyLookup` port;
  `resolveCredential(ctx)` precedence user→tenant→platform; skip
  `checkUsageQuota` when owner==='user'; on user-key call failure DO NOT fall
  back (fail-closed); set `credentialOwner` from resolved owner; `invalidate`
  hook on rotate/revoke.
- `packages/ai/src/index.ts` — export new symbols.
- `packages/services/src/repo-admin/*` — `UserProviderKeyRepo`
  (get/upsert/delete/list-by-user) on collection
  `userProviderKeys/{userId}:{provider}`; register in `Repos`.
- `packages/services/src/identity/keys.ts` (new) — `saveUserProviderKey`,
  `listUserProviderKeys`, `setUserProviderKeyEnabled`, `deleteUserProviderKey`,
  `rotateTenantKey`, `revokeTenantKey`, `getTenantKeyStatus`, `savePlatformKey`,
  `getPlatformKeyStatus`. Each: `authorize()` → validate → SM write → repo
  upsert (masked) → `invalidate` → audit.
- `packages/services/src/shared/context.ts` — provide `userKeyLookup` to gateway
  via bootstrap (repo-backed).
- `packages/access/src/actions.ts` + `policy.ts` — add `userKey.manage`
  (any-authed, self), `tenantKey.manage` (tenantAdmin), `platformKey.manage`
  (super-admin-only) + completeness test.
- `packages/api-contract/src/callables/identity/keys.ts` (new) — the 9 callables
  (§3.9); register in identity index + `TENANT_CALLABLES`/module map;
  coverage-pin test.
- `functions/sdk-v1/src/bootstrap.ts` — wire `userKeyLookup` into
  `createAiGateway`; register key callables → services.
- `firestore.rules` — `userProviderKeys` deny-all (server-only).
- `supabase/migrations/2026071819xxxx_llm_credential_owner_user.sql` — doc/CHECK
  for `'user'` + optional index. **Coordinate with LLM-Tracking (they own
  telemetry).**
- tests: secret-manager per-user precedence; gateway BYOK bypass + fail-closed;
  keys service authz/validate/rotate; contract coverage pin.

**P2 web:** `packages/repositories/src/identity/user-provider-key.ts` (client
repo) + register; `packages/query/src/identity/user-provider-keys.ts` hooks
(`useUserProviderKeys`, `useSaveUserProviderKey`,
`useSetUserProviderKeyEnabled`, `useDeleteUserProviderKey`, admin
`useTenantKeyStatus`/`useRotateTenantKey`/`useRevokeTenantKey`, super-admin
`usePlatformKeyStatus`/`useSavePlatformKey`); UI panels in
`student-web`/`teacher-web` `SettingsPage.tsx`, `admin-web` settings,
`super-admin` settings.

**P3 mobile:** BYOK panel in `mobile-student`
`screens/profile/SettingsScreen.tsx` + `mobile-teacher` settings, reusing the
same api-client callables.

## 5. Non-goals (explicitly deferred)

Scheduled/auto rotation; step-up re-auth; OpenAI/Anthropic adapters; age/consent
gating for minors; per-feature key overrides; mobile-teacher test-cred fix.
