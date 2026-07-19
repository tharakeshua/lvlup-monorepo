/**
 * Exact-path LevelUp content loaders.
 *
 * Conversation configuration is frozen from one scope tuple.  The older
 * `items.get(tenantId, itemId)` compatibility API intentionally uses a
 * collection-group query, so it is unsuitable here: identical ids can exist
 * under different parents during migration.  This module is the one narrow
 * direct-read seam consumed by the conversational runtime.
 */
import { type Firestore } from "firebase-admin/firestore";
import { makeEntityRepo } from "./entity-repo.js";
import { docFromFirestore } from "./firestore.js";
import { answerKeyDoc, itemDoc, spaceDoc, storyPointDoc, tenantCollectionDoc } from "./paths.js";
import type { LevelupContentRepo, ScopedAgentRepo } from "./types.js";

async function readExact(
  firestore: Firestore,
  path: string
): Promise<Record<string, unknown> | null> {
  const snap = await firestore.doc(path).get();
  return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
}

function isScoped(data: Record<string, unknown>, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(([field, value]) => {
    const actual = data[field];
    // Exact paths are sufficient for legacy records that did not denormalize
    // every parent id; if a field is present, it must agree with the path.
    return actual === undefined || actual === value;
  });
}

/** Flat agent reader with a required space fence. */
export function makeScopedAgentRepo(firestore: Firestore, now: () => string): ScopedAgentRepo {
  const base = makeEntityRepo(firestore, "agents", now);
  return {
    ...base,
    async getScoped(tenantId, spaceId, agentId) {
      const data = await readExact(firestore, tenantCollectionDoc(tenantId, "agents", agentId));
      return data && isScoped(data, { tenantId, spaceId, id: agentId }) ? data : null;
    },
  };
}

export function makeLevelupContentRepo(firestore: Firestore): LevelupContentRepo {
  return {
    async getSpace(tenantId, spaceId) {
      const data = await readExact(firestore, spaceDoc(tenantId, spaceId));
      return data && isScoped(data, { tenantId, id: spaceId }) ? data : null;
    },

    async getStoryPoint(tenantId, spaceId, storyPointId) {
      const data = await readExact(firestore, storyPointDoc(tenantId, spaceId, storyPointId));
      return data && isScoped(data, { tenantId, spaceId, id: storyPointId }) ? data : null;
    },

    async getItem(tenantId, spaceId, storyPointId, itemId) {
      const data = await readExact(firestore, itemDoc(tenantId, spaceId, storyPointId, itemId));
      return data && isScoped(data, { tenantId, spaceId, storyPointId, id: itemId }) ? data : null;
    },

    async getAnswerKey(tenantId, spaceId, storyPointId, itemId) {
      const data = await readExact(
        firestore,
        answerKeyDoc(tenantId, spaceId, storyPointId, itemId)
      );
      return data && isScoped(data, { tenantId, spaceId, storyPointId, itemId }) ? data : null;
    },

    async getAgent(tenantId, spaceId, agentId) {
      const data = await readExact(firestore, tenantCollectionDoc(tenantId, "agents", agentId));
      return data && isScoped(data, { tenantId, spaceId, id: agentId }) ? data : null;
    },

    async getEvaluationSettings(tenantId, settingsId) {
      const data = await readExact(
        firestore,
        tenantCollectionDoc(tenantId, "evaluationSettings", settingsId)
      );
      return data && isScoped(data, { tenantId, id: settingsId }) ? data : null;
    },

    async getRubricPreset(tenantId, rubricPresetId) {
      const data = await readExact(
        firestore,
        tenantCollectionDoc(tenantId, "rubricPresets", rubricPresetId)
      );
      return data && isScoped(data, { tenantId, id: rubricPresetId }) ? data : null;
    },
  };
}
