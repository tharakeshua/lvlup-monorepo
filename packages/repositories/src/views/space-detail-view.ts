/**
 * spaceDetailViewRepo — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1, §4.3 PC-14,
 * levelup-content.md "spaceDetailViewRepo").
 *
 * Assembles `{space, storyPoints, items, myProgress}` for the learner/editor
 * dashboard in a BOUNDED number of wire calls — never one `listItems` per story
 * point (that 1+N is the exact anti-pattern PC-14 forbids):
 *
 *   • If the server exposes the composite `getSpaceDetail`, use it (ONE call).
 *   • Otherwise compose a SMALL FIXED set: getSpace + listStoryPoints + ONE
 *     batched listItems (across all story points) + getSpaceProgress (≤4 calls).
 *
 * Lives under `src/views/**` — the only sanctioned composition surface (R6
 * exception, asserted by repo-isolation.static.test.ts). It calls the injected
 * api-client directly rather than importing sibling repo modules, so it stays a
 * single shaped read with no hidden fan-out.
 */
import { type ApiClientLike, toPage } from "../levelup-content/_kit";

export interface SpaceDetailViewInput {
  spaceId: string;
  userId?: string;
}

export interface SpaceDetailView {
  space: unknown;
  storyPoints: unknown[];
  items: unknown[];
  myProgress: unknown;
}

export interface SpaceDetailViewRepo {
  get(input: SpaceDetailViewInput): Promise<SpaceDetailView>;
}

export function createSpaceDetailViewRepo(api: ApiClientLike): SpaceDetailViewRepo {
  const lv = api.levelup;
  return {
    get: async ({ spaceId, userId }) => {
      // Preferred: ONE server composite call (PC-14 — a genuine 1+N dashboard
      // gets a server composite, never N client calls). The composite is
      // OPTIONAL: when the server does not ship it (call rejects) we degrade to a
      // SMALL FIXED set of batched reads. This keeps the view bounded either way.
      const composite = await lv["getSpaceDetail"]!({ spaceId, userId })
        .then((c) => c as Partial<SpaceDetailView>)
        .catch(() => null);
      if (composite) {
        return {
          space: composite.space ?? null,
          storyPoints: composite.storyPoints ?? [],
          items: composite.items ?? [],
          myProgress: composite.myProgress ?? null,
        };
      }

      // Fallback: a small FIXED set of batched reads. listItems is called ONCE
      // (batched across story points via storyPointIds), never one per story point.
      // Callables return envelopes (`{ space }`, `{ progress }`) — unwrap to match
      // the composite shape and spaceRepo/progressRepo consumers (web + mobile).
      const spaceRes = (await lv["getSpace"]!({ spaceId })) as { space?: unknown };
      const space = spaceRes?.space ?? spaceRes;
      const spPage = toPage<{ id?: string }>(await lv["listStoryPoints"]!({ spaceId }));
      const storyPointIds = spPage.items
        .map((s) => s.id)
        .filter((x): x is string => typeof x === "string");
      const items = toPage<unknown>(await lv["listItems"]!({ spaceId, storyPointIds })).items;
      // Progress is best-effort context — a code-joined "lazy" student may have no
      // progress doc yet (open-Q #6); a missing/denied progress read must not fail
      // the whole space view, so fall back to null.
      const progressRes = await lv["getSpaceProgress"]!(
        userId ? { spaceId, userId } : { spaceId }
      ).catch(() => null);
      const myProgress =
        progressRes && typeof progressRes === "object" && "progress" in progressRes
          ? (progressRes as { progress: unknown }).progress
          : progressRes;

      return { space, storyPoints: spPage.items, items, myProgress };
    },
  };
}
