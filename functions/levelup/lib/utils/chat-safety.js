"use strict";
/**
 * Chat safety filter for student AI interactions.
 *
 * Detects prompt injection attempts, non-educational content requests,
 * and rate limit abuse before sending messages to the LLM.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMessageSafety = checkMessageSafety;
exports.checkRateLimitAbuse = checkRateLimitAbuse;
// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /disregard\s+(all\s+)?(previous|above|prior)/i,
  /forget\s+(all\s+)?(previous|above|prior)/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(a|an)\s+(?!student|learner)/i,
  /jailbreak/i,
  /bypass\s+(the\s+)?filter/i,
  /override\s+(the\s+)?(system|safety)/i,
];
// Topics that are clearly non-educational
const BLOCKED_TOPIC_PATTERNS = [
  /how\s+to\s+(hack|crack|break\s+into)/i,
  /generate\s+(a\s+)?password/i,
  /write\s+(a\s+)?(malware|virus|exploit)/i,
  /how\s+to\s+(buy|sell|use)\s+(drugs?|weapons?)/i,
  /self[- ]?harm/i,
  /suicide\s+(method|how)/i,
];
/**
 * Check if a student message is safe to send to the AI tutor.
 */
function checkMessageSafety(message) {
  const trimmed = message.trim();
  // Empty message check
  if (trimmed.length === 0) {
    return { safe: false, reason: "Message cannot be empty." };
  }
  // Check for prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason:
          "This message contains instructions that could interfere with the AI tutor. Please rephrase your question.",
      };
    }
  }
  // Check for clearly non-educational content
  for (const pattern of BLOCKED_TOPIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason:
          "This topic is outside the scope of academic tutoring. Please ask a question related to your studies.",
      };
    }
  }
  return { safe: true };
}
// ── Rate Limit Abuse Detection ──────────────────────────────────────────────
// In-memory tracker for high-frequency message detection per user
// Resets on cold start, but catches abuse within a single instance lifetime
const userMessageTimestamps = new Map();
const ABUSE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ABUSE_THRESHOLD = 50; // 50 messages per hour
/**
 * Track user message frequency and detect abuse patterns.
 * Returns a warning if the user is approaching the abuse threshold.
 */
function checkRateLimitAbuse(userId) {
  const now = Date.now();
  const timestamps = userMessageTimestamps.get(userId) ?? [];
  // Filter to messages within the window
  const recentTimestamps = timestamps.filter((t) => now - t < ABUSE_WINDOW_MS);
  recentTimestamps.push(now);
  userMessageTimestamps.set(userId, recentTimestamps);
  if (recentTimestamps.length > ABUSE_THRESHOLD) {
    return {
      safe: false,
      reason:
        "You have sent too many messages in the last hour. Please take a break and try again later.",
    };
  }
  if (recentTimestamps.length > ABUSE_THRESHOLD * 0.8) {
    return {
      safe: true,
      warning: `You are approaching the message limit (${recentTimestamps.length}/${ABUSE_THRESHOLD} per hour).`,
    };
  }
  return { safe: true };
}
//# sourceMappingURL=chat-safety.js.map
