import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/** Minimal waitFor helper for tests — polls until callback passes or times out. */
async function waitFor(
  callback: () => void | Promise<void>,
  opts?: { timeout?: number }
): Promise<void> {
  const timeout = opts?.timeout ?? 5000;
  const interval = 50;
  const start = Date.now();
  while (true) {
    try {
      await callback();
      return;
    } catch (err) {
      if (Date.now() - start >= timeout) throw err;
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();
const mockUpdateDoc = vi.fn();
const mockServerTimestamp = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock("firebase/firestore", () => ({
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  FirestoreError: class FirestoreError extends Error {},
}));

// Mock firebase/functions
const mockHttpsCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

// Mock firebase/database
const mockRef = vi.fn();
const mockOnValue = vi.fn();
vi.mock("firebase/database", () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  onValue: (...args: unknown[]) => mockOnValue(...args),
}));

// Mock shared-services
vi.mock("@levelup/shared-services", () => ({
  getFirebaseServices: () => ({
    db: { type: "firestore" },
    rtdb: { type: "database" },
    functions: { type: "functions" },
  }),
}));

import { useSpaces } from "../queries/useSpaces";
import { useSpace } from "../queries/useSpace";
import { useExams } from "../queries/useExams";
import { useExam } from "../queries/useExam";
import { useClasses, useCreateClass } from "../queries/useClasses";
import { useStudents } from "../queries/useStudents";
import { useSubmissions } from "../queries/useSubmissions";
import { useProgress } from "../queries/useProgress";
import { useAcademicSessions } from "../queries/useAcademicSessions";
import { useNotifications, useUnreadCount } from "../queries/useNotifications";
import { useExamAnalytics } from "../queries/useExamAnalytics";

// Helper: create a fresh QueryClient and wrapper for each test
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

// Helper: create a mock Firestore query snapshot
function fakeQuerySnap(docs: { id: string; data: Record<string, unknown> }[]) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
    empty: docs.length === 0,
  };
}

// Helper: create a mock Firestore doc snapshot
function fakeDocSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
  };
}

beforeEach(() => {
  mockCollection.mockReturnValue("col-ref");
  mockDoc.mockReturnValue("doc-ref");
  mockQuery.mockReturnValue("query-ref");
  mockWhere.mockReturnValue("where-constraint");
  mockOrderBy.mockReturnValue("orderBy-constraint");
  mockLimit.mockReturnValue("limit-constraint");
  mockStartAfter.mockReturnValue("startAfter-constraint");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSpaces", () => {
  it("should fetch spaces for a tenant", async () => {
    mockGetDocs.mockResolvedValue(
      fakeQuerySnap([
        { id: "s1", data: { name: "Math", status: "active" } },
        { id: "s2", data: { name: "Science", status: "active" } },
      ])
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSpaces("tenant-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: "s1", name: "Math", status: "active" },
      { id: "s2", name: "Science", status: "active" },
    ]);
  });

  it("should return empty array when tenantId is null", async () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSpaces(null), { wrapper });

    // Query should be disabled
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should filter by status", async () => {
    mockGetDocs.mockResolvedValue(fakeQuerySnap([{ id: "s1", data: { name: "Active Space" } }]));

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSpaces("t1", { status: "active" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWhere).toHaveBeenCalledWith("status", "==", "active");
  });
});

