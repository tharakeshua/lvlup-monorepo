"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRubric = resolveRubric;
const firestore_1 = require("./firestore");
/**
 * Resolve rubric using the inheritance chain: item > storyPoint > space > tenant.
 * Full override model — first non-null wins.
 */
async function resolveRubric(tenantId, spaceId, item) {
  // 1. Item-level rubric
  if (item.rubric) return item.rubric;
  const db = (0, firestore_1.getDb)();
  // 2. StoryPoint-level rubric
  const spDoc = await db
    .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${item.storyPointId}`)
    .get();
  if (spDoc.exists) {
    const sp = spDoc.data();
    if (sp.defaultRubric) return sp.defaultRubric;
  }
  // 3. Space-level rubric
  const spaceDoc = await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).get();
  if (spaceDoc.exists) {
    const space = spaceDoc.data();
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
        if (settings?.defaultRubric) return settings.defaultRubric;
      }
    }
  }
  return null;
}
//# sourceMappingURL=rubric.js.map
