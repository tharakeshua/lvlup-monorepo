import type { AuthProvider } from "@levelup/domain";
import * as admin from "firebase-admin";
/** Sanitize roll number for synthetic email derivation. */
export declare function sanitizeRollNumber(rollNumber: string): string;
/** Generate an 8-character temporary password (no ambiguous chars). */
export declare function generateTempPassword(): string;
/** Generate a URL-friendly slug from a name. */
export declare function generateSlug(name: string): string;
/** Determine the primary auth provider from a UserRecord. */
export declare function determineProvider(user: admin.auth.UserRecord): AuthProvider;
