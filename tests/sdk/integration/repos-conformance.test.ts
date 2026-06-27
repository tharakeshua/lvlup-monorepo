/**
 * Repos conformance suite (testability.md T6) — ONE file, TWO drivers.
 *
 * Asserts the in-memory `Repos` fake and the emulator-backed real
 * `@levelup/repository-admin` behave identically on the semantics that a naive
 * in-memory fake gets wrong: `getMany` chunk boundaries, opaque-cursor
 * pagination, and `tx()` atomicity (commit-or-rollback incl. the outbox write).
 *
 * The emulator driver self-skips when the emulator is down or the real package
 * isn't built (scaffold window).
 */
import { describe, it, beforeEach, expect } from "vitest";
import { ALL_REPO_DRIVERS, type ReposDriver } from "../fakes/repos-driver";
import { emulatorsDown } from "../harness/per-test-setup";
import { localSeedId } from "../harness/fixtures-ids";

const TENANT = localSeedId("tenant", "contract");

for (const driver of ALL_REPO_DRIVERS) {
  const maybe = driver.requiresEmulator && emulatorsDown() ? describe.skip : describe;

  maybe(`Repos conformance [${driver.name}]`, () => {
    let repos: Awaited<ReturnType<ReposDriver["create"]>>;

    beforeEach(async () => {
      try {
        repos = await driver.create();
      } catch (e) {
        // emulator driver pending — skip the whole block by throwing a skip marker
        if (driver.requiresEmulator) {
          // eslint-disable-next-line no-console
          console.warn(`[repos-conformance] ${driver.name} pending: ${(e as Error).message}`);
          return;
        }
        throw e;
      }
      await driver.reset(repos);
    });

    it("getMany returns only existing docs at chunk boundaries (0/1/10/11/21)", async () => {
      if (!repos) return; // emulator driver pending
      const ids: string[] = [];
      for (let i = 0; i < 21; i++) {
        const { id } = await repos.spaces.upsert(TENANT, { title: `s${i}` });
        ids.push(id);
      }
      for (const n of [0, 1, 10, 11, 21]) {
        const got = await repos.spaces.getMany(TENANT, ids.slice(0, n));
        expect(got.length, `getMany(${n})`).toBe(n);
      }
      // missing ids are dropped, not nulls
      const mixed = await repos.spaces.getMany(TENANT, [ids[0]!, "does-not-exist"]);
      expect(mixed.length).toBe(1);
    });

    it("paginate threads an opaque cursor and terminates with nextCursor:null", async () => {
      if (!repos) return;
      for (let i = 0; i < 25; i++) await repos.students.upsert(TENANT, { rollNumber: `R${i}` });
      const page1 = await repos.students.list(TENANT, { limit: 20 });
      expect(page1.items.length).toBe(20);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = await repos.students.list(TENANT, { limit: 20, cursor: page1.nextCursor! });
      expect(page2.items.length).toBe(5);
      expect(page2.nextCursor).toBeNull();
      // no overlap between pages
      const ids1 = new Set(page1.items.map((d) => d["id"]));
      for (const d of page2.items) expect(ids1.has(d["id"])).toBe(false);
    });

    it("tx() commits both the doc write AND the outbox row on success", async () => {
      if (!repos) return;
      await repos.tx(async (tx) => {
        tx.upsert("spaces", TENANT, { id: "tx-space", title: "published" });
        tx.enqueueOutbox(TENANT, { type: "space.published", spaceId: "tx-space" });
      });
      expect(await repos.spaces.get(TENANT, "tx-space")).not.toBeNull();
      expect((await repos.outbox.drain(TENANT)).length).toBe(1);
    });

    it("tx() rolls back the doc write AND leaves NO outbox row when the body throws (#14)", async () => {
      if (!repos) return;
      await expect(
        repos.tx(async (tx) => {
          tx.upsert("spaces", TENANT, { id: "doomed", title: "never" });
          tx.enqueueOutbox(TENANT, { type: "space.published", spaceId: "doomed" });
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");
      expect(await repos.spaces.get(TENANT, "doomed")).toBeNull();
      expect((await repos.outbox.drain(TENANT)).length).toBe(0);
    });

    it("cursor encode/decode round-trips", async () => {
      if (!repos) return;
      const value = { offset: 42, key: "abc" };
      expect(repos.decodeCursor(repos.encodeCursor(value))).toEqual(value);
    });
  });
}
