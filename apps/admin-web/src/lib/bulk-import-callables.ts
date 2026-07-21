/**
 * Bulk import client callables — wraps existing SDK hooks + TODO stubs for
 * parents, staff, and scanner roles.
 *
 * @see docs/PRODUCT-IMPROVEMENTS-ROADMAP.md (P0-2)
 */
import {
  callBulkImportStudents,
  callBulkImportTeachers,
  type BulkImportStudentsRequest,
  type BulkImportStudentsResponse,
  type BulkImportTeachersRequest,
  type BulkImportTeachersResponse,
} from "@levelup/shared-services/auth";

export type BulkImportEntity = "students" | "teachers" | "parents" | "staff" | "scanners";

export interface BulkImportRowResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export interface BulkImportParentsRequest {
  tenantId: string;
  rows: Array<Record<string, string>>;
  dryRun?: boolean;
}

export interface BulkImportStaffRequest {
  tenantId: string;
  rows: Array<Record<string, string>>;
  dryRun?: boolean;
}

export interface BulkImportScannersRequest {
  tenantId: string;
  rows: Array<Record<string, string>>;
  dryRun?: boolean;
}

/** Implemented — delegates to sdk-v1 bulkImportStudents. */
export async function bulkImportStudents(
  request: BulkImportStudentsRequest
): Promise<BulkImportStudentsResponse> {
  return callBulkImportStudents(request);
}

/** Implemented — delegates to sdk-v1 bulkImportTeachers. */
export async function bulkImportTeachers(
  request: BulkImportTeachersRequest
): Promise<BulkImportTeachersResponse> {
  return callBulkImportTeachers(request);
}

/** TODO(P0-2): implement bulkImportParents callable in sdk-v1 identity slice. */
export async function bulkImportParents(
  _request: BulkImportParentsRequest
): Promise<BulkImportRowResult> {
  throw new Error(
    "bulkImportParents is not implemented yet — add sdk-v1 callable (see docs/PRODUCT-IMPROVEMENTS-ROADMAP.md P0-2)"
  );
}

/** TODO(P0-2): implement bulkImportStaff callable (staff role + permissions). */
export async function bulkImportStaff(
  _request: BulkImportStaffRequest
): Promise<BulkImportRowResult> {
  throw new Error(
    "bulkImportStaff is not implemented yet — add sdk-v1 callable (see docs/PRODUCT-IMPROVEMENTS-ROADMAP.md P0-2)"
  );
}

/** TODO(P0-2): implement bulkImportScanners callable for Manual Agent accounts. */
export async function bulkImportScanners(
  _request: BulkImportScannersRequest
): Promise<BulkImportRowResult> {
  throw new Error(
    "bulkImportScanners is not implemented yet — add sdk-v1 callable (see docs/PRODUCT-IMPROVEMENTS-ROADMAP.md P0-2)"
  );
}

export const BULK_IMPORT_TEMPLATES: Record<
  BulkImportEntity,
  { columns: string[]; sampleRow: Record<string, string> }
> = {
  students: {
    columns: [
      "firstName",
      "lastName",
      "rollNumber",
      "email",
      "phone",
      "classId",
      "className",
      "section",
      "parentFirstName",
      "parentLastName",
      "parentEmail",
      "parentPhone",
    ],
    sampleRow: {
      firstName: "Asha",
      lastName: "Kumar",
      rollNumber: "101",
      email: "asha@school.test",
      phone: "",
      classId: "",
      className: "Grade 10A",
      section: "A",
      parentFirstName: "Raj",
      parentLastName: "Kumar",
      parentEmail: "raj@parent.test",
      parentPhone: "",
    },
  },
  teachers: {
    columns: ["firstName", "lastName", "email", "phone", "subjects"],
    sampleRow: {
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya@school.test",
      phone: "",
      subjects: "Math,Physics",
    },
  },
  parents: {
    columns: ["firstName", "lastName", "email", "phone", "studentRollNumbers"],
    sampleRow: {
      firstName: "Raj",
      lastName: "Kumar",
      email: "raj@parent.test",
      phone: "",
      studentRollNumbers: "101,102",
    },
  },
  staff: {
    columns: ["firstName", "lastName", "email", "phone", "role", "permissions"],
    sampleRow: {
      firstName: "Sam",
      lastName: "Ops",
      email: "sam@school.test",
      phone: "",
      role: "staff",
      permissions: "canViewAnalytics",
    },
  },
  scanners: {
    columns: ["firstName", "lastName", "email", "phone", "deviceLabel"],
    sampleRow: {
      firstName: "Field",
      lastName: "Agent",
      email: "scanner@school.test",
      phone: "",
      deviceLabel: "Hall-A-scanner",
    },
  },
};
