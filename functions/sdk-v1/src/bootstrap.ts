/**
 * Runtime bootstrap for the deployable `v1.*` codebase (Phase 5 wiring).
 *
 * This is the ONE place the codebase wires the structural ports that
 * `@levelup/functions-adapters` (the `makeCallable`/`makeTrigger`/… shells) pull
 * via `getRepos()`/`getAi()`/`getClock()`. It is imported for side-effect at the
 * top of `index.ts` (BEFORE any module barrel) so every shell resolves the same
 * injected `repos`/`ai`/`clock`.
 *
 * Providers wired to the REAL implementations:
 *   • repos  → `@levelup/services/repo-admin` `createRepos()` (Admin SDK — the ONLY
 *              direct-Firestore site). Constructed lazily after `admin.initializeApp()`.
 *   • ai     → `@levelup/ai` `createAiGateway({ repos, projectId })` (per-tenant
 *              Secret Manager key resolution + cost/quota/circuit-breaker).
 *   • clock  → ISO wall-clock (`() => new Date().toISOString()`).
 *
 * Port-shape reconciliation (the SINGLE sanctioned cast, T9/structural-port seam):
 * `@levelup/functions-adapters` types `repos`/`ai` against the local structural
 * `Repos`/`AiGateway` ports in `context/ports.ts` (intentionally minimal — only the
 * members the adapter layer touches are named, the rest is an index signature). The
 * concrete `createRepos()` / `createAiGateway()` results are structural supersets of
 * those ports but are nominally distinct types (e.g. the port's
 * `AiCallContext.tenantId` is `TenantId | string` vs the ai package's `TenantId`).
 * The plan (`context/ports.ts` header) defers replacing the local seams with the
 * concrete types to the reconciliation wave; until then this one boundary casts
 * `repos`/`ai` to the port types so the injection typechecks. No `any`; no test
 * weakening; the cast lives ONLY at this wiring boundary.
 */
// `firebase-admin`'s ESM build exposes the namespace (`apps`, `initializeApp`,
// `app`, …) on the DEFAULT export only — `import * as admin` yields
// `admin.apps === undefined` (CJS interop), which throws on `admin.apps.length`
// at module load and fails the codebase analysis. Use the default import.
import admin from "firebase-admin";
import { isoNow, type Timestamp } from "@levelup/domain";
import { createRepos } from "@levelup/services/repo-admin";
import { createAiGateway, createStubProvider, type SecretResolver } from "@levelup/ai";
import {
  configureRuntime,
  projectId,
  type Repos as PortRepos,
  type AiGateway as PortAiGateway,
} from "@levelup/functions-adapters";

let configured = false;

/**
 * Initialize firebase-admin (idempotent) and wire the three runtime ports into
 * `@levelup/functions-adapters` exactly once. Safe to call from multiple module
 * loads; only the first call performs the wiring.
 */
export function bootstrapRuntime(): void {
  if (configured) return;

  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  // ISO wall-clock injected as `ctx.now()` for every service.
  const clock = (): Timestamp => isoNow();

  // The ONLY direct-Firestore handle, built over the initialized Admin app.
  // `createRepos` takes a plain `() => string` ISO clock.
  const repos = createRepos({ now: () => clock() });

  // AI gateway over the same repos slice (cost/quota reads + LlmCallLog writes go
  // through `ctx.repos.*`, never firebase-admin directly).
  //
  // EMULATOR/TEST guard: when running against the Firebase emulator (or an explicit
  // TEST/SEED flag), inject a DETERMINISTIC stub provider + constant-key secret
  // resolver so NO test ever blocks on a real LLM network round-trip. The gateway's
  // moderation / quota / cost / audit-log / circuit-breaker sequence is unchanged —
  // only the provider's network leg and the Secret Manager lookup are stubbed.
  const isEmulatorOrTest =
    !!process.env["FIRESTORE_EMULATOR_HOST"] ||
    process.env["LEVELUP_AI_STUB"] === "1" ||
    process.env["SEED"] === "1" ||
    process.env["TEST"] === "1";

  const aiDeps: Parameters<typeof createAiGateway>[0] = {
    repos: repos as unknown as Parameters<typeof createAiGateway>[0]["repos"],
    projectId: projectId(),
  };
  if (isEmulatorOrTest) {
    const stubSecretResolver: SecretResolver = {
      getApiKey: async () => "stub-emulator-key",
      invalidate: () => {},
    };
    aiDeps.providerFactory = (apiKey, model) => createStubProvider(apiKey, model);
    aiDeps.secretResolver = stubSecretResolver;
  }
  const ai = createAiGateway(aiDeps);

  configureRuntime({
    // Structural-port reconciliation cast (see file header). The concrete
    // implementations are supersets of the adapter-layer ports.
    repos: repos as unknown as PortRepos,
    ai: ai as unknown as PortAiGateway,
    clock,
  });

  configured = true;
}

// Run the wiring on module load (side-effect import from index.ts). `index.ts`
// imports `./bootstrap.js` BEFORE any module barrel precisely so the runtime
// ports resolve the moment each shell's module is evaluated; the import alone is
// inert unless the bootstrap actually executes here. Idempotent (the `configured`
// guard), so repeat module loads are safe.
bootstrapRuntime();
