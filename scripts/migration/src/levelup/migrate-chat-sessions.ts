/**
 * Migrate LevelUp chat sessions → /tenants/{tId}/chatSessions/{sessionId}
 *
 * Chat sessions are in the global /chatSessions collection with courseId reference.
 * They get moved under the tenant's scope.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyChatSession {
  _docId: string;
  userId: string;
  courseId: string;
  storyPointId: string;
  itemId: string;
  questionType?: string;
  agentId?: string;
  agentName?: string;
  sessionTitle: string;
  previewMessage: string;
  messageCount: number;
  language: string;
  isActive: boolean;
  messages: Array<{
    id: string;
    role: string;
    text: string;
    timestamp: string;
    mediaUrls?: string[];
    tokensUsed?: { input: number; output: number };
  }>;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export async function migrateChatSessions(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Migrating LevelUp chat sessions for org ${orgId}`);

  // Get all courses belonging to this org to know which sessions to migrate
  const coursesSnap = await db.collection("courses").where("orgId", "==", orgId).get();
  const courseIds = new Set(coursesSnap.docs.map((d) => d.id));
  logger.info(`Found ${courseIds.size} courses to migrate chat sessions from`);

  // Read all chat sessions and filter by courseId
  // Firestore doesn't support 'in' queries with large arrays, so we iterate
  for (const courseId of courseIds) {
    const spaceId = courseId;

    const sessions = await readAllDocs<LegacyChatSession>(
      db.collection("chatSessions").where("courseId", "==", courseId) as admin.firestore.Query
    );
    logger.info(`Course ${courseId}: ${sessions.length} chat sessions`);

    if (sessions.length === 0) continue;

    await processBatch(
      sessions,
      async (session, batch, db) => {
        const sessionId = session._docId;
        const targetPath = `tenants/${tenantId}/chatSessions/${sessionId}`;

        if (await docExists(db, targetPath)) {
          logger.debug(`ChatSession ${sessionId} already migrated, skipping`);
          return { action: "skipped", id: sessionId };
        }

        const newSession = {
          id: sessionId,
          tenantId,
          userId: session.userId,
          spaceId,
          storyPointId: session.storyPointId,
          itemId: session.itemId,
          questionType: session.questionType || null,
          agentId: session.agentId || null,
          agentName: session.agentName || null,
          sessionTitle: session.sessionTitle,
          previewMessage: session.previewMessage,
          messageCount: session.messageCount,
          language: session.language || "en",
          isActive: session.isActive,
          messages: session.messages || [],
          systemPrompt: session.systemPrompt || "",
          createdAt: session.createdAt
            ? admin.firestore.Timestamp.fromMillis(session.createdAt)
            : admin.firestore.Timestamp.now(),
          updatedAt: session.updatedAt
            ? admin.firestore.Timestamp.fromMillis(session.updatedAt)
            : admin.firestore.Timestamp.now(),
          _migratedFrom: "levelup",
          _migrationSourcePath: `chatSessions/${sessionId}`,
        };

        if (dryRun) {
          logger.info(`[DRY RUN] Would migrate chat session: ${sessionId}`);
          return { action: "created", id: sessionId };
        }

        batch.set(db.doc(targetPath), newSession);
        return { action: "created", id: sessionId };
      },
      { dryRun, logger }
    );
  }

  logger.printSummary();
}
