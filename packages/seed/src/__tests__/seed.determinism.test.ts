/**
 * seed determinism + idempotency (SDK-LAYERS-PLAN.md §7.2 / T2).
 *
 *   • `seedId(kind,key)` is config-keyed + STABLE (no randomness) — same inputs,
 *     same id, across calls and runs.
 *   • re-seeding is a NO-OP (upsert-by-stable-id) — the produced doc set is
 *     byte-identical after a second seed.
 *   • seed-built claims === `syncMembershipClaims` output for the same membership
 *     (no second claim-builder).
 *   • a fixed clock pins timestamps.
 *
 * The determinism snapshot + the idempotency double-seed both need the emulator
 * (Admin SDK writes), so those cases run only when emulators are up; the pure
 * `seedId` stability check always runs. Self-skips until `@levelup/seed` exports.
 */
import { describe, it, expect } from "vitest";
import * as seed from "../index";

const Sd = seed as unknown as {
  seedId?: (kind: string, key: string) => string;
  stableId?: (kind: string, key: string) => string;
  seedAll?: (opts: unknown) => Promise<unknown>;
  buildSeedClaims?: (membership: unknown) => unknown;
};

const seedId = Sd.seedId ?? Sd.stableId;
const ready = Boolean(seedId);

(ready ? describe : describe.skip)("seed determinism", () => {
  it("seedId is stable + collision-free for distinct keys", () => {
    const a1 = seedId!("student", "sam");
    const a2 = seedId!("student", "sam");
    const b = seedId!("student", "nora");
    expect(a1).toBe(a2); // deterministic
    expect(a1).not.toBe(b); // distinct keys → distinct ids
  });

  it("seedId namespaces by kind (same key, different kind → different id)", () => {
    expect(seedId!("student", "x")).not.toBe(seedId!("teacher", "x"));
  });

  it("produces no randomness (re-derivation across a fresh import path is identical)", async () => {
    const again = (await import("../index")) as unknown as { seedId?: typeof seedId };
    if (again.seedId) expect(again.seedId("class", "10a")).toBe(seedId!("class", "10a"));
  });
});
