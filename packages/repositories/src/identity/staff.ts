/**
 * `staffRepo` (SDK-LAYERS-PLAN §4.1, identity.md "staffRepo"). Mirrors
 * `studentRepo`: `list`/`getMany`/`save`/`archive` + `canArchive`. Staff has no
 * dedicated `getStaff` read in the contract (§3.2) — single fetch routes through
 * the batched `getMany`/`list`.
 */
import type { Staff, StaffId } from "@levelup/domain";
import type {
  ApiClient,
  ListStaffRequest,
  SaveInput,
  SaveResponse,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

export interface StaffRepo {
  list(filter?: ListStaffRequest): Promise<PageBag<Staff>>;
  paginate(filter?: ListStaffRequest): Promise<PageBag<Staff>>;
  getMany(ids: readonly (StaffId | string)[]): Promise<Staff[]>;
  save(input: SaveInput<Partial<Staff>>): Promise<SaveResponse>;
  archive(id: StaffId | string): Promise<SaveResponse>;
  canArchive(staff: { status?: string }): boolean;
}

export function createStaffRepo(api: ApiClient): StaffRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listStaff, filter),
    paginate: (filter = {}) => paginate(api.identity.listStaff, filter),
    async getMany(ids) {
      if (ids.length === 0) return [];
      const page = await api.identity.listStaff({ ids: ids as string[] });
      return page.items;
    },
    save: (input) => api.identity.saveStaff(input),
    archive: (id) => api.identity.saveStaff({ id: id as string, delete: true }),
    canArchive: (staff) => can("entityStatus", staff.status, "archived"),
  };
}
