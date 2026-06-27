/**
 * rubricPresetRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(filter)               — listRubricPresets (paginated — MERGE-PAGINATION)
 *   getMany(ids)               — batched
 *   save(input)                — metadata only; `delete?` archive convention (D5)
 *   resolveEffectiveRubric(...) — derived client-side PREVIEW of the
 *                                 tenant→space→storyPoint→item resolution chain
 *                                 (server is authoritative at save — be-levelup §4.8)
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

export interface RubricPresetFilter extends PageRequest {
  category?: string;
  questionType?: string;
}

export interface SaveRubricPresetInput {
  id?: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

interface RubricCarrier {
  rubric?: unknown;
  rubricId?: string;
  defaultRubric?: unknown;
  defaultRubricId?: string;
}

/** The resolved snapshot + source-id pair (REVIEW open-Q resolution). */
export interface ResolvedRubric {
  rubric: unknown | null;
  rubricId: string | null;
  source: "item" | "storyPoint" | "space" | "tenant" | "none";
}

export interface RubricPresetRepo {
  list(filter?: RubricPresetFilter): Promise<Page<unknown>>;
  paginate(filter?: RubricPresetFilter): Promise<PageBag<unknown>>;
  getMany(ids: readonly string[]): Promise<unknown[]>;
  save(input: SaveRubricPresetInput): Promise<unknown>;
  resolveEffectiveRubric(ctx: {
    item?: RubricCarrier | null;
    storyPoint?: RubricCarrier | null;
    space?: RubricCarrier | null;
    tenantDefault?: { rubric?: unknown; rubricId?: string } | null;
  }): ResolvedRubric;
}

export function createRubricPresetRepo(api: ApiClientLike): RubricPresetRepo {
  const lv = api.levelup;
  return {
    list: (filter = {}) => lv["listRubricPresets"]!(filter).then((r) => toPage(r)),
    paginate: (filter = {}) => makePaginator((req) => lv["listRubricPresets"]!(req), filter),
    getMany: (ids) => batchGetMany((req) => lv["listRubricPresets"]!(req), ids),
    save: (input) => lv["saveRubricPreset"]!(input),
    resolveEffectiveRubric: ({ item, storyPoint, space, tenantDefault }) => {
      // item snapshot wins, then storyPoint, then space, then tenant default.
      if (item?.rubric != null)
        return { rubric: item.rubric, rubricId: item.rubricId ?? null, source: "item" };
      if (storyPoint?.defaultRubric != null)
        return {
          rubric: storyPoint.defaultRubric,
          rubricId: storyPoint.defaultRubricId ?? null,
          source: "storyPoint",
        };
      if (space?.defaultRubric != null)
        return {
          rubric: space.defaultRubric,
          rubricId: space.defaultRubricId ?? null,
          source: "space",
        };
      if (tenantDefault?.rubric != null)
        return {
          rubric: tenantDefault.rubric,
          rubricId: tenantDefault.rubricId ?? null,
          source: "tenant",
        };
      return { rubric: null, rubricId: null, source: "none" };
    },
  };
}
