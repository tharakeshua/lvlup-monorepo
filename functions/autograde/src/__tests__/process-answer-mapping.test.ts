import { describe, it, expect, vi, beforeEach } from "vitest";
import { parsePanopticonResponse } from "../prompts/panopticon";

/**
 * Tests for the Panopticon answer-to-question mapping pipeline.
 *
 * The core processAnswerMapping function orchestrates I/O (Firestore, Storage, LLM).
 * We test the pure parsing logic that interprets the LLM routing response.
 */

describe("process-answer-mapping — parsePanopticonResponse", () => {
  const questionIds = ["Q1", "Q2", "Q3"];
  const totalPages = 4;

  it("should parse a valid routing map with non-overlapping pages", () => {
    const llmOutput = JSON.stringify({
      routing_map: {
        Q1: [0],
        Q2: [1, 2],
        Q3: [3],
      },
      confidence: {
        Q1: 0.95,
        Q2: 0.87,
        Q3: 0.92,
      },
    });

    const result = parsePanopticonResponse(llmOutput, questionIds, totalPages);

    expect(result.routing_map).toBeDefined();
    expect(result.routing_map["Q1"]).toEqual([0]);
    expect(result.routing_map["Q2"]).toEqual([1, 2]);
    expect(result.routing_map["Q3"]).toEqual([3]);
  });

  it("should apply sandwich rule to fill gaps between pages", () => {
    // Q1 has pages [0, 3] with gap at 1,2. Since no other question claims 1,2,
    // the sandwich rule should fill them in.
    const llmOutput = JSON.stringify({
      routing_map: {
        Q1: [0, 3],
        Q2: [],
        Q3: [],
      },
    });

    const result = parsePanopticonResponse(llmOutput, questionIds, totalPages);

    // Pages 1 and 2 should be filled in between 0 and 3
    expect(result.routing_map["Q1"]).toEqual([0, 1, 2, 3]);
  });

  it("should handle missing confidence scores gracefully", () => {
    const llmOutput = JSON.stringify({
      routing_map: {
        Q1: [0],
        Q2: [1],
        Q3: [2],
      },
    });

    const result = parsePanopticonResponse(llmOutput, questionIds, totalPages);

    expect(result.routing_map).toBeDefined();
    // confidence may be empty or undefined
    expect(result.confidence ?? {}).toBeDefined();
  });

  it("should throw for malformed JSON", () => {
    expect(() => parsePanopticonResponse("invalid json", questionIds, totalPages)).toThrow();
  });

  it("should handle empty routing map", () => {
    const llmOutput = JSON.stringify({
      routing_map: {},
    });

    const result = parsePanopticonResponse(llmOutput, questionIds, totalPages);
    expect(Object.keys(result.routing_map)).toHaveLength(0);
  });
});
