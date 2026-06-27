/**
 * Lightweight content moderation (server-shared.md / levelup-content §
 * "chat-safety regex filter"). Used by `sendChatMessage` (learner input + tutor
 * output) and any free-text AI surface. This is a cheap deterministic pre/post
 * filter — NOT a substitute for the provider's own safety settings — that blocks
 * the obvious cases (prompt-injection at the tutor, abuse) and redacts PII before
 * a prompt is logged.
 */

export type ModerationCategory =
  | "prompt_injection"
  | "self_harm"
  | "sexual_minor"
  | "violence_threat"
  | "hate";

export interface ModerationResult {
  allowed: boolean;
  categories: ModerationCategory[];
  /** The input with PII redacted (safe to log / send downstream). */
  sanitized: string;
}

interface Rule {
  category: ModerationCategory;
  pattern: RegExp;
}

const RULES: Rule[] = [
  {
    category: "prompt_injection",
    pattern:
      /\b(ignore (all |the )?previous instructions|disregard (the )?system prompt|reveal (the )?(system )?prompt|show (me )?the (rubric|model answer|grading guidance))\b/i,
  },
  { category: "self_harm", pattern: /\b(kill myself|suicide|end my life|self[-\s]?harm)\b/i },
  {
    category: "sexual_minor",
    pattern: /\b(child|minor|underage)\b.{0,20}\b(sex|nude|explicit)\b/i,
  },
  { category: "violence_threat", pattern: /\b(i('| wi)ll kill|shoot up|bomb the|murder you)\b/i },
  { category: "hate", pattern: /\b(kill all|exterminate the)\b/i },
];

// PII patterns redacted before logging (not blocking).
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /\b(?:\+?\d[\d\s-]{7,}\d)\b/g;

export function redactPii(text: string): string {
  return text.replace(EMAIL_RE, "[redacted-email]").replace(PHONE_RE, "[redacted-phone]");
}

export interface ModerateOptions {
  /** When true (default) PII is redacted in `sanitized`. */
  redactPii?: boolean;
  /** Categories that block when matched (default: all). */
  blockOn?: ModerationCategory[];
}

export function moderateText(text: string, opts: ModerateOptions = {}): ModerationResult {
  const blockOn = new Set<ModerationCategory>(
    opts.blockOn ?? ["prompt_injection", "self_harm", "sexual_minor", "violence_threat", "hate"]
  );
  const categories: ModerationCategory[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(text) && blockOn.has(rule.category)) {
      categories.push(rule.category);
    }
  }
  const sanitized = opts.redactPii === false ? text : redactPii(text);
  return { allowed: categories.length === 0, categories, sanitized };
}
