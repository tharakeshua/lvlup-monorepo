/**
 * `levelup-content` MUTATION hooks (domains/levelup-content.md "Mutation hooks").
 *
 * The CONTENT slice: authoring saves (space/storyPoint/item/agent/rubricPreset/
 * questionBank), bank import, the B2C store (saveReview round-trip + purchase
 * authority ⚷), and the AI-tutor chat send. (Test-session start/submit/evaluate
 * and recordItemAttempt are owned by the sibling `testsession-progress` domain.)
 *
 * Every mutation is built with `defineMutation` — so the §6.1 build-time guard
 * runs, the optimistic recipe is allow-list-checked, and `onSettled` reconciles
 * with the server via the invalidation graph (per-callable roots/fanout). No hook
 * hand-writes `invalidateQueries` or touches firebase.
 *
 * Optimistic surface (✅ closed allow-list ONLY): `useSendChatMessage` —
 * appendToList of the pending user message. Everything else round-trips
 * (publish/lifecycle/save/purchase); passing `optimistic` on those is a build
 * error (the guard) + a lint error (`no-optimistic-on-authority`).
 */
import { defineMutation } from "../mutation/define-mutation.js";
import { appendToList } from "../mutation/recipes/append-list.js";
import { chatKeys } from "../keys/registry.js";

/** Loose repo accessor (the repo seam returns `unknown`; apps narrow at call sites). */
type Repos = Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
const call = (repos: unknown, name: string, method: string, vars: unknown): Promise<unknown> =>
  (repos as Repos)[name][method](vars as never);

// ── content authoring (NEVER optimistic — lifecycle/answer-key authority) ─────

export const useSaveSpace = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveSpace",
  run: (repos, vars) => call(repos, "spaceRepo", "save", vars),
});

export const useSaveStoryPoint = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveStoryPoint",
  run: (repos, vars) => call(repos, "storyPointRepo", "save", vars),
});

export const useSaveItem = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveItem",
  run: (repos, vars) => call(repos, "itemRepo", "save", vars),
});

export const useImportFromBank = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.importFromBank",
  run: (repos, vars) => call(repos, "itemRepo", "saveFromBank", vars),
});

export const useSaveAgent = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveAgent",
  run: (repos, vars) => call(repos, "agentRepo", "save", vars),
});

export const useSaveRubricPreset = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveRubricPreset",
  run: (repos, vars) => call(repos, "rubricPresetRepo", "save", vars),
});

export const useSaveQuestionBankItem = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveQuestionBankItem",
  run: (repos, vars) => call(repos, "questionBankRepo", "save", vars),
});

// ── sendChatMessage — ✅ optimistic append of the pending user message ─────────

interface SendChatVars {
  sessionId?: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  text: string;
  language?: string;
  mediaUrls?: string[];
  [k: string]: unknown;
}

export const useSendChatMessage = defineMutation<SendChatVars>({
  callable: "v1.levelup.sendChatMessage",
  run: (repos, vars) => call(repos, "chatRepo", "recordMessage", vars),
  optimistic: appendToList<SendChatVars>(
    // append into the session's messages sub-list; the chatStream subscription /
    // server response reconciles the authoritative message in onSettled.
    chatKeys.sub("session", "messages"),
    (vars) => ({
      id: `pending_${Date.now()}`,
      role: "user",
      text: vars.text,
      pending: true,
    })
  ),
});

// ── AI content generation (ai tier; authority-sensitive; no optimistic) ────────

export const useGenerateContent = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.generateContent",
  run: (repos, vars) => call(repos, "aiGenerationRepo", "getGeneration", vars),
});

// ── B2C store (saveReview round-trips; purchase is purchase-authority ⚷) ──────

export const useSaveSpaceReview = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.saveSpaceReview",
  run: (repos, vars) => call(repos, "storeRepo", "saveReview", vars),
});

export const usePurchaseSpace = defineMutation<Record<string, unknown>>({
  callable: "v1.levelup.purchaseSpace",
  run: (repos, vars) => call(repos, "storeRepo", "recordPurchase", vars),
});
