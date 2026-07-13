/**
 * Firestore mock helpers for unit testing Cloud Functions.
 *
 * Provides lightweight stubs for common Firestore operations
 * without requiring the emulator.
 */

import { vi } from "vitest";

/** A minimal mock DocumentSnapshot. */
export function mockDocumentSnapshot(
  data: Record<string, unknown> | undefined,
  id = "mock-doc-id"
) {
  return {
    exists: data !== undefined,
    id,
    data: () => data,
    ref: { id, path: `mock/${id}` },
    get: (field: string) => data?.[field],
  };
}

/** A minimal mock QuerySnapshot. */
export function mockQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const mapped = docs.map((d) => mockDocumentSnapshot(d.data, d.id));
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: mapped,
    forEach: (cb: (doc: ReturnType<typeof mockDocumentSnapshot>) => void) => mapped.forEach(cb),
  };
}

/** Create a stub for admin.firestore() that returns predictable results. */
export function createMockFirestore() {
  const docData = new Map<string, Record<string, unknown>>();
  const collectionData = new Map<string, Array<{ id: string; data: Record<string, unknown> }>>();

  const mockBatch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  const mockTransaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockDoc = vi.fn((path: string) => ({
    id: path.split("/").pop() ?? "auto-id",
    path,
    get: vi.fn().mockResolvedValue(mockDocumentSnapshot(docData.get(path), path.split("/").pop())),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    collection: vi.fn((sub: string) => mockCollection(`${path}/${sub}`)),
  }));

  const mockCollection = vi.fn((path: string) => ({
    path,
    doc: vi.fn((id?: string) => {
      const docId = id ?? `auto-${Date.now()}`;
      return mockDoc(`${path}/${docId}`);
    }),
    get: vi.fn().mockResolvedValue(mockQuerySnapshot(collectionData.get(path) ?? [])),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }));

  return {
    db: {
      doc: mockDoc,
      collection: mockCollection,
      batch: vi.fn(() => mockBatch),
      runTransaction: vi.fn(async (fn: (txn: typeof mockTransaction) => Promise<void>) => {
        await fn(mockTransaction);
      }),
    },
    batch: mockBatch,
    transaction: mockTransaction,
    /** Seed a document for subsequent get() calls. */
    seedDoc(path: string, data: Record<string, unknown>) {
      docData.set(path, data);
    },
    /** Seed collection query results. */
    seedCollection(path: string, docs: Array<{ id: string; data: Record<string, unknown> }>) {
      collectionData.set(path, docs);
    },
  };
}
