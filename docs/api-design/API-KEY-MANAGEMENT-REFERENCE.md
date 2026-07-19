# API Key Management Reference and Runbook

Status: backend core deployed; client settings UI and Supabase production
telemetry activation remain open  
Project: `lvlup-ff6fa`  
Region: `asia-south1`  
Last verified: 2026-07-18

This is the canonical description of the API-key system that is actually
implemented. It supersedes implementation-status statements in
`API-KEY-MANAGEMENT-PLAN.md`; the plan remains the record of product decisions
and future scope.

## 1. Current production state

| Capability                         | State                   | Evidence                                                                                           |
| ---------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Platform Gemini default            | Live                    | Secret Manager secret `levelup-default-gemini`, enabled version 1                                  |
| Runtime access to platform key     | Live                    | Cloud Functions runtime service account has secret accessor; real provider calls passed            |
| User BYOK backend                  | Live                    | Save/list/enable/delete callables deployed; authenticated save/list/delete production smoke passed |
| Tenant key backend                 | Live                    | Rotate/revoke/status callables deployed                                                            |
| Platform key backend               | Live                    | Super-admin save/status callables deployed                                                         |
| Credential hierarchy               | Live in v1 AI gateway   | `user -> tenant -> platform`; user failure is fail-closed                                          |
| Key validation                     | Live                    | Gemini `models.list` validation before save; definitive invalid credentials rejected               |
| Server-only Firestore policy       | Live                    | `userProviderKeys` and `keyMetadata` deny all client reads/writes                                  |
| LLM provider/model path            | Live                    | Production extraction completed with `gemini-3.1-pro-preview`; flash default is `gemini-3.5-flash` |
| Supabase telemetry code            | Implemented, not active | Sink and schema exist, but production `SUPABASE_SERVICE_ROLE_KEY` is empty                         |
| Supabase BYOK constraint migration | Code-ready, not applied | `20260718190000_llm_credential_owner_user.sql`                                                     |
| Web/mobile key settings            | Not implemented         | No query hooks or app settings panels currently consume the nine callables                         |
| Automatic scheduled rotation       | Not implemented         | Manual version creation/revocation only                                                            |
| Rollback callable/UI               | Not implemented         | Low-level user-secret version enable/disable primitives exist only                                 |

The backend is usable today through Firebase callable functions. The product UI
work must not be described as shipped until the web/mobile/admin settings
surfaces are implemented and deployed.

## 2. Credential resolution

For a production v1 LLM request, the gateway resolves one credential:

```text
active user BYOK key
        |
        | absent
        v
tenant Gemini key: tenant-{tenantId}-gemini
        |
        | secret does not exist
        v
platform Gemini key: levelup-default-gemini
```

Rules:

- An active and enabled user key always wins.
- If the user key exists but cannot be read or the provider rejects it, the
  request fails. It does not spend tenant or platform budget.
- If the user has no eligible key, tenant then platform fallback is automatic.
- A permission error reading a tenant secret is surfaced. Only a genuine
  not-found condition falls back to the platform key.
- User-owned calls bypass the tenant/platform quota pre-check.
- Tenant and platform calls remain subject to the gateway quota check.
- The v1 resolver intentionally reads Secret Manager on each request. This
  avoids stale credentials in warm function instances after rotation or
  revocation.
- `LEVELUP_AI_KEY` or `GEMINI_API_KEY` is a local/emulator override. It replaces
  Secret Manager resolution for development; it is not the production hierarchy.

The five production v1 AI entry points deployed with this behavior are:

- `v1-levelup-sendChatMessage`
- `v1-levelup-evaluateAnswer`
- `v1-levelup-generateContent`
- `v1-autograde-extractQuestions`
- `v1-autograde-gradeQuestion`

Legacy compatibility functions still use their legacy resolver bridge. The
platform default was deployed to those functions earlier, but user BYOK lookup
is owned by the v1 gateway and must not be assumed on an un-migrated legacy
path.

