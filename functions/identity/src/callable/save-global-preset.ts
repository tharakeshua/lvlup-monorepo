import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SaveGlobalPresetRequestSchema } from "@levelup/shared-types";
import { getUser, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint for global evaluation preset management.
 * - No id → create new preset (SuperAdmin only)
 * - id present → update existing preset (SuperAdmin only)
 * - delete: true → delete preset (SuperAdmin only)
 */
export const saveGlobalEvaluationPreset = onCall(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

    const callerUser = await getUser(callerUid);
    if (!callerUser?.isSuperAdmin) {
      throw new HttpsError("permission-denied", "SuperAdmin only");
    }

    await enforceRateLimit("global", callerUid, "write", 30);

    const {
      id,
      data,
      delete: shouldDelete,
    } = parseRequest(request.data, SaveGlobalPresetRequestSchema);

    if (id && shouldDelete) {
      // ── DELETE ──
      const presetRef = admin.firestore().doc(`globalEvaluationPresets/${id}`);
      const snap = await presetRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Preset not found");
      }
      await presetRef.delete();
      logger.info(`Deleted global preset ${id}`);
      return { id, deleted: true };
    }

    if (!id) {
      // ── CREATE ──
      if (!data?.name) {
        throw new HttpsError("invalid-argument", "name is required");
      }

      const presetRef = admin.firestore().collection("globalEvaluationPresets").doc();
      await presetRef.set({
        id: presetRef.id,
        name: data.name,
        description: data.description ?? null,
        isDefault: data.isDefault ?? false,
        isPublic: data.isPublic ?? false,
        enabledDimensions: data.enabledDimensions ?? [],
        displaySettings: data.displaySettings ?? {
          showStrengths: true,
          showKeyTakeaway: true,
          prioritizeByImportance: false,
        },
        createdBy: callerUid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`Created global preset ${presetRef.id} (${data.name})`);
      return { id: presetRef.id, created: true };
    } else {
      // ── UPDATE ──
      const presetRef = admin.firestore().doc(`globalEvaluationPresets/${id}`);
      const snap = await presetRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Preset not found");
      }

      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (data?.name !== undefined) updates.name = data.name;
      if (data?.description !== undefined) updates.description = data.description;
      if (data?.isDefault !== undefined) updates.isDefault = data.isDefault;
      if (data?.isPublic !== undefined) updates.isPublic = data.isPublic;
      if (data?.enabledDimensions !== undefined) updates.enabledDimensions = data.enabledDimensions;
      if (data?.displaySettings !== undefined) updates.displaySettings = data.displaySettings;

      await presetRef.update(updates);

      logger.info(`Updated global preset ${id}`);
      return { id, created: false };
    }
  }
);
