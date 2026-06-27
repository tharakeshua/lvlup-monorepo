/**
 * Minimal structural view of the `@levelup/api-client` public surface that the
 * identity repos depend on (SDK-LAYERS-PLAN §1.2 — repos import
 * `@levelup/api-client` ONLY). `@levelup/api-client` is built concurrently in the
 * same wave; this file pins the plan-specified namespaced shape
 * (`api.<module>.<op>(req) → Promise<res>`) so this domain typechecks against the
 * declared public surface and the typecheck/fix wave reconciles any drift.
 *
 * The shape mirrors api-client-core.md §3.2:
 *   { identity, levelup, autograde, analytics, subscribe, call }
 * Each callable is `(req) => Promise<res>`. We type only the callables this
 * domain invokes; every namespace keeps a permissive `[op]` tail so the real
 * (superset) `ApiClient` stays assignable to this view.
 */
import type {
  TenantId,
  StudentId,
  TeacherId,
  ParentId,
  StaffId,
  ClassId,
  AcademicSessionId,
  AnnouncementId,
  UserId,
  Tenant,
  TenantPublicView,
  Student,
  Teacher,
  Parent,
  Staff,
  Class,
  AcademicSession,
  UnifiedUser,
  UserMembership,
  PlatformClaims,
  Announcement,
  Notification,
  NotificationPreferences,
  NotificationBadgeState,
  EntityStatus,
  TenantRole,
} from "@levelup/domain";

// ---------------------------------------------------------------------------
// Contract pagination fragment (§3.5) — repos thread the opaque cursor verbatim.
// ---------------------------------------------------------------------------

export interface PageRequest {
  cursor?: string;
  limit?: number;
}

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

/** The consolidated SaveResponse `{ id, created? }` (§3.2). */
export interface SaveResponse {
  id: string;
  created?: boolean;
  deleted?: boolean;
}

/** The canonical save-input envelope — `{ id?, data, delete? }` (§3.2, D5). */
export interface SaveInput<TData> {
  id?: string;
  data?: TData;
  delete?: boolean;
}

// ---------------------------------------------------------------------------
// Realtime subscribe pass-through (§3.7 / api-client-core.md §3.7).
// ---------------------------------------------------------------------------

export interface SubscriptionHandle {
  unsubscribe(): void;
}

export type SubscribeFn = (
  name: string,
  params: Record<string, unknown>,
  cb: (payload: unknown) => void
) => SubscriptionHandle;

// ---------------------------------------------------------------------------
// Request / response shapes for the identity callables (§3.2 / identity.md).
// Authored against the FROZEN contract; the api-contract schemas are the SSOT
// and the typecheck/fix wave reconciles field-level drift.
// ---------------------------------------------------------------------------

type Callable<Req, Res> = (req: Req) => Promise<Res>;

// ---- session / me ----

export interface GetMeResponse {
  user: UnifiedUser;
  memberships: UserMembership[];
  claims: PlatformClaims;
  activeTenant?: Tenant;
}
export interface SwitchActiveTenantRequest {
  targetTenantId: TenantId;
}
export interface SwitchActiveTenantResponse {
  tenantId: TenantId;
  role: TenantRole;
}
export interface JoinTenantRequest {
  tenantCode: string;
}
export interface JoinTenantResponse {
  tenantId: TenantId;
  membershipId: string;
  role: TenantRole;
}

// ---- tenant ----

export interface GetTenantRequest {
  tenantOverride?: TenantId;
}
export interface ListTenantsRequest extends PageRequest {
  status?: string;
  plan?: string;
  q?: string;
}
export interface TenantSummary {
  id: TenantId;
  name: string;
  status: string;
  plan?: string;
}
export interface DeactivateTenantRequest {
  tenantOverride: TenantId;
  reason?: string;
}
export interface ReactivateTenantRequest {
  tenantOverride: TenantId;
}
export interface TenantLifecycleResponse {
  tenantId: TenantId;
  status: string;
}
export interface ExportTenantDataRequest {
  tenantOverride?: TenantId;
  scope: "students" | "teachers" | "all";
}
export interface ExportTenantDataResponse {
  downloadUrl: string;
  expiresAt: string;
}
export interface UploadTenantAssetRequest {
  kind: "logo" | "banner" | "favicon";
  contentType: string;
  bytesBase64: string;
}
export interface UploadTenantAssetResponse {
  assetUrl: string;
}
export interface LookupTenantByCodeRequest {
  tenantCode: string;
}

