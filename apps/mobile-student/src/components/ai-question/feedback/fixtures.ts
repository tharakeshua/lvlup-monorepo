/**
 * Preview fixtures — StoredEvaluation + getEvaluationConfig payloads shaped
 * EXACTLY like the real callable projections (field-for-field with
 * domain/content/stored-evaluation.ts + get-evaluation-config.ts). Content
 * mirrors the design card's moon-phases example so the preview reads 1:1 against
 * feedback-result.card.html. Used by preview.tsx and any component test.
 */
import type { EvaluationConfigInput, StoredEvaluationInput } from "./types";

/** The config the student saw up front — its criteria/dimensions close the loop. */
export const MOON_CONFIG: EvaluationConfigInput = {
  rubric: {
    scoringMode: "hybrid",
    passingPercentage: 60,
    criteria: [
      {
        id: "crit-phases",
        name: "Phases mechanism",
        description: "Explains how the lit half we see changes over the orbit.",
        maxScore: 4,
        levels: [
          { label: "Missing", description: "No mechanism given.", score: 0 },
          { label: "Partial", description: "One extreme named.", score: 2 },
          { label: "Full", description: "Both extremes, correct geometry.", score: 4 },
        ],
      },
      {
        id: "crit-tidal",
        name: "Tidal locking",
        description: "Why the same face points at Earth.",
        maxScore: 4,
        levels: [
          { label: "Missing", score: 0 },
          { label: "Wrong mechanism", description: "Right conclusion, wrong cause.", score: 2 },
          { label: "Correct", description: "Synchronous rotation.", score: 4 },
        ],
      },
      {
        id: "crit-structure",
        name: "Clear structure",
        maxScore: 2,
        levels: [
          { label: "Unclear", score: 0 },
          { label: "Clear", score: 2 },
        ],
      },
    ],
    dimensions: [
      { id: "correctness", name: "Correctness", priority: "HIGH", scoringScale: 10 },
      { id: "clarity", name: "Clarity", priority: "MEDIUM", scoringScale: 10 },
    ],
  },
  settings: {
    enabledDimensions: [
      { id: "correctness", name: "Correctness", priority: "HIGH", scoringScale: 10 },
      { id: "clarity", name: "Clarity", priority: "MEDIUM", scoringScale: 10 },
    ],
  },
};

/** G1 — partial credit, full payload. */
export const PARTIAL_EVALUATION: StoredEvaluationInput = {
  score: 7,
  maxScore: 10,
  correctness: 0.7,
  percentage: 70,
  confidence: 0.92,
  mistakeClassification: "Conceptual",
  summary: {
    keyTakeaway: "Your phases explanation is solid — tidal locking is the piece to firm up.",
    overallComment:
      "You clearly explained how the moon's orbit changes the fraction of the lit half we see, with a correct new-moon / full-moon contrast. The second part conflates “the moon doesn't rotate” with tidal locking — it does rotate, exactly once per orbit.",
  },
  strengths: ["Lit-half geometry explained precisely, with both extremes."],
  weaknesses: ["Distinguish “no rotation” from “synchronous rotation.”"],
  missingConcepts: ["why tidal forces slow a moon's spin over time"],
  rubricBreakdown: [
    {
      criterionId: "crit-phases",
      criterionName: "Phases mechanism",
      score: 4,
      maxScore: 4,
      comment: "Full lit-half geometry, both extremes named.",
    },
    {
      criterionId: "crit-tidal",
      criterionName: "Tidal locking",
      score: 2,
      maxScore: 4,
      comment: "Right conclusion, wrong mechanism — the moon does rotate.",
    },
    { criterionId: "crit-structure", criterionName: "Clear structure", score: 1, maxScore: 2 },
  ],
  structuredFeedback: {
    correctness: [
      {
        severity: "major",
        message:
          "“The moon doesn't spin” is the one factual error — it spins once per orbit, which is exactly why one face points at us.",
        suggestion:
          "Try holding a ball and walking around a chair while keeping the same side facing it — count your turns.",
      },
    ],
    clarity: [
      {
        severity: "minor",
        message:
          "Well ordered. A linking sentence between the two parts would make the structure explicit.",
      },
    ],
  },
};

/** G2 — correct, compact (rubric collapses at full marks). */
export const CORRECT_EVALUATION: StoredEvaluationInput = {
  score: 10,
  maxScore: 10,
  correctness: 1,
  percentage: 100,
  confidence: 0.97,
  mistakeClassification: "None",
  summary: {
    keyTakeaway: "Textbook-clear — you even anticipated the eclipse question.",
    overallComment: "",
  },
  strengths: [
    "Both mechanisms explained with correct causal language.",
    "Used your own diagram to support the geometry.",
  ],
  weaknesses: [],
  missingConcepts: [],
};

/** G3 — not quite yet + low confidence (review banner). */
export const INCORRECT_EVALUATION: StoredEvaluationInput = {
  score: 2,
  maxScore: 10,
  correctness: 0.2,
  percentage: 20,
  confidence: 0.55,
  mistakeClassification: "Knowledge Gap",
  summary: {
    keyTakeaway: "You described eclipses, not phases — closely related, worth untangling.",
    overallComment:
      "The core idea here is geometry, not shadows: phases come from how much of the lit half faces us as the moon orbits.",
  },
  strengths: [],
  weaknesses: ["Separate “eclipse” (Earth's shadow) from “phase” (viewing angle)."],
  missingConcepts: ["what actually causes a lunar phase"],
};

/** Legacy shape check — summary as a bare STRING (old / needs_review rows). */
export const LEGACY_STRING_SUMMARY_EVALUATION: StoredEvaluationInput = {
  score: 6,
  maxScore: 10,
  correctness: 0.6,
  percentage: 60,
  summary: "Solid attempt — tighten the second half and you're there.",
  strengths: ["Clear opening definition."],
  weaknesses: [],
  missingConcepts: [],
};
