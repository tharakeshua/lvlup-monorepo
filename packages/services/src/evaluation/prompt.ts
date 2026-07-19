/**
 * Evaluation prompt composition (AI-EVALUATION-CORE-PLAN.md D8 — ported from the
 * legacy `functions/levelup/src/prompts/evaluator.ts` and extended with the
 * evaluation-settings dimension block). Produces the ONE `evaluationPrompt`
 * variable the `unifiedEvaluation` registry template renders; the output
 * structure itself is enforced by the per-call responseSchema, not prose.
 *
 * ⚷ This prompt legitimately embeds rubric.modelAnswer / evaluatorGuidance /
 * dimension promptGuidance — it exists ONLY server-side and must never be
 * returned to a client.
 */
import type { Doc, EvaluationRequest, TranscriptTurn } from "./types.js";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** criteria.maxScore is canonical (UnifiedRubricSchema); legacy docs carried maxPoints. */
function criterionMax(c: Doc): number {
  return num(c["maxScore"]) ?? num(c["maxPoints"]) ?? 0;
}

function personaBlock(agent: Doc | null | undefined): string {
  if (!agent) return "";
  let out = "";
  const identity = str(agent["identity"]) || str(agent["name"]);
  if (identity) out += `EVALUATOR IDENTITY:\n${identity}\n`;
  const rules = arr(agent["rules"]).map(String).filter(Boolean);
  if (rules.length) out += `GRADING RULES:\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
  const objectives = arr(agent["evaluationObjectives"]).map(String).filter(Boolean);
  if (objectives.length)
    out += `EVALUATION OBJECTIVES:\n${objectives.map((o) => `- ${o}`).join("\n")}\n`;
  const strictness = num(agent["strictness"]);
  if (strictness !== undefined) out += `STRICTNESS (0 lenient … 1 strict): ${strictness}\n`;
  const style = str(agent["feedbackStyle"]);
  if (style) out += `FEEDBACK STYLE: ${style}\n`;
  return out ? out + "\n" : "";
}

function rubricBlock(rubric: Doc | null | undefined): string {
  if (!rubric) return "";
  const mode = str(rubric["scoringMode"]);
  const criteria = arr(rubric["criteria"]) as Doc[];
  const dimensions = arr(rubric["dimensions"]) as Doc[];
  let out = "";

  if ((mode === "criteria_based" || mode === "hybrid" || mode === "") && criteria.length) {
    out +=
      "GRADING RUBRIC (score each criterion separately):\n" +
      criteria
        .map((c) => {
          const id = str(c["id"]);
          const name = str(c["name"]);
          const desc = str(c["description"]);
          return `- ${id ? `[${id}] ` : ""}${name} (${criterionMax(c)} marks)${desc ? `: ${desc}` : ""}`;
        })
        .join("\n") +
      "\n";
  }
  if ((mode === "dimension_based" || mode === "hybrid") && dimensions.length) {
    out +=
      "RUBRIC DIMENSIONS (rate each):\n" +
      dimensions
        .map((d) => {
          const scale = num(d["scoringScale"]) ?? 10;
          const weight = num(d["weight"]);
          return `- ${str(d["name"])} (scale 1-${scale}${weight !== undefined ? `, weight ${weight}` : ""})${str(d["description"]) ? `: ${str(d["description"])}` : ""}`;
        })
        .join("\n") +
      "\n";
  }
  if (mode === "holistic") {
    out += `HOLISTIC EVALUATION:\n${str(rubric["holisticGuidance"])}\nMax score: ${num(rubric["holisticMaxScore"]) ?? 10}\n`;
  }

  // ⚷ grading secrets — server-side only.
  const modelAnswer = str(rubric["modelAnswer"]);
  if (modelAnswer)
    out += `\nMODEL ANSWER (reference — alternative valid solutions are acceptable):\n${modelAnswer}\n`;
  const guidance = str(rubric["evaluatorGuidance"]);
  if (guidance) out += `\nEVALUATOR GUIDANCE:\n${guidance}\n`;

  return out ? out + "\n" : "";
}

function dimensionsBlock(settings: Doc | null | undefined): string {
  const dims = arr(settings?.["enabledDimensions"]) as Doc[];
  if (!dims.length) return "";
  return (
    "FEEDBACK DIMENSIONS — for EACH dimension below, provide feedback items under " +
    "its id in `structuredFeedback` (empty array when nothing notable):\n" +
    dims
      .map((d) => {
        const parts = [
          `- ${str(d["id"])} — ${str(d["name"])}`,
          str(d["description"]),
          str(d["priority"]) ? `priority: ${str(d["priority"])}` : "",
          // ⚷ authoring-only guidance.
          str(d["promptGuidance"]) ? `guidance: ${str(d["promptGuidance"])}` : "",
        ].filter(Boolean);
        return parts.join(" | ");
      })
      .join("\n") +
    "\n\n"
  );
}

function questionBlock(req: EvaluationRequest): string {
  const q = req.question;
  const t = q.typeData ?? {};
  let out = `QUESTION TYPE: ${q.questionType}\nQUESTION:\n${q.text}\n\n`;

  if (q.questionType === "code") {
    const language = str(t["language"]);
    if (language) out += `LANGUAGE: ${language}\n`;
    const starter = str(t["starterCode"]);
    if (starter) out += `STARTER CODE PROVIDED:\n\`\`\`\n${starter}\n\`\`\`\n`;
    const cases = arr(t["testCases"]) as Doc[];
    if (cases.length) {
      out +=
        "TEST CASES:\n" +
        cases
          .map(
            (tc) =>
              `- Input: ${str(tc["input"])} → Expected: ${str(tc["expectedOutput"])}${str(tc["description"]) ? ` (${str(tc["description"])})` : ""}`
          )
          .join("\n") +
        "\n";
    }
    out += "Evaluate: correctness, code quality, edge-case handling, efficiency.\n\n";
  } else {
    const correct = str(t["correctAnswer"]);
    if (correct) out += `EXPECTED ANSWER: ${correct}\n`;
    const acceptable = arr(t["acceptableAnswers"]).map(String).filter(Boolean);
    if (acceptable.length) out += `ALSO ACCEPTABLE: ${acceptable.join(", ")}\n`;
    const objectives = arr(t["objectives"]).map(String).filter(Boolean);
    if (objectives.length)
      out += `LEARNING OBJECTIVES the student should demonstrate:\n${objectives.map((o) => `- ${o}`).join("\n")}\n`;
    if (correct || acceptable.length || objectives.length) out += "\n";
  }
  return out;
}