// ---- org entities ----

export interface ListStudentsRequest extends PageRequest {
  classId?: ClassId;
  status?: EntityStatus;
  q?: string;
  /** Batched read input — the server fans in the `in`-chunking (§5.5, DX-14). */
  ids?: string[];
}
export interface GetStudentRequest {
  id: StudentId;
}
export interface ListTeachersRequest extends PageRequest {
  status?: EntityStatus;
  ids?: string[];
}
export interface GetTeacherRequest {
  id: TeacherId;
}
export interface ListParentsRequest extends PageRequest {
  studentId?: StudentId;
  ids?: string[];
}
export interface ListStaffRequest extends PageRequest {
  ids?: string[];
}
export interface ListClassesRequest extends PageRequest {
  academicSessionId?: AcademicSessionId;
  status?: EntityStatus;
}
export interface GetClassRequest {
  id: ClassId;
}
/** `getClass` returns counts + first roster page (MERGE-PAGINATION §4.1). */
export interface ClassDetailView {
  class: Class;
  students?: Student[];
  teachers?: Teacher[];
  roster?: PageResponse<Student>;
}
export interface ListAcademicSessionsRequest extends PageRequest {
  status?: EntityStatus;
}

// ---- multi-tenant user management + bulk ----

export interface CreateOrgUserRequest {
  role: TenantRole;
  firstName: string;
  lastName: string;
  email?: string;
  rollNumber?: string;
  password?: string;
  phone?: string;
  classIds?: ClassId[];
  subjects?: string[];
  linkedStudentIds?: StudentId[];
}
export interface CreateOrgUserResponse {
  uid: UserId;
  entityId: string;
  membershipId: string;
}
export interface BulkImportStudentsRequest {
  rows: Record<string, unknown>[];
  defaultClassIds?: ClassId[];
}
export interface BulkImportTeachersRequest {
  rows: Record<string, unknown>[];
}
export interface BulkImportResponse {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}
export interface BulkUpdateStatusRequest {
  entityType: "student" | "teacher";
  ids: string[];
  status: EntityStatus;
}
export interface BulkUpdateStatusResponse {
  updated: number;
  errors: { id: string; message: string }[];
}
export interface RolloverSessionRequest {
  fromSessionId: AcademicSessionId;
  toSessionId: AcademicSessionId;
  promotionMap?: Record<string, string>;
}
export interface RolloverSessionResponse {
  classesCreated: number;
  studentsMoved: number;
}

// ---- announcements ----

export interface ListAnnouncementsRequest extends PageRequest {
  scope?: "platform" | "tenant";
  status?: string;
}
export interface SaveAnnouncementResponse {
  id: AnnouncementId;
  created?: boolean;
  deleted?: boolean;
}
export interface MarkAnnouncementReadRequest {
  announcementId: AnnouncementId;
}
export interface MarkAnnouncementReadResponse {
  isReadByMe: true;
}

// ---- notifications ----

export interface MarkNotificationReadRequest {
  mode: "one" | "all";
  notificationId?: string;
}
export interface MarkNotificationReadResponse {
  unreadCount: number;
}
export interface SaveNotificationPreferencesRequest {
  enabledTypes?: string[];
  muteUntil?: string;
}

// ---- super-admin platform ----

