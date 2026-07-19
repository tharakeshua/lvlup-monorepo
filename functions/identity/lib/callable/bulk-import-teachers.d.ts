interface ImportError {
  rowIndex: number;
  email: string;
  error: string;
}
/**
 * Callable: Bulk-imports teachers from parsed CSV data.
 * Supports dry-run validation.
 *
 * Config: 540s timeout, 1GiB memory for large imports.
 */
export declare const bulkImportTeachers: import("firebase-functions/https").CallableFunction<
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
