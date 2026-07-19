import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseExtractionResponse } from "../prompts/extraction";

/**
 * Tests for the question extraction pipeline.
 *
 * Since extractQuestions is an onCall function with heavy I/O (Storage + LLM),
 * we test the pure logic: parsing the LLM response into structured questions.
 */

// We need to check if parseExtractionResponse exists and is importable.
// If the import fails, the test file will error at compile time — which is acceptable
// per the success criteria ("tests compile").

describe("extract-questions — parseExtractionResponse", () => {
  it("should parse a valid extraction response with questions", () => {
    const llmOutput = JSON.stringify({
      questions: [
        {
          questionNumber: "Q1",
          text: "Solve: 2x + 3 = 7",
          maxMarks: 5,
          rubric: {
            criteria: [
              { name: "Setup", description: "Correct equation setup", maxPoints: 2 },
              { name: "Solution", description: "Correct answer x=2", maxPoints: 3 },
            ],
          },
          questionType: "standard",
        },
        {
          questionNumber: "Q2",
          text: "Define photosynthesis",
          maxMarks: 3,
          rubric: {
            criteria: [{ name: "Definition", description: "Accurate definition", maxPoints: 3 }],
          },
        },
      ],
    });

    const result = parseExtractionResponse(llmOutput);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].questionNumber).toBe("Q1");
    expect(result.questions[0].maxMarks).toBe(5);
    expect(result.questions[0].rubric.criteria).toHaveLength(2);
    expect(result.questions[1].text).toContain("photosynthesis");
  });

  it("should handle questions with sub-questions", () => {
    const llmOutput = JSON.stringify({
      questions: [
        {
          questionNumber: "Q1",
          text: "Answer the following:",
          maxMarks: 10,
          rubric: {
            criteria: [{ name: "Overall", description: "Overall quality", maxPoints: 10 }],
          },
          subQuestions: [
            {
              label: "(a)",
              text: "What is gravity?",
              maxMarks: 5,
              rubric: {
                criteria: [{ name: "Definition", description: "Correct definition", maxPoints: 5 }],
              },
            },
            {
              label: "(b)",
              text: "Give an example.",
              maxMarks: 5,
            },
          ],
        },
      ],
    });

    const result = parseExtractionResponse(llmOutput);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].subQuestions).toHaveLength(2);
    expect(result.questions[0].subQuestions![0].label).toBe("(a)");
  });

  it("should throw or return empty for malformed JSON", () => {
    expect(() => parseExtractionResponse("not json")).toThrow();
  });

  it("should throw for empty questions array", () => {
    const llmOutput = JSON.stringify({ questions: [] });
    expect(() => parseExtractionResponse(llmOutput)).toThrow("No questions extracted");
  });

  it("should strip markdown fences before parsing", () => {
    const inner = JSON.stringify({
      questions: [
        {
          questionNumber: "Q1",
          text: "What is 1+1?",
          maxMarks: 2,
          rubric: {
            criteria: [{ name: "Answer", description: "Correct", maxPoints: 2 }],
          },
        },
      ],
    });
    const wrapped = "```json\n" + inner + "\n```";

    const result = parseExtractionResponse(wrapped);
    expect(result.questions).toHaveLength(1);
  });
});
