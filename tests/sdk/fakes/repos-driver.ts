/**
 * Repos conformance DRIVER abstraction (testability.md T6).
 *
 * T6 requires the in-memory `Repos` fake and the emulator-backed real
 * `@levelup/repository-admin` to share ONE conformance test file run with TWO
 * drivers, so the fake can never diverge on `tx()` atomicity / cursor semantics /
 * brand-strip. This module exposes the two drivers; the conformance suite lives
 * at tests/sdk/integration/repos-conformance.test.ts and is parameterized over
 * `ALL_REPO_DRIVERS`.
 */
import { createInMemoryRepos, type InMemoryRepos } from "./in-memory-repos";
import { fixedClock } from "../harness/auth-context";

export interface ReposDriver {
  name: "in-memory" | "emulator";
  /** Build a fresh Repos instance for a test. */
  create(): Promise<InMemoryRepos>;
  /** Whether this driver needs the emulator (suite skips it when down). */
  requiresEmulator: boolean;
  /** Reset between tests. */
  reset(repos: InMemoryRepos): Promise<void>;
}

const inMemoryDriver: ReposDriver = {
  name: "in-memory",
  requiresEmulator: false,
  async create() {
    return createInMemoryRepos({ now: fixedClock() });
  },
  async reset(repos) {
    repos._reset();
  },
};

/**
 * Emulator driver — wraps the real `@levelup/repository-admin/testing`
 * `createInMemoryRepos`/real `createRepos`. During the scaffold window the real
 * package isn't built; `create()` throws a clear skip-reason so the conformance
 * suite marks the emulator row pending rather than failing opaquely.
 */
const emulatorDriver: ReposDriver = {
  name: "emulator",
  requiresEmulator: true,
  async create() {
    const mod = (await import("@levelup/services/repo-admin").catch(() => null)) as {
      createRepos?: () => InMemoryRepos;
    } | null;
    if (!mod?.createRepos) {
      throw new Error("@levelup/services/repo-admin not built yet — emulator driver pending");
    }
    return mod.createRepos();
  },
  async reset() {
    // The conformance suite creates ephemeral spaces/students/outbox docs under the
    // `contract` tenant and asserts exact counts. That tenant is ALSO populated by
    // the contract-fixture seed (harness/contract-seed), so clear the collections
    // this suite writes BEFORE each test to keep its counts deterministic. (Other
    // tenants/collections are untouched.)
    try {
      const { adminDb } = await import("../harness/emulator");
      const { localSeedId } = await import("../harness/fixtures-ids");
      const db = adminDb();
      const tenant = localSeedId("tenant", "contract");
      for (const coll of ["spaces", "students", "outbox"]) {
        const ref = db.collection(`tenants/${tenant}/${coll}`);
        // recursiveDelete clears the collection (and any subcollections like
        // spaces/{id}/storyPoints) so the seeded content space doesn't skew counts.
        await db.recursiveDelete(ref).catch(async () => {
          const snap = await ref.get();
          await Promise.all(snap.docs.map((d) => d.ref.delete()));
        });
      }
    } catch {
      // emulator not reachable — the suite self-skips elsewhere.
    }
  },
};

export const ALL_REPO_DRIVERS: ReposDriver[] = [inMemoryDriver, emulatorDriver];
export { inMemoryDriver, emulatorDriver };
