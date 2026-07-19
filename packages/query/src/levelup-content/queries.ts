/**
 * `levelup-content` READ hooks (domains/levelup-content.md "Query hooks").
 *
 * The CONTENT slice of the domain: spaces · story points · items (answer-stripped
 * + the answer-bearing editor item under a non-persisted scope) · agents ·
 * question bank · rubric presets · B2C store/reviews · AI-tutor chat sessions ·
 * content versions · the cross-entity space-detail view. (Learning PROGRESS and
 * TEST SESSIONS are owned by the sibling `testsession-progress` domain.)
 *
 * Every read hook calls a `repos.*` method (never firebase) and stores the result
 * under a key-factory key so the invalidation graph can target the narrowest
 * correct scope. Keys are tenant-implicit; filters are the trailing key object so
 * the key is structurally stable across renders (cache hits). Return types stay
 * generic (`TData = unknown` default) because the repo seam shapes views to
 * `unknown` at this layer; apps narrow via the hook generic.
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "../provider/useApi.js";
import {
  spaceKeys,
  storyPointKeys,
  itemKeys,
  versionKeys,
  questionBankKeys,
  rubricPresetKeys,
  chatKeys,
  storeKeys,
  reviewKeys,
  QUERY_KEYS,
} from "../keys/registry.js";
import { editItemKey } from "../keys/scopes.js";

/** A repo bag indexed by name; methods are loose at this seam (repos return `unknown`). */
type Repos = Record<string, Record<string, (...args: never[]) => unknown>>;
const repo = (repos: unknown, name: string): Record<string, (...args: never[]) => unknown> =>
  (repos as Repos)[name];

/** Per-hook options: everything React Query allows except the key/fn we own. */
type ReadOpts<T> = Omit<UseQueryOptions<T, unknown, T, readonly unknown[]>, "queryKey" | "queryFn">;

// ── spaces ───────────────────────────────────────────────────────────────────

export function useSpaces<T = unknown>(
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: spaceKeys.list(filter),
    queryFn: () => repo(repos, "spaceRepo").list(filter as never) as Promise<T>,
    ...opts,
  });
}

