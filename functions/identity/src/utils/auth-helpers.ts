import { randomBytes } from "crypto";
import type { AuthProvider } from "@levelup/domain";
import * as admin from "firebase-admin";

/** Sanitize roll number for synthetic email derivation. */
export function sanitizeRollNumber(rollNumber: string): string {
  return rollNumber.replace(/[^a-zA-Z0-9\-_]/g, "").toLowerCase();
}

/** Generate an 8-character temporary password (no ambiguous chars). */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Generate a URL-friendly slug from a name. */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Determine the primary auth provider from a UserRecord. */
export function determineProvider(user: admin.auth.UserRecord): AuthProvider {
  if (user.providerData.some((p) => p.providerId === "google.com")) return "google";
  if (user.providerData.some((p) => p.providerId === "apple.com")) return "apple";
  if (user.phoneNumber) return "phone";
  return "email";
}
