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
import {
  createSupabaseLlmTelemetrySink,
  getSupabaseServerClient,
  isSupabaseTelemetryConfigured,
  createUserKeyLookup,
} from "@levelup/services";
import {
  createAiGateway,
  createStubProvider,
  createStubImageStore,
  type SecretResolver,
  type UserSecretResolver,
} from "@levelup/ai";
import {
  configureRuntime,
  projectId,
  createAdminStorageSigner,
  createRtdbGradingProjections,
  createRtdbExtractionProjections,
  createRtdbLevelupProjections,
  enqueuePipelineAdvance,
  type Repos as PortRepos,
  type AiGateway as PortAiGateway,
  type PipelineEnqueuePort,
} from "@levelup/functions-adapters";
import { makeAiSeam } from "./ai-seam.js";
import { createAdminImageStore } from "./image-store.js";

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

  // imageStore (FIX-3): the storagePath→bytes seam has NO in-gateway default —
  // unwired, every `{ storagePath }` AI call fails loud PRECONDITION_FAILED
  // ("image store not configured"). Prod reads the DEFAULT bucket (the same one
  // `signUploadUrl` grants `tenants/…` paths into); emulator/tests get the
  // deterministic stub (symmetric with createStubProvider — no Storage-emulator
  // object needs to exist behind the paths services pass).
  const aiDeps: Parameters<typeof createAiGateway>[0] = {
    repos: repos as unknown as Parameters<typeof createAiGateway>[0]["repos"],
    projectId: projectId(),
    imageStore: isEmulatorOrTest ? createStubImageStore() : createAdminImageStore(),
    // BYOK precedence (user → tenant → platform): the gateway discovers a user's
    // own key via this repo-backed lookup, then reads the value from Secret Manager.
    userKeyLookup: createUserKeyLookup(
      repos as unknown as Parameters<typeof createUserKeyLookup>[0]
    ),
  };
  if (isSupabaseTelemetryConfigured()) {
    aiDeps.telemetry = createSupabaseLlmTelemetrySink(getSupabaseServerClient());
    aiDeps.onTelemetryError = ({ stage, requestId, attemptId, error }) => {
      console.error("LLM telemetry delivery failed", {
        stage,
        requestId,
        ...(attemptId !== undefined ? { attemptId } : {}),
        error: error instanceof Error ? error.message : "unknown telemetry error",
      });
    };
  }
  if (isEmulatorOrTest) {
    const stubSecretResolver: SecretResolver = {
      getApiKey: async () => "stub-emulator-key",
      invalidate: () => {},
    };
    const stubUserSecretResolver: UserSecretResolver = {
      getKeyByRef: async () => "stub-emulator-key",
      invalidate: () => {},
    };
    aiDeps.providerFactory = (apiKey, model) => createStubProvider(apiKey, model);
    aiDeps.secretResolver = stubSecretResolver;
    aiDeps.userSecretResolver = stubUserSecretResolver;
  }
  const ai = createAiGateway(aiDeps);

  // ── AI seam reconciliation (RESULT-shape adapter) ──────────────────────────
  // The `@levelup/services` layer consumes the gateway through its OWN structural
  // seam (`services/src/shared/ai.ts` `AiGenerateResult`), whose result fields are
  // `{ text, json, tokensUsed, costUsd, model }` — every service reads `ai.json`
  // (+ `ai.costUsd`/`ai.tokensUsed`). The concrete `@levelup/ai` gateway returns
  // `AiResponse = { data, text, tokenUsage, cost, model }`. These two shapes have
  // NEVER been reconciled: the `as unknown as PortAiGateway` cast below silences
  // the type divergence, so at runtime `ai.json` was ALWAYS `undefined` and every
  // AI-graded answer (and autograde grade, and chat token count) collapsed to a
  // zeroed/empty result. Adapt the RESULT here — the single sanctioned wiring
  // boundary — so the injected gateway satisfies the services seam at runtime.
  // The mapping lives in `./ai-seam.ts` (pure, unit-pinned) because this `as
  // unknown` cast has no compile guard; see `__tests__/ai-seam.adapter.test.ts`.
  const aiSeam = makeAiSeam(ai as unknown as Parameters<typeof makeAiSeam>[0]);

  // ── Runtime-wiring hooks (FIX-2: the previously-hollow composition root) ────
  // PROD-ONLY injection (except the RTDB tickers — see below); when absent the
  // services keep their emulator/test fallbacks (stub upload URL, inline
  // pipeline, no-op ticker projection):
  //   • storage            → ctx.storage.signUploadUrl (Admin-SDK v4 signed PUT;
  //                          requestUploadUrlService, P0-D)
  //   • pipelineTasks      → ctx.enqueuePipelineAdvance (Cloud Tasks via
  //                          firebase-admin/functions onto the deployed
  //                          v1-autograde-advancePipeline handler, P1-F)
  //   • gradingProjections → ctx.repos.gradingProjections (Admin-RTDB live-ticker
  //                          writer implementing the AG-5 GradingProjectionPort)
  //   • levelupProjections → ctx.repos.levelupProjections (Admin-RTDB live-ticker
  //                          writer implementing the U2.6 LevelupProjectionPort —
  //                          spaceProgress/level/achievement/testSession channels)
  // The RTDB ticker projections ALSO wire in the emulator when the database
  // emulator is up (FIREBASE_DATABASE_EMULATOR_HOST): the Admin SDK then targets
  // the emulated RTDB, which makes the AD-12 channels (incl. the CHAT-1
  // chatBump e2e) testable end-to-end. The adapters stay best-effort
  // (log+swallow), so a run without the database emulator only logs.
  const rtdbAvailable = !isEmulatorOrTest || !!process.env["FIREBASE_DATABASE_EMULATOR_HOST"];
  if (rtdbAvailable) {
    (repos as unknown as Record<string, unknown>)["gradingProjections"] =
      createRtdbGradingProjections();
    (repos as unknown as Record<string, unknown>)["extractionProjections"] =
      createRtdbExtractionProjections();
    (repos as unknown as Record<string, unknown>)["levelupProjections"] =
      createRtdbLevelupProjections();
  }
  const pipelineTasks: PipelineEnqueuePort = (req) => enqueuePipelineAdvance(req);

  configureRuntime({
    // Structural-port reconciliation cast (see file header). The concrete
    // implementations are supersets of the adapter-layer ports.
    repos: repos as unknown as PortRepos,
    ai: aiSeam as unknown as PortAiGateway,
    clock,
    ...(isEmulatorOrTest ? {} : { storage: createAdminStorageSigner(), pipelineTasks }),
  });

  configured = true;
}

// Run the wiring on module load (side-effect import from index.ts). `index.ts`
// imports `./bootstrap.js` BEFORE any module barrel precisely so the runtime
// ports resolve the moment each shell's module is evaluated; the import alone is
// inert unless the bootstrap actually executes here. Idempotent (the `configured`
// guard), so repeat module loads are safe.
bootstrapRuntime();
