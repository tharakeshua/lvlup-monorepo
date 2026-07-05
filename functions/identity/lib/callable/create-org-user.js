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
exports.createOrgUser = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const usage_1 = require("../utils/usage");
const legacy_docs_1 = require("../contracts/legacy-docs");
/**
 * createOrgUser — Creates a new user within a tenant organization.
 *
 * Creates the Firebase Auth user, tenant entity doc (student/teacher/parent),
 * and UserMembership doc in a single flow.
 */
exports.createOrgUser = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(request.data, wire_1.CreateOrgUserRequestSchema);
    if (!data.tenantId || !data.role || !data.firstName || !data.lastName) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId, role, firstName, and lastName are required"
      );
    }
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 30);
    const tenant = await (0, utils_1.getTenant)(data.tenantId);
    (0, utils_1.assertTenantAccessible)(tenant, "write");
    // Enforce subscription quota for student/teacher creation
    if (data.role === "student" || data.role === "teacher") {
      await (0, utils_1.assertQuota)(data.tenantId, data.role);
    }
    const db = admin.firestore();
    const tenantCode = tenant.tenantCode;
    // Determine email for auth account
    let email = data.email;
    let password = data.password ?? (0, utils_1.generateTempPassword)();
    if (!email && data.role === "student" && data.rollNumber) {
      // Generate synthetic email for students without email
      const sanitized = (0, utils_1.sanitizeRollNumber)(data.rollNumber);
      email = `${sanitized}@${data.tenantId}.levelup.internal`;
    }
    if (!email) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "email or rollNumber is required to create an auth account"
      );
    }
    // Create Firebase Auth user
    let authUser;
    try {
      authUser = await admin.auth().createUser({
        email,
        password,
        displayName: `${data.firstName} ${data.lastName}`,
        disabled: false,
      });
    } catch (err) {
      const authErr = err;
      if (authErr.code === "auth/email-already-exists") {
        throw new https_1.HttpsError("already-exists", `User with email ${email} already exists`);
      }
      throw new https_1.HttpsError("internal", `Failed to create auth user: ${err.message}`);
    }
    const uid = authUser.uid;
    try {
      // Create the tenant-specific entity doc
      let entityId;
      const entityBase = {
        tenantId: data.tenantId,
        name: `${data.firstName} ${data.lastName}`,
        uid,
        status: "active",
        // B8: timestamps at rest are canonical ISO strings.
        createdAt: (0, domain_1.isoNow)(),
        updatedAt: (0, domain_1.isoNow)(),
      };
      if (data.role === "student") {
        const studentRef = db.collection(`tenants/${data.tenantId}/students`).doc();
        entityId = studentRef.id;
        await studentRef.set({
          id: studentRef.id,
          ...entityBase,
          rollNumber: data.rollNumber ?? "",
          classIds: data.classIds ?? [],
          parentIds: [],
        });
      } else if (data.role === "teacher") {
        const teacherRef = db.collection(`tenants/${data.tenantId}/teachers`).doc();
        entityId = teacherRef.id;
        await teacherRef.set({
          id: teacherRef.id,
          ...entityBase,
          subjects: data.subjects ?? [],
          classIds: data.classIds ?? [],
          designation: null,
        });
      } else if (data.role === "parent") {
        const parentRef = db.collection(`tenants/${data.tenantId}/parents`).doc();
        entityId = parentRef.id;
        await parentRef.set({
          id: parentRef.id,
          ...entityBase,
          childStudentIds: data.linkedStudentIds ?? [],
        });
      } else if (data.role === "staff") {
        const staffRef = db.collection(`tenants/${data.tenantId}/staff`).doc();
        entityId = staffRef.id;
        await staffRef.set({
          id: staffRef.id,
          ...entityBase,
          department: null,
        });
      } else if (data.role === "scanner") {
        const scannerRef = db.collection(`tenants/${data.tenantId}/scanners`).doc();
        entityId = scannerRef.id;
        await scannerRef.set({
          id: scannerRef.id,
          ...entityBase,
        });
      } else {
        throw new https_1.HttpsError("invalid-argument", `Unsupported role: ${data.role}`);
      }
      // Create UserMembership
      const membershipId = `${uid}_${data.tenantId}`;
      const membershipRef = db.doc(`userMemberships/${membershipId}`);
      const membership = {
        id: membershipId,
        uid,
        tenantId: data.tenantId,
        tenantCode,
        role: data.role,
        status: "active",
        joinSource: "admin_created",
        ...(data.role === "student" && { studentId: entityId }),
        ...(data.role === "teacher" && {
          teacherId: entityId,
          permissions: { managedClassIds: data.classIds ?? [] },
        }),
        ...(data.role === "parent" && {
          parentId: entityId,
          parentLinkedStudentIds: data.linkedStudentIds ?? [],
        }),
        ...(data.role === "staff" && {
          staffId: entityId,
          staffPermissions: legacy_docs_1.DEFAULT_STAFF_PERMISSIONS,
        }),
        ...(data.role === "scanner" && { scannerId: entityId }),
        createdAt: (0, domain_1.isoNow)(),
        updatedAt: (0, domain_1.isoNow)(),
      };
      await membershipRef.set(membership);
      // Set custom claims
      const claims = (0, utils_1.buildClaimsForMembership)(membership);
      await admin.auth().setCustomUserClaims(uid, claims);
      // Update tenant stats
      await (0, utils_1.updateTenantStats)(data.tenantId, data.role, "increment");
      // Update real-time usage counters
      if (data.role === "student") {
        await (0, usage_1.incrementUsage)(data.tenantId, "currentStudents", 1);
      } else if (data.role === "teacher") {
        await (0, usage_1.incrementUsage)(data.tenantId, "currentTeachers", 1);
      }
      // Create platform user doc if it doesn't exist
      const userRef = db.doc(`users/${uid}`);
      const existingUser = await userRef.get();
      if (!existingUser.exists) {
        await userRef.set({
          uid,
          email,
          displayName: `${data.firstName} ${data.lastName}`,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          authProvider: (0, utils_1.determineProvider)(authUser),
          isSuperAdmin: false,
          activeTenantId: data.tenantId,
          createdAt: (0, domain_1.isoNow)(),
          updatedAt: (0, domain_1.isoNow)(),
        });
      }
      v2_1.logger.info(`Created org user ${uid} as ${data.role} in tenant ${data.tenantId}`);
      await (0, utils_1.logTenantAction)(data.tenantId, callerUid, "createOrgUser", {
        uid,
        role: data.role,
        entityId,
      });
      await (0, utils_1.writePlatformActivity)(
        "user_created",
        callerUid,
        {
          uid,
          role: data.role,
          displayName: `${data.firstName} ${data.lastName}`,
        },
        data.tenantId
      );
      return { uid, entityId, membershipId };
    } catch (err) {
      // Cleanup auth user on failure
      try {
        await admin.auth().deleteUser(uid);
      } catch {
        v2_1.logger.warn(`Failed to cleanup auth user ${uid} after entity creation failure`);
      }
      throw err;
    }
  }
);
//# sourceMappingURL=create-org-user.js.map
