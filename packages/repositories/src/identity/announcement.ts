/**
 * `announcementRepo` (SDK-LAYERS-PLAN §4.1, identity.md). `list`/`save`/`archive`
 * + `markRead` (✅ conservative-optimistic — sets `isReadByMe`) + a `canTransition`
 * pure read of the FROZEN `announcement` machine
 * (`draft→[published,archived]`, `published→[archived]`, `archived→[draft]`).
 *
 * Publish/lifecycle is the server's authority (§6.10); the repo only forwards the
 * status flip on the save body and exposes the UX pre-check.
 */
import type { Announcement, AnnouncementId } from "@levelup/domain";
import type {
  ApiClient,
  ListAnnouncementsRequest,
  MarkAnnouncementReadResponse,
  SaveAnnouncementResponse,
  SaveInput,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

export interface AnnouncementRepo {
  list(filter?: ListAnnouncementsRequest): Promise<PageBag<Announcement>>;
  paginate(filter?: ListAnnouncementsRequest): Promise<PageBag<Announcement>>;
  save(input: SaveInput<Record<string, unknown>>): Promise<SaveAnnouncementResponse>;
  archive(id: AnnouncementId | string): Promise<SaveAnnouncementResponse>;
  /** ✅ conservative-optimistic mark-read (sets `isReadByMe`). */
  markRead(id: AnnouncementId | string): Promise<MarkAnnouncementReadResponse>;
  /** Pure `announcement` machine pre-check. No wire call. */
  canTransition(from: string | undefined, to: string): boolean;
}

export function createAnnouncementRepo(api: ApiClient): AnnouncementRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listAnnouncements, filter),
    paginate: (filter = {}) => paginate(api.identity.listAnnouncements, filter),
    save: (input) => api.identity.saveAnnouncement(input),
    archive: (id) => api.identity.saveAnnouncement({ id: id as string, delete: true }),
    markRead: (id) => api.identity.markAnnouncementRead({ announcementId: id as AnnouncementId }),
    canTransition: (from, to) => can("announcement", from, to),
  };
}
