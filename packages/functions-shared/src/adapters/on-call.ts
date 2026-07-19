/**
 * `makeCallable` — the entire wire→service shell (server-shared.md §2.3).
 *
 * Every one of the ~47 callables is one line:
 *   export const saveSpace = makeCallable('v1.levelup.saveSpace', S.saveSpaceService);
 *
 * The shell: buildAuthContext → rate-limit → parseRequest → idempotency dedupe →
 * service → idempotency commit → (dev) response validate → mapError on any throw.
 */
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { CALLABLES, type CallableName, type ReqOf, type ResOf } from "@levelup/api-contract";
import { REGION, VALIDATE_RESPONSES } from "../config/config.js";
import { buildAuthContext } from "../context/build-auth-context.js";
import type { AuthContext } from "../context/auth-context.js";
import { getRepos, getAi, getClock, getStorage, getPipelineTasks } from "./runtime.js";
import { parseRequest } from "../request/parse-request.js";
import { mapError } from "../request/map-error.js";
import { fail } from "../request/fail.js";
import { enforceRateLimit } from "../limits/rate-limit.js";
import { dedupe } from "../idempotency/dedupe.js";
import { writeAudit } from "../audit/audit.js";

export type ServiceFn<N extends CallableName> = (
  input: ReqOf<N>,
  ctx: AuthContext
) => Promise<ResOf<N>>;

/** Pull the super-admin tenantOverride from the request data, ONLY if the def allows it. */
function extractTenantOverride(
  def: { allowsTenantOverride?: boolean },
  data: unknown
): string | undefined {
  if (!def.allowsTenantOverride) return undefined;
  if (typeof data === "object" && data !== null && "tenantOverride" in data) {
    const v = (data as { tenantOverride?: unknown }).tenantOverride;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/**
 * Drop ONLY the legitimate envelope fields from the request body BEFORE the
 * `.strict()` parse:
 *  - `idempotencyKey` — ALWAYS. The UUIDv7 rides the api-client envelope and was
 *    already lifted off the raw data by `extractIdempotencyKey`; §3.2 forbids any
 *    request *schema* from declaring it, so it must not reach `.strict()`.
 *
 * Everything else stays. In particular a body `tenantId` is NOT stripped: no
 * request schema declares `tenantId` (§7.2 / §6.1 — it is claim-derived), so a
 * stray `tenantId` MUST be REJECTED by `.strict()` as an invalid-argument. This
 * satisfies §6.1 "a body tenantId cannot redirect a write off the caller's claim"
 * by DENYING the request rather than silently stripping it. The super-admin
 * `tenantOverride` is a real schema field on `allowsTenantOverride` defs and is
 * consumed via `ctx.tenantId`; it is left intact for those defs and (correctly)
 * rejected by `.strict()` on every other def.
 */
// The reserved ENVELOPE fields @levelup/api-client stamps OUTSIDE the `.strict()`
// request schema (see api-client/src/{envelope,idempotency}.ts): `__apiVersion`
// (every call) and `__idempotencyKey` (def.idempotent calls). The server MUST strip
// ALL of them before parseRequest or `.strict()` rejects them ("Unrecognized key
// __apiVersion"). Kept in sync with the client by literal value.
const ENVELOPE_FIELDS = ["__apiVersion", "__idempotencyKey", "idempotencyKey"] as const;

function stripEnvelopeFields(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
  const obj = data as Record<string, unknown>;
  if (!ENVELOPE_FIELDS.some((k) => k in obj)) return data;
  const rest = { ...obj };
  for (const k of ENVELOPE_FIELDS) delete rest[k];
  return rest;
}

function extractIdempotencyKey(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const obj = data as Record<string, unknown>;
  // api-client sends `__idempotencyKey`; accept the legacy bare key too.
  const v = obj["__idempotencyKey"] ?? obj["idempotencyKey"];
  return typeof v === "string" ? v : undefined;
}

export function makeCallable<N extends CallableName>(name: N, service: ServiceFn<N>) {
  const def = CALLABLES[name] as (typeof CALLABLES)[N] & {
    authMode: "authed" | "public";
    rateTier: "read" | "write" | "ai" | "auth" | "report";
    idempotent?: boolean;
    allowsTenantOverride?: boolean;
  };

  return onCall(
    {
      region: REGION,
      cors: true,
      // AI-tier callables (extraction, grading kicks) can run multi-pass LLM
      // work far past the 60s default. The live extraction pipeline holds the
      // request open while it streams RTDB progress across both passes.
      ...(def.rateTier === "ai" ? { timeoutSeconds: 540, memory: "1GiB" as const } : {}),
    },
    async (request: CallableRequest): Promise<ResOf<N>> => {
      try {
        const data = request.data as unknown;
        const ctx = await buildAuthContext(request.auth, {
          anonymous: def.authMode === "public",
          tenantOverride: extractTenantOverride(def, data),
          idempotencyKey: extractIdempotencyKey(data),
          repos: getRepos(),
          ai: getAi(),
          clock: getClock(),
          storage: getStorage(),
          pipelineTasks: getPipelineTasks(),
        });

        if (def.authMode === "authed" && (!ctx.uid || ctx.uid === "<public>")) {
          fail("UNAUTHENTICATED", "authentication required");
        }

        // Audit a super-admin cross-tenant override (best-effort).
        if (ctx.usedTenantOverride) {
          await writeAudit(
            ctx,
            "tenantOverride",
            { type: "tenant", id: String(ctx.tenantId) },
            { callable: name }
          );
        }

        await enforceRateLimit(ctx, def.rateTier);

        // `def.requestSchema` widens to a union of every callable's ZodType when
        // indexed by the generic `N`; re-narrow to this callable's request shape.
        const requestSchema = def.requestSchema as unknown as {
          safeParse(
            d: unknown
          ):
            | { success: true; data: ReqOf<N> }
            | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
        };
        // Strip ONLY the envelope `idempotencyKey` before the `.strict()` parse.
        // A body `tenantId` is intentionally left in so `.strict()` REJECTS it
        // (§7.2/§6.1 — tenantId is claim-derived; a forged one must DENY, not
        // silently redirect). `tenantOverride` is a real schema field where allowed.
        const input = parseRequest<ReqOf<N>>(stripEnvelopeFields(data), requestSchema);

        if (def.idempotent && ctx.idempotencyKey) {
          const cached = await dedupe.begin<ResOf<N>>(ctx, name);
          if (cached !== null) return cached;
        }

        let res: ResOf<N>;
        try {
          res = await service(input, ctx);
        } catch (e) {
          if (def.idempotent && ctx.idempotencyKey) await dedupe.release(ctx, name);
          throw e;
        }

        if (def.idempotent && ctx.idempotencyKey) await dedupe.commit(ctx, name, res);

        if (VALIDATE_RESPONSES) {
          const parsed = def.responseSchema.safeParse(res);
          if (!parsed.success) {
            // Dev-only contract gate: surface drift loudly.
            throw new Error(`[contract] response drift for ${name}: ${parsed.error.message}`);
          }
        }

        return res;
      } catch (e) {
        throw mapError(e);
      }
    }
  );
}
