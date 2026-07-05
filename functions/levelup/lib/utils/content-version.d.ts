import * as admin from "firebase-admin";
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
export declare function writeContentVersion(
  db: admin.firestore.Firestore,
  tenantId: string,
  spaceId: string,
  params: WriteVersionParams
): Promise<string>;
export {};
