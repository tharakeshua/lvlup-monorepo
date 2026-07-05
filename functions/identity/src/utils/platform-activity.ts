import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import type { PlatformActivityAction } from "@levelup/domain";

/**
 * Write a platform-wide activity log entry.
 * Collection: /platformActivityLog/{autoId}
 */
export async function writePlatformActivity(
  action: PlatformActivityAction,
  actorUid: string,
  metadata: Record<string, unknown> = {},
  tenantId?: string
): Promise<void> {
  try {
    const db = admin.firestore();

    // Resolve actor email
    let actorEmail = "unknown";
    try {
      const userRecord = await admin.auth().getUser(actorUid);
      actorEmail = userRecord.email ?? "unknown";
    } catch {
      // Best-effort email resolution
    }

    await db.collection("platformActivityLog").add({
      action,
      actorUid,
      actorEmail,
      tenantId: tenantId ?? null,
      metadata,
      // B8: timestamps at rest are canonical ISO strings.
      createdAt: isoNow(),
    });
  } catch (err) {
    // Activity logging should never block the main operation
    logger.warn(`Failed to write platform activity log: ${err}`);
  }
}
