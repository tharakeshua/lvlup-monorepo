/**
 * Fake `ApiClient` — the unit-test seam for `@levelup/repositories` (T3 /
 * MERGE-REPOSITORIES-PLAN: `createRepositories(api)` accepts a hand-stubbed
 * ApiClient so shaping / N+1 collapse / cursor logic is testable without an
 * emulator).
 *
 * Two ways to build one:
 *   1. `createFakeApiClient()` — a hand-stubbed, namespaced surface
 *      (`api.levelup.saveSpace(req)`, `api.identity.getMe(req)`, …) where each
 *      method is registered per-name and every call is RECORDED. This is the
 *      cheapest path for repo unit tests that only touch a few callables.
 *   2. `wrapTransport(fakeTransport)` — feed the FAKE TRANSPORT into the REAL
 *      `createApiClient` so validation + idempotency + retry are exercised end
 *      to end (the plan's preferred "fake transport feeding a real client").
 *      Falls back to the hand-stub if `@levelup/api-client` isn't built yet.
 *
 * The namespaced shape mirrors `ApiClient` from api-client-core.md §3.2:
 *   { identity:{...}, levelup:{...}, autograde:{...}, analytics:{...},
 *     subscribe, call }
 */
import { createFakeTransport, type FakeTransport, type RecordedInvoke } from "./fake-transport";

const MODULES = ["identity", "levelup", "autograde", "analytics"] as const;
type Module = (typeof MODULES)[number];

type Responder = (data: unknown) => unknown | Promise<unknown>;

export interface FakeApiClient {
  identity: Record<string, (data: unknown) => Promise<unknown>>;
  levelup: Record<string, (data: unknown) => Promise<unknown>>;
  autograde: Record<string, (data: unknown) => Promise<unknown>>;
  analytics: Record<string, (data: unknown) => Promise<unknown>>;
  subscribe: FakeTransport["subscribe"];
  call: (name: string) => (data: unknown) => Promise<unknown>;

  // ---- Test controls ----
  /** Register a response for a fully-qualified callable name `v1.<mod>.<op>`. */
  on(fqName: string, responder: unknown | Responder): FakeApiClient;
  /** Register a response by module + op (sugar for `on`). */
  stub(module: Module, op: string, responder: unknown | Responder): FakeApiClient;
  /** Make a callable reject. */
  fail(fqName: string, err: unknown): FakeApiClient;
  readonly calls: RecordedInvoke[];
  callsTo(fqName: string): RecordedInvoke[];
  reset(): void;
  /** The underlying fake transport (for subscription drivers). */
  readonly transport: FakeTransport;
}

function moduleOf(fqName: string): Module {
  // 'v1.levelup.saveSpace' → 'levelup'
  const seg = fqName.split(".")[1] as Module;
  return MODULES.includes(seg) ? seg : "levelup";
}
function opOf(fqName: string): string {
  return fqName.split(".").slice(2).join(".");
}

/**
 * Hand-stubbed namespaced ApiClient. Every method proxies through the fake
 * transport's `invoke` so all calls are recorded uniformly and subscription
 * drivers are available via `.transport`.
 */
export function createFakeApiClient(): FakeApiClient {
  const transport = createFakeTransport();

  const nsProxy = (module: Module): Record<string, (data: unknown) => Promise<unknown>> =>
    new Proxy(
      {},
      {
        get(_t, op: string) {
          if (typeof op !== "string") return undefined;
          return (data: unknown) => transport.invoke(`v1.${module}.${op}`, data);
        },
      }
    );

  const client: FakeApiClient = {
    identity: nsProxy("identity"),
    levelup: nsProxy("levelup"),
    autograde: nsProxy("autograde"),
    analytics: nsProxy("analytics"),
    subscribe: (name, params, cb) => transport.subscribe(name, params, cb),
    call: (name: string) => (data: unknown) => transport.invoke(name, data),

    on(fqName, responder) {
      transport.onInvoke(fqName, responder);
      return client;
    },
    stub(module, op, responder) {
      transport.onInvoke(`v1.${module}.${op}`, responder);
      return client;
    },
    fail(fqName, err) {
      transport.failInvoke(fqName, err);
      return client;
    },
    get calls() {
      return transport.calls;
    },
    callsTo(fqName) {
      return transport.callsTo(fqName);
    },
    reset() {
      transport.reset();
    },
    get transport() {
      return transport;
    },
  };

  // keep names referenced so unused-var lint stays quiet during scaffold window
  void moduleOf;
  void opOf;
  return client;
}

/**
 * Preferred path when `@levelup/api-client` is built: feed the FAKE TRANSPORT
 * into the REAL `createApiClient` so request/response validation, idempotency
 * key attachment, and retry are all exercised. Returns the real `ApiClient`
 * shape. Falls back to `createFakeApiClient()` during the scaffold window.
 */
export async function wrapTransport(
  fakeTransport?: FakeTransport,
  opts?: { validateResponses?: boolean }
): Promise<{ api: unknown; transport: FakeTransport }> {
  const transport = fakeTransport ?? createFakeTransport();
  try {
    const mod = (await import("@levelup/api-client")) as {
      createApiClient?: (t: unknown, o?: unknown) => unknown;
    };
    if (mod.createApiClient) {
      const api = mod.createApiClient(transport, {
        validateResponses: opts?.validateResponses ?? true,
      });
      return { api, transport };
    }
  } catch {
    /* api-client not built yet — fall through to hand stub */
  }
  return { api: createFakeApiClient(), transport };
}
