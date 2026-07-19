import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  collectionPrefix,
  topLevelCollection,
  identityCollectionCandidates,
} from "../firebase/collection-prefix";

const KEYS = [
  "VITE_LVLUP_COLLECTION_PREFIX",
  "NEXT_PUBLIC_LVLUP_COLLECTION_PREFIX",
  "LVLUP_COLLECTION_PREFIX",
  "VITE_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
] as const;

describe("collection-prefix (client)", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults empty when no env / non-prod project", () => {
    expect(collectionPrefix()).toBe("");
    expect(topLevelCollection("userMemberships")).toBe("userMemberships");
  });

  it("defaults v2_ for lvlup-ff6fa project", () => {
    process.env["VITE_FIREBASE_PROJECT_ID"] = "lvlup-ff6fa";
    expect(collectionPrefix()).toBe("v2_");
    expect(topLevelCollection("userMemberships")).toBe("v2_userMemberships");
  });

  it("explicit prefix wins over project default", () => {
    process.env["VITE_FIREBASE_PROJECT_ID"] = "lvlup-ff6fa";
    process.env["VITE_LVLUP_COLLECTION_PREFIX"] = "";
    expect(collectionPrefix()).toBe("");
  });

  it("identityCollectionCandidates prefers prefixed then v2_ then bare", () => {
    process.env["LVLUP_COLLECTION_PREFIX"] = "v2_";
    expect(identityCollectionCandidates("userMemberships")).toEqual([
      "v2_userMemberships",
      "userMemberships",
    ]);
  });
});
