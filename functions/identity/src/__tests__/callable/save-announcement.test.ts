/**
 * Unit tests for saveAnnouncement callable.
 * Tests auth, scope permissions, CRUD operations, status transitions, and return values.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockDocDelete = vi.fn();
const mockCollectionDoc = vi.fn();
const mockDocRef = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn = () => ({
    collection: (path: string) => ({
      doc: (id?: string) => {
        mockCollectionDoc(path, id);
        const docId = id ?? "auto-announcement-id";
        return {
          id: docId,
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
          delete: mockDocDelete,
        };
      },
    }),
    doc: (path: string) => {
      mockDocRef(path);
      return {
        id: path.split("/").pop(),
        get: mockDocGet,
        set: mockDocSet,
        update: mockDocUpdate,
        delete: mockDocDelete,
      };
    },
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT(${n})`,
  };
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

// ── Mock utils ──────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockAssertTenantAdminOrSuperAdmin = vi.fn();

vi.mock("../../utils", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  parseRequest: vi.fn((data: any) => data),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

// ── Mock firebase-functions ─────────────────────────────────────────
vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: any) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { saveAnnouncement } from "../../callable/save-announcement";

const handler = saveAnnouncement as unknown as (request: any) => Promise<any>;

describe("saveAnnouncement", () => {
  const tenantId = "tenant-1";
  const callerUid = "admin-uid";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({
      isSuperAdmin: false,
      displayName: "Admin User",
      email: "admin@test.com",
    });
    mockDocSet.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
    mockDocDelete.mockResolvedValue(undefined);
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth", async () => {
    await expect(handler({ auth: null, data: { data: {}, tenantId } })).rejects.toThrow(
      "Must be logged in"
    );
  });

  // ── Scope permissions ─────────────────────────────────────────────

  it("rejects platform scope for non-superadmin", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { data: { scope: "platform", title: "X", body: "Y" } },
      })
    ).rejects.toThrow("Only SuperAdmin can manage platform announcements");
  });

  it("checks admin permission for tenant scope", async () => {
    await handler({
      auth: { uid: callerUid },
      data: {
        tenantId,
        data: { scope: "tenant", title: "Hello", body: "World" },
      },
    });

    expect(mockAssertTenantAdminOrSuperAdmin).toHaveBeenCalledWith(callerUid, tenantId);
  });

  it("throws when tenant scope lacks tenantId", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { data: { scope: "tenant", title: "X", body: "Y" } },
      })
    ).rejects.toThrow("tenantId required for tenant-scoped announcements");
  });

  // ── DELETE ────────────────────────────────────────────────────────

  it("deletes announcement and returns { id, deleted: true }", async () => {
    const result = await handler({
      auth: { uid: callerUid },
      data: { id: "ann-1", tenantId, data: {}, delete: true },
    });

    expect(mockDocDelete).toHaveBeenCalled();
    expect(result).toEqual({ id: "ann-1", deleted: true });
  });

  // ── CREATE ────────────────────────────────────────────────────────

  it("throws when title is missing on create", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { tenantId, data: { body: "Some body" } },
      })
    ).rejects.toThrow("title and body are required");
  });

  it("throws when body is missing on create", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { tenantId, data: { title: "Some title" } },
      })
    ).rejects.toThrow("title and body are required");
  });

  it("creates with default status of draft", async () => {
    await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { title: "New Ann", body: "Body text" } },
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        publishedAt: null,
      })
    );
  });

  it("sets publishedAt when status=published on create", async () => {
    await handler({
      auth: { uid: callerUid },
      data: {
        tenantId,
        data: { title: "Published", body: "Body", status: "published" },
      },
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );
  });

  it("returns { id, created: true } on create", async () => {
    const result = await handler({
      auth: { uid: callerUid },
      data: { tenantId, data: { title: "New", body: "Body" } },
    });

    expect(result.id).toBeDefined();
    expect(result.created).toBe(true);
  });

  // ── UPDATE ────────────────────────────────────────────────────────

  it("throws not-found when updating non-existing announcement", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await expect(
      handler({
        auth: { uid: callerUid },
        data: { id: "missing", tenantId, data: { title: "Updated" } },
      })
    ).rejects.toThrow("Announcement not found");
  });

  it("updates only defined fields", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    await handler({
      auth: { uid: callerUid },
      data: { id: "ann-1", tenantId, data: { title: "New Title" } },
    });

    const updateArg = mockDocUpdate.mock.calls[0][0];
    expect(updateArg.title).toBe("New Title");
    expect(updateArg).not.toHaveProperty("body");
    expect(updateArg).not.toHaveProperty("targetRoles");
    expect(updateArg.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("sets publishedAt when status updated to published", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    await handler({
      auth: { uid: callerUid },
      data: { id: "ann-1", tenantId, data: { status: "published" } },
    });

    const updateArg = mockDocUpdate.mock.calls[0][0];
    expect(updateArg.status).toBe("published");
    expect(updateArg.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("sets archivedAt when status updated to archived", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    await handler({
      auth: { uid: callerUid },
      data: { id: "ann-1", tenantId, data: { status: "archived" } },
    });

    const updateArg = mockDocUpdate.mock.calls[0][0];
    expect(updateArg.status).toBe("archived");
    expect(updateArg.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns { id, created: false } on update", async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    const result = await handler({
      auth: { uid: callerUid },
      data: { id: "ann-1", tenantId, data: { title: "Updated" } },
    });

    expect(result).toEqual({ id: "ann-1", created: false });
  });
});