## 3. Secret and metadata storage

### Secret Manager

| Owner    | Secret name                | Value behavior                                     |
| -------- | -------------------------- | -------------------------------------------------- |
| User     | `user-{userId}-{provider}` | New save adds a version; delete removes the secret |
| Tenant   | `tenant-{tenantId}-gemini` | Rotate adds a version; revoke removes the secret   |
| Platform | `levelup-default-gemini`   | Save adds a version                                |

Plaintext is present only in the authenticated callable request long enough to:

1. validate it with the provider;
2. write it to Secret Manager;
3. discard it.

It is never returned by a callable and must never be logged.

### Firestore

`userProviderKeys/{userId}:{provider}` contains user key metadata:

- opaque `secretRef`;
- masked key;
- provider;
- active/invalid/revoked status;
- enabled flag;
- label;
- Secret Manager version;
- validation and audit timestamps.

`keyMetadata/{scope}` contains masked tenant/platform status:

- tenant scope: `tenant:{tenantId}:{provider}`;
- platform scope: `platform:{provider}`.

The tenant document carries `geminiKeyRef` for compatibility. Neither tenant
documents nor metadata collections contain plaintext key values.

Firestore rules deny all direct client access to `userProviderKeys` and
`keyMetadata`. All reads and mutations go through authenticated callables backed
by Admin SDK repositories.

## 4. Callable API

All functions are deployed under the `sdk-v1` codebase in `asia-south1`.

| Callable                                | Authority                                    | Purpose                                            |
| --------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `v1.identity.saveUserProviderKey`       | Any authenticated user, self only            | Validate and save/rotate BYOK; return masked view  |
| `v1.identity.listUserProviderKeys`      | Any authenticated user, self only            | List masked personal key metadata                  |
| `v1.identity.setUserProviderKeyEnabled` | Any authenticated user, self only            | Opt into or out of BYOK routing                    |
| `v1.identity.deleteUserProviderKey`     | Any authenticated user, self only            | Delete personal metadata and Secret Manager secret |
| `v1.identity.rotateTenantKey`           | Tenant admin; super-admin override supported | Validate and add a tenant secret version           |
| `v1.identity.revokeTenantKey`           | Tenant admin; super-admin override supported | Delete tenant secret, clear ref, mark revoked      |
| `v1.identity.getTenantKeyStatus`        | Tenant admin; super-admin override supported | Return masked tenant key status                    |
| `v1.identity.savePlatformKey`           | Real super-admin only                        | Validate and add a platform secret version         |
| `v1.identity.getPlatformKeyStatus`      | Real super-admin only                        | Return masked platform key status                  |

The deployed function IDs replace dots with dashes, for example:
`v1.identity.saveUserProviderKey` becomes `v1-identity-saveUserProviderKey`.

The raw provider key is accepted only by save/rotate requests. Response
contracts contain masks and metadata only.

## 5. Validation behavior

Gemini keys are checked against the Google Generative Language models endpoint
before storage:

- HTTP 200: accepted and `validatedAt` is stamped;
- HTTP 400/401/403: rejected as `INVALID_API_KEY`;
- HTTP 429/5xx or network failure: not treated as proof of an invalid key; the
  key may be stored with no successful validation timestamp;
- emulator/local override: provider validation is skipped.

Only `google` is enabled in the provider enum. The domain and callable schemas
are provider-shaped so another provider can be added without redesigning
ownership, but its adapter and validation branch must be implemented first.

## 6. Rotation, revocation, and rollback

### User key

- Saving the same provider again writes a new Secret Manager version and updates
  the masked metadata/version.
- Disabling the key keeps it stored but removes it from gateway eligibility.
- Deleting removes both metadata and the Secret Manager secret.
- The low-level writer can disable prior versions and re-enable a numbered
  version, but no production callable or UI exposes grace-window rollback yet.

### Tenant key

