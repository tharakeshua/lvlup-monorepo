/**
 * spaceDetailViewRepo — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1, §4.3 PC-14,
 * levelup-content.md "spaceDetailViewRepo").
 *
 * Assembles `{space, storyPoints, items, myProgress}` for the learner/editor
 * dashboard in a BOUNDED number of wire calls — never one `listItems` per story
 * point (that 1+N is the exact anti-pattern PC-14 forbids). The current API has
 * no getSpaceDetail or cross-story-point item batch callable, so this view:
 *
 *   • composes getSpace + listStoryPoints + getSpaceProgress in three calls;
 *   • reads items only when exactly one story point exists (one scoped call);
 *   • otherwise returns itemsComplete:false instead of sending rejected fields
 *     or issuing an unbounded N-call fan-out.
 *
 * Lives under `src/views/**` — the only sanctioned composition surface (R6
 * exception, asserted by repo-isolation.static.test.ts). It calls the injected
 * api-client directly rather than importing sibling repo modules, so it stays a
 * single shaped read with no hidden fan-out.
 */
import { type ApiClientLike, invokeCallable, toPage } from "../levelup-content/_kit";
import type { Space, SpaceProgress, StoryPoint, UnifiedItem } from "@levelup/domain";

export interface SpaceDetailViewInput {
  spaceId: string;
  userId?: string;
}

export interface SpaceDetailView {
  space: Space;
  storyPoints: StoryPoint[];
  items: UnifiedItem[];
  myProgress: SpaceProgress | null;
  /**
   * False when the API cannot return all items within the view's bounded call
   * budget (currently spaces with multiple story points).
   */
  itemsComplete: boolean;
}

export interface SpaceDetailViewRepo {
  get(input: SpaceDetailViewInput | string): Promise<SpaceDetailView>;
}

export function createSpaceDetailViewRepo(api: ApiClientLike): SpaceDetailViewRepo {
  const lv = api.levelup;
  return {
    get: async (input) => {
      // Accept the string form used by the query package as well as the public
      // object form, then send only fields admitted by each strict contract.
      const { spaceId, userId } =
        typeof input === "string" ? { spaceId: input, userId: undefined } : input;

      const [spaceResponse, storyPointResponse, progressResponse] = await Promise.all([
        invokeCallable<"v1.levelup.getSpace">(lv["getSpace"]!, { spaceId }),
        invokeCallable<"v1.levelup.listStoryPoints">(lv["listStoryPoints"]!, { spaceId }),
        invokeCallable<"v1.levelup.getSpaceProgress">(
          lv["getSpaceProgress"]!,
          userId ? { spaceId, userId } : { spaceId }
        ).catch(() => null),
      ]);

      const storyPoints = toPage<StoryPoint>(storyPointResponse).items;
      let items: UnifiedItem[] = [];
      let itemsComplete = storyPoints.length === 0;

      // listItems is story-point scoped. One valid item read stays bounded; for
      // multiple story points we explicitly surface incompleteness instead of
      // inventing a rejected `storyPointIds` request or issuing an N-call fanout.
      if (storyPoints.length === 1) {
        const itemPage = toPage<UnifiedItem>(
          await invokeCallable<"v1.levelup.listItems">(lv["listItems"]!, {
            spaceId,
            storyPointId: String(storyPoints[0]!.id),
            limit: 100,
          })
        );
        items = itemPage.items;
        itemsComplete = itemPage.nextCursor === null;
      }

      // Progress is best-effort context — a code-joined "lazy" student may have no
      // progress doc yet (open-Q #6); a missing/denied progress read must not fail
      // the whole space view, so fall back to null.
      return {
        space: spaceResponse.space,
        storyPoints,
        items,
        myProgress: progressResponse?.progress ?? null,
        itemsComplete,
      };
    },
  };
}
