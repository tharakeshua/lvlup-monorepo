/**
 * storyPointRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(spaceId)        — listStoryPoints (the full ordered API response)
 *   get(scope)           — scoped getStoryPoint, envelope unwrapped
 *   save(input)          — maps ergonomic `delete?` to data.deleted (D5)
 *   isAssessment(sp)     — derived: type ∈ {timed_test,quiz,practice}
 *                          (the single helper replacing scattered
 *                          `=== timed_test || === test` checks — be-levelup §4.4)
 */
import { type ApiClientLike, type Page, invokeCallable, toPage } from "./_kit";
import type { ReqOf, ResOf } from "@levelup/api-contract";
import type { StoryPoint, StoryPointType } from "@levelup/domain";

const ASSESSMENT_TYPES = new Set(["timed_test", "quiz", "practice"]);

export type StoryPointFilter = ReqOf<"v1.levelup.listStoryPoints">;

export type SaveStoryPointInput = ReqOf<"v1.levelup.saveStoryPoint"> & {
  /** Ergonomic soft-delete flag; mapped to the canonical data.deleted field. */
  delete?: boolean;
};

export interface StoryPointRepo {
  list(filter: StoryPointFilter): Promise<Page<StoryPoint>>;
  get(input: ReqOf<"v1.levelup.getStoryPoint">): Promise<StoryPoint>;
  save(input: SaveStoryPointInput): Promise<ResOf<"v1.levelup.saveStoryPoint">>;
  isAssessment(sp: { type?: StoryPointType }): boolean;
}

export function createStoryPointRepo(api: ApiClientLike): StoryPointRepo {
  const lv = api.levelup;
  return {
    list: (filter) =>
      invokeCallable<"v1.levelup.listStoryPoints">(lv["listStoryPoints"]!, filter).then((r) =>
        toPage<StoryPoint>(r)
      ),
    get: async (input) => {
      const response = await invokeCallable<"v1.levelup.getStoryPoint">(
        lv["getStoryPoint"]!,
        input
      );
      return response.storyPoint;
    },
    save: ({ delete: shouldDelete, ...input }) =>
      invokeCallable<"v1.levelup.saveStoryPoint">(lv["saveStoryPoint"]!, {
        ...input,
        data: { ...input.data, ...(shouldDelete ? { deleted: true } : {}) },
      }),
    isAssessment: (sp) => ASSESSMENT_TYPES.has(sp.type ?? ""),
  };
}
