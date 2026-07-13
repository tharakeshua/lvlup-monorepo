/**
 * Shared firebase-admin mock setup for callable tests.
 *
 * The key insight is that admin.firestore() must return a STABLE singleton,
 * because source code calls it on every invocation. If vi.fn creates a new
 * object each time, the mocks set up in beforeEach won't apply.
 */
import { vi } from "vitest";

// Stable Firestore DB instance — shared across all calls to admin.firestore()
export const mockDb = {
  doc: vi.fn(),
  collection: vi.fn(),
  batch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
};

// Stable RTDB instance
export const mockRtdb = {
  ref: vi.fn(() => ({
    transaction: vi.fn().mockImplementation((cb: any) => Promise.resolve(cb(0))),
    set: vi.fn().mockResolvedValue(undefined),
  })),
};

// firestore function that also has FieldValue
export const mockFirestore = Object.assign(() => mockDb, {
  FieldValue: {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  },
});

export const mockDatabase = () => mockRtdb;

export function getAdminMock() {
  return {
    default: { firestore: mockFirestore, database: mockDatabase },
    firestore: mockFirestore,
    database: mockDatabase,
  };
}
