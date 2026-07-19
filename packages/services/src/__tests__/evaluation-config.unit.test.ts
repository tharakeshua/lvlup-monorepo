/**
 * getEvaluationConfig tests (UI transparency — "show me exactly how this will
 * be graded"). The load-bearing property is ⚷ ROLE REDACTION: a student must
 * never receive rubric.modelAnswer/evaluatorGuidance, dimension promptGuidance,
 * agent systemPrompt/rules/evaluationObjectives, or settings confidenceConfig.
 * Teachers get everything + provenance.
 */
import { describe, it, expect } from "vitest";
import { CALLABLES } from "@levelup/api-contract";
import { getEvaluationConfigService } from "../levelup/evaluation-config";
import { toRubricView } from "../evaluation/config-view";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;

const TS = "2026-01-01T00:00:00.000Z";

const AGENT_DOC: Doc = {
  id: "agent_1",
  spaceId: "space_1",
  tenantId: "tenant_t",
  type: "evaluator",
  name: "Prof. Strict",
  identity: "A rigorous but fair professor",
  isActive: true,
  systemPrompt: "SECRET-SYSTEM-PROMPT",
  rules: ["SECRET-RULE"],
  evaluationObjectives: ["SECRET-OBJECTIVE"],
  strictness: 0.8,
  feedbackStyle: "direct",
  createdAt: TS,
  updatedAt: TS,
  createdBy: "u_t",
  updatedBy: "u_t",
};

const RUBRIC_DOC: Doc = {
  scoringMode: "criteria_based",
  criteria: [{ id: "c1", name: "Depth", maxPoints: 5 }], // legacy maxPoints on purpose
  modelAnswer: "SECRET-MODEL-ANSWER",
  evaluatorGuidance: "SECRET-GUIDANCE",
  holisticGuidance: "SECRET-HOLISTIC-GUIDANCE", // ⚷ G13 — holistic scoring hint, must not leak
  strayAtRestKey: "should be dropped", // must not leak through strict view
};

const SETTINGS_DOC: Doc = {
  id: "evalset_1",
  _kind: "evaluationSettings",
  name: "STEM defaults",
  isDefault: true,
  enabledDimensions: [
    { id: "clarity", name: "Clarity", priority: "HIGH", promptGuidance: "SECRET-DIM-GUIDANCE" },
  ],
  displaySettings: { showStrengths: true, showKeyTakeaway: true, prioritizeByImportance: false },
  confidenceConfig: {
    confidenceThreshold: 0.7,
    autoApproveThreshold: 0.9,
    requireReviewForPartialCredit: true,
  },
  createdAt: TS,
  updatedAt: TS,
};

const ITEM_DOC: Doc = {
  id: "item_1",
  type: "question",
  rubric: RUBRIC_DOC,
  meta: { evaluatorAgentId: "agent_1" },
};

function makeCtx(role: "student" | "teacher"): AuthContext {
  const repos: Record<string, unknown> = {
    items: {
      async get(_t: string, id: string) {
        return id === "item_1" ? ITEM_DOC : null;
      },
    },
    spaces: {
      async get() {
        return { id: "space_1", evaluationSettingsId: "evalset_1" };
      },
    },
    agents: {
      async get(_t: string, id: string) {
        return id === "agent_1" ? AGENT_DOC : null;
      },
    },
    evaluationSettings: {
      async get(_t: string, id: string) {
        return id === "evalset_1" ? SETTINGS_DOC : null;
      },
      async list() {
        return { items: [SETTINGS_DOC], nextCursor: null };
      },
    },
    tenants: {
      async get() {
        return null;
      },
    },
  };
  return {
    uid: "user_1",
    isSuperAdmin: false,
    tenantId: "tenant_t",
    role,
    permissions: {},
    staffPermissions: {},
    classIds: [],
    studentIds: [],
    entityIds: {} as AuthContext["entityIds"],
    now: () => TS,
    repos: repos as unknown as AuthContext["repos"],
    ai: {
      async generate() {
        throw new Error("not used");
      },
    } as unknown as AuthContext["ai"],
  } as AuthContext;
}

const INPUT = { spaceId: "space_1", itemId: "item_1" };

/** The exact response gate makeCallable applies under VALIDATE_RESPONSES. */
function assertResponseValid(res: unknown): void {
  const parsed = (
    CALLABLES["v1.levelup.getEvaluationConfig"] as {
      responseSchema: { safeParse(v: unknown): { success: boolean; error?: unknown } };
    }
  ).responseSchema.safeParse(res);
  expect(parsed.success, JSON.stringify(parsed.error, null, 2)).toBe(true);
}