function transcriptText(transcript: TranscriptTurn[]): string {
  return transcript
    .map((turn) => `${turn.role === "user" ? "STUDENT" : "AGENT"}: ${turn.content}`)
    .join("\n");
}

function answerBlock(req: EvaluationRequest): string {
  const a = req.answer;
  let out = "";
  // Grader-directed context (never student content — stays OUTSIDE the tags).
  if (a.note) out += `${a.note}\n`;
  if (a.transcript?.length) {
    out +=
      "The student completed a guided conversation with a learning agent. " +
      "Evaluate how well the STUDENT turns demonstrate understanding (the agent " +
      "turns are context, not the student's work).\n" +
      `CONVERSATION:\n<student_answer>\n${transcriptText(a.transcript)}\n</student_answer>\n\n`;
    const mediaCount = a.media?.length ?? 0;
    if (mediaCount > 0) {
      out +=
        "Stable [image: …] placeholders in the conversation correspond, in encounter order, " +
        `to ${mediaCount} attached image(s). Consider those attachments as part of the learner's ` +
        "evidence; do not infer image content not present in the attachments.\n\n";
    }
    const obs = a.observations ?? [];
    if (obs.length) {
      out +=
        "AGENT OBSERVATIONS recorded during the conversation (evidence per dimension — verify against the transcript):\n" +
        obs
          .map(
            (o) =>
              `- [${o.dimensionId}] ${o.evidence}${o.provisionalScore !== undefined ? ` (provisional: ${o.provisionalScore})` : ""}`
          )
          .join("\n") +
        "\n\n";
    }
    return out;
  }

  const mediaCount = a.media?.length ?? 0;
  const text = a.text?.trim() ?? "";
  if (text) {
    out += `STUDENT'S ANSWER:\n<student_answer>\n${text}\n</student_answer>\n`;
    if (mediaCount > 0)
      out += `(The student also attached ${mediaCount} media file(s) — consider the attached image/audio as part of the answer.)\n`;
  } else if (mediaCount > 0) {
    out +=
      "STUDENT'S ANSWER: provided ONLY as the attached media file(s) — grade what is in the attached image/audio.\n";
  } else {
    out += "STUDENT'S ANSWER:\n<student_answer>\n(no answer provided)\n</student_answer>\n";
  }
  return out + "\n";
}

/** Compose the full evaluation prompt (the `evaluationPrompt` template variable). */
export function buildEvaluationPrompt(req: EvaluationRequest): string {
  let prompt = personaBlock(req.agent);
  prompt += questionBlock(req);
  prompt += answerBlock(req);
  prompt += rubricBlock(req.rubric);
  prompt += dimensionsBlock(req.settings);
  prompt +=
    "SCORING:\n" +
    `- Maximum score: ${req.question.maxScore}\n` +
    "- Award partial credit where earned; accept alternative valid solutions.\n" +
    "- Be fair and consistent; explain every deduction.\n" +
    "- Set `confidence` to how certain you are of this evaluation (0-1); use low " +
    "confidence when the answer is unreadable, ambiguous, or off-format.\n";
  return prompt;
}
