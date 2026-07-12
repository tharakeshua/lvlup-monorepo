/**
 * registry-completeness (SDK-LAYERS-PLAN.md §3.1–§3.2 / api-contract-core.md
 * §3.2 + §10.2 / MERGE-C9-ORPHANED).
 *
 * Complements registry-integrity.test.ts (which owns the fixture gate). This file
 * locks the registry's STRUCTURAL completeness and the inventory equivalence:
 *
 *   (A) Per-def integrity: every CallableName resolves a def carrying a request
 *       schema, a response schema, a valid `module`, a valid `rateTier`, and a
 *       valid `authMode`. `def.name === key`. The `<module>` name-segment equals
 *       `def.module` (with the documented gamification/notification folds).
 *   (B) CALLABLES ≡ common-api.md §3.3 inventory in BOTH directions — the
 *       drift-cannot-recur invariant (§3.2 MERGE-C9-ORPHANED). The §3.3 carried-
 *       forward inventory must all resolve; every callable must trace to an
 *       allowed module. This MUST NOT be vacuously green: a planted self-check
 *       proves the inventory list is non-empty and the two-direction diff fires.
 *   (C) rateTier coverage: every def's rateTier ∈ RATE_TIERS and AI/report/write
 *       callables carry the right tier where the plan pins it.
 *   (D) idempotency def-hint invariant (§3.1 MERGE-IDEMPOTENCY): no request schema
 *       declares a literal `idempotencyKey` field (the UUIDv7 rides the envelope;
 *       the domain key is a def hint) — at most the one documented carve-out.
 *
 * Self-skips until the contract surfaces CALLABLES (parallel impl).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as contract from "../index";
import { collectKeys } from "./no-tenant-id-in-request.test";

type Def = {
  name?: string;
  module?: string;
  requestSchema?: z.ZodTypeAny;
  responseSchema?: z.ZodTypeAny;
  authMode?: string;
  rateTier?: string;
  idempotent?: boolean;
};

const C = contract as unknown as {
  CALLABLES?: Record<string, Def>;
  CALLABLE_NAMES?: string[];
  RATE_TIERS?: readonly string[];
  API_MODULES?: readonly string[];
  parseCallableName?: (n: string) => { version: string; module: string; op: string } | null;
  API_VERSION?: string;
};

const RATE_TIERS = ["write", "read", "ai", "auth", "report"];
const MODULES = ["identity", "levelup", "autograde", "analytics"];

/**
 * The common-api.md §3.3 carried-forward inventory, as fully-qualified names.
 * Folds in the §3.2 ~90-callable registry (incl. C1–C31 and gamification). Each
 * MUST resolve in CALLABLES. (Names the master plan adds beyond §3.3 are allowed
 * in CALLABLES; the §3.3 set is the required floor.)
 */
