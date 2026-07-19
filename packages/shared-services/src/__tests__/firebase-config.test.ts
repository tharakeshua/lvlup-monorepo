/**
 * Unit tests for firebase/config.ts
 * Mocks the Firebase SDK to test configuration loading and singleton behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Firebase SDK modules
// ---------------------------------------------------------------------------

const mockApp = { name: "[DEFAULT]", options: {} };

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => mockApp),
  getApps: vi.fn(() => []),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({})),
}));

vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
}));

import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirebase,
  getFirebaseServices,
  getFirebaseConfigFromEnv,
  resetFirebaseServices,
  type FirebaseConfig,
} from "../firebase/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validConfig: FirebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "test.firebaseapp.com",
  projectId: "test-project",
  storageBucket: "test.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:abc",
  databaseURL: "https://test-project-default-rtdb.firebaseio.com",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("firebase/config", () => {
  beforeEach(() => {
    resetFirebaseServices();
    vi.clearAllMocks();
    // Reset getApps to return empty by default
    vi.mocked(getApps).mockReturnValue([]);
  });

  // -------------------------------------------------------------------------
  // initializeFirebase
  // -------------------------------------------------------------------------

  describe("initializeFirebase", () => {
    it("initialises Firebase with a valid config and returns services", () => {
      const services = initializeFirebase(validConfig);

      expect(initializeApp).toHaveBeenCalledWith(validConfig);
      expect(services).toHaveProperty("app");
      expect(services).toHaveProperty("auth");
      expect(services).toHaveProperty("db");
      expect(services).toHaveProperty("storage");
      expect(services).toHaveProperty("rtdb");
      expect(services).toHaveProperty("functions");
    });

    it("returns the existing singleton on subsequent calls", () => {
      const first = initializeFirebase(validConfig);
      const second = initializeFirebase(validConfig);

      expect(first).toBe(second);
      // initializeApp should only be called once
      expect(initializeApp).toHaveBeenCalledTimes(1);
    });

    it("reuses an existing Firebase app instead of creating a new one", () => {
      vi.mocked(getApps).mockReturnValue([mockApp as any]);

      const services = initializeFirebase(validConfig);

      expect(initializeApp).not.toHaveBeenCalled();
      expect(services.app).toBe(mockApp);
    });

    it("initialises without databaseURL when not provided", () => {
      const configNoDB: FirebaseConfig = {
        ...validConfig,
        databaseURL: undefined,
      };

      const services = initializeFirebase(configNoDB);
      expect(services).toHaveProperty("rtdb");
    });

    it("falls back to getFirebaseConfigFromEnv when no config is provided", () => {
      // Set the minimum env vars
      process.env["VITE_FIREBASE_API_KEY"] = "env-key";
      process.env["VITE_FIREBASE_AUTH_DOMAIN"] = "env.firebaseapp.com";
      process.env["VITE_FIREBASE_PROJECT_ID"] = "env-project";
      process.env["VITE_FIREBASE_STORAGE_BUCKET"] = "env.appspot.com";
      process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] = "999";
      process.env["VITE_FIREBASE_APP_ID"] = "1:999:web:def";

      const services = initializeFirebase();

      expect(services).toHaveProperty("app");

      // Clean up
      delete process.env["VITE_FIREBASE_API_KEY"];
      delete process.env["VITE_FIREBASE_AUTH_DOMAIN"];
      delete process.env["VITE_FIREBASE_PROJECT_ID"];
      delete process.env["VITE_FIREBASE_STORAGE_BUCKET"];
      delete process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"];
      delete process.env["VITE_FIREBASE_APP_ID"];
    });
  });

  // -------------------------------------------------------------------------
  // getFirebaseServices
  // -------------------------------------------------------------------------

  describe("getFirebaseServices", () => {
    it("returns the singleton after explicit initialisation", () => {
      const init = initializeFirebase(validConfig);
      const services = getFirebaseServices();

      expect(services).toBe(init);
    });

    it("auto-initialises from env when singleton is not yet set", () => {
      process.env["VITE_FIREBASE_API_KEY"] = "env-key";
      process.env["VITE_FIREBASE_AUTH_DOMAIN"] = "env.firebaseapp.com";
      process.env["VITE_FIREBASE_PROJECT_ID"] = "env-project";
      process.env["VITE_FIREBASE_STORAGE_BUCKET"] = "env.appspot.com";
      process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] = "999";
      process.env["VITE_FIREBASE_APP_ID"] = "1:999:web:def";

      const services = getFirebaseServices();
      expect(services).toHaveProperty("app");

      delete process.env["VITE_FIREBASE_API_KEY"];
      delete process.env["VITE_FIREBASE_AUTH_DOMAIN"];
      delete process.env["VITE_FIREBASE_PROJECT_ID"];
      delete process.env["VITE_FIREBASE_STORAGE_BUCKET"];
      delete process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"];
      delete process.env["VITE_FIREBASE_APP_ID"];
    });
  });

  // -------------------------------------------------------------------------
  // getFirebaseConfigFromEnv
  // -------------------------------------------------------------------------

  describe("getFirebaseConfigFromEnv", () => {
    const envKeys = [
      "FIREBASE_API_KEY",
      "FIREBASE_AUTH_DOMAIN",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_STORAGE_BUCKET",
      "FIREBASE_MESSAGING_SENDER_ID",
      "FIREBASE_APP_ID",
    ] as const;

    afterEach(() => {
      // Clear all possible prefixed env vars
      for (const key of envKeys) {
        delete process.env[`VITE_${key}`];
        delete process.env[`NEXT_PUBLIC_${key}`];
        delete process.env[key];
      }
      delete process.env["VITE_FIREBASE_DATABASE_URL"];
      delete process.env["NEXT_PUBLIC_FIREBASE_DATABASE_URL"];
    });

    it("reads VITE_ prefixed environment variables", () => {
      process.env["VITE_FIREBASE_API_KEY"] = "vite-key";
      process.env["VITE_FIREBASE_AUTH_DOMAIN"] = "vite.firebaseapp.com";
      process.env["VITE_FIREBASE_PROJECT_ID"] = "vite-project";
      process.env["VITE_FIREBASE_STORAGE_BUCKET"] = "vite.appspot.com";
      process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] = "111";
      process.env["VITE_FIREBASE_APP_ID"] = "1:111:web:vite";

      const config = getFirebaseConfigFromEnv();

      expect(config.apiKey).toBe("vite-key");
      expect(config.authDomain).toBe("vite.firebaseapp.com");
      expect(config.projectId).toBe("vite-project");
      expect(config.storageBucket).toBe("vite.appspot.com");
      expect(config.messagingSenderId).toBe("111");
      expect(config.appId).toBe("1:111:web:vite");
    });

    it("reads NEXT_PUBLIC_ prefixed environment variables", () => {
      process.env["NEXT_PUBLIC_FIREBASE_API_KEY"] = "next-key";
      process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] = "next.firebaseapp.com";
      process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] = "next-project";
      process.env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] = "next.appspot.com";
      process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] = "222";
      process.env["NEXT_PUBLIC_FIREBASE_APP_ID"] = "1:222:web:next";

      const config = getFirebaseConfigFromEnv();

      expect(config.apiKey).toBe("next-key");
      expect(config.projectId).toBe("next-project");
    });

    it("throws when a required variable is missing", () => {
      // No env vars set at all
      expect(() => getFirebaseConfigFromEnv()).toThrow(/Missing required environment variable/);
    });

    it("infers databaseURL from projectId when not explicitly set", () => {
      process.env["VITE_FIREBASE_API_KEY"] = "key";
      process.env["VITE_FIREBASE_AUTH_DOMAIN"] = "auth.domain";
      process.env["VITE_FIREBASE_PROJECT_ID"] = "my-proj";
      process.env["VITE_FIREBASE_STORAGE_BUCKET"] = "bucket";
      process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] = "333";
      process.env["VITE_FIREBASE_APP_ID"] = "appid";

      const config = getFirebaseConfigFromEnv();

      expect(config.databaseURL).toBe("https://my-proj-default-rtdb.firebaseio.com");
    });

    it("uses explicit VITE_FIREBASE_DATABASE_URL when set", () => {
      process.env["VITE_FIREBASE_API_KEY"] = "key";
      process.env["VITE_FIREBASE_AUTH_DOMAIN"] = "auth.domain";
      process.env["VITE_FIREBASE_PROJECT_ID"] = "my-proj";
      process.env["VITE_FIREBASE_STORAGE_BUCKET"] = "bucket";
      process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] = "333";
      process.env["VITE_FIREBASE_APP_ID"] = "appid";
      process.env["VITE_FIREBASE_DATABASE_URL"] = "https://custom-db.firebaseio.com";

      const config = getFirebaseConfigFromEnv();

      expect(config.databaseURL).toBe("https://custom-db.firebaseio.com");
    });
  });

  // -------------------------------------------------------------------------
  // resetFirebaseServices
  // -------------------------------------------------------------------------

  describe("resetFirebaseServices", () => {
    it("clears the singleton so a fresh initialisation occurs", () => {
      initializeFirebase(validConfig);
      resetFirebaseServices();

      // After reset, initializeApp should be called again
      vi.mocked(getApps).mockReturnValue([]);
      initializeFirebase(validConfig);

      expect(initializeApp).toHaveBeenCalledTimes(2);
    });
  });
});
