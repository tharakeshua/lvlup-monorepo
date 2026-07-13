import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "../firebase";
import type {
  SaveResponse,
  SaveTenantRequest,
  SaveClassRequest,
  SaveStudentRequest,
  SaveTeacherRequest,
  SaveParentRequest,
  SaveAcademicSessionRequest,
  SaveStaffRequest,
  ManageNotificationsRequest,
  ManageNotificationsResponse,
  SaveSpaceRequest,
  SaveStoryPointRequest,
  SaveItemRequest,
  DeactivateTenantRequest,
  ReactivateTenantRequest,
  ExportTenantDataRequest,
  ExportTenantDataResponse,
  SaveAnnouncementRequest,
  SaveAnnouncementResponse,
  ListAnnouncementsRequest,
  ListAnnouncementsResponse,
  SearchUsersRequest,
  SearchUsersResponse,
  BulkImportTeachersRequest,
  BulkImportTeachersResponse,
  BulkUpdateStatusRequest,
  BulkUpdateStatusResponse,
  RolloverSessionRequest,
  RolloverSessionResponse,
  UploadTenantAssetRequest,
  UploadTenantAssetResponse,
} from "@levelup/shared-types";

// ---------------------------------------------------------------------------
// Auth callable types
// ---------------------------------------------------------------------------

export interface SwitchActiveTenantResponse {
  success: boolean;
  role: string;
}

export interface CreateOrgUserRequest {
  tenantId: string;
  role: "tenantAdmin" | "teacher" | "student" | "parent" | "scanner" | "staff";
  email?: string;
  rollNumber?: string;
  firstName: string;
  lastName: string;
  password?: string;
  phone?: string;
  classIds?: string[];
  subjects?: string[];
  linkedStudentIds?: string[];
}
export interface CreateOrgUserResponse {
  uid: string;
  entityId: string;
  membershipId: string;
}

// ---------------------------------------------------------------------------
// Bulk import types (kept as-is — not consolidated)
// ---------------------------------------------------------------------------

export interface StudentImportRow {
  firstName: string;
  lastName: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  classId?: string;
  className?: string;
  section?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
}

export interface BulkImportStudentsRequest {
  tenantId: string;
  students: StudentImportRow[];
  dryRun: boolean;
}
export interface BulkImportStudentsResponse {
  totalRows: number;
  created: number;
  skipped: number;
  errors: { rowIndex: number; rollNumber: string; error: string }[];
  credentialsUrl?: string;
  credentialsExpiresAt?: string;
}

// ---------------------------------------------------------------------------
// Callable wrappers
// ---------------------------------------------------------------------------

function getCallable<Req, Res>(name: string) {
  const { functions } = getFirebaseServices();
  return httpsCallable<Req, Res>(functions, name);
}

// Auth / tenant management

export async function callSwitchActiveTenant(
  tenantId: string
): Promise<SwitchActiveTenantResponse> {
  const fn = getCallable<{ tenantId: string }, SwitchActiveTenantResponse>("switchActiveTenant");
  const result = await fn({ tenantId });
  return result.data;
}

export async function callCreateOrgUser(
  data: CreateOrgUserRequest
): Promise<CreateOrgUserResponse> {
  const fn = getCallable<CreateOrgUserRequest, CreateOrgUserResponse>("createOrgUser");
  const result = await fn(data);
  return result.data;
}

// Identity

export async function callSaveTenant(data: SaveTenantRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveTenantRequest, SaveResponse>("saveTenant");
  const result = await fn(data);
  return result.data;
}

export async function callSaveClass(data: SaveClassRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveClassRequest, SaveResponse>("saveClass");
  const result = await fn(data);
  return result.data;
}

export async function callSaveStudent(data: SaveStudentRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveStudentRequest, SaveResponse>("saveStudent");
  const result = await fn(data);
  return result.data;
}

export async function callSaveTeacher(data: SaveTeacherRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveTeacherRequest, SaveResponse>("saveTeacher");
  const result = await fn(data);
  return result.data;
}

export async function callSaveParent(data: SaveParentRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveParentRequest, SaveResponse>("saveParent");
  const result = await fn(data);
  return result.data;
}

export async function callSaveAcademicSession(
  data: SaveAcademicSessionRequest
): Promise<SaveResponse> {
  const fn = getCallable<SaveAcademicSessionRequest, SaveResponse>("saveAcademicSession");
  const result = await fn(data);
  return result.data;
}

export async function callManageNotifications(
  data: ManageNotificationsRequest
): Promise<ManageNotificationsResponse> {
  const fn = getCallable<ManageNotificationsRequest, ManageNotificationsResponse>(
    "manageNotifications"
  );
  const result = await fn(data);
  return result.data;
}

export async function callBulkImportStudents(
  data: BulkImportStudentsRequest
): Promise<BulkImportStudentsResponse> {
  const fn = getCallable<BulkImportStudentsRequest, BulkImportStudentsResponse>(
    "bulkImportStudents"
  );
  const result = await fn(data);
  return result.data;
}

// LevelUp

