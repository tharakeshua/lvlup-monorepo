/**
 * Admin-RTDB `LevelupProjectionPort` adapter (U2.6 seam; AD-12 — inherits the
 * AG-5 `grading-projections-rtdb` convention). The concrete writer behind
 * `ctx.repos.levelupProjections` — the four levelup live-ticker projections the
 * flipped realtime subscriptions read:
 *
 *   spaceProgressLive/{t}/{userId}/{spaceId}   ← bounded progress numerics
 *   studentLevelLive/{t}/{userId}              ← slim StudentLevel shape
 *   achievementUnlocks/{t}/{userId}/latest     ← latest unlock event (LWW)
 *   testSessionLive/{t}/{userId}/{sessionId}   ← {remainingMs, serverDeadline, status}
 *   chatBump/{t}/{userId}/{sessionId}          ← {rev, lastMessageAt} — CHAT-1 bump
 *                                                signal; message content NEVER in RTDB
 *
 * All roots are USER-owned (path-keyed `{userId}` == auth uid, AD-9), so the
 * RTDB read rules gate owner access on the path segment — no sibling gate
 * nodes. `.write: false` throughout (Admin-SDK writes only).
 *
 * The projection is a pure SIDE-CHANNEL (authority stays in Firestore), so every
 * write here is BEST-EFFORT: an RTDB failure is logged and swallowed — a submit
 * or progress write must never fail because the ticker couldn't tick.
 */
import { getDatabase, ServerValue } from "firebase-admin/database";
import { logger } from "firebase-functions/v2";
import type { LevelupProjectionPort } from "@levelup/services";

export function createRtdbLevelupProjections(): LevelupProjectionPort {
  const swallow = async (label: string, write: () => Promise<unknown>): Promise<void> => {
    try {
      await write();
    } catch (e) {
      logger.error(`[levelup-projections] ${label} failed`, e);
    }
  };

  return {
    async setSpaceProgress(tenantId, userId, spaceId, live): Promise<void> {
      await swallow(`setSpaceProgress ${tenantId}/${userId}/${spaceId}`, () =>
        getDatabase().ref(`spaceProgressLive/${tenantId}/${userId}/${spaceId}`).set(live)
      );
    },

    async setStudentLevel(tenantId, userId, level): Promise<void> {
      await swallow(`setStudentLevel ${tenantId}/${userId}`, () =>
        getDatabase().ref(`studentLevelLive/${tenantId}/${userId}`).set(level)
      );
    },

    async setAchievementUnlock(tenantId, userId, event): Promise<void> {
      await swallow(`setAchievementUnlock ${tenantId}/${userId}`, () =>
        getDatabase().ref(`achievementUnlocks/${tenantId}/${userId}/latest`).set(event)
      );
    },

    async clearAchievementUnlock(tenantId, userId): Promise<void> {
      await swallow(`clearAchievementUnlock ${tenantId}/${userId}`, () =>
        getDatabase().ref(`achievementUnlocks/${tenantId}/${userId}/latest`).remove()
      );
    },

    async setTestSessionLive(tenantId, userId, sessionId, live): Promise<void> {
      await swallow(`setTestSessionLive ${tenantId}/${userId}/${sessionId}`, () =>
        getDatabase().ref(`testSessionLive/${tenantId}/${userId}/${sessionId}`).set(live)
      );
    },

    async bumpChat(tenantId, userId, sessionId, lastMessageAt): Promise<void> {
      // update() (not set()) so `rev` increments atomically server-side; the node
      // carries the refetch signal ONLY — rev + lastMessageAt, never a message.
      await swallow(`bumpChat ${tenantId}/${userId}/${sessionId}`, () =>
        getDatabase()
          .ref(`chatBump/${tenantId}/${userId}/${sessionId}`)
          .update({ rev: ServerValue.increment(1), lastMessageAt })
      );
    },
  };
}
