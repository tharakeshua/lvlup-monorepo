/**
 * Opaque base64 cursor encode/decode (common-api §7). Services + clients never
 * see a raw Firestore snapshot — only this opaque string. The encoding MUST match
 * the in-memory testing twin so the T6 conformance suite passes one fixture
 * through both drivers.
 *
 * A cursor carries the ordering key value(s) of the last returned doc plus its
 * doc id (tiebreaker), JSON-encoded then base64'd.
 */

export interface CursorPayload {
  /** Value of the orderBy field on the last doc (id when default ordering). */
  v: unknown;
  /** Doc id of the last returned doc (stable tiebreaker). */
  id: string;
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeCursor(cursor: string): unknown {
  return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
}

export function encodePageCursor(payload: CursorPayload): string {
  return encodeCursor(payload);
}

export function decodePageCursor(cursor: string): CursorPayload {
  const v = decodeCursor(cursor) as CursorPayload;
  if (v == null || typeof v !== "object" || !("id" in v)) {
    throw new RangeError("malformed cursor");
  }
  return v;
}