describe("getEvaluationConfig — ⚷ role redaction", () => {
  it("student view: secrets stripped everywhere, provenance intact, strict-valid", async () => {
    const res = (await getEvaluationConfigService(INPUT as never, makeCtx("student"))) as Doc;
    assertResponseValid(res);
    const config = res["config"] as Doc;

    const agent = config["agent"] as Doc;
    expect(agent["name"]).toBe("Prof. Strict");
    expect(agent["identity"]).toBe("A rigorous but fair professor");
    expect(agent["systemPrompt"]).toBeUndefined();
    expect(agent["rules"]).toBeUndefined();
    expect(agent["evaluationObjectives"]).toBeUndefined();

    const rubric = config["rubric"] as Doc;
    expect(rubric["modelAnswer"]).toBeUndefined();
    expect(rubric["evaluatorGuidance"]).toBeUndefined();
    expect(rubric["holisticGuidance"]).toBeUndefined(); // ⚷ G13
    expect(rubric["strayAtRestKey"]).toBeUndefined();
    // legacy maxPoints canonicalized so the UI renders marks correctly
    expect((rubric["criteria"] as Doc[])[0]!["maxScore"]).toBe(5);

    const settings = config["settings"] as Doc;
    expect(settings["confidenceConfig"]).toBeUndefined();
    expect((settings["enabledDimensions"] as Doc[])[0]!["promptGuidance"]).toBeUndefined();
    expect((settings["enabledDimensions"] as Doc[])[0]!["id"]).toBe("clarity");

    expect(config["provenance"]).toEqual({
      agentSource: "item",
      rubricSource: "item",
      settingsSource: "space",
    });
    // The serialized student payload must not contain ANY secret string.
    const flat = JSON.stringify(res);
    for (const secret of [
      "SECRET-SYSTEM-PROMPT",
      "SECRET-RULE",
      "SECRET-OBJECTIVE",
      "SECRET-MODEL-ANSWER",
      "SECRET-GUIDANCE",
      "SECRET-HOLISTIC-GUIDANCE",
      "SECRET-DIM-GUIDANCE",
    ]) {
      expect(flat).not.toContain(secret);
    }
  });

  it("teacher view: full config incl. secrets + thresholds, strict-valid", async () => {
    const res = (await getEvaluationConfigService(INPUT as never, makeCtx("teacher"))) as Doc;
    assertResponseValid(res);
    const config = res["config"] as Doc;
    expect((config["agent"] as Doc)["systemPrompt"]).toBe("SECRET-SYSTEM-PROMPT");
    expect((config["rubric"] as Doc)["modelAnswer"]).toBe("SECRET-MODEL-ANSWER");
    expect((config["rubric"] as Doc)["holisticGuidance"]).toBe("SECRET-HOLISTIC-GUIDANCE"); // ⚷ G13 — authoring retains

    expect(((config["settings"] as Doc)["confidenceConfig"] as Doc)["confidenceThreshold"]).toBe(
      0.7
    );
    expect(((config["settings"] as Doc)["enabledDimensions"] as Doc[])[0]!["promptGuidance"]).toBe(
      "SECRET-DIM-GUIDANCE"
    );
  });

  it("space-level preview (no itemId): falls back to space/tenant legs", async () => {
    const res = (await getEvaluationConfigService(
      { spaceId: "space_1" } as never,
      makeCtx("teacher")
    )) as Doc;
    assertResponseValid(res);
    const config = res["config"] as Doc;
    expect(config["rubric"]).toBeNull(); // space has no defaultRubric in this fixture
    expect((config["provenance"] as Doc)["settingsSource"]).toBe("space");
  });

  it("missing item → NOT_FOUND", async () => {
    await expect(
      getEvaluationConfigService(
        { spaceId: "space_1", itemId: "nope" } as never,
        makeCtx("teacher")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("toRubricView", () => {
  it("null-safe and whitelists to the strict UnifiedRubric shape", () => {
    expect(toRubricView(null)).toBeNull();
    const v = toRubricView({
      scoringMode: "bogus",
      junk: 1,
      criteria: [{ name: "A", maxScore: 2, extra: true }],
    }) as Doc;
    expect(v["scoringMode"]).toBe("criteria_based");
    expect(v["junk"]).toBeUndefined();
    expect((v["criteria"] as Doc[])[0]).toEqual({ name: "A", maxScore: 2 });
  });
});
