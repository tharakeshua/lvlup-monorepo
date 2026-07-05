"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.getRtdb = getRtdb;
exports.loadSpace = loadSpace;
exports.loadStoryPoint = loadStoryPoint;
exports.loadItem = loadItem;
exports.loadItems = loadItems;
exports.loadAgent = loadAgent;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const legacy_docs_1 = require("../contracts/legacy-docs");
function getDb() {
  return admin.firestore();
}
function getRtdb() {
  return admin.database();
}
async function loadSpace(tenantId, spaceId) {
  const doc = await getDb().doc(`tenants/${tenantId}/spaces/${spaceId}`).get();
  if (!doc.exists) {
    throw new https_1.HttpsError("not-found", `Space ${spaceId} not found`);
  }
  const result = legacy_docs_1.SpaceDocSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    v2_1.logger.error("Invalid Space document", { docId: doc.id, errors: result.error.flatten() });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  return result.data;
}
async function loadStoryPoint(tenantId, spaceId, storyPointId) {
  const doc = await getDb()
    .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}`)
    .get();
  if (!doc.exists) {
    throw new https_1.HttpsError("not-found", `StoryPoint ${storyPointId} not found`);
  }
  const result = legacy_docs_1.StoryPointDocSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    v2_1.logger.error("Invalid StoryPoint document", {
      docId: doc.id,
      errors: result.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  return result.data;
}
async function loadItem(tenantId, spaceId, itemId, storyPointId) {
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
    throw new https_1.HttpsError("not-found", `Item ${itemId} not found`);
  }
  // Supplement missing fields from path context (seed data may omit spaceId/tenantId)
  const rawData = {
    spaceId,
    tenantId,
    storyPointId: storyPointId ?? "",
    ...doc.data(),
    id: doc.id,
  };
  const result = legacy_docs_1.UnifiedItemDocSchema.safeParse(rawData);
  if (!result.success) {
    v2_1.logger.error("Invalid UnifiedItem document", {
      docId: doc.id,
      errors: result.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  return result.data;
}
async function loadItems(tenantId, spaceId, storyPointId) {
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
    const result = legacy_docs_1.UnifiedItemDocSchema.safeParse(rawData);
    if (!result.success) {
      v2_1.logger.error("Invalid UnifiedItem document", {
        docId: d.id,
        errors: result.error.flatten(),
      });
      throw new https_1.HttpsError("internal", "Data integrity error");
    }
    return result.data;
  });
}
async function loadAgent(tenantId, spaceId, agentId) {
  const doc = await getDb().doc(`tenants/${tenantId}/spaces/${spaceId}/agents/${agentId}`).get();
  if (!doc.exists) return null;
  const result = legacy_docs_1.AgentDocSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    v2_1.logger.error("Invalid Agent document", { docId: doc.id, errors: result.error.flatten() });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  return result.data;
}
//# sourceMappingURL=firestore.js.map
