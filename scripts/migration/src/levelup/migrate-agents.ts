/**
 * Migrate LevelUp AI agents → /tenants/{tId}/spaces/{sId}/agents/{agentId}
 *
 * Agents may be stored globally or as subcollections under courses.
 * This script checks both patterns and migrates to the tenant-scoped structure.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyAgent {
  _docId: string;
  courseId: string;
  type: string; // 'tutor' | 'evaluator'
  name: string;
  identity: string;
  systemPrompt?: string;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  maxConversationTurns?: number;
  rules?: string;
  evaluationObjectives?: Array<{
    id: string;
    name: string;
    points: number;
    description?: string;
  }>;
  strictness?: string;
  feedbackStyle?: string;
  modelOverride?: string;
  temperatureOverride?: number;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
}

export async function migrateAgents(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Migrating LevelUp agents for org ${orgId}`);

  // Get all courses belonging to this org
  const coursesSnap = await db.collection("courses").where("orgId", "==", orgId).get();
  const courseIds = coursesSnap.docs.map((d) => d.id);
  logger.info(`Found ${courseIds.length} courses to migrate agents from`);

  for (const courseId of courseIds) {
    const spaceId = courseId;

    // Try reading agents from subcollection under course
    const agents = await readAllDocs<LegacyAgent>(
      db.collection(`courses/${courseId}/agents`) as admin.firestore.CollectionReference
    );

    // Also try global agents collection filtered by courseId
    const globalAgents = await readAllDocs<LegacyAgent>(
      db.collection("agents").where("courseId", "==", courseId) as admin.firestore.Query
    );

    const allAgents = [...agents, ...globalAgents];
    // Deduplicate by _docId
    const seenIds = new Set<string>();
    const uniqueAgents = allAgents.filter((a) => {
      if (seenIds.has(a._docId)) return false;
      seenIds.add(a._docId);
      return true;
    });

    if (uniqueAgents.length === 0) continue;
    logger.info(`Course ${courseId}: ${uniqueAgents.length} agents`);

    await processBatch(
      uniqueAgents,
      async (agent, batch, db) => {
        const agentId = agent._docId;
        const targetPath = `tenants/${tenantId}/spaces/${spaceId}/agents/${agentId}`;

        if (await docExists(db, targetPath)) {
          logger.debug(`Agent ${agentId} already migrated, skipping`);
          return { action: "skipped", id: agentId };
        }

        const newAgent = {
          id: agentId,
          spaceId,
          tenantId,
          type: agent.type || "tutor",
          name: agent.name,
          identity: agent.identity || "",
          systemPrompt: agent.systemPrompt || null,
          supportedLanguages: agent.supportedLanguages || [],
          defaultLanguage: agent.defaultLanguage || "en",
          maxConversationTurns: agent.maxConversationTurns || null,
          rules: agent.rules || null,
          evaluationObjectives: agent.evaluationObjectives || [],
          strictness: agent.strictness || "moderate",
          feedbackStyle: agent.feedbackStyle || "detailed",
          modelOverride: agent.modelOverride || null,
          temperatureOverride: agent.temperatureOverride ?? null,
          createdBy: agent.createdBy || "",
          createdAt: agent.createdAt
            ? admin.firestore.Timestamp.fromMillis(agent.createdAt)
            : admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          _migratedFrom: "levelup",
          _migrationSourcePath: `agents/${agentId}`,
        };

        if (dryRun) {
          logger.info(
            `[DRY RUN] Would migrate agent: ${agentId} (${agent.name}, type=${agent.type})`
          );
          return { action: "created", id: agentId };
        }

        batch.set(db.doc(targetPath), newAgent);
        return { action: "created", id: agentId };
      },
      { dryRun, logger }
    );
  }

  logger.printSummary();
}