describe("useSpace", () => {
  it("should fetch a single space", async () => {
    mockGetDoc.mockResolvedValue(fakeDocSnap("space-1", { name: "Math" }));

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSpace("t1", "space-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ id: "space-1", name: "Math" });
  });

  it("should return null when space does not exist", async () => {
    mockGetDoc.mockResolvedValue(fakeDocSnap("space-2", null));

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSpace("t1", "space-2"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it("should be disabled when spaceId is null", () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSpace("t1", null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useExams", () => {
  it("should fetch exams list", async () => {
    mockGetDocs.mockResolvedValue(
      fakeQuerySnap([
        { id: "e1", data: { title: "Midterm" } },
        { id: "e2", data: { title: "Final" } },
      ])
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useExams("t1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toEqual({ id: "e1", title: "Midterm" });
  });

  it("should apply filters", async () => {
    mockGetDocs.mockResolvedValue(fakeQuerySnap([]));

    const { wrapper } = createTestWrapper();
    renderHook(() => useExams("t1", { spaceId: "sp-1", classId: "cl-1", status: "published" }), {
      wrapper,
    });

    await waitFor(() => {
      expect(mockWhere).toHaveBeenCalledWith("linkedSpaceId", "==", "sp-1");
      expect(mockWhere).toHaveBeenCalledWith("classIds", "array-contains", "cl-1");
      expect(mockWhere).toHaveBeenCalledWith("status", "==", "published");
    });
  });
});

describe("useExam", () => {
  it("should fetch a single exam", async () => {
    mockOnSnapshot.mockImplementationOnce((_ref, onNext) => {
      onNext(fakeDocSnap("exam-1", { title: "Quiz 1" }));
      return () => {};
    });

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useExam("t1", "exam-1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ id: "exam-1", title: "Quiz 1" });
  });

  it("should be disabled when examId is null", () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useExam("t1", null), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});

describe("useClasses", () => {
  it("should fetch classes", async () => {
    mockGetDocs.mockResolvedValue(
      fakeQuerySnap([{ id: "c1", data: { name: "10-A", grade: "10" } }])
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useClasses("t1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ id: "c1", name: "10-A", grade: "10" }]);
  });
});

describe("useCreateClass", () => {
  it("should call createClass cloud function", async () => {
    const mockCallable = vi.fn().mockResolvedValue({ data: { classId: "new-c1" } });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await result.current.mutateAsync({
      tenantId: "t1",
      name: "10-B",
      grade: "10",
    });

    expect(mockCallable).toHaveBeenCalledWith({
      tenantId: "t1",
      name: "10-B",
      grade: "10",
    });
  });
});

describe("useStudents", () => {
  it("should fetch students", async () => {
    mockGetDocs.mockResolvedValue(
      fakeQuerySnap([
        { id: "st1", data: { rollNumber: "1" } },
        { id: "st2", data: { rollNumber: "2" } },
      ])
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useStudents("t1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("should filter by classId", async () => {
    mockGetDocs.mockResolvedValue(fakeQuerySnap([]));

    const { wrapper } = createTestWrapper();
    renderHook(() => useStudents("t1", { classId: "cl-1" }), { wrapper });

    await waitFor(() => {
      expect(mockWhere).toHaveBeenCalledWith("classIds", "array-contains", "cl-1");
    });
  });
});

describe("useSubmissions", () => {
  it("should fetch submissions", async () => {
    mockOnSnapshot.mockImplementationOnce((_q, onNext) => {
      onNext(fakeQuerySnap([{ id: "sub1", data: { examId: "e1", status: "completed" } }]));
      return () => {};
    });

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useSubmissions("t1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.[0]).toEqual({ id: "sub1", examId: "e1", status: "completed" });
  });
});

describe("useProgress", () => {
  it("should fetch student progress for a specific space", async () => {
    mockGetDocs.mockResolvedValue(
      fakeQuerySnap([{ id: "prog1", data: { userId: "u1", spaceId: "s1", percent: 75 } }])
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useProgress("t1", "u1", "s1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ id: "prog1", userId: "u1", spaceId: "s1", percent: 75 });
  });

  it("should fetch overall progress when no spaceId", async () => {
    mockGetDoc.mockResolvedValue(fakeDocSnap("u1", { totalPoints: 100 }));

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useProgress("t1", "u1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ id: "u1", totalPoints: 100 });
  });

  it("should be disabled when studentId is null", () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useProgress("t1", null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAcademicSessions", () => {
  it("should fetch academic sessions", async () => {
    mockGetDocs.mockResolvedValue(
      fakeQuerySnap([{ id: "as1", data: { name: "2025-26", startDate: "2025-04-01" } }])
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useAcademicSessions("t1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ id: "as1", name: "2025-26", startDate: "2025-04-01" }]);
  });
});

describe("useNotifications", () => {
  it("should fetch notifications via cloud function", async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: { notifications: [{ id: "n1", message: "Hello" }], hasMore: false, lastId: null },
    });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useNotifications("t1", "u1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.notifications).toHaveLength(1);
    expect(result.current.data?.notifications[0]).toEqual({ id: "n1", message: "Hello" });
  });

  it("should be disabled when userId is null", () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useNotifications("t1", null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useUnreadCount", () => {
  it("should subscribe to RTDB unread count", () => {
    const mockUnsub = vi.fn();
    mockOnValue.mockImplementation((_ref, onValue) => {
      onValue({ val: () => 5 });
      return mockUnsub;
    });

    const { result } = renderHook(() => useUnreadCount("t1", "u1"));

    expect(result.current).toBe(5);
  });

  it("should return 0 when no tenant or user", () => {
    const { result } = renderHook(() => useUnreadCount(null, null));

    expect(result.current).toBe(0);
  });

  it("should default to 0 when snapshot is null", () => {
    mockOnValue.mockImplementation((_ref, onValue) => {
      onValue({ val: () => null });
      return vi.fn();
    });

    const { result } = renderHook(() => useUnreadCount("t1", "u1"));

    expect(result.current).toBe(0);
  });
});

describe("useExamAnalytics", () => {
  it("should fetch exam analytics", async () => {
    mockGetDoc.mockResolvedValue(fakeDocSnap("exam-1", { averageScore: 85, submissionCount: 30 }));

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useExamAnalytics("t1", "exam-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      id: "exam-1",
      averageScore: 85,
      submissionCount: 30,
    });
  });

  it("should be disabled when examId is null", () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useExamAnalytics("t1", null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
