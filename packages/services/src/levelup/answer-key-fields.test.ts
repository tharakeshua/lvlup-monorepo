/**
 * LD-01 — ANSWER_KEY_FIELDS must strip canonical MCQ/jumbled/matching answer
 * fields (`isCorrect`, `correctOrder`, `right`) so learner reads never leak keys.
 */
import { describe, it, expect } from "vitest";
import { stripAnswerFields, extractAnswerKey } from "./content";

describe("LD-01 — stripAnswerFields covers isCorrect/correctOrder/right", () => {
  it("strips isCorrect from nested MCQ options", () => {
    const payload = {
      type: "mcq",
      questionData: {
        options: [
          { id: "a", text: "One", isCorrect: true },
          { id: "b", text: "Two", isCorrect: false },
        ],
      },
    };
    const stripped = stripAnswerFields(payload) as typeof payload;
    expect(stripped.questionData.options[0]).toEqual({ id: "a", text: "One" });
    expect(stripped.questionData.options[1]).toEqual({ id: "b", text: "Two" });
    expect("isCorrect" in stripped.questionData.options[0]).toBe(false);
  });

  it("strips correctOrder from jumbled payloads", () => {
    const payload = {
      type: "jumbled",
      questionData: { items: ["b", "a"], correctOrder: ["a", "b"] },
    };
    const stripped = stripAnswerFields(payload) as Record<string, unknown>;
    const qd = stripped["questionData"] as Record<string, unknown>;
    expect(qd["items"]).toEqual(["b", "a"]);
    expect("correctOrder" in qd).toBe(false);
  });

  it("strips matching pair `right` answers", () => {
    const payload = {
      type: "matching",
      questionData: {
        pairs: [
          { left: "A", right: "1" },
          { left: "B", right: "2" },
        ],
      },
    };
    const stripped = stripAnswerFields(payload) as typeof payload;
    expect(stripped.questionData.pairs[0]).toEqual({ left: "A" });
    expect(stripped.questionData.pairs[1]).toEqual({ left: "B" });
  });

  it("extractAnswerKey collects the same fields for deny-all storage", () => {
    const data = {
      payload: {
        type: "mcq",
        questionData: {
          options: [{ id: "a", text: "One", isCorrect: true }],
          correctOrder: ["a"],
          pairs: [{ left: "L", right: "R" }],
        },
      },
    };
    const ak = extractAnswerKey(data);
    expect(ak).toBeTruthy();
    expect(ak!["isCorrect"]).toBe(true);
    expect(ak!["correctOrder"]).toEqual(["a"]);
    expect(ak!["right"]).toBe("R");
  });
});
