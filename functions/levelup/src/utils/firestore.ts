import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import type { Space, StoryPoint, UnifiedItem, Agent } from "../types";
import {
  SpaceDocSchema as SpaceSchema,
  StoryPointDocSchema as StoryPointSchema,
  UnifiedItemDocSchema as UnifiedItemSchema,
  AgentDocSchema as AgentSchema,
} from "../contracts/legacy-docs";

export function getDb() {
  return admin.firestore();
}

export function getRtdb() {
  return admin.database();
}

export async function loadSpace(tenantId: string, spaceId: string): Promise<Space> {
  const doc = await getDb().doc(`tenants/${tenantId}/spaces/${spaceId}`).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", `Space ${spaceId} not found`);
  }
  const result = SpaceSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    logger.error("Invalid Space document", { docId: doc.id, errors: result.error.flatten() });
    throw new HttpsError("internal", "Data integrity error");
  }
  return result.data as unknown as Space;
}

export async function loadStoryPoint(
  tenantId: string,
  spaceId: string,
  storyPointId: string
): Promise<StoryPoint> {
  const doc = await getDb()
    .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}`)
    .get();
  if (!doc.exists) {
    throw new HttpsError("not-found", `StoryPoint ${storyPointId} not found`);
  }
  const result = StoryPointSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    logger.error("Invalid StoryPoint document", { docId: doc.id, errors: result.error.flatten() });
    throw new HttpsError("internal", "Data integrity error");
  }
  return result.data as unknown as StoryPoint;
}

export async function loadItem(
  tenantId: string,
  spaceId: string,
  itemId: string,
  storyPointId?: string
): Promise<UnifiedItem> {
  let doc;
  if (storyPointId) {
    // Nested path (canonical): storyPoints/{storyPointId}/items/{itemId}
    doc = await getDb()
      .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items/${itemId}`)
      .get();
    // Fallback to flat path if not found in nested
    if (!doc.exists) {
      doc = await getDb().doc(`tenants/${tenantId}/spaces/${spaceId}/items/${itemId}`).get();
    }
  } else {
    // No storyPointId: try flat path first, then search nested storyPoints
    doc = await getDb().doc(`tenants/${tenantId}/spaces/${spaceId}/items/${itemId}`).get();
    if (!doc.exists) {
      const storyPointsSnap = await getDb()
        .collection(`tenants/${tenantId}/spaces/${spaceId}/storyPoints`)
        .get();
      for (const sp of storyPointsSnap.docs) {
        const itemDoc = await getDb()
          .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${sp.id}/items/${itemId}`)
          .get();
        if (itemDoc.exists) {
          doc = itemDoc;
          break;
        }
      }
    }
  }
  if (!doc || !doc.exists) {
    throw new HttpsError("not-found", `Item ${itemId} not found`);
  }
  // Supplement missing fields from path context (seed data may omit spaceId/tenantId)
  const rawData = {
    spaceId,
    tenantId,
    storyPointId: storyPointId ?? "",
    ...doc.data(),
    id: doc.id,
  };
  const result = UnifiedItemSchema.safeParse(rawData);
  if (!result.success) {
    logger.error("Invalid UnifiedItem document", { docId: doc.id, errors: result.error.flatten() });
    throw new HttpsError("internal", "Data integrity error");
  }
  return result.data as unknown as UnifiedItem;
}

export async function loadItems(
  tenantId: string,
  spaceId: string,
  storyPointId: string
): Promise<UnifiedItem[]> {
  // Items are stored under storyPoints subcollection (nested path)
  const nestedPath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`;
  let snapshot = await getDb().collection(nestedPath).orderBy("orderIndex", "asc").get();

  // Fallback to legacy flat path if nested is empty
  if (snapshot.empty) {
    snapshot = await getDb()
      .collection(`tenants/${tenantId}/spaces/${spaceId}/items`)
      .where("storyPointId", "==", storyPointId)
      .orderBy("orderIndex", "asc")
      .get();
  }

  return snapshot.docs.map((d) => {
    // Supplement missing fields from path context (seed data may omit spaceId/tenantId)
    const rawData = { spaceId, tenantId, storyPointId, ...d.data(), id: d.id };
    const result = UnifiedItemSchema.safeParse(rawData);
    if (!result.success) {
      logger.error("Invalid UnifiedItem document", { docId: d.id, errors: result.error.flatten() });
      throw new HttpsError("internal", "Data integrity error");
    }
    return result.data as unknown as UnifiedItem;
  });
}

export async function loadAgent(
  tenantId: string,
  spaceId: string,
  agentId: string
): Promise<Agent | null> {
  const doc = await getDb().doc(`tenants/${tenantId}/spaces/${spaceId}/agents/${agentId}`).get();
  if (!doc.exists) return null;
  const result = AgentSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    logger.error("Invalid Agent document", { docId: doc.id, errors: result.error.flatten() });
    throw new HttpsError("internal", "Data integrity error");
  }
  return result.data as unknown as Agent;
}
