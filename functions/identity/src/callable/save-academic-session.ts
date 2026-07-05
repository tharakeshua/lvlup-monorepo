import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { SaveAcademicSessionRequestSchema, type SaveResponse } from "../contracts/wire";
import { assertTenantAdminOrSuperAdmin, getTenant, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint: replaces createAcademicSession + updateAcademicSession.
 * - No id = create new academic session
 * - id present = update existing session
 * - isCurrent = true automatically unsets previous current session
 */
export const saveAcademicSession = onCall(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

    const { id, tenantId, data } = parseRequest(request.data, SaveAcademicSessionRequestSchema);

    await assertTenantAdminOrSuperAdmin(callerUid, tenantId);

    await enforceRateLimit(tenantId, callerUid, "write", 30);

    const db = admin.firestore();
    const sessionsCollection = db.collection(`tenants/${tenantId}/academicSessions`);

    if (!id) {
      // ── CREATE ──
      const tenant = await getTenant(tenantId);
      if (!tenant || tenant.status !== "active") {
        throw new HttpsError("not-found", "Tenant not found or inactive");
      }

      if (!data.name || !data.startDate || !data.endDate) {
        throw new HttpsError("invalid-argument", "name, startDate, and endDate are required");
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
            updatedAt: isoNow(),
          });
        }

        batch.set(sessionRef, {
          id: sessionRef.id,
          tenantId,
          name: data.name,
          startDate: Timestamp.fromDate(new Date(data.startDate)),
          endDate: Timestamp.fromDate(new Date(data.endDate)),
          isCurrent: true,
          status: "active",
          createdAt: isoNow(),
          createdBy: callerUid,
          updatedAt: isoNow(),
          updatedBy: callerUid,
        });

        await batch.commit();
      } else {
        await sessionRef.set({
          id: sessionRef.id,
          tenantId,
          name: data.name,
          startDate: Timestamp.fromDate(new Date(data.startDate)),
          endDate: Timestamp.fromDate(new Date(data.endDate)),
          isCurrent: false,
          status: "active",
          createdAt: isoNow(),
          createdBy: callerUid,
          updatedAt: isoNow(),
          updatedBy: callerUid,
        });
      }

      logger.info(`Created academic session ${sessionRef.id} in tenant ${tenantId}`);

      return { id: sessionRef.id, created: true } satisfies SaveResponse;
    } else {
      // ── UPDATE ──
      const sessionRef = db.doc(`tenants/${tenantId}/academicSessions/${id}`);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Academic session not found");
      }

      const updates: Record<string, unknown> = {
        updatedAt: isoNow(),
        updatedBy: callerUid,
      };

      if (data.name !== undefined) updates.name = data.name;
      if (data.startDate !== undefined) {
        updates.startDate = Timestamp.fromDate(new Date(data.startDate));
      }
      if (data.endDate !== undefined) {
        updates.endDate = Timestamp.fromDate(new Date(data.endDate));
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
              updatedAt: isoNow(),
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

      logger.info(`Updated academic session ${id} in tenant ${tenantId}`);

      return { id, created: false } satisfies SaveResponse;
    }
  }
);
