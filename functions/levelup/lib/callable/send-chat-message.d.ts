/**
 * AI tutor chat — send a message and get a response.
 *
 * Builds context from the current item, resolves tutor agent,
 * and uses Socratic method to guide students.
 * Rate limited: 10 messages/min per user.
 */
export declare const sendChatMessage: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    sessionId: string;
    reply: string;
    tokensUsed: {
      input: number;
      output: number;
    };
  }>,
  unknown
>;