export async function callSaveSpace(data: SaveSpaceRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveSpaceRequest, SaveResponse>("saveSpace");
  const result = await fn(data);
  return result.data;
}

export async function callSaveStoryPoint(data: SaveStoryPointRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveStoryPointRequest, SaveResponse>("saveStoryPoint");
  const result = await fn(data);
  return result.data;
}

export async function callSaveItem(data: SaveItemRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveItemRequest, SaveResponse>("saveItem");
  const result = await fn(data);
  return result.data;
}

// Tenant lifecycle

export async function callDeactivateTenant(
  data: DeactivateTenantRequest
): Promise<{ success: boolean; membershipsSuspended: number }> {
  const fn = getCallable<
    DeactivateTenantRequest,
    { success: boolean; membershipsSuspended: number }
  >("deactivateTenant");
  const result = await fn(data);
  return result.data;
}

export async function callReactivateTenant(
  data: ReactivateTenantRequest
): Promise<{ success: boolean; membershipsReactivated: number }> {
  const fn = getCallable<
    ReactivateTenantRequest,
    { success: boolean; membershipsReactivated: number }
  >("reactivateTenant");
  const result = await fn(data);
  return result.data;
}

export async function callExportTenantData(
  data: ExportTenantDataRequest
): Promise<ExportTenantDataResponse> {
  const fn = getCallable<ExportTenantDataRequest, ExportTenantDataResponse>("exportTenantData");
  const result = await fn(data);
  return result.data;
}

// Identity — global presets

export interface SaveGlobalPresetRequest {
  id?: string;
  data?: {
    name?: string;
    description?: string;
    isDefault?: boolean;
    isPublic?: boolean;
    enabledDimensions?: Array<Record<string, unknown>>;
    displaySettings?: {
      showStrengths: boolean;
      showKeyTakeaway: boolean;
      prioritizeByImportance: boolean;
    };
  };
  delete?: boolean;
}

export interface SaveGlobalPresetResponse {
  id: string;
  created?: boolean;
  deleted?: boolean;
}

export async function callSaveGlobalEvaluationPreset(
  data: SaveGlobalPresetRequest
): Promise<SaveGlobalPresetResponse> {
  const fn = getCallable<SaveGlobalPresetRequest, SaveGlobalPresetResponse>(
    "saveGlobalEvaluationPreset"
  );
  const result = await fn(data);
  return result.data;
}

// Identity — join tenant

export interface JoinTenantRequest {
  tenantCode: string;
}

export interface JoinTenantResponse {
  success: boolean;
  tenantId: string;
  role: string;
}

export async function callJoinTenant(data: JoinTenantRequest): Promise<JoinTenantResponse> {
  const fn = getCallable<JoinTenantRequest, JoinTenantResponse>("joinTenant");
  const result = await fn(data);
  return result.data;
}

// Announcements

export async function callSaveAnnouncement(
  data: SaveAnnouncementRequest
): Promise<SaveAnnouncementResponse> {
  const fn = getCallable<SaveAnnouncementRequest, SaveAnnouncementResponse>("saveAnnouncement");
  const result = await fn(data);
  return result.data;
}

export async function callListAnnouncements(
  data: ListAnnouncementsRequest
): Promise<ListAnnouncementsResponse> {
  const fn = getCallable<ListAnnouncementsRequest, ListAnnouncementsResponse>("listAnnouncements");
  const result = await fn(data);
  return result.data;
}

// Bulk teacher import

export async function callBulkImportTeachers(
  data: BulkImportTeachersRequest
): Promise<BulkImportTeachersResponse> {
  const fn = getCallable<BulkImportTeachersRequest, BulkImportTeachersResponse>(
    "bulkImportTeachers"
  );
  const result = await fn(data);
  return result.data;
}

// Bulk status update

export async function callBulkUpdateStatus(
  data: BulkUpdateStatusRequest
): Promise<BulkUpdateStatusResponse> {
  const fn = getCallable<BulkUpdateStatusRequest, BulkUpdateStatusResponse>("bulkUpdateStatus");
  const result = await fn(data);
  return result.data;
}

// Session rollover

export async function callRolloverSession(
  data: RolloverSessionRequest
): Promise<RolloverSessionResponse> {
  const fn = getCallable<RolloverSessionRequest, RolloverSessionResponse>("rolloverSession");
  const result = await fn(data);
  return result.data;
}

// Staff management

export async function callSaveStaff(data: SaveStaffRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveStaffRequest, SaveResponse>("saveStaff");
  const result = await fn(data);
  return result.data;
}

// Tenant asset upload

export async function callUploadTenantAsset(
  data: UploadTenantAssetRequest
): Promise<UploadTenantAssetResponse> {
  const fn = getCallable<UploadTenantAssetRequest, UploadTenantAssetResponse>("uploadTenantAsset");
  const result = await fn(data);
  return result.data;
}

// Global user search (SuperAdmin)

export async function callSearchUsers(data: SearchUsersRequest): Promise<SearchUsersResponse> {
  const fn = getCallable<SearchUsersRequest, SearchUsersResponse>("searchUsers");
  const result = await fn(data);
  return result.data;
}
