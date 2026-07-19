import { getDb } from "./firestore";
import type { UnifiedItem, UnifiedRubric, StoryPoint, Space } from "../types";

/**
 * Resolve rubric using the inheritance chain: item > storyPoint > space > tenant.
 * Full override model — first non-null wins.
 */
export async function resolveRubric(
  tenantId: string,
  spaceId: string,
  item: UnifiedItem
): Promise<UnifiedRubric | null> {
  // 1. Item-level rubric
  if (item.rubric) return item.rubric;

  const db = getDb();

  // 2. StoryPoint-level rubric
  const spDoc = await db
    .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${item.storyPointId}`)
    .get();
  if (spDoc.exists) {
    const sp = spDoc.data() as StoryPoint;
    if (sp.defaultRubric) return sp.defaultRubric;
  }

  // 3. Space-level rubric
  const spaceDoc = await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).get();
  if (spaceDoc.exists) {
    const space = spaceDoc.data() as Space;
    if (space.defaultRubric) return space.defaultRubric;
  }

  // 4. Tenant-level default (from tenant evaluation settings)
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (tenantDoc.exists) {
    const tenant = tenantDoc.data();
    const settingsId = tenant?.settings?.defaultEvaluationSettingsId;
    if (settingsId) {
      const settingsDoc = await db
        .doc(`tenants/${tenantId}/evaluationSettings/${settingsId}`)
        .get();
      if (settingsDoc.exists) {
        const settings = settingsDoc.data();
        if (settings?.defaultRubric) return settings.defaultRubric as UnifiedRubric;
      }
    }
  }

  return null;
}
