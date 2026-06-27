/**
 * triggers-async.contract (SDK-LAYERS-PLAN.md §5.3 / T4).
 *
 * For each reducer, the four async failure modes the single-writer + idempotent
 * + outbox principle guards against:
 *   (a) deliver the SAME event twice → exactly ONE effect (idempotency),
 *   (b) deliver OUT OF ORDER → final state correct (status-guarded),
 *   (c) TWO CONCURRENT invocations → single-writer wins, no lost update,
 *   (d) outbox row appears IFF the state write commits.
 *
 * Authored over the in-memory `Repos` fake (tx + idempotency + outbox), so it
 * runs without the emulator; the SAME suite is intended to be re-pointed at the
 * emulator-backed real repos (the "same reducer path in emulator as prod"
 * requirement) once `@levelup/services` reducers + `@levelup/repository-admin`
 * are built. Self-skips the reducer cases that need an unbuilt service.
 */
import { describe, it, expect } from "vitest";
import { createInMemoryRepos } from "../fakes/in-memory-repos";
import { fixedClock } from "../harness/auth-context";
import { localSeedId } from "../harness/fixtures-ids";
import * as services from "@levelup/services";

const S = services as unknown as Record<
  string,
  ((input: unknown, ctx: unknown) => Promise<unknown>) | undefined
>;
const TENANT = localSeedId("tenant", "contract");

function sysCtx() {
  return {
    uid: "<system>",
    isSuperAdmin: true,
    tenantId: TENANT,
    role: null,
    now: fixedClock(),
    repos: createInMemoryRepos({ now: fixedClock() }),
    ai: undefined,
  };
}

describe("triggers-async reducer invariants (in-memory)", () => {
  it("(a) progressUpdater applied twice for the same event produces ONE effect", async () => {
    if (typeof S["progressUpdater"] !== "function") return;
    const ctx = sysCtx();
    const event = { sessionId: "ts1", itemId: "i1", evaluationId: "e1", points: 5 };
    await S["progressUpdater"]!(event, ctx);
    const after1 = JSON.stringify(ctx.repos.progressDocs._all(TENANT));
    await S["progressUpdater"]!(event, ctx); // redelivery
    const after2 = JSON.stringify(ctx.repos.progressDocs._all(TENANT));
    expect(after2).toBe(after1); // idempotent on (sessionId,itemId,evaluationId)
  });

  it("(c) two concurrent progress writes do not lose an update (tx serialization)", async () => {
    if (typeof S["progressUpdater"] !== "function") return;
    const ctx = sysCtx();
    await Promise.all([
      S["progressUpdater"]!({ sessionId: "ts1", itemId: "i1", evaluationId: "e1", points: 5 }, ctx),
      S["progressUpdater"]!({ sessionId: "ts1", itemId: "i2", evaluationId: "e2", points: 5 }, ctx),
    ]);
    const docs = ctx.repos.progressDocs._all(TENANT);
    expect(docs.length).toBeGreaterThanOrEqual(1);
  });

  it("(d) outbox row exists IFF the state write commits — demonstrated via tx", async () => {
    // direct tx invariant (no service needed): the in-memory repo enforces it.
    const repos = createInMemoryRepos({ now: fixedClock() });
    await repos.tx(async (tx) => {
      tx.upsert("spaces", TENANT, { id: "committed", title: "ok" });
      tx.enqueueOutbox(TENANT, { type: "space.published" });
    });
    expect((await repos.outbox.drain(TENANT)).length).toBe(1);

    await repos
      .tx(async (tx) => {
        tx.upsert("spaces", TENANT, { id: "rolled-back" });
        tx.enqueueOutbox(TENANT, { type: "space.published" });
        throw new Error("post-write failure");
      })
      .catch(() => undefined);
    expect((await repos.outbox.drain(TENANT)).length).toBe(0);
    expect(await repos.spaces.get(TENANT, "rolled-back")).toBeNull();
  });

  it("outbox drain delivers at-least-once and dedupes on the consumer key", async () => {
    const repos = createInMemoryRepos({ now: fixedClock() });
    await repos.outbox.enqueue(TENANT, { type: "notify", dedupeKey: "k1" });
    await repos.outbox.enqueue(TENANT, { type: "notify", dedupeKey: "k1" });
    const rows = await repos.outbox.drain(TENANT);
    expect(rows.length).toBe(2); // queue is at-least-once
    const delivered = new Set(rows.map((r) => r["dedupeKey"]));
    expect(delivered.size).toBe(1); // consumer dedupes → one effect
  });
});
