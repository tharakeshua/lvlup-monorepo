/**
 * Unified error types for the Auto-LevelUp platform.
 *
 * Used by both Cloud Functions (server) and frontend apps (client)
 * to provide consistent, typed error handling.
 *
 * @module error-types
 */

// ─────────────────────────────────────────────────────
// Error codes
// ─────────────────────────────────────────────────────

/** Application-level error codes with semantic meaning. */
export type AppErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "INTERNAL_ERROR"
  | "QUOTA_EXCEEDED";

/**
 * Mapping from AppErrorCode to Firebase FunctionsErrorCode.
 * Used server-side for HttpsError transport.
 */
export const APP_ERROR_TO_HTTPS: Record<AppErrorCode, string> = {
  VALIDATION_FAILED: "invalid-argument",
  NOT_FOUND: "not-found",
  PERMISSION_DENIED: "permission-denied",
  UNAUTHENTICATED: "unauthenticated",
  RATE_LIMITED: "resource-exhausted",
  CONFLICT: "already-exists",
  PRECONDITION_FAILED: "failed-precondition",
  INTERNAL_ERROR: "internal",
  QUOTA_EXCEEDED: "resource-exhausted",
};

/**
 * Mapping from Firebase FunctionsErrorCode to AppErrorCode.
 * Used client-side to decode errors received from Cloud Functions.
 */
export const HTTPS_TO_APP_ERROR: Record<string, AppErrorCode> = {
  "invalid-argument": "VALIDATION_FAILED",
  "not-found": "NOT_FOUND",
  "permission-denied": "PERMISSION_DENIED",
  unauthenticated: "UNAUTHENTICATED",
  "resource-exhausted": "RATE_LIMITED",
  "already-exists": "CONFLICT",
  "failed-precondition": "PRECONDITION_FAILED",
  internal: "INTERNAL_ERROR",
};

// ─────────────────────────────────────────────────────
// Error response shape
// ─────────────────────────────────────────────────────

/** Standardized error response returned by all callable functions. */
export interface AppErrorResponse {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────
// Rate limit configuration
// ─────────────────────────────────────────────────────

/** Rate limit tiers for different endpoint categories. */
export interface RateLimitConfig {
  maxPerMinute: number;
  actionType: string;
}

/** Default rate limits by endpoint category. */
export const RATE_LIMITS = {
  /** save*, create*, bulk* endpoints */
  WRITE: { maxPerMinute: 30, actionType: "write" },
  /** list*, get*, manage* endpoints */
  READ: { maxPerMinute: 60, actionType: "read" },
  /** sendChatMessage, evaluateAnswer, extractQuestions, gradeQuestion(retry) */
  AI: { maxPerMinute: 10, actionType: "ai" },
  /** switchActiveTenant, joinTenant */
  AUTH: { maxPerMinute: 10, actionType: "auth" },
  /** generateReport */
  REPORT: { maxPerMinute: 5, actionType: "report" },
} as const satisfies Record<string, RateLimitConfig>;

/** User-friendly error messages for each error code. */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION_FAILED: "The request contains invalid data.",
  NOT_FOUND: "The requested resource was not found.",
  PERMISSION_DENIED: "You do not have permission to perform this action.",
  UNAUTHENTICATED: "You must be logged in to perform this action.",
  RATE_LIMITED: "Too many requests. Please try again in a moment.",
  CONFLICT: "This resource already exists.",
  PRECONDITION_FAILED: "The operation cannot be performed in the current state.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
  QUOTA_EXCEEDED: "You have exceeded your usage quota.",
};

/** Recovery suggestions shown alongside error toasts. */
export const ERROR_RECOVERY_HINTS: Record<AppErrorCode, string | null> = {
  VALIDATION_FAILED: "Check the form fields and try again.",
  NOT_FOUND: "The item may have been deleted. Try refreshing the page.",
  PERMISSION_DENIED: "Contact your administrator if you need access.",
  UNAUTHENTICATED: "Please sign in and try again.",
  RATE_LIMITED: "Wait a few seconds before trying again.",
  CONFLICT: "Refresh the page to see the latest version.",
  PRECONDITION_FAILED: "Refresh the page and verify the current status.",
  INTERNAL_ERROR: "If the problem persists, contact support.",
  QUOTA_EXCEEDED: "Contact your administrator to upgrade your plan.",
};
