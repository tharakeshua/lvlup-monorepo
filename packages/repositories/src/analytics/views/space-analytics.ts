/**
 * One canonical, server-batched per-space analytics read. The repository keeps
 * the app away from raw progress documents and from per-student fan-out.
 */
import type {
  ApiClient,
  GetSpaceAnalyticsRequest,
  GetSpaceAnalyticsResponse,
} from "../api-types.js";

export interface SpaceAnalyticsRepo {
  get(spaceId: string): Promise<GetSpaceAnalyticsResponse>;
}

export function createSpaceAnalyticsRepo(api: ApiClient): SpaceAnalyticsRepo {
  return {
    get: (spaceId) =>
      api.analytics.getSpaceAnalytics({
        spaceId: spaceId as GetSpaceAnalyticsRequest["spaceId"],
      }),
  };
}
