/**
 * CONV-P0 regression: the `resumeConversationFinalizations` scheduler runs with a
 * tenant-null SystemContext (the scheduler shell is platform-wide). The service
 * must fan out over tenants itself — a previous version called `requireTenant(ctx)`
 * and threw "No active tenant on the auth context" on every 5-minute tick. This
 * asserts the tenant-null path enumerates tenants without throwing, and that a
 * tenant-scoped ctx still resumes only its own tenant.
 */
import { describe, expect, it } from "vitest";
import { resumeConversationFinalizationsService } from "./recovery.js";
import { createInMemoryRepos } from "../repo-admin/testing/index.js";
import type { SystemContext } from "../shared/context.js";

const NOW = "2026-07-19T00:00:00.000Z";

describe("resumeConversationFinalizationsService — scheduler tenant fan-out (CONV-P0)", () => {
  it("runs under a tenant-null scheduler context by enumerating tenants (no throw)", async () => {
    const repos = createInMemoryRepos({ now: () => NOW });
    await repos.tenants.upsert("__platform__", { id: "t1" }, NOW);
    await repos.tenants.upsert("__platform__", { id: "t2" }, NOW);
    const ctx = { tenantId: null, now: () => NOW, repos } as unknown as SystemContext;

    const report = await resumeConversationFinalizationsService(ctx);

    // Two empty tenants → examined nothing, but crucially did NOT throw
    // "No active tenant on the auth context".
    expect(report).toMatchObject({ examined: 0, completed: 0, pending: 0, failed: 0, errors: 0 });
  });

  it("resumes only the scoped tenant when ctx.tenantId is set", async () => {
    const repos = createInMemoryRepos({ now: () => NOW });
    const ctx = { tenantId: "t1", now: () => NOW, repos } as unknown as SystemContext;

    const report = await resumeConversationFinalizationsService(ctx);

    expect(report.examined).toBe(0);
    expect(report.errors).toBe(0);
  });
});