const COMMON_API_INVENTORY: string[] = [
  // identity
  "v1.identity.saveTenant",
  "v1.identity.deactivateTenant",
  "v1.identity.reactivateTenant",
  "v1.identity.exportTenantData",
  "v1.identity.uploadTenantAsset",
  "v1.identity.saveStudent",
  "v1.identity.saveTeacher",
  "v1.identity.saveParent",
  "v1.identity.saveStaff",
  "v1.identity.saveClass",
  "v1.identity.saveAcademicSession",
  "v1.identity.createOrgUser",
  "v1.identity.switchActiveTenant",
  "v1.identity.joinTenant",
  "v1.identity.bulkImportStudents",
  "v1.identity.bulkImportTeachers",
  "v1.identity.bulkUpdateStatus",
  "v1.identity.rolloverSession",
  "v1.identity.saveAnnouncement",
  "v1.identity.listAnnouncements",
  "v1.identity.searchUsers",
  "v1.identity.saveGlobalEvaluationPreset",
  "v1.identity.lookupTenantByCode",
  "v1.identity.getMe",
  "v1.identity.getTenant",
  "v1.identity.listTenants",
  "v1.identity.listStudents",
  "v1.identity.getStudent",
  "v1.identity.listTeachers",
  "v1.identity.getTeacher",
  "v1.identity.listParents",
  "v1.identity.listStaff",
  "v1.identity.listClasses",
  "v1.identity.getClass",
  "v1.identity.listAcademicSessions",
  "v1.identity.listNotifications",
  "v1.identity.getNotificationBadge",
  "v1.identity.markNotificationRead",
  "v1.identity.getNotificationPreferences",
  "v1.identity.saveNotificationPreferences",
  "v1.identity.markAnnouncementRead",
  // levelup (content + testsession + gamification folded)
  "v1.levelup.saveSpace",
  "v1.levelup.duplicateSpace",
  "v1.levelup.saveStoryPoint",
  "v1.levelup.saveItem",
  "v1.levelup.getItemForEdit",
  "v1.levelup.listVersions",
  "v1.levelup.startTestSession",
  "v1.levelup.submitTestSession",
  "v1.levelup.evaluateAnswer",
  "v1.levelup.recordItemAttempt",
  "v1.levelup.saveQuestionBankItem",
  "v1.levelup.listQuestionBank",
  "v1.levelup.importFromBank",
  "v1.levelup.saveRubricPreset",
  "v1.levelup.listRubricPresets",
  "v1.levelup.saveAgent",
  "v1.levelup.listAgents",
  "v1.levelup.sendChatMessage",
  "v1.levelup.getChatSession",
  "v1.levelup.listChatSessions",
  "v1.levelup.saveSpaceReview",
  "v1.levelup.listSpaceReviews",
  "v1.levelup.listStoreSpaces",
  "v1.levelup.getStoreSpace",
  "v1.levelup.purchaseSpace",
  "v1.levelup.listSpaces",
  "v1.levelup.getSpace",
  "v1.levelup.listStoryPoints",
  "v1.levelup.listItems",
  "v1.levelup.getSpaceProgress",
  "v1.levelup.getStoryPointProgress",
  "v1.levelup.getTestSession",
  "v1.levelup.listTestSessions",
  "v1.levelup.getLeaderboard",
  "v1.levelup.getStudentLevel",
  "v1.levelup.getGamificationSummary",
  "v1.levelup.listAchievements",
  "v1.levelup.listStudentAchievements",
  "v1.levelup.markAchievementsSeen",
  "v1.levelup.saveAchievementDefinition",
  "v1.levelup.listLearningInsights",
  "v1.levelup.dismissInsight",
  "v1.levelup.listStudyGoals",
  "v1.levelup.saveStudyGoal",
  "v1.levelup.listStudySessions",
  // autograde
  "v1.autograde.saveExam",
  "v1.autograde.extractQuestions",
  "v1.autograde.uploadAnswerSheets",
  "v1.autograde.gradeQuestion",
  "v1.autograde.releaseResults",
  "v1.autograde.saveEvaluationSettings",
  "v1.autograde.listEvaluationSettings",
  "v1.autograde.listExams",
  "v1.autograde.getExam",
  "v1.autograde.listSubmissions",
  "v1.autograde.getSubmission",
  "v1.autograde.listQuestionSubmissions",
  "v1.autograde.listQuestions",
  "v1.autograde.getExamAnalytics",
  "v1.autograde.listDeadLetter",
  "v1.autograde.resolveDeadLetter",
  // analytics
  "v1.analytics.getSummary",
  "v1.analytics.generateReport",
  "v1.analytics.getPerformanceTrends",
  "v1.analytics.getChildSummary",
  "v1.analytics.listLinkedChildren",
  "v1.analytics.getExamAnalytics",
  "v1.analytics.getCostSummary",
  "v1.analytics.listInsights",
  "v1.analytics.dismissInsight",
  "v1.analytics.getLeaderboard",
];

