/**
 * spaceRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(filter?)        — paginated, opaque cursor
 *   get(id)              — single getSpace, shaped SpaceView
 *   getMany(ids)         — batched (server fan-in, no client chunking)
 *   save(input)          — metadata only (D2: never injects tenantId)
 *   publish/archive(id)  — lifecycle via saveSpace { status } (no separate callables)
 *   canTransition(f,t)   — pure ALLOWED_TRANSITIONS read (UX)
 *   canPublish(space)    — derived: status is draft/published & publishable
 *   isPublished(space)   — derived boolean
 *   computeRating(space) — derived: blend ratingAggregate into a view number
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  canTransition as kitCanTransition,
  batchGetMany,
  makePaginator,
  toPage,
} from "./_kit";

export interface SpaceFilter extends PageRequest {
  status?: string;
  type?: string;
  classId?: string;
  subject?: string;
  teacherId?: string;
}

export interface SaveSpaceInput {
  id?: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

interface SpaceLike {
  id?: string;
  status?: string;
  stats?: { storyPointCount?: number; itemCount?: number } | null;
  ratingAggregate?: { count?: number; average?: number } | null;
}

export interface SpaceRepo {
  list(filter?: SpaceFilter): Promise<Page<unknown>>;
  paginate(filter?: SpaceFilter): Promise<PageBag<unknown>>;
  get(id: string): Promise<unknown>;
  getMany(ids: readonly string[]): Promise<unknown[]>;
  save(input: SaveSpaceInput): Promise<unknown>;
  publish(input: { id: string }): Promise<unknown>;
  archive(input: { id: string }): Promise<unknown>;
  canTransition(from: string, to: string): boolean;
  canPublish(space: SpaceLike): boolean;
  isPublished(space: SpaceLike): boolean;
  computeAverageRating(space: SpaceLike): number;
}

export function createSpaceRepo(api: ApiClientLike): SpaceRepo {
  const lv = api.levelup;
  return {
    list: (filter = {}) => lv["listSpaces"]!(filter).then((r) => toPage(r)),
    paginate: (filter = {}) => makePaginator((req) => lv["listSpaces"]!(req), filter),
    // Callable returns `{ space }`; callers/hooks expect the SpaceView itself.
    get: (id) => lv["getSpace"]!({ spaceId: id }).then((r) => (r as { space: unknown }).space),
    getMany: (ids) => batchGetMany((req) => lv["listSpaces"]!(req), ids),
    save: (input) => lv["saveSpace"]!(input),
    // Contract: saveSpace IS the lifecycle verb — there is no publishSpace/archiveSpace.
    publish: (input) => lv["saveSpace"]!({ id: input.id, data: { status: "published" } }),
    archive: (input) => lv["saveSpace"]!({ id: input.id, data: { status: "archived" } }),
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
    computeAverageRating: (space) => space.ratingAggregate?.average ?? 0,
  };
}
