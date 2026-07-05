/**
 * FIX-2 pin: the runtime hooks actually REACH the service-visible ctx — the
 * live-diagnosed defect was exactly this gap (ports configured {repos,ai,clock}
 * only, so `ctx.storage` / `ctx.enqueuePipelineAdvance` were always undefined
 * and every service ran its emulator fallback in PROD).
 *
 * Also pins the tenant-currying rule: the ctx hook signature stays
 * `(submissionId, step)` while the enqueue port receives the ctx's tenant.
 * Schedulers deliberately get NO enqueue hook (fan-outs spread `{...ctx,
 * tenantId}` which would freeze the curried tenant at null) — their re-drives
 * stay inline.
 */
import { describe, it, expect, vi } from "vitest";
import { makeSystemContext } from "./auth-context.js";
import { buildAuthContext } from "./build-auth-context.js";
import type { Repos, AiGateway, PipelineAdvanceRequest } from "./ports.js";

const repos = {} as Repos;
const ai = {} as AiGateway;

describe("makeSystemContext hooks", () => {
  it("curries the pipeline enqueue port over the ctx tenant", async () => {
    const seen: PipelineAdvanceRequest[] = [];
    const ctx = makeSystemContext("t1" as never, {
      repos,
      ai,
      pipelineTasks: async (req) => {
        seen.push(req);
      },
      storage: { signUploadUrl: async () => "https://signed" },
    });
    await ctx.enqueuePipelineAdvance!("sub1", "grading");
    expect(seen).toEqual([{ tenantId: "t1", submissionId: "sub1", step: "grading" }]);
    expect(ctx.storage).toBeDefined();
  });

  it("leaves both hooks undefined when unconfigured (service fallbacks preserved)", () => {
    const ctx = makeSystemContext(null, { repos, ai });
    expect(ctx.storage).toBeUndefined();
    expect(ctx.enqueuePipelineAdvance).toBeUndefined();
  });
});

describe("buildAuthContext hooks", () => {
  it("curries the enqueue port over the CLAIM-resolved tenant and attaches storage", async () => {
    const port = vi.fn(async (_req: PipelineAdvanceRequest) => {});
    const ctx = await buildAuthContext(
      { uid: "u1", token: { tenantId: "t9", role: "teacher" } } as never,
      {
        repos,
        ai,
        storage: { signUploadUrl: async () => "https://signed" },
        pipelineTasks: port,
      }
    );
    await ctx.enqueuePipelineAdvance!("subX", "finalize");
    expect(port).toHaveBeenCalledWith({ tenantId: "t9", submissionId: "subX", step: "finalize" });
    expect(ctx.storage).toBeDefined();
  });
});
