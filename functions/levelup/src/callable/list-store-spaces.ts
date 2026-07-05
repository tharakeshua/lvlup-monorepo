import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { ListStoreSpacesRequestSchema } from "../contracts/wire";
import { assertAuth } from "../utils/auth";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

interface ListStoreSpacesRequest {
  subject?: string;
  /** Page size (max 50). */
  limit?: number;
  /** Firestore document ID to start after (cursor pagination). */
  startAfter?: string;
  search?: string;
}

interface StoreSpaceSummary {
  id: string;
  title: string;
  storeDescription: string;
  storeThumbnailUrl: string | null;
  subject: string | null;
  labels: string[];
  price: number;
  currency: string;
  totalStudents: number;
  totalStoryPoints: number;
}

/**
 * List spaces published to the public B2C store.
 * Minimal auth: works for any authenticated user (consumer or school).
 */
export const listStoreSpaces = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const data = parseRequest(request.data ?? {}, ListStoreSpacesRequestSchema);
  await enforceRateLimit("platform_public", callerUid, "read", 60);

  const pageSize = Math.min(data.limit ?? 20, 50);

  const db = admin.firestore();
  let query: admin.firestore.Query = db
    .collection("tenants/platform_public/spaces")
    .where("publishedToStore", "==", true)
    .orderBy("publishedAt", "desc");

  // Optional subject filter
  if (data.subject) {
    query = query.where("subject", "==", data.subject);
  }

  // Cursor pagination
  if (data.startAfter) {
    const cursorDoc = await db.doc(`tenants/platform_public/spaces/${data.startAfter}`).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  query = query.limit(pageSize);

  const snapshot = await query.get();

  const spaces: StoreSpaceSummary[] = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title ?? "",
      storeDescription: d.storeDescription ?? d.description ?? "",
      storeThumbnailUrl: d.storeThumbnailUrl ?? d.thumbnailUrl ?? null,
      subject: d.subject ?? null,
      labels: d.labels ?? [],
      price: d.price ?? 0,
      currency: d.currency ?? "USD",
      totalStudents: d.stats?.totalStudents ?? 0,
      totalStoryPoints: d.stats?.totalStoryPoints ?? 0,
    };
  });

  // Client-side search filter (simple title match for MVP)
  let filtered = spaces;
  if (data.search) {
    const term = data.search.toLowerCase();
    filtered = spaces.filter(
      (s) => s.title.toLowerCase().includes(term) || s.storeDescription.toLowerCase().includes(term)
    );
  }

  return {
    spaces: filtered,
    hasMore: snapshot.docs.length === pageSize,
    lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
  };
});