/** AI-tier callables the plan pins (extract/grade/evaluate/chat/generate). */
const EXPECTED_AI_TIER = [
  "v1.levelup.evaluateAnswer",
  "v1.levelup.sendChatMessage",
  "v1.autograde.extractQuestions",
  "v1.autograde.gradeQuestion",
  "v1.autograde.uploadAnswerSheets",
];

/** Report-tier callables the plan pins. */
const EXPECTED_REPORT_TIER = ["v1.analytics.generateReport"];

const ready = Boolean(C.CALLABLES && C.CALLABLE_NAMES);
const d = ready ? describe : describe.skip;

// ---- guard against a vacuously-green inventory test (this runs ALWAYS) ----
describe("registry-completeness inventory self-check (non-vacuous)", () => {
  it("the common-api §3.3 inventory list is substantial (>=100 names)", () => {
    expect(COMMON_API_INVENTORY.length).toBeGreaterThanOrEqual(100);
  });
  it("the inventory list has no duplicates", () => {
    expect(new Set(COMMON_API_INVENTORY).size).toBe(COMMON_API_INVENTORY.length);
  });
  it("every inventory name is a well-formed v1.<module>.<op>", () => {
    const bad = COMMON_API_INVENTORY.filter(
      (n) => !/^v1\.(identity|levelup|autograde|analytics)\.[A-Za-z]+$/.test(n)
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
});

d("(A) per-def structural integrity (§10.2)", () => {
  const CALLABLES = C.CALLABLES!;

  it("every def has name===key, request+response schema, module, rateTier, authMode", () => {
    const problems: string[] = [];
    for (const [key, def] of Object.entries(CALLABLES)) {
      if (def.name !== key) problems.push(`${key}: name !== key (${def.name})`);
      if (!def.requestSchema) problems.push(`${key}: missing requestSchema`);
      if (!def.responseSchema) problems.push(`${key}: missing responseSchema`);
      if (!def.module || !MODULES.includes(def.module))
        problems.push(`${key}: bad module ${def.module}`);
      if (!def.rateTier || !RATE_TIERS.includes(def.rateTier))
        problems.push(`${key}: bad rateTier ${def.rateTier}`);
      if (def.authMode !== "authed" && def.authMode !== "public")
        problems.push(`${key}: bad authMode ${def.authMode}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("request and response schemas are Zod schemas (have safeParse)", () => {
    const bad: string[] = [];
    for (const [key, def] of Object.entries(CALLABLES)) {
      if (typeof (def.requestSchema as { safeParse?: unknown })?.safeParse !== "function")
        bad.push(`${key}: requestSchema not a Zod schema`);
      if (typeof (def.responseSchema as { safeParse?: unknown })?.safeParse !== "function")
        bad.push(`${key}: responseSchema not a Zod schema`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("name <module> segment === def.module (with gamification/notification folds)", () => {
    const bad: string[] = [];
    for (const [key, def] of Object.entries(CALLABLES)) {
      const parsed = C.parseCallableName?.(key) ?? null;
      if (!parsed) {
        bad.push(`${key}: unparseable name`);
        continue;
      }
      if (parsed.version !== (C.API_VERSION ?? "v1"))
        bad.push(`${key}: version !== ${C.API_VERSION ?? "v1"}`);
      // notification name-segment folds onto identity; gamification name-segments
      // are authored under levelup/analytics. Otherwise segment === module.
      const segMatches =
        parsed.module === def.module ||
        parsed.module === "notification" ||
        ["levelup", "analytics"].includes(def.module ?? "");
      if (!segMatches) bad.push(`${key}: segment ${parsed.module} !== module ${def.module}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("exactly one public callable, and it is lookupTenantByCode", () => {
    const publics = Object.entries(CALLABLES)
      .filter(([, def]) => def.authMode === "public")
      .map(([k]) => k);
    expect(publics.length).toBeLessThanOrEqual(1);
    if (publics.length === 1) expect(publics[0]).toBe("v1.identity.lookupTenantByCode");
  });
});

d("(B) CALLABLES ≡ common-api §3.3 inventory — both directions (§3.2)", () => {
  const CALLABLES = C.CALLABLES!;

  it("every §3.3 inventory callable resolves in CALLABLES", () => {
    const missing = COMMON_API_INVENTORY.filter((n) => !CALLABLES[n]);
    expect(missing, `inventory callables not in CALLABLES:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every CALLABLES name traces to one of the four modules (closed set)", () => {
    const stray = Object.keys(CALLABLES).filter((n) => {
      const parsed = C.parseCallableName?.(n);
      return !parsed || (!MODULES.includes(parsed.module) && parsed.module !== "notification");
    });
    expect(stray, `callables outside the closed module set:\n${stray.join("\n")}`).toEqual([]);
  });

  it("CALLABLE_NAMES === Object.keys(CALLABLES) (no desync)", () => {
    expect([...C.CALLABLE_NAMES!].sort()).toEqual(Object.keys(CALLABLES).sort());
  });
});

d("(C) rateTier coverage (§9)", () => {
  const CALLABLES = C.CALLABLES!;

  it("every def.rateTier ∈ RATE_TIERS", () => {
    const tiers = new Set(C.RATE_TIERS ?? RATE_TIERS);
    const bad = Object.entries(CALLABLES).filter(([, d2]) => !tiers.has(d2.rateTier ?? ""));
    expect(
      bad.map(([k]) => k),
      bad.map(([k]) => k).join("\n")
    ).toEqual([]);
  });

  it('AI callables carry rateTier "ai" where the plan pins it', () => {
    const bad = EXPECTED_AI_TIER.filter((n) => CALLABLES[n] && CALLABLES[n].rateTier !== "ai");
    expect(bad, `expected ai tier:\n${bad.join("\n")}`).toEqual([]);
  });

  it('report callables carry rateTier "report"', () => {
    const bad = EXPECTED_REPORT_TIER.filter(
      (n) => CALLABLES[n] && CALLABLES[n].rateTier !== "report"
    );
    expect(bad, `expected report tier:\n${bad.join("\n")}`).toEqual([]);
  });

  it("read callables (list*/get*) are not on a write/ai/report tier (sampled)", () => {
    const reads = ["v1.levelup.listSpaces", "v1.identity.getMe", "v1.autograde.listExams"];
    for (const n of reads) {
      if (CALLABLES[n])
        expect(["read"], `${n} should be read tier`).toContain(CALLABLES[n].rateTier);
    }
  });
});

d("(D) idempotency def-hint invariant (§3.1 MERGE-IDEMPOTENCY)", () => {
  const CALLABLES = C.CALLABLES!;

  it("no request schema declares a literal idempotencyKey field (≤1 carve-out)", () => {
    const offenders: string[] = [];
    for (const [name, def] of Object.entries(CALLABLES)) {
      if (def.requestSchema && collectKeys(def.requestSchema).has("idempotencyKey"))
        offenders.push(name);
    }
    // recordItemAttempt is the one documented carve-out (§3.2).
    expect(
      offenders.length,
      `idempotencyKey in request:\n${offenders.join("\n")}`
    ).toBeLessThanOrEqual(1);
  });

  it("the canonical idempotent callables are flagged idempotent:true", () => {
    const canonicalIdem = [
      "v1.levelup.submitTestSession",
      "v1.levelup.evaluateAnswer",
      "v1.levelup.recordItemAttempt",
      "v1.levelup.purchaseSpace",
      "v1.identity.createOrgUser",
      "v1.identity.bulkImportStudents",
    ];
    const notFlagged = canonicalIdem.filter((n) => CALLABLES[n] && !CALLABLES[n].idempotent);
    expect(notFlagged, `expected idempotent:true:\n${notFlagged.join("\n")}`).toEqual([]);
  });
});
