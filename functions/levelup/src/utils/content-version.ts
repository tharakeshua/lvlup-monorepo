import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";

interface WriteVersionParams {
  entityType: "space" | "storyPoint" | "item";
  entityId: string;
  changeType: "created" | "updated" | "published" | "archived";
  changeSummary: string;
  changedBy: string;
}

/**
 * Writes a ContentVersion document to track content changes.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/versions/{versionId}
 */
export async function writeContentVersion(
  db: admin.firestore.Firestore,
  tenantId: string,
  spaceId: string,
  params: WriteVersionParams
): Promise<string> {
  const versionsPath = `tenants/${tenantId}/spaces/${spaceId}/versions`;

  // Get next version number
  const lastVersion = await db
    .collection(versionsPath)
    .where("entityType", "==", params.entityType)
    .where("entityId", "==", params.entityId)
    .orderBy("version", "desc")
    .limit(1)
    .get();

  const nextVersion = lastVersion.empty ? 1 : (lastVersion.docs[0].data().version ?? 0) + 1;

  const versionRef = db.collection(versionsPath).doc();
  await versionRef.set({
    id: versionRef.id,
    version: nextVersion,
    entityType: params.entityType,
    entityId: params.entityId,
    changeType: params.changeType,
    changeSummary: params.changeSummary,
    changedBy: params.changedBy,
    changedAt: isoNow(),
  });

  logger.info(`Wrote version ${nextVersion} for ${params.entityType}:${params.entityId}`);
  return versionRef.id;
}
