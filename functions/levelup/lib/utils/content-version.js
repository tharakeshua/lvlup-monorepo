"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeContentVersion = writeContentVersion;
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
/**
 * Writes a ContentVersion document to track content changes.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/versions/{versionId}
 */
async function writeContentVersion(db, tenantId, spaceId, params) {
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
    changedAt: (0, domain_1.isoNow)(),
  });
  v2_1.logger.info(`Wrote version ${nextVersion} for ${params.entityType}:${params.entityId}`);
  return versionRef.id;
}
//# sourceMappingURL=content-version.js.map
