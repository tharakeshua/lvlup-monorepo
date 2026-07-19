interface ImportError {
  rowIndex: number;
  rollNumber: string;
  error: string;
}
/**
 * Callable: Bulk-imports students from parsed CSV data.
 * Supports dry-run validation and parent auto-creation.
 *
 * Config: 540s timeout, 1GiB memory for large imports.
 */
export declare const bulkImportStudents: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        totalRows: number;
        created: number;
        skipped: number;
        errors: ImportError[];
        credentialsUrl?: undefined;
        credentialsExpiresAt?: undefined;
      }
    | {
        totalRows: number;
        created: number;
        skipped: number;
        errors: ImportError[];
        credentialsUrl: string | undefined;
        credentialsExpiresAt: string | undefined;
      }
  >,
  unknown
>;
export {};
