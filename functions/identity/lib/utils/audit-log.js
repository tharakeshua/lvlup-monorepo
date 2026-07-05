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
exports.logTenantAction = logTenantAction;
const admin = __importStar(require("firebase-admin"));
const domain_1 = require("@levelup/domain");
const v2_1 = require("firebase-functions/v2");
/**
 * Log an administrative action to the tenant's audit log.
 * Collection: /tenants/{tenantId}/auditLogs/{logId}
 */
async function logTenantAction(tenantId, callerUid, action, details) {
  try {
    await admin
      .firestore()
      .collection(`tenants/${tenantId}/auditLogs`)
      .add({
        action,
        callerUid,
        details: details ?? null,
        // B8: timestamps at rest are canonical ISO strings.
        createdAt: (0, domain_1.isoNow)(),
      });
  } catch (err) {
    // Audit logging should never block the main operation
    v2_1.logger.warn(`Failed to write audit log for tenant ${tenantId}: ${err}`);
  }
}
//# sourceMappingURL=audit-log.js.map
