/**
 * Teacher listClasses / getClass must stay claim-scoped (classIds) so the
 * dashboard cannot fan out analytics.getSummary for foreign classes (403s).
 * Shared by web teacher-web and apps/mobile-teacher.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { listClassesService, getClassService } from "./reads";

const TS = "2026-01-01T00:00:00.000Z";

async function seedClass(
  ctx: ReturnType<typeof makeAuthContext>,
  id: string,
  name: string
): Promise<void> {
  const tenantId = ctx.tenantId!;
  await ctx.repos.classes.upsert(
    tenantId,
    {
      id,
      name,
      grade: "10",
      section: "A",
      academicSessionId: "session_1",
      teacherIds: [],
      status: "active",
      createdAt: TS,
      updatedAt: TS,
      createdBy: ctx.uid,
      updatedBy: ctx.uid,
    },
    TS
  );
}

describe("listClasses / getClass teacher class-scope", () => {
  it("listClasses returns only claim classIds for a teacher", async () => {
    const ctx = makeAuthContext("teacher", { claimsOverride: { classIds: ["class_mine"] } });
    await seedClass(ctx, "class_mine", "Mine");
    await seedClass(ctx, "class_other", "Other");

    const res = await listClassesService({}, ctx);
    expect(res.items.map((c) => (c as { id: string }).id)).toEqual(["class_mine"]);
    expect(res.nextCursor).toBeNull();
  });

  it("listClasses returns empty when teacher has no classIds", async () => {
    const ctx = makeAuthContext("teacher", { claimsOverride: { classIds: [] } });
    await seedClass(ctx, "class_other", "Other");
    const res = await listClassesService({}, ctx);
    expect(res.items).toEqual([]);
  });

  it("tenantAdmin listClasses is not claim-scoped (full roster page)", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    await seedClass(ctx, "class_a", "A");
    await seedClass(ctx, "class_b", "B");
    const res = await listClassesService({ limit: 50 }, ctx);
    const ids = res.items.map((c) => (c as { id: string }).id).sort();
    expect(ids).toEqual(["class_a", "class_b"]);
  });

  it("getClass denies a teacher for an unassigned class", async () => {
    const ctx = makeAuthContext("teacher", { claimsOverride: { classIds: ["class_mine"] } });
    await seedClass(ctx, "class_other", "Other");
    await expect(getClassService({ id: "class_other" }, ctx)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("getClass allows a teacher for an assigned class", async () => {
    const ctx = makeAuthContext("teacher", { claimsOverride: { classIds: ["class_mine"] } });
    await seedClass(ctx, "class_mine", "Mine");
    const res = await getClassService({ id: "class_mine" }, ctx);
    expect((res as { id: string }).id).toBe("class_mine");
  });
});
