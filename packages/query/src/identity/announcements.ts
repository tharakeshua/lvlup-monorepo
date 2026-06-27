/**
 * Identity — announcement hooks (identity.md "Query hooks"). List + save (⚷
 * publish lifecycle — never optimistic) + the ✅ mark-as-read carve-out.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { defineMutation } from "../mutation/define-mutation.js";
import { patchDetail } from "../mutation/recipes/patch-detail.js";
import { announcementKeys } from "../keys/registry.js";

interface AnnouncementRepo {
  list(filter?: object): Promise<unknown>;
  save(input: unknown): Promise<unknown>;
  markRead(id: string): Promise<unknown>;
}
const ann = (repos: Repositories): AnnouncementRepo =>
  (repos as unknown as Record<string, AnnouncementRepo>).announcementRepo;

export function useAnnouncements(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: announcementKeys.list(filter ?? {}),
    queryFn: () => ann(repos).list(filter),
  });
}

/** Save/publish an announcement. ⚷ publish lifecycle — never optimistic. */
export const useSaveAnnouncement = defineMutation<unknown, unknown>({
  callable: "v1.identity.saveAnnouncement",
  run: (repos, vars) => ann(repos as Repositories).save(vars),
});

/** ✅ optimistic mark-announcement-read: set `isReadByMe` on the row; rollback on error. */
export const useMarkAnnouncementRead = defineMutation<{ announcementId: string }, unknown>({
  callable: "v1.identity.markAnnouncementRead",
  run: (repos, vars) => ann(repos as Repositories).markRead(vars.announcementId),
  optimistic: patchDetail<{ announcementId: string }, unknown, unknown[]>(
    announcementKeys.list({}),
    (prev, v) =>
      (Array.isArray(prev) ? prev : []).map((a) =>
        (a as { id?: string }).id === v.announcementId ? { ...(a as object), isReadByMe: true } : a
      )
  ),
});
