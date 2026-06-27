/**
 * Identity domain factory — `createIdentityRepos(api)` (SDK-LAYERS-PLAN §4.1,
 * identity.md "Repositories"). Assembles the per-entity identity repos + the two
 * cross-entity VIEW repos (classRepo, userSearchRepo) into one bag the top-level
 * `createRepositories(api)` (owned by this 'identity' agent in `../index.ts`)
 * spreads.
 *
 * Repos import `@levelup/api-client` + `@levelup/domain` ONLY (here via the
 * structural `ApiClient` slice in `../internal/api-types`). Per-entity repos never
 * compose siblings; the view repos live under `views/` (R6 exception) and compose
 * via batched read CALLABLES, not sibling-repo imports.
 *
 * The parent per-entity repo is exposed as `parentRepoEntity` so it does not
 * collide with the analytics `parentRepo` VIEW (N+1 child-summary collapse) in
 * the merged bag (_harness PER_ENTITY_REPO_NAMES / VIEW_REPO_NAMES).
 */
import type { ApiClient } from "../internal/api-types.js";

import { createMeRepo, type MeRepo } from "./me.js";
import { createTenantRepo, type TenantRepo } from "./tenant.js";
import { createStudentRepo, type StudentRepo } from "./student.js";
import { createTeacherRepo, type TeacherRepo } from "./teacher.js";
import { createParentEntityRepo, type ParentEntityRepo } from "./parent.js";
import { createStaffRepo, type StaffRepo } from "./staff.js";
import { createAcademicSessionRepo, type AcademicSessionRepo } from "./academic-session.js";
import { createOrgUserRepo, type OrgUserRepo } from "./org-user.js";
import { createAnnouncementRepo, type AnnouncementRepo } from "./announcement.js";
import { createNotificationRepo, type NotificationRepo } from "./notification.js";
import { createClassRepo, type ClassRepo } from "./views/class.js";
import { createUserSearchRepo, type UserSearchRepo } from "./views/user-search.js";

export interface IdentityRepos {
  meRepo: MeRepo;
  tenantRepo: TenantRepo;
  studentRepo: StudentRepo;
  teacherRepo: TeacherRepo;
  parentRepoEntity: ParentEntityRepo;
  staffRepo: StaffRepo;
  academicSessionRepo: AcademicSessionRepo;
  orgUserRepo: OrgUserRepo;
  announcementRepo: AnnouncementRepo;
  notificationRepo: NotificationRepo;
  // view repos (compose under views/ — R6 exception)
  classRepo: ClassRepo;
  userSearchRepo: UserSearchRepo;
}

export function createIdentityRepos(api: ApiClient): IdentityRepos {
  return {
    meRepo: createMeRepo(api),
    tenantRepo: createTenantRepo(api),
    studentRepo: createStudentRepo(api),
    teacherRepo: createTeacherRepo(api),
    parentRepoEntity: createParentEntityRepo(api),
    staffRepo: createStaffRepo(api),
    academicSessionRepo: createAcademicSessionRepo(api),
    orgUserRepo: createOrgUserRepo(api),
    announcementRepo: createAnnouncementRepo(api),
    notificationRepo: createNotificationRepo(api),
    classRepo: createClassRepo(api),
    userSearchRepo: createUserSearchRepo(api),
  };
}

export type {
  MeRepo,
  TenantRepo,
  StudentRepo,
  TeacherRepo,
  ParentEntityRepo,
  StaffRepo,
  AcademicSessionRepo,
  OrgUserRepo,
  AnnouncementRepo,
  NotificationRepo,
  ClassRepo,
  UserSearchRepo,
};
