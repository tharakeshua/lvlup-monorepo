"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCallerMembership = getCallerMembership;
exports.assertAutogradePermission = assertAutogradePermission;
const functions = __importStar(require("firebase-functions/v2"));
/**
 * Extract and validate caller membership from custom claims.
 */
function getCallerMembership(request) {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const claims = request.auth.token;
  const uid = request.auth.uid;
  const tenantId = claims.tenantId;
  const role = claims.role;
  if (!tenantId || !role) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No active tenant context. Please switch to a tenant first."
    );
  }
  return { uid, tenantId, role, permissions: claims.permissions };
}
/**
 * Assert caller has permission for AutoGrade operations.
 * Accepts tenantAdmin, superAdmin, or teacher with the specified permission.
 */
function assertAutogradePermission(caller, requiredTenantId, teacherPermission, options) {
  if (caller.tenantId !== requiredTenantId) {
    throw new functions.https.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (caller.role === "superAdmin" || caller.role === "tenantAdmin") {
    return;
  }
  if (caller.role === "teacher") {
    if (!teacherPermission) return; // No specific permission needed
    if (caller.permissions?.[teacherPermission]) return;
    throw new functions.https.HttpsError(
      "permission-denied",
      `Teacher lacks required permission: ${teacherPermission}.`
    );
  }
  if (caller.role === "scanner") {
    if (options?.allowScanner) return;
    throw new functions.https.HttpsError(
      "permission-denied",
      "Scanner role is not permitted for this operation."
    );
  }
  throw new functions.https.HttpsError(
    "permission-denied",
    `Role '${caller.role}' cannot perform this operation.`
  );
}
//# sourceMappingURL=assertions.js.map
