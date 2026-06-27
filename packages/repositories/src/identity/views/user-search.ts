/**
 * `userSearchRepo` — super-admin cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1,
 * identity.md "userSearchRepo (view)"). The server returns BATCHED memberships
 * (no N+1 — be-identity §4.9); the repo shapes each `UserSearchResult` into the
 * search-UI row. Lives under `views/` (R6 composition surface).
 */
import type { ApiClient, SearchUsersRequest, UserSearchResult } from "../../internal/api-types.js";
import { paginate, type PageBag } from "../../internal/paginate.js";

export interface UserSearchRepo {
  search(
    query: string,
    filter?: { cursor?: string; limit?: number }
  ): Promise<PageBag<UserSearchResult>>;
}

export function createUserSearchRepo(api: ApiClient): UserSearchRepo {
  return {
    search: (query, filter = {}) =>
      paginate(api.identity.searchUsers, {
        query,
        cursor: filter.cursor,
        limit: filter.limit,
      } satisfies SearchUsersRequest),
  };
}
