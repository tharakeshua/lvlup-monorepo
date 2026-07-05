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
exports.saveAcademicSession = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consolidated endpoint: replaces createAcademicSession + updateAcademicSession.
 * - No id = create new academic session
 * - id present = update existing session
 * - isCurrent = true automatically unsets previous current session
 */
exports.saveAcademicSession = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const { id, tenantId, data } = (0, utils_1.parseRequest)(
      request.data,
      wire_1.SaveAcademicSessionRequestSchema
    );
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, tenantId);
    await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
    const db = admin.firestore();
    const sessionsCollection = db.collection(`tenants/${tenantId}/academicSessions`);
    if (!id) {
      // ── CREATE ──
      const tenant = await (0, utils_1.getTenant)(tenantId);
      if (!tenant || tenant.status !== "active") {
        throw new https_1.HttpsError("not-found", "Tenant not found or inactive");
      }
      if (!data.name || !data.startDate || !data.endDate) {
        throw new https_1.HttpsError(
          "invalid-argument",
          "name, startDate, and endDate are required"
        );
      }
      const sessionRef = sessionsCollection.doc();
      if (data.isCurrent) {
        // Unset isCurrent on existing sessions
        const currentSessions = await sessionsCollection.where("isCurrent", "==", true).get();
        const batch = db.batch();
        for (const doc of currentSessions.docs) {
          batch.update(doc.ref, {
            isCurrent: false,
            // B8: timestamps at rest are canonical ISO strings.
            updatedAt: (0, domain_1.isoNow)(),
          });
        }
        batch.set(sessionRef, {
          id: sessionRef.id,
          tenantId,
          name: data.name,
          startDate: firestore_1.Timestamp.fromDate(new Date(data.startDate)),
          endDate: firestore_1.Timestamp.fromDate(new Date(data.endDate)),
          isCurrent: true,
          status: "active",
          createdAt: (0, domain_1.isoNow)(),
          createdBy: callerUid,
          updatedAt: (0, domain_1.isoNow)(),
          updatedBy: callerUid,
        });
        await batch.commit();
      } else {
        await sessionRef.set({
          id: sessionRef.id,
          tenantId,
          name: data.name,
          startDate: firestore_1.Timestamp.fromDate(new Date(data.startDate)),
          endDate: firestore_1.Timestamp.fromDate(new Date(data.endDate)),
          isCurrent: false,
          status: "active",
          createdAt: (0, domain_1.isoNow)(),
          createdBy: callerUid,
          updatedAt: (0, domain_1.isoNow)(),
          updatedBy: callerUid,
        });
      }
      v2_1.logger.info(`Created academic session ${sessionRef.id} in tenant ${tenantId}`);
      return { id: sessionRef.id, created: true };
    } else {
      // ── UPDATE ──
      const sessionRef = db.doc(`tenants/${tenantId}/academicSessions/${id}`);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new https_1.HttpsError("not-found", "Academic session not found");
      }
      const updates = {
        updatedAt: (0, domain_1.isoNow)(),
        updatedBy: callerUid,
      };
      if (data.name !== undefined) updates.name = data.name;
      if (data.startDate !== undefined) {
        updates.startDate = firestore_1.Timestamp.fromDate(new Date(data.startDate));
      }
      if (data.endDate !== undefined) {
        updates.endDate = firestore_1.Timestamp.fromDate(new Date(data.endDate));
      }
      if (data.status !== undefined) updates.status = data.status;
      if (data.isCurrent === true) {
        // Unset previous current session
        const currentSessions = await sessionsCollection.where("isCurrent", "==", true).get();
        const batch = db.batch();
        for (const doc of currentSessions.docs) {
          if (doc.id !== id) {
            batch.update(doc.ref, {
              isCurrent: false,
              updatedAt: (0, domain_1.isoNow)(),
            });
          }
        }
        updates.isCurrent = true;
        batch.update(sessionRef, updates);
        await batch.commit();
      } else {
        if (data.isCurrent !== undefined) updates.isCurrent = data.isCurrent;
        await sessionRef.update(updates);
      }
      v2_1.logger.info(`Updated academic session ${id} in tenant ${tenantId}`);
      return { id, created: false };
    }
  }
);
//# sourceMappingURL=save-academic-session.js.map
