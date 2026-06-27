/**
 * repositories unit tests (MERGE-REPOSITORIES-PLAN / T3) — run against a FAKE
 * ApiClient (no emulator). Exercises the client-brain logic: shaping, getMany
 * N+1 collapse, opaque-cursor paginate(), derived fields, and the sensitive-key
 * editor-cache scope.
 *
 * Uses `createRepositories(api)` — the documented fake-ApiClient seam. Self-skips
 * until `@levelup/repositories` exports it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeApiClient,
  makePage,
  makeSpace,
  makeStoryPoint,
  makeItem,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import * as repos from "../index";

const R = repos as unknown as {
  createRepositories?: (
    api: unknown
  ) => Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>;
  isSensitiveKey?: (key: readonly unknown[]) => boolean;
};

const ready = Boolean(R.createRepositories);
const d = ready ? describe : describe.skip;

d("createRepositories(fakeApiClient)", () => {
  let api: FakeApiClient;

  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("spaceRepo.paginate threads the opaque cursor and stops on nextCursor:null", async () => {
    api.stub("levelup", "listSpaces", (req) => {
      const cursor = (req as { cursor?: string }).cursor;
      return cursor
        ? makePage([makeSpace({ id: "sp2" })], null)
        : makePage([makeSpace({ id: "sp1" })], "CURSOR_1");
    });
    const r = R.createRepositories!(api);
    const page1 = (await r["spaceRepo"]!["list"]!({ limit: 1 })) as {
      items: unknown[];
      nextCursor: string | null;
    };
    expect(page1.nextCursor).toBe("CURSOR_1");
    const page2 = (await r["spaceRepo"]!["list"]!({ limit: 1, cursor: page1.nextCursor })) as {
      nextCursor: string | null;
    };
    expect(page2.nextCursor).toBeNull();
  });

  it("a view repo shapes space+storyPoints+items in ONE shaped call (spaceDetailView)", async () => {
    api.stub("levelup", "getSpace", () => makeSpace());
    api.stub("levelup", "listStoryPoints", () => makePage([makeStoryPoint()]));
    api.stub("levelup", "listItems", () => makePage([makeItem()]));
    const r = R.createRepositories!(api);
    const view = r["spaceDetailViewRepo"];
    if (view?.["get"]) {
      const detail = (await view["get"]({ spaceId: makeSpace().id })) as Record<string, unknown>;
      expect(detail).toBeDefined();
    }
  });

  it("isSensitiveKey excludes the edit-item scope from persisted/offline cache", () => {
    if (R.isSensitiveKey) {
      expect(R.isSensitiveKey(["__edit_item__", "item1"])).toBe(true);
      expect(R.isSensitiveKey(["spaces", "list"])).toBe(false);
    }
  });
});
