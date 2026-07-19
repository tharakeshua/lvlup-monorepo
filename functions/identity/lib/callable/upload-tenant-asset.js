"use strict";
/**
 * uploadTenantAsset — Generates a signed upload URL for tenant branding assets.
 *
 * Accepts { tenantId, assetType, contentType } and returns { uploadUrl, publicUrl }.
 * The client uploads directly to Cloud Storage using the signed URL.
 */
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
exports.uploadTenantAsset = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const zod_1 = require("zod");
const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const CONTENT_TYPE_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
const UploadTenantAssetSchema = zod_1.z.object({
  tenantId: zod_1.z.string().min(1),
  assetType: zod_1.z.enum(["logo", "banner", "favicon"]),
  contentType: zod_1.z.string().min(1),
});
exports.uploadTenantAsset = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(request.data, UploadTenantAssetSchema);
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 10);
    if (!ALLOWED_CONTENT_TYPES.has(data.contentType)) {
      throw new https_1.HttpsError(
        "invalid-argument",
        `Invalid content type: ${data.contentType}. Allowed: ${Array.from(ALLOWED_CONTENT_TYPES).join(", ")}`
      );
    }
    const ext = CONTENT_TYPE_TO_EXT[data.contentType] ?? "png";
    const timestamp = Date.now();
    const filePath = `tenants/${data.tenantId}/branding/${data.assetType}-${timestamp}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    // Generate signed URL for upload (15 min expiry)
    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: data.contentType,
    });
    // The public URL (assumes default bucket with public access or Firebase Storage URL)
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    return { uploadUrl, publicUrl };
  }
);
//# sourceMappingURL=upload-tenant-asset.js.map
