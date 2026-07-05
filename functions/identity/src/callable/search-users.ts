import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { toTimestamp } from "@levelup/domain";
import { getUser, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { z } from "zod";

const SearchUsersRequestSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().min(1).max(50).optional(),
});

export const searchUsers = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const callerUser = await getUser(callerUid);
  if (!callerUser?.isSuperAdmin) {
    throw new HttpsError("permission-denied", "SuperAdmin only");
  }

  await enforceRateLimit("global", callerUid, "read", 60);

  const data = parseRequest(request.data, SearchUsersRequestSchema);
  const searchQuery = data.query.toLowerCase();
  const pageLimit = data.limit ?? 20;

  const db = admin.firestore();

  // Search users collection by email prefix match
  const usersSnap = await db
    .collection("users")
    .orderBy("email")
    .startAt(searchQuery)
    .endAt(searchQuery + "\uf8ff")
    .limit(pageLimit)
    .get();

  // Also search by displayName if email search returns few results
  let displayNameResults: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  if (usersSnap.docs.length < pageLimit) {
    const nameSnap = await db
      .collection("users")
      .orderBy("displayName")
      .startAt(searchQuery)
      .endAt(searchQuery + "\uf8ff")
      .limit(pageLimit)
      .get();
    displayNameResults = nameSnap.docs;
  }

  // Merge and deduplicate
  const seenUids = new Set<string>();
  const allDocs = [...usersSnap.docs, ...displayNameResults];
  const uniqueUsers: Array<Record<string, unknown>> = [];

  for (const doc of allDocs) {
    if (seenUids.has(doc.id)) continue;
    seenUids.add(doc.id);
    const userData = doc.data();
    uniqueUsers.push({
      uid: doc.id,
      email: (userData.email as string) ?? null,
      displayName: (userData.displayName as string) ?? null,
      isSuperAdmin: (userData.isSuperAdmin as boolean) ?? false,
      activeTenantId: (userData.activeTenantId as string) ?? null,
      // B8: timestamps out are canonical ISO strings (legacy Timestamp
      // objects and ISO strings collapse uniformly; null stays null).
      lastLoginAt: toTimestamp(userData.lastLoginAt),
      createdAt: toTimestamp(userData.createdAt),
    });
    if (uniqueUsers.length >= pageLimit) break;
  }

  // Get membership info for found users
  const results: Array<Record<string, unknown>> = [];
  for (const user of uniqueUsers) {
    const membershipSnap = await db
      .collection("userMemberships")
      .where("uid", "==", user.uid)
      .where("status", "==", "active")
      .get();

    const memberships = membershipSnap.docs.map((m) => {
      const mData = m.data();
      return {
        tenantId: mData.tenantId as string,
        tenantCode: (mData.tenantCode as string) ?? "",
        role: mData.role as string,
      };
    });

    results.push({ ...user, memberships });
  }

  logger.info("searchUsers completed", { query: data.query, resultCount: results.length });

  return { users: results };
});
