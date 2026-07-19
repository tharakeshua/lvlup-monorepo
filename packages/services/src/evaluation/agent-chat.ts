/**
 * Chat-agent question support (AI-EVALUATION-CORE-PLAN.md Phase 4 / D6): the
 * persona-driven conversational turn. Composes the ONE `agentPrompt` variable
 * the `agentChat` registry template renders, declares the agent's tools
 * (`record_observation` / `end_conversation`), and parses the tool calls the
 * model returns into typed observations / end signals.
 *
 * ⚷ The composed prompt embeds the persona system prompt, question objectives,
 * and dimension guidance — server-side only, never returned to a client.
 */
import type { AgentObservation, Doc, TranscriptTurn } from "./types.js";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const RECORD_OBSERVATION_TOOL = "record_observation";
export const END_CONVERSATION_TOOL = "end_conversation";

export interface AgentTurnRequest {
  /** The chat-agent question item's resolved question text. */
  questionText: string;
  /** `payload.questionData` of the chat_agent_question item. */
  questionData?: Doc | null;
  /** Space agent doc (tutor/evaluator persona), when configured. */
  agent?: Doc | null;
  /** EvaluationSettings doc — enabled dimensions become observable dimensions. */
  settings?: Doc | null;
  /** Prior conversation (oldest → newest), EXCLUDING the new learner message. */
  history: TranscriptTurn[];
  /** The learner's new message this turn. */
  message: string;
  language: string;
  /** Turn budget state, rendered so the agent can pace itself. */
  turnsUsed: number;
  maxTurns: number;
}

/** Dimension descriptors the agent may observe against ({id, name, description}). */
export function observableDimensions(
  settings: Doc | null | undefined
): { id: string; name: string; description: string }[] {
  return (arr(settings?.["enabledDimensions"]) as Doc[])
    .map((d) => ({
      id: str(d["id"]),
      name: str(d["name"]),
      description: str(d["description"]),
    }))
    .filter((d) => d.id.length > 0);
}

/** Tool declarations for one agent turn (gateway `tools` — no responseSchema). */
export function buildAgentTools(
  dimensionIds: string[]
): { name: string; description: string; parameters?: unknown }[] {
  return [
    {
      name: RECORD_OBSERVATION_TOOL,
      description:
        "Record a private grading observation when the learner demonstrates (or " +
        "clearly fails) one of the evaluation dimensions. Invisible commentary " +
        "for the final evaluation — never mention it to the learner.",
      parameters: {
        type: "object",
        properties: {
          dimensionId: {
            type: "string",
            ...(dimensionIds.length > 0 ? { enum: dimensionIds } : {}),
            description: "The evaluation dimension this observation is about.",
          },
          evidence: {
            type: "string",
            description: "What the learner said/did that demonstrates or fails the dimension.",
          },
          provisionalScore: {
            type: "number",
            description: "Provisional 0-10 rating of the dimension so far.",
          },
        },
        required: ["dimensionId", "evidence"],
      },
    },
    {
      name: END_CONVERSATION_TOOL,
      description:
        "End the conversation once the objectives are covered, the learner asks " +
        "to finish, or no further progress is being made. Final grading runs " +
        "after this call.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the conversation is complete." },
        },
        required: ["reason"],
      },
    },
  ];
}

/** Compose the `agentPrompt` template variable for one turn. */
export function buildAgentTurnPrompt(req: AgentTurnRequest): string {
  const qd = req.questionData ?? {};
  let out = "";

  // Persona: question-level agentInstructions win; else the space agent.
  const instructions = str(qd["agentInstructions"]);
  const agent = req.agent;
  if (instructions) {
    out += `YOUR PERSONA AND TASK:\n${instructions}\n\n`;
  } else if (agent) {
    const identity = str(agent["systemPrompt"]) || str(agent["identity"]) || str(agent["name"]);
    if (identity) out += `YOUR PERSONA:\n${identity}\n`;
    const rules = arr(agent["rules"]).map(String).filter(Boolean);
    if (rules.length) out += `RULES:\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
    if (out) out += "\n";
  }

  out += `THE QUESTION you are guiding the learner through:\n${req.questionText}\n\n`;

  const objectives = arr(qd["objectives"]).map(String).filter(Boolean);
  if (objectives.length) {
    out += `LEARNING OBJECTIVES the learner should demonstrate:\n${objectives.map((o) => `- ${o}`).join("\n")}\n\n`;
  }

  const dims = observableDimensions(req.settings ?? null);
  if (dims.length) {
    out +=
      "EVALUATION DIMENSIONS to observe (use record_observation whenever the " +
      "learner demonstrates or clearly fails one — never tell the learner):\n" +
      dims
        .map((d) => `- ${d.id} — ${d.name}${d.description ? `: ${d.description}` : ""}`)
        .join("\n") +
      "\n\n";
  }

  out += `Conversation turns used: ${req.turnsUsed} of ${req.maxTurns}. When the budget is nearly spent, steer toward wrapping up and call end_conversation.\n\n`;

  if (req.history.length) {
    out +=
      "CONVERSATION SO FAR:\n" +
      req.history.map((t) => `${t.role === "user" ? "LEARNER" : "YOU"}: ${t.content}`).join("\n") +
      "\n\n";
  }

  out += `LEARNER SAYS: ${req.message}\n\nReply as the agent, in ${req.language}.`;
  return out;
}

export interface ParsedAgentToolCalls {
  observations: AgentObservation[];
  ended: boolean;
  endReason?: string;
}

/** Parse gateway toolCalls into typed observations / end signal (unknowns dropped). */
export function parseAgentToolCalls(
  toolCalls: { name: string; args: Record<string, unknown> }[] | undefined,
  dimensionIds: string[],
  at: string
): ParsedAgentToolCalls {
  const out: ParsedAgentToolCalls = { observations: [], ended: false };
  const dimSet = new Set(dimensionIds);
  for (const call of toolCalls ?? []) {
    if (call.name === RECORD_OBSERVATION_TOOL) {
      const dimensionId = str(call.args["dimensionId"]);
      const evidence = str(call.args["evidence"]);
      // Whitelist to enabled dimensions when configured; accept any id otherwise.
      if (!evidence || (dimSet.size > 0 && !dimSet.has(dimensionId))) continue;
      out.observations.push({
        dimensionId,
        evidence,
        ...(typeof call.args["provisionalScore"] === "number"
          ? { provisionalScore: call.args["provisionalScore"] }
          : {}),
        at,
      });
    } else if (call.name === END_CONVERSATION_TOOL) {
      out.ended = true;
      const reason = str(call.args["reason"]);
      if (reason) out.endReason = reason;
    }
  }
  return out;
}
