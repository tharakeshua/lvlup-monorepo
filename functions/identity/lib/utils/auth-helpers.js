"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRollNumber = sanitizeRollNumber;
exports.generateTempPassword = generateTempPassword;
exports.generateSlug = generateSlug;
exports.determineProvider = determineProvider;
const crypto_1 = require("crypto");
/** Sanitize roll number for synthetic email derivation. */
function sanitizeRollNumber(rollNumber) {
  return rollNumber.replace(/[^a-zA-Z0-9\-_]/g, "").toLowerCase();
}
/** Generate an 8-character temporary password (no ambiguous chars). */
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = (0, crypto_1.randomBytes)(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
/** Generate a URL-friendly slug from a name. */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
/** Determine the primary auth provider from a UserRecord. */
function determineProvider(user) {
  if (user.providerData.some((p) => p.providerId === "google.com")) return "google";
  if (user.providerData.some((p) => p.providerId === "apple.com")) return "apple";
  if (user.phoneNumber) return "phone";
  return "email";
}
//# sourceMappingURL=auth-helpers.js.map