export function useSpace<T = unknown>(
  spaceId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: spaceKeys.detail(spaceId),
    queryFn: () => repo(repos, "spaceRepo").get(spaceId as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

/**
 * The cross-entity learner/editor dashboard view: `{space, storyPoints,
 * itemsByStoryPoint, myProgress}` assembled in one repo call (collapses the
 * listStoryPoints + N×listItems + getSpaceProgress fan-out).
 */
export function useSpaceDetailView<T = unknown>(
  spaceId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: spaceKeys.sub(spaceId, "detailView"),
    queryFn: () => repo(repos, "spaceDetailViewRepo").get(spaceId as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

// ── story points ──────────────────────────────────────────────────────────────

export function useStoryPoints<T = unknown>(
  spaceId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: storyPointKeys.list({ spaceId }),
    queryFn: () => repo(repos, "storyPointRepo").list({ spaceId } as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

// ── items (answer-stripped) ─────────────────────────────────────────────────

export function useItems<T = unknown>(
  spaceId: string,
  storyPointId: string,
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  const f = { spaceId, storyPointId, ...filter };
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: itemKeys.list(f),
    queryFn: () => repo(repos, "itemRepo").list(f as never) as Promise<T>,
    enabled: Boolean(spaceId && storyPointId) && (opts?.enabled ?? true),
    ...opts,
  });
}

/**
 * The RESOLVED evaluation config (agent · rubric · settings) for one item —
 * server-projected student-safe (holisticGuidance / modelAnswer / evaluatorGuidance
 * stripped). Powers the "How you'll be evaluated" card: objectives + rubric score
 * ladders + enabled dimensions + passing bar. Omit `itemId` to preview
 * space-level defaults. Every leg (agent/rubric/settings) may be null.
 */
export function useEvaluationConfig<T = unknown>(
  spaceId: string,
  itemId?: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  const f = { evalConfig: true, spaceId, itemId: itemId ?? null };
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: itemKeys.list(f),
    queryFn: () =>
      repo(repos, "itemRepo").getEvaluationConfig({ spaceId, itemId } as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    ...opts,
  });
}

/**
 * Answer-bearing editor item (authoring roles only). Lives under the
 * `items:edit` NON-PERSISTED scope (`editItemKey`) so the re-merged AnswerKey
 * never lands in the shared/offline cache and is never bulk-invalidated by the
 * `items` root (REVIEW §6.4 / SDK-SERVER §7.1.3). `gcTime: 0`, `staleTime: 0`.
 */
export function useItemForEdit<T = unknown>(
  spaceId: string,
  storyPointId: string,
  itemId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: editItemKey(itemId),
    queryFn: () =>
      repo(repos, "itemRepo").getForEdit({ spaceId, storyPointId, itemId } as never) as Promise<T>,
    enabled: Boolean(spaceId && storyPointId && itemId) && (opts?.enabled ?? true),
    gcTime: 0,
    staleTime: 0,
    ...opts,
  });
}

// ── versions ──────────────────────────────────────────────────────────────────

export function useVersions<T = unknown>(
  spaceId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: versionKeys.list({ spaceId }),
    queryFn: () => repo(repos, "versionRepo").list({ spaceId } as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

// ── question bank ─────────────────────────────────────────────────────────────

export function useQuestionBank<T = unknown>(
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: questionBankKeys.list(filter),
    queryFn: () => repo(repos, "questionBankRepo").list(filter as never) as Promise<T>,
    ...opts,
  });
}

// ── rubric presets ────────────────────────────────────────────────────────────

export function useRubricPresets<T = unknown>(
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: rubricPresetKeys.list(filter),
    queryFn: () => repo(repos, "rubricPresetRepo").list(filter as never) as Promise<T>,
    ...opts,
  });
}

// ── agents (prompts ⚷ stripped for non-authoring) ───────────────────────────

export function useAgents<T = unknown>(
  spaceId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: QUERY_KEYS.agents.list({ spaceId }),
    queryFn: () => repo(repos, "agentRepo").list({ spaceId } as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

// ── B2C store / reviews ───────────────────────────────────────────────────────

export function useStoreSpaces<T = unknown>(
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: storeKeys.list(filter),
    queryFn: () => repo(repos, "storeRepo").listStoreSpaces(filter as never) as Promise<T>,
    ...opts,
  });
}

export function useStoreSpace<T = unknown>(
  spaceId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: storeKeys.detail(spaceId),
    queryFn: () => repo(repos, "storeRepo").getStoreSpace(spaceId as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

export function useSpaceReviews<T = unknown>(
  spaceId: string,
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  const f = { spaceId, ...filter };
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: reviewKeys.list(f),
    queryFn: () => repo(repos, "storeRepo").listReviews(f as never) as Promise<T>,
    enabled: Boolean(spaceId) && (opts?.enabled ?? true),
    ...opts,
  });
}

// ── AI tutor chat ─────────────────────────────────────────────────────────────

export function useChatSessions<T = unknown>(
  filter: Record<string, unknown> = {},
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: chatKeys.list(filter),
    queryFn: () => repo(repos, "chatRepo").listSessions(filter as never) as Promise<T>,
    ...opts,
  });
}

export function useChatSession<T = unknown>(
  sessionId: string,
  opts?: ReadOpts<T>
): UseQueryResult<T, unknown> {
  const { repos } = useApi();
  return useQuery<T, unknown, T, readonly unknown[]>({
    queryKey: chatKeys.detail(sessionId),
    queryFn: () => repo(repos, "chatRepo").getSession(sessionId as never) as Promise<T>,
    enabled: Boolean(sessionId) && (opts?.enabled ?? true),
    ...opts,
  });
}
