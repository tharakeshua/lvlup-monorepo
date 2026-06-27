/**
 * PROMPTS registry — the build-time-known set of prompt templates the AI gateway
 * can run. Consolidates the live `functions/levelup` evaluator/tutor prompts and
 * the `functions/autograde` extraction (panopticon) + grading (relms) prompts
 * into one typed registry (server-shared.md §4.1).
 *
 * `AiRequest.promptKey` is `keyof typeof PROMPTS`, so an unknown prompt key fails
 * `tsc`. Each template renders `{{variable}}` placeholders from
 * `AiRequest.variables`; `requiredVariables` is checked at render time.
 */
import type { JsonValue } from "@levelup/domain";

/** The five AI purposes the platform performs (matches `AiRequest.purpose`). */
export type AiPurpose =
  | "question_extraction"
  | "answer_mapping"
  | "answer_grading"
  | "ai_chat"
  | "insights";

export interface PromptTemplate {
  readonly purpose: AiPurpose;
  /** System instruction sent to the model (stable, never tenant-authored). */
  readonly system: string;
  /** User template with `{{var}}` placeholders. */
  readonly user: string;
  /** Variable names that MUST be present in `AiRequest.variables`. */
  readonly requiredVariables: readonly string[];
  /** Whether this prompt expects structured (JSON) output. */
  readonly structured: boolean;
  /** Default model hint (overridable per request). */
  readonly defaultModel: string;
  /** Default sampling temperature. */
  readonly defaultTemperature: number;
}

const def = <T extends PromptTemplate>(t: T): T => t;

export const PROMPTS = {
  /** Panopticon stage 1 — extract questions + rubric from a question paper. */
  questionExtraction: def({
    purpose: "question_extraction",
    system:
      "You are an exam-paper extraction engine. Read the provided question-paper " +
      "images and emit a structured list of questions with marks and a per-question " +
      "rubric. Never invent questions; preserve numbering and sub-parts.",
    user:
      "Exam title: {{examTitle}}\nExam type: {{examType}}\n" +
      "Extract every question. For each: text, maxMarks, order, and a criteria-based " +
      "rubric whose criteria marks sum to maxMarks.",
    requiredVariables: ["examTitle", "examType"],
    structured: true,
    defaultModel: "gemini-1.5-pro",
    defaultTemperature: 0,
  }),

  /** Panopticon stage 2 — map a scanned answer sheet to question regions. */
  answerMapping: def({
    purpose: "answer_mapping",
    system:
      "You are an answer-sheet scout. Given answer-sheet images and the known " +
      "question list, locate each answer and report which question it belongs to, " +
      "with a readability/confidence assessment.",
    user:
      "Questions: {{questions}}\nMap each detected answer region to a questionId. " +
      "Flag unreadable or missing answers.",
    requiredVariables: ["questions"],
    structured: true,
    defaultModel: "gemini-1.5-flash",
    defaultTemperature: 0,
  }),

  /** RELMS — grade a single answer against its resolved rubric. */
  answerGrading: def({
    purpose: "answer_grading",
    system:
      "You are a rigorous, fair grader. Score the student answer ONLY against the " +
      "provided rubric. Output score, per-criterion breakdown, strengths, " +
      "weaknesses, missing concepts, and a confidence value in [0,1]. Never exceed " +
      "maxMarks. Be consistent and explain each deduction.",
    user:
      "Question: {{question}}\nMax marks: {{maxMarks}}\nRubric: {{rubric}}\n" +
      "Student answer: {{answer}}\nGrade strictly per the rubric.",
    requiredVariables: ["question", "maxMarks", "rubric", "answer"],
    structured: true,
    defaultModel: "gemini-1.5-pro",
    defaultTemperature: 0,
  }),

  /** Tutor chat — conversational help inside a story-point item. */
  aiChat: def({
    purpose: "ai_chat",
    system:
      "You are a patient learning tutor scoped to one practice item. Help the " +
      "learner reason toward the answer with hints and questions. NEVER reveal the " +
      "model answer, the rubric, or the grading guidance verbatim. Keep replies " +
      "concise and encouraging.",
    user:
      "Item context: {{itemContext}}\nConversation so far: {{history}}\n" +
      "Learner says: {{message}}\nRespond as the tutor in {{language}}.",
    requiredVariables: ["itemContext", "message", "language"],
    structured: false,
    defaultModel: "gemini-1.5-flash",
    defaultTemperature: 0.6,
  }),

  /** Learning-insight generation from a student's progress summary. */
  insights: def({
    purpose: "insights",
    system:
      "You generate short, actionable learning insights for a single student from " +
      "their performance summary. Be specific and supportive; cite the weak areas.",
    user:
      "Student summary: {{summary}}\nProduce up to {{maxInsights}} insights with a " +
      "title, body, and severity.",
    requiredVariables: ["summary", "maxInsights"],
    structured: true,
    defaultModel: "gemini-1.5-flash",
    defaultTemperature: 0.3,
  }),
} as const satisfies Record<string, PromptTemplate>;

export type PromptKey = keyof typeof PROMPTS;
export const PROMPT_KEYS = Object.keys(PROMPTS) as PromptKey[];

/** Render a prompt template's user string against the supplied variables. */
export function renderPrompt(
  key: PromptKey,
  variables: Record<string, JsonValue>
): { system: string; user: string; template: PromptTemplate } {
  const template = PROMPTS[key];
  for (const req of template.requiredVariables) {
    if (variables[req] === undefined || variables[req] === null) {
      throw new Error(`Prompt "${key}" missing required variable "${req}"`);
    }
  }
  const user = template.user.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
    const v = variables[name];
    if (v === undefined) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
  return { system: template.system, user, template };
}
