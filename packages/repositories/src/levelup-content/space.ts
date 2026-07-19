/**
 * spaceRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(filter?)        — paginated, opaque cursor
 *   get(id)              — single getSpace, shaped SpaceView
 *   getMany(ids)         — compatibility fan-out via canonical getSpace calls
 *                          (the API currently has no batched id read)
 *   save(input)          — maps ergonomic delete to data.deleted
 *   publish/archive(id)  — map to saveSpace.data.status (authoritySensitive)
 *   canTransition(f,t)   — pure ALLOWED_TRANSITIONS read (UX)
 *   canPublish(space)    — derived: status is draft/published & publishable
 *   isPublished(space)   — derived boolean
 *   computeRating(space) — derived: blend ratingAggregate into a view number
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  canTransition as kitCanTransition,
  invokeCallable,
  makePaginator,
  toPage,
} from "./_kit";
import type { ReqOf, ResOf } from "@levelup/api-contract";
import type { Space, SpaceRatingAggregate, SpaceStats, SpaceStatus } from "@levelup/domain";

type ListSpacesRequest = ReqOf<"v1.levelup.listSpaces">;
export type SpaceFilter = Omit<ListSpacesRequest, "limit"> & {
  limit?: ListSpacesRequest["limit"];
};

export type SaveSpaceInput = ReqOf<"v1.levelup.saveSpace"> & {
  /** Ergonomic soft-delete flag; mapped to the canonical data.deleted field. */
  delete?: boolean;
};

interface SpaceLike {
  id?: string;
  status?: SpaceStatus;
  stats?: Partial<SpaceStats> | null;
  ratingAggregate?: Partial<SpaceRatingAggregate> | null;
}

export interface SpaceRepo {
  list(filter?: SpaceFilter): Promise<Page<Space>>;
  paginate(filter?: SpaceFilter): Promise<PageBag<Space>>;
  get(id: string): Promise<Space>;
  getMany(ids: readonly string[]): Promise<Space[]>;
  save(input: SaveSpaceInput): Promise<ResOf<"v1.levelup.saveSpace">>;
  duplicate(input: ReqOf<"v1.levelup.duplicateSpace">): Promise<ResOf<"v1.levelup.duplicateSpace">>;
  publish(input: { id: string }): Promise<ResOf<"v1.levelup.saveSpace">>;
  archive(input: { id: string }): Promise<ResOf<"v1.levelup.saveSpace">>;
  canTransition(from: SpaceStatus, to: SpaceStatus): boolean;
  canPublish(space: SpaceLike): boolean;
  isPublished(space: SpaceLike): boolean;
  computeAverageRating(space: SpaceLike): number;
}

export function createSpaceRepo(api: ApiClientLike): SpaceRepo {
  const lv = api.levelup;
  const getSpace = async (id: string): Promise<Space> => {
    const response = await invokeCallable<"v1.levelup.getSpace">(lv["getSpace"]!, {
      spaceId: id,
    });
    return response.space;
  };
  return {
    list: (filter = {}) =>
      invokeCallable<"v1.levelup.listSpaces">(lv["listSpaces"]!, {
        ...filter,
        limit: filter.limit ?? 20,
      }).then((r) => toPage<Space>(r)),
    paginate: (filter = {}) =>
      makePaginator<Space, SpaceFilter>(
        (req) =>
          invokeCallable<"v1.levelup.listSpaces">(lv["listSpaces"]!, {
            ...req,
            limit: req.limit ?? 20,
          }),
        { ...filter, limit: filter.limit ?? 20 }
      ),
    get: getSpace,
    duplicate: (input) => invokeCallable<"v1.levelup.duplicateSpace">(lv["duplicateSpace"]!, input),
    // The API currently exposes no batched space-id filter. Preserve this
    // convenience without sending the invalid `{ids}` field to listSpaces.
    getMany: (ids) => Promise.all(ids.map(getSpace)),
    save: ({ delete: shouldDelete, ...input }) =>
      invokeCallable<"v1.levelup.saveSpace">(lv["saveSpace"]!, {
        ...input,
        data: { ...input.data, ...(shouldDelete ? { deleted: true } : {}) },
      }),
    // Lifecycle authority lives in saveSpace.data.status in the canonical API.
    publish: ({ id }) =>
      invokeCallable<"v1.levelup.saveSpace">(lv["saveSpace"]!, {
        id: id as ReqOf<"v1.levelup.saveSpace">["id"],
        data: { status: "published" },
      }),
    archive: ({ id }) =>
      invokeCallable<"v1.levelup.saveSpace">(lv["saveSpace"]!, {
        id: id as ReqOf<"v1.levelup.saveSpace">["id"],
        data: { status: "archived" },
      }),
    canTransition: (from, to) => kitCanTransition("space", from, to),
    canPublish: (space) => {
      // The lifecycle gate is authoritative for the UX button; the content
      // readiness checks only DOWN-vote when the stats are actually present
      // (a bare `{status}` pre-check has no counts yet — don't false-block it).
      if (!kitCanTransition("space", space.status ?? "draft", "published")) return false;
      const sp = space.stats?.storyPointCount;
      const items = space.stats?.itemCount;
      if (typeof sp === "number" && sp <= 0) return false;
      if (typeof items === "number" && items <= 0) return false;
      return true;
    },
    isPublished: (space) => space.status === "published",
    computeAverageRating: (space) => space.ratingAggregate?.averageRating ?? 0,
  };
}