- Rotate validates and adds the latest version to `tenant-{tenantId}-gemini`.
- Revoke deletes that Secret Manager container, clears the tenant ref, and marks
  metadata revoked. The next uncached gateway resolution falls back to the
  platform key.
- Manual rollback/grace automation is not exposed.

### Platform key

- Save validates and adds a new version to `levelup-default-gemini`.
- There is no platform revoke callable in the current contract. Emergency
  disable/delete is a super-admin Secret Manager operation.

## 7. Authorization and audit

The access package defines three actions:

- `userKey.manage`: any authenticated role, self-ownership required;
- `tenantKey.manage`: tenant admin, tenant-scoped;
- `platformKey.manage`: real super-admin only, platform-scoped.

Mutations write metadata-only audit entries:

- `user.ai.key.write`
- `user.ai.key.revoke`
- `tenant.ai.key.rotate`
- `tenant.ai.key.revoke`
- `platform.ai.key.write`

Audit entries may include actor, provider, version, tenant, and timestamp. They
must never contain a secret value.

## 8. LLM attribution and Supabase

The gateway request record supports:

- `credential_owner = 'user' | 'tenant' | 'platform'`;
- actor, initiator, subject, and billing user IDs;
- tenant, feature, operation, prompt, resource, model, token usage, and
  estimated cost;
- one attempt row per provider attempt.

BYOK sets `credential_owner='user'` and bypasses tenant/platform quota while
retaining visibility and token/cost attribution.

Code paths:

- gateway record types: `packages/ai/src/telemetry/`;
- Supabase sink: `packages/services/src/supabase/llm-telemetry.ts`;
- foundation schema:
  `supabase/migrations/20260718160000_llm_tracking_foundation.sql`;
- BYOK constraint extension:
  `supabase/migrations/20260718190000_llm_credential_owner_user.sql`.

Production telemetry is currently disabled because
`functions/sdk-v1/.env.lvlup-ff6fa` has an empty `SUPABASE_SERVICE_ROLE_KEY`.
`SUPABASE_URL` and a publishable key are not enough for the server sink. Until a
real server-only key is installed and the migrations are applied, the Supabase
smoke test correctly fails before making a write.

Activation runbook:

1. provision the real service-role credential as a server-only Firebase/GCP
   secret; never use an `EXPO_PUBLIC_` or `VITE_` variable;
2. bind it to the sdk-v1 functions runtime;
3. apply both Supabase migrations, including the BYOK owner constraint;
4. deploy the affected v1 AI functions;
5. run `pnpm -F @levelup/functions-sdk-v1 smoke:supabase`;
6. make one authenticated LLM call and verify request, attempt, token, cost,
   user/tenant, and `credential_owner` fields;
7. verify the smoke row is deleted and no prompt/response content was stored.

## 9. Client integration

Clients must not send a provider key on each LLM request. The intended flow is:

1. user opens an authenticated settings screen;
2. settings calls `saveUserProviderKey` once;
3. later LLM operations carry normal Firebase authentication only;
4. the server resolves the user, tenant, or platform credential.

The backend contracts are ready, but query hooks and settings panels do not yet
exist in student/teacher web/mobile, admin-web, or super-admin. The next UI
phase must add:

- student/teacher web and mobile: personal key add, mask, enable, delete;
- admin-web: tenant status, rotate, revoke;
- super-admin: platform status and save.

The UI must clear plaintext form state after submit, never persist it in browser
or mobile storage, and never display it after save.

## 10. Deployment and verification record

Verified on 2026-07-18:

- access typecheck and 6/6 policy tests passed;
- API-contract typecheck and 145/145 tests passed;
- AI typecheck, build, and 42/42 tests passed;
- focused key-service suite passed 5/5;
- services typecheck and build passed;
- sdk-v1 typecheck/build and 174/174 tests passed;
- callable coverage passed 154/154;
- Firestore rules compiled and deployed;
- all nine key-management functions are active in `asia-south1`;
- all five current v1 LLM entry points were redeployed with the final resolver;
- unauthenticated callable smoke returned the expected `UNAUTHENTICATED`;
- authenticated `listUserProviderKeys` returned HTTP 200;
- a controlled production BYOK save/list/delete cycle passed without printing
  the key, and the post-delete list returned zero keys;
