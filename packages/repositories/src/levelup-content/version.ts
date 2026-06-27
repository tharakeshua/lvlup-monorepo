/**
 * versionRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(spaceId)  — listVersions (paginated content-version history)
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  makePaginator,
  toPage,
} from "./_kit";

export interface VersionFilter extends PageRequest {
  spaceId: string;
}

export interface VersionRepo {
  list(filter: VersionFilter): Promise<Page<unknown>>;
  paginate(filter: VersionFilter): Promise<PageBag<unknown>>;
}

export function createVersionRepo(api: ApiClientLike): VersionRepo {
  const lv = api.levelup;
  return {
    list: (filter) => lv["listVersions"]!(filter).then((r) => toPage(r)),
    paginate: (filter) => makePaginator((req) => lv["listVersions"]!(req), filter),
  };
}
