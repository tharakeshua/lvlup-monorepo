/**
 * Shared space URL helpers — B2B uses `/spaces/...`, B2C uses `/consumer/spaces/...`.
 * Pages under both route trees must pick the prefix from the current location.
 */

export function spaceBasePath(pathname: string): "/spaces" | "/consumer/spaces" {
  return pathname.includes("/consumer/") || pathname.startsWith("/consumer")
    ? "/consumer/spaces"
    : "/spaces";
}

export function spaceHref(pathname: string, spaceId: string): string {
  return `${spaceBasePath(pathname)}/${spaceId}`;
}

/** Canonical learner URL for a module (formerly "story point"). */
export function moduleHref(pathname: string, spaceId: string, moduleId: string): string {
  return `${spaceHref(pathname, spaceId)}/modules/${moduleId}`;
}

/** @deprecated Prefer {@link moduleHref}. Kept as alias for gradual migration. */
export function storyPointHref(pathname: string, spaceId: string, storyPointId: string): string {
  return moduleHref(pathname, spaceId, storyPointId);
}

export function testHref(pathname: string, spaceId: string, storyPointId: string): string {
  return `${spaceHref(pathname, spaceId)}/test/${storyPointId}`;
}

export function practiceHref(pathname: string, spaceId: string, storyPointId: string): string {
  return `${spaceHref(pathname, spaceId)}/practice/${storyPointId}`;
}

export function testAnalyticsHref(pathname: string, spaceId: string, storyPointId: string): string {
  return `${testHref(pathname, spaceId, storyPointId)}/analytics`;
}

export function spacesListHref(pathname: string): string {
  return pathname.includes("/consumer") ? "/consumer" : "/spaces";
}
