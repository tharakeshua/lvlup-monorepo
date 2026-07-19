import { describe, expect, it } from "vitest";
import { getCallable } from "../index.js";

describe("v1.autograde.listQuestions response contract", () => {
  it("accepts canonical extracted question rows without createdAt", () => {
    const def = getCallable("v1.autograde.listQuestions");

    const parsed = def.responseSchema.safeParse({
      questions: [
        {
          id: "xRfMJeA0LlxmADcRT48C_q1",
          examId: "xRfMJeA0LlxmADcRT48C",
          text: "Find the values of a, b.",
          maxMarks: 2,
          order: 1,
          rubric: {
            scoringMode: "criteria_based",
            criteria: [
              {
                id: "c1",
                name: "Values of a and b",
                maxScore: 1,
                description: "Correctly identifies the values.",
              },
            ],
          },
          questionType: "short_answer",
          extractionConfidence: 0.98,
          readabilityIssue: false,
          rubricStatus: "generated",
          updatedAt: "2026-07-18T14:33:26.127Z",
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});