- production extraction completed 24 questions and 24 rubrics using
  `gemini-3.1-pro-preview`;
- the platform default key remained `levelup-default-gemini`.

Deployment warnings to schedule:

- Node.js 20 is deprecated and reaches decommission on 2026-10-30;
- the deployed `firebase-functions` dependency is behind the current major
  version;
- Firebase CLI 13.7.2 cannot parse the current build manifest; deployment was
  completed with Firebase CLI 15.24.0.

## 11. Operational runbooks

### Save a platform default

Preferred: call `v1.identity.savePlatformKey` as a real super-admin. It
validates, writes a new Secret Manager version, stores masked metadata, and
audits the change.

Emergency/manual Secret Manager changes must preserve the exact name
`levelup-default-gemini`, verify runtime accessor IAM, and be followed by a real
gateway call.

### Rotate a tenant key

1. authenticate as tenant admin;
2. call `v1.identity.rotateTenantKey`;
3. check `getTenantKeyStatus`;
4. run a tenant LLM smoke;
5. verify telemetry owner `tenant` after Supabase is activated.

### Revoke a tenant key

1. confirm the platform fallback is present and valid;
2. call `v1.identity.revokeTenantKey`;
3. confirm status is revoked/present false;
4. run an LLM smoke and confirm it succeeds on the platform owner;
5. investigate immediately if Secret Manager deletion or fallback fails.

### Test user BYOK safely

1. use a dedicated test user and test provider key;
2. save and confirm only a mask is returned;
3. list and confirm enabled/active status;
4. run one LLM call and confirm owner `user`;
5. invalidate the provider key deliberately only in a non-production test and
   confirm fail-closed behavior;
6. delete the BYOK key and confirm list is empty.

### Provider incident

1. determine the credential owner from telemetry/log-safe metadata;
2. do not copy secret values into the incident;
3. user owner: surface the error and ask that user to repair/disable BYOK;
4. tenant owner: rotate or revoke and verify platform fallback;
5. platform owner: add a validated version or disable AI if no safe key exists;
6. verify provider/model availability before blaming the credential.

## 12. Source map

- Domain metadata and enums:
  `packages/domain/src/entities/identity/user-provider-key.ts`,
  `packages/domain/src/enums/keys.ts`
- Gateway and resolver: `packages/ai/src/gateway.ts`,
  `packages/ai/src/secrets/secret-manager.ts`
- Validation: `packages/ai/src/secrets/validate.ts`
- Access: `packages/access/src/actions.ts`, `packages/access/src/policy.ts`
- Contracts: `packages/api-contract/src/callables/identity/keys.ts`
- Services: `packages/services/src/identity/keys.ts`
- Repositories: `packages/services/src/repo-admin/extended.ts`,
  `packages/services/src/shared/extended-repos.ts`
- Function wiring: `functions/sdk-v1/src/identity.ts`,
  `functions/sdk-v1/src/bootstrap.ts`
- Firestore policy: `firestore.rules`
- Supabase migrations: `supabase/migrations/`
- Team ownership: `docs/llm-tracking/LLM-OPERATIONS-TEAM.md`

## 13. Definition of complete for the remaining rollout

The end-to-end project is complete only when:

- Supabase service-role secret is installed securely;
- both telemetry migrations are applied and the smoke passes;
- user/tenant/platform settings surfaces are implemented and deployed;
- web and mobile production builds exercise those surfaces;
- BYOK, tenant, and platform production smokes verify correct
  `credential_owner`;
- Node 20 and Firebase dependency upgrade work is scheduled before the runtime
  deadline;
- this reference is updated with the final app URLs/build versions and evidence.
