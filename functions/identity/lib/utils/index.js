"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writePlatformActivity =
  exports.logTenantAction =
  exports.assertFeatureEnabled =
  exports.assertQuota =
  exports.parseRequest =
  exports.assertTenantAccessible =
  exports.assertTenantAdminOrSuperAdmin =
  exports.updateTenantStats =
  exports.getTenant =
  exports.getMembership =
  exports.getUser =
  exports.determineProvider =
  exports.generateSlug =
  exports.generateTempPassword =
  exports.sanitizeRollNumber =
  exports.buildClaimsForMembership =
    void 0;
var claims_1 = require("./claims");
Object.defineProperty(exports, "buildClaimsForMembership", {
  enumerable: true,
  get: function () {
    return claims_1.buildClaimsForMembership;
  },
});
var auth_helpers_1 = require("./auth-helpers");
Object.defineProperty(exports, "sanitizeRollNumber", {
  enumerable: true,
  get: function () {
    return auth_helpers_1.sanitizeRollNumber;
  },
});
Object.defineProperty(exports, "generateTempPassword", {
  enumerable: true,
  get: function () {
    return auth_helpers_1.generateTempPassword;
  },
});
Object.defineProperty(exports, "generateSlug", {
  enumerable: true,
  get: function () {
    return auth_helpers_1.generateSlug;
  },
});
Object.defineProperty(exports, "determineProvider", {
  enumerable: true,
  get: function () {
    return auth_helpers_1.determineProvider;
  },
});
var firestore_helpers_1 = require("./firestore-helpers");
Object.defineProperty(exports, "getUser", {
  enumerable: true,
  get: function () {
    return firestore_helpers_1.getUser;
  },
});
Object.defineProperty(exports, "getMembership", {
  enumerable: true,
  get: function () {
    return firestore_helpers_1.getMembership;
  },
});
Object.defineProperty(exports, "getTenant", {
  enumerable: true,
  get: function () {
    return firestore_helpers_1.getTenant;
  },
});
Object.defineProperty(exports, "updateTenantStats", {
  enumerable: true,
  get: function () {
    return firestore_helpers_1.updateTenantStats;
  },
});
var assertions_1 = require("./assertions");
Object.defineProperty(exports, "assertTenantAdminOrSuperAdmin", {
  enumerable: true,
  get: function () {
    return assertions_1.assertTenantAdminOrSuperAdmin;
  },
});
Object.defineProperty(exports, "assertTenantAccessible", {
  enumerable: true,
  get: function () {
    return assertions_1.assertTenantAccessible;
  },
});
var parse_request_1 = require("./parse-request");
Object.defineProperty(exports, "parseRequest", {
  enumerable: true,
  get: function () {
    return parse_request_1.parseRequest;
  },
});
var quota_1 = require("./quota");
Object.defineProperty(exports, "assertQuota", {
  enumerable: true,
  get: function () {
    return quota_1.assertQuota;
  },
});
var feature_gate_1 = require("./feature-gate");
Object.defineProperty(exports, "assertFeatureEnabled", {
  enumerable: true,
  get: function () {
    return feature_gate_1.assertFeatureEnabled;
  },
});
var audit_log_1 = require("./audit-log");
Object.defineProperty(exports, "logTenantAction", {
  enumerable: true,
  get: function () {
    return audit_log_1.logTenantAction;
  },
});
var platform_activity_1 = require("./platform-activity");
Object.defineProperty(exports, "writePlatformActivity", {
  enumerable: true,
  get: function () {
    return platform_activity_1.writePlatformActivity;
  },
});
//# sourceMappingURL=index.js.map
