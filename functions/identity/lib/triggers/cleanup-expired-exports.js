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
exports.cleanupExpiredExports = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
/**
 * Scheduled trigger: runs every 30 minutes to delete expired credential export files.
 * Files are tagged with `deleteAfter` metadata during bulk import.
 */
exports.cleanupExpiredExports = (0, scheduler_1.onSchedule)(
  {
    schedule: "every 30 minutes",
    region: "asia-south1",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: "exports/" });
    const now = new Date();
    let deletedCount = 0;
    for (const file of files) {
      const deleteAfter = file.metadata?.metadata?.deleteAfter;
      if (!deleteAfter || typeof deleteAfter !== "string") continue;
      const expiresAt = new Date(deleteAfter);
      if (isNaN(expiresAt.getTime())) continue;
      if (now >= expiresAt) {
        try {
          await file.delete();
          deletedCount++;
          v2_1.logger.info(`Deleted expired export file: ${file.name}`);
        } catch (err) {
          v2_1.logger.warn(`Failed to delete expired export file: ${file.name}`, err);
        }
      }
    }
    v2_1.logger.info(
      `Cleanup complete: ${deletedCount} expired files deleted out of ${files.length} total`
    );
  }
);
//# sourceMappingURL=cleanup-expired-exports.js.map
