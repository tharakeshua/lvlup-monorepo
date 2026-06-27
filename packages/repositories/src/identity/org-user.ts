/**
 * `orgUserRepo` (SDK-LAYERS-PLAN §4.1, identity.md "orgUserRepo") — write-side
 * provisioning. `createOrgUser` (idempotencyKey attached by the api-client),
 * `bulkImportStudents`/`bulkImportTeachers`/`bulkUpdateStatus` — accept parsed CSV
 * rows and return the per-row `{created,skipped,errors}` shaped for the import UI.
 *
 * These are NEVER optimistic (provisioning + bulk are authority-sensitive — §4.4);
 * the repo just forwards the request body THROUGH (no tenantId injection — D2).
 */
import type {
  ApiClient,
  BulkImportResponse,
  BulkImportStudentsRequest,
  BulkImportTeachersRequest,
  BulkUpdateStatusRequest,
  BulkUpdateStatusResponse,
  CreateOrgUserRequest,
  CreateOrgUserResponse,
} from "../internal/api-types.js";

export interface OrgUserRepo {
  create(input: CreateOrgUserRequest): Promise<CreateOrgUserResponse>;
  bulkImportStudents(input: BulkImportStudentsRequest): Promise<BulkImportResponse>;
  bulkImportTeachers(input: BulkImportTeachersRequest): Promise<BulkImportResponse>;
  bulkUpdateStatus(input: BulkUpdateStatusRequest): Promise<BulkUpdateStatusResponse>;
}

export function createOrgUserRepo(api: ApiClient): OrgUserRepo {
  return {
    create: (input) => api.identity.createOrgUser(input),
    bulkImportStudents: (input) => api.identity.bulkImportStudents(input),
    bulkImportTeachers: (input) => api.identity.bulkImportTeachers(input),
    bulkUpdateStatus: (input) => api.identity.bulkUpdateStatus(input),
  };
}
