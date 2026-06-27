/**
 * storyPointRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(spaceId)        — listStoryPoints (paginated — MERGE-PAGINATION)
 *   get(id)              — getStoryPoint (C20)
 *   getMany(ids)         — batched
 *   save(input)          — metadata only; `delete?` archive convention (D5)
 *   isAssessment(sp)     — derived: type ∈ {timed_test,quiz,practice}
 *                          (the single helper replacing scattered
 *                          `=== timed_test || === test` checks — be-levelup §4.4)
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  batchGetMany,
  makePaginator,
  toPage,
} from "./_kit";

const ASSESSMENT_TYPES = new Set(["timed_test", "quiz", "practice"]);

export interface StoryPointFilter extends PageRequest {
  spaceId: string;
}

export interface SaveStoryPointInput {
  id?: string;
  spaceId: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

export interface StoryPointRepo {
  list(filter: StoryPointFilter): Promise<Page<unknown>>;
  paginate(filter: StoryPointFilter): Promise<PageBag<unknown>>;
  get(id: string): Promise<unknown>;
  getMany(ids: readonly string[]): Promise<unknown[]>;
  save(input: SaveStoryPointInput): Promise<unknown>;
  isAssessment(sp: { type?: string }): boolean;
}

export function createStoryPointRepo(api: ApiClientLike): StoryPointRepo {
  const lv = api.levelup;
  return {
    list: (filter) => lv["listStoryPoints"]!(filter).then((r) => toPage(r)),
    paginate: (filter) => makePaginator((req) => lv["listStoryPoints"]!(req), filter),
    get: (id) => lv["getStoryPoint"]!({ storyPointId: id }),
    getMany: (ids) => batchGetMany((req) => lv["listStoryPoints"]!(req), ids),
    save: (input) => lv["saveStoryPoint"]!(input),
    isAssessment: (sp) => ASSESSMENT_TYPES.has(sp.type ?? ""),
  };
}
