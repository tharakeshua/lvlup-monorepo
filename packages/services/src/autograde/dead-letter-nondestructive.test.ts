/**
 * SVC-4 — listDeadLetter / resolveDeadLetter must NOT drain the outbox.
 * Sibling pending delivery rows must survive a DLQ list or single resolve.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { listDeadLetterService } from "./reads";
import { resolveDeadLetterService } from "./resolve-dead-letter";

const TS = "2026-01-01T00:00:00.000Z";

describe("SVC-4 — dead-letter list/resolve are non-destructive", () => {
  it("listDeadLetter does not drain sibling pending outbox rows", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const tenantId = ctx.tenantId!;

    await ctx.repos.outbox.enqueue(tenantId, {
      id: "delivery_pending",
      type: "notification.send",
      payload: { channel: "email" },
    });
    await ctx.repos.outbox.enqueue(tenantId, {
      id: "dlq_1",
      _kind: "gradingDeadLetter",
      submissionId: "sub_1",
      pipelineStep: "scouting",
      error: "timeout",
      attempts: 2,
      lastAttemptAt: TS,
      resolvedAt: null,
      createdAt: TS,
    });

    const before = await ctx.repos.outbox.list(tenantId);
    expect(before.length).toBe(2);

    const res = await listDeadLetterService({}, ctx);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]!.id).toBe("dlq_1");

    const after = await ctx.repos.outbox.list(tenantId);
    expect(after.length).toBe(2);
    expect(after.map((r) => r["id"]).sort()).toEqual(["delivery_pending", "dlq_1"]);
  });

  it("resolveDeadLetter updates only the target row (no drain-all)", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const tenantId = ctx.tenantId!;

    await ctx.repos.outbox.enqueue(tenantId, {
      id: "delivery_keep",
      type: "notification.send",
      payload: { channel: "push" },
    });
    await ctx.repos.outbox.enqueue(tenantId, {
      id: "dlq_target",
      _kind: "gradingDeadLetter",
      submissionId: "sub_target",
      pipelineStep: "grading",
      error: "model error",
      attempts: 3,
      lastAttemptAt: TS,
      resolvedAt: null,
      createdAt: TS,
    });
    await ctx.repos.outbox.enqueue(tenantId, {
      id: "dlq_sibling",
      _kind: "gradingDeadLetter",
      submissionId: "sub_sib",
      pipelineStep: "grading",
      error: "other",
      attempts: 1,
      lastAttemptAt: TS,
      resolvedAt: null,
      createdAt: TS,
    });

    const result = await resolveDeadLetterService(
      { entryId: "dlq_target", method: "dismiss" },
      ctx
    );
    expect(result.success).toBe(true);
    expect(result.resolution).toBe("dismissed");

    const rows = await ctx.repos.outbox.list(tenantId);
    expect(rows.length).toBe(3);

    const target = rows.find((r) => r["id"] === "dlq_target")!;
    expect(target["resolvedAt"]).toBeTruthy();
    expect(target["resolutionMethod"]).toBe("dismissed");

    const sibling = rows.find((r) => r["id"] === "dlq_sibling")!;
    expect(sibling["resolvedAt"]).toBeFalsy();

    const delivery = rows.find((r) => r["id"] === "delivery_keep")!;
    expect(delivery["type"]).toBe("notification.send");
  });

  it("resolveDeadLetter idempotent returns a valid resolution when method is missing", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const tenantId = ctx.tenantId!;

    await ctx.repos.outbox.enqueue(tenantId, {
      id: "dlq_legacy_resolved",
      _kind: "gradingDeadLetter",
      submissionId: "sub_1",
      pipelineStep: "grading",
      error: "old",
      attempts: 1,
      lastAttemptAt: TS,
      resolvedAt: TS,
      // Legacy row: resolved without resolutionMethod.
      createdAt: TS,
    });

    const result = await resolveDeadLetterService(
      { entryId: "dlq_legacy_resolved", method: "dismiss" },
      ctx
    );
    expect(result.success).toBe(true);
    expect(result.resolution).toBe("dismissed");
  });

  it("resolveDeadLetter retry fails cleanly when submissionId is missing", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const tenantId = ctx.tenantId!;

    await ctx.repos.outbox.enqueue(tenantId, {
      id: "dlq_no_sub",
      _kind: "gradingDeadLetter",
      pipelineStep: "grading",
      error: "corrupt",
      attempts: 1,
      lastAttemptAt: TS,
      resolvedAt: null,
      createdAt: TS,
    });

    await expect(
      resolveDeadLetterService({ entryId: "dlq_no_sub", method: "retry" }, ctx)
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });

    const row = (await ctx.repos.outbox.list(tenantId)).find((r) => r["id"] === "dlq_no_sub")!;
    expect(row["resolvedAt"]).toBeFalsy();
  });
});
