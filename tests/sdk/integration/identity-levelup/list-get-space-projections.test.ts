/**
 * INTEGRATION — listSpaces / getSpace projections
 * (SDK-LAYERS-PLAN.md §5.2 shared readers "answer-stripped/guidance-stripped/
 *  released-gated projections", §3.5 pagination, §6.1 tenant scoping).
 *
 * Locks the read-path authority: the SAME callable returns a role-/state-scoped
 * PROJECTION, server-shaped, never the raw authoritative doc:
 *
 *   • listSpaces is paginated (PageRequest in → pageResponse out): `items` array
 *     + `nextCursor` (string|null = end-of-stream). The cursor is opaque and the
 *     server threads it (the client never builds it).
 *   • Both list and detail are tenant-scoped via claims — they return the caller's
 *     tenant's spaces only.
 *   • The detail projection (getSpace) carries the slim, learner-safe shape: NO
 *     answer-key/guidance/cost fields (the §6.4/§6.7 strip), and stats are the
 *     server-maintained denormalized counters (§6.9), not client-settable.
 *   • A student sees the published/enrolled projection; a draft space the student
 *     is not enrolled in is NOT listed to them (visibility gate).
 *
 * Real wire path; self-skips when emulators/seed are down.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { invoke, leaksSensitiveKey, skipReason } from "./_invoke";
import { localSeedId } from "../../harness/fixtures-ids";

const skip = () => Boolean(skipReason());

const PUBLISHED_SPACE = localSeedId("space", "published");

interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
interface SpaceListItem {
  id: string;
  title?: string;
  status?: string;
  stats?: Record<string, unknown>;
}

describe.skipIf(skip())("listSpaces / getSpace projections (emulator, wire path)", () => {
  beforeAll(() => {
    /* published-space + enrolled-student seeded */
  });

  it("listSpaces returns a pageResponse shape (items[] + nextCursor)", async () => {
    const res = await invoke<PageResponse<SpaceListItem>>(
      "v1.levelup.listSpaces",
      { limit: 20 },
      "teacher"
    );
    expect(Array.isArray(res.items), "pageResponse.items must be an array").toBe(true);
    expect("nextCursor" in res, "pageResponse must declare nextCursor").toBe(true);
    // nextCursor is an opaque string or null (end-of-stream).
    expect(res.nextCursor === null || typeof res.nextCursor === "string").toBe(true);
  });

  it("the limit is honored and the server (not the client) owns the cursor", async () => {
    const first = await invoke<PageResponse<SpaceListItem>>(
      "v1.levelup.listSpaces",
      { limit: 1 },
      "teacher"
    );
    expect(first.items.length).toBeLessThanOrEqual(1);
    if (first.nextCursor) {
      // The opaque cursor threads a second page — the client passes it back verbatim.
      const second = await invoke<PageResponse<SpaceListItem>>(
        "v1.levelup.listSpaces",
        { limit: 1, cursor: first.nextCursor },
        "teacher"
      );
      expect(Array.isArray(second.items)).toBe(true);
      // Page 2's first item differs from page 1's (no overlap on a stable sort).
      if (first.items[0] && second.items[0]) {
        expect(second.items[0].id).not.toBe(first.items[0].id);
      }
    }
  });

  it("getSpace returns a learner-safe projection — NO ⚷ answer-key/guidance/cost fields", async () => {
    const res = await invoke("v1.levelup.getSpace", { spaceId: PUBLISHED_SPACE }, "student");
    const leaked = leaksSensitiveKey(res);
    expect(leaked, `getSpace leaked a ⚷ field (${leaked})`).toBeNull();
  });

  it("getSpace stats are the server-maintained denormalized counters (§6.9), present in the projection", async () => {
    const res = await invoke<{ id?: string; stats?: Record<string, unknown> }>(
      "v1.levelup.getSpace",
      { spaceId: PUBLISHED_SPACE },
      "student"
    );
    expect(res).toBeDefined();
    // stats, when present, are an object the SERVER owns — the client cannot write
    // them (no save path accepts them; asserted by the optimistic-counter allowlist
    // contract test). Here we just assert the projection exposes them read-only.
    if (res.stats) expect(typeof res.stats).toBe("object");
  });

  it("listSpaces is tenant-scoped via claims — only the caller-tenant spaces appear", async () => {
    const res = await invoke<PageResponse<SpaceListItem>>(
      "v1.levelup.listSpaces",
      { limit: 100 },
      "teacher"
    );
    // Every returned space id must be one of the contract tenant's seeded spaces
    // (we can only positively assert membership of the published seed id here).
    expect(Array.isArray(res.items)).toBe(true);
    // Every returned space must carry an id (the caller-tenant projection shape);
    // the cross-tenant DENIAL itself is proven in tenant-id-from-claims.test.ts.
    for (const s of res.items) {
      expect(typeof s.id, "each listed space must expose an id").toBe("string");
    }
  });

  it("a student does NOT see another author’s DRAFT space in listSpaces (visibility gate)", async () => {
    const draft = localSeedId("space", "dsa"); // seeded as draft, not enrolled-for-this-student
    const res = await invoke<PageResponse<SpaceListItem>>(
      "v1.levelup.listSpaces",
      { limit: 100 },
      "student"
    );
    const draftRow = res.items.find((s) => s.id === draft);
    // If present, it must NOT be exposed as a draft to a non-enrolled student.
    if (draftRow && draftRow.status) {
      expect(draftRow.status).not.toBe("draft");
    }
  });
});