export interface SearchUsersRequest extends PageRequest {
  query: string;
}
export interface UserSearchResult {
  uid: UserId;
  email?: string;
  displayName?: string;
  isSuperAdmin?: boolean;
  activeTenantId?: TenantId;
  memberships: { tenantId: TenantId; tenantCode: string; role: TenantRole }[];
}
export interface SaveGlobalEvaluationPresetRequest {
  id?: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

// ---------------------------------------------------------------------------
// The identity namespace surface — only the ops the identity repos invoke. The
// permissive `[op]` tail keeps the real (superset) client assignable.
// ---------------------------------------------------------------------------

export interface IdentityNamespace {
  // me / session
  getMe: Callable<Record<string, never>, GetMeResponse>;
  switchActiveTenant: Callable<SwitchActiveTenantRequest, SwitchActiveTenantResponse>;
  joinTenant: Callable<JoinTenantRequest, JoinTenantResponse>;
  // tenant
  getTenant: Callable<GetTenantRequest, Tenant>;
  listTenants: Callable<ListTenantsRequest, PageResponse<TenantSummary>>;
  saveTenant: Callable<SaveInput<Record<string, unknown>>, SaveResponse>;
  deactivateTenant: Callable<DeactivateTenantRequest, TenantLifecycleResponse>;
  reactivateTenant: Callable<ReactivateTenantRequest, TenantLifecycleResponse>;
  exportTenantData: Callable<ExportTenantDataRequest, ExportTenantDataResponse>;
  uploadTenantAsset: Callable<UploadTenantAssetRequest, UploadTenantAssetResponse>;
  lookupTenantByCode: Callable<LookupTenantByCodeRequest, TenantPublicView>;
  // org entities
  listStudents: Callable<ListStudentsRequest, PageResponse<Student>>;
  getStudent: Callable<GetStudentRequest, Student>;
  saveStudent: Callable<SaveInput<Partial<Student>>, SaveResponse>;
  listTeachers: Callable<ListTeachersRequest, PageResponse<Teacher>>;
  getTeacher: Callable<GetTeacherRequest, Teacher>;
  saveTeacher: Callable<SaveInput<Partial<Teacher>>, SaveResponse>;
  listParents: Callable<ListParentsRequest, PageResponse<Parent>>;
  saveParent: Callable<SaveInput<Partial<Parent>>, SaveResponse>;
  listStaff: Callable<ListStaffRequest, PageResponse<Staff>>;
  saveStaff: Callable<SaveInput<Partial<Staff>>, SaveResponse>;
  listClasses: Callable<ListClassesRequest, PageResponse<Class>>;
  getClass: Callable<GetClassRequest, ClassDetailView>;
  saveClass: Callable<SaveInput<Partial<Class>>, SaveResponse>;
  listAcademicSessions: Callable<ListAcademicSessionsRequest, PageResponse<AcademicSession>>;
  saveAcademicSession: Callable<SaveInput<Partial<AcademicSession>>, SaveResponse>;
  // provisioning + bulk
  createOrgUser: Callable<CreateOrgUserRequest, CreateOrgUserResponse>;
  bulkImportStudents: Callable<BulkImportStudentsRequest, BulkImportResponse>;
  bulkImportTeachers: Callable<BulkImportTeachersRequest, BulkImportResponse>;
  bulkUpdateStatus: Callable<BulkUpdateStatusRequest, BulkUpdateStatusResponse>;
  rolloverSession: Callable<RolloverSessionRequest, RolloverSessionResponse>;
  // announcements
  listAnnouncements: Callable<ListAnnouncementsRequest, PageResponse<Announcement>>;
  saveAnnouncement: Callable<SaveInput<Record<string, unknown>>, SaveAnnouncementResponse>;
  markAnnouncementRead: Callable<MarkAnnouncementReadRequest, MarkAnnouncementReadResponse>;
  // notifications
  listNotifications: Callable<PageRequest, PageResponse<Notification>>;
  getNotificationBadge: Callable<Record<string, never>, NotificationBadgeState>;
  markNotificationRead: Callable<MarkNotificationReadRequest, MarkNotificationReadResponse>;
  getNotificationPreferences: Callable<Record<string, never>, NotificationPreferences>;
  saveNotificationPreferences: Callable<
    SaveNotificationPreferencesRequest,
    NotificationPreferences
  >;
  // super-admin platform
  searchUsers: Callable<SearchUsersRequest, PageResponse<UserSearchResult>>;
  saveGlobalEvaluationPreset: Callable<SaveGlobalEvaluationPresetRequest, SaveResponse>;
  // permissive tail — other identity callables exist on the real client.
  [op: string]: (req: never) => Promise<unknown>;
}

/**
 * The structural slice of `ApiClient` the identity repos consume. The real
 * client (a superset) is assignable to this; other namespaces stay permissive so
 * the identity factory does not over-constrain the shared client object.
 */
export interface ApiClient {
  identity: IdentityNamespace;
  levelup: Record<string, (req: never) => Promise<unknown>>;
  autograde: Record<string, (req: never) => Promise<unknown>>;
  analytics: Record<string, (req: never) => Promise<unknown>>;
  subscribe?: SubscribeFn;
  /** Signal the transport to force-refresh the ID token (switchActiveTenant). */
  refreshToken?: () => Promise<void>;
}
