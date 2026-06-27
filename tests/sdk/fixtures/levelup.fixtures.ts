/**
 * Per-callable fixtures for `v1.levelup.*` (content + testsession + gamification).
 * See tests/sdk/fixtures/callable-fixture.ts.
 *
 * These exercise the highest-authority client paths: the answer-key strip
 * boundary (saveItem / getItemForEdit), the server-scores-not-client contract
 * (recordItemAttempt / evaluateAnswer — CD13), and the release/projection gates.
 */
import { registerFixture } from "./callable-fixture";
import { localSeedId } from "../harness/fixtures-ids";

const SPACE = localSeedId("space", "dsa");
const SPACE_PUB = localSeedId("space", "published");
const SP = localSeedId("sp", "arrays");
const ITEM = localSeedId("item", "arrays.q1");

// --- content writes (NEVER optimistic; lifecycle is explicit verbs DX-5) ---
registerFixture("v1.levelup.saveSpace", {
  // SPACE_TYPES = learning|practice|assessment|resource|hybrid (§domain enum is
  // canonical; 'course' was an invalid fixture value that failed zSpaceType).
  request: { data: { title: "New Space", type: "learning" } },
  as: "teacher",
  seedState: "contract-tenant",
});
registerFixture("v1.levelup.saveStoryPoint", {
  // ordering field is `orderIndex` (strict schema rejects `order`).
  request: { spaceId: SPACE, data: { title: "Linked Lists", type: "practice", orderIndex: 1 } },
  as: "teacher",
  seedState: "draft-space",
});
registerFixture("v1.levelup.saveItem", {
  // Schema-valid two-level payload (top-level item `type` + nested `questionData`).
  // The answer-bearing `modelAnswer` rides inside the payload; the server strips it
  // into the deny-all AnswerKey subcollection (§6.4).
  request: {
    spaceId: SPACE,
    storyPointId: SP,
    data: {
      type: "question",
      title: "Define an array.",
      payload: {
        type: "question",
        questionData: {
          questionType: "text",
          modelAnswer: "A contiguous block of memory.",
        },
      },
    },
  },
  as: "teacher",
  seedState: "story-point-with-item",
});

// --- authoring read (⚷ re-merges answer key; non-persisted cache) ---
registerFixture("v1.levelup.getItemForEdit", {
  request: { spaceId: SPACE, storyPointId: SP, itemId: ITEM },
  as: "teacher",
  seedState: "story-point-with-item",
});

// --- reads (answer-stripped projection for learners) ---
registerFixture("v1.levelup.listItems", {
  request: { spaceId: SPACE, storyPointId: SP, limit: 20 },
  as: "student",
  seedState: "story-point-with-item",
  expect: (res) => {
    // answer keys must NOT appear in a learner-facing item list (§6.4)
    const json = JSON.stringify(res);
    if (/correctAnswer|acceptableAnswers|evaluationGuidance|modelAnswer/.test(json)) {
      throw new Error("listItems leaked an answer-key field to a student caller");
    }
  },
});
registerFixture("v1.levelup.listSpaces", {
  request: { limit: 20 },
  as: "student",
  seedState: "enrolled-student",
});
registerFixture("v1.levelup.getSpaceProgress", {
  request: { spaceId: SPACE },
  as: "student",
  seedState: "enrolled-student",
});

// --- test session (server-authoritative deadline + grading) ---
registerFixture("v1.levelup.startTestSession", {
  request: { spaceId: SPACE, storyPointId: SP },
  as: "student",
  seedState: "story-point-with-item",
});
registerFixture("v1.levelup.submitTestSession", {
  request: { sessionId: localSeedId("session", "ts1") },
  as: "student",
  seedState: "active-test-session",
});
registerFixture("v1.levelup.saveTestAnswer", {
  // write-through, server-authoritative, never optimistic (C21)
  request: {
    sessionId: localSeedId("session", "ts1"),
    itemId: ITEM,
    answer: "0",
    markedForReview: false,
  },
  as: "student",
  seedState: "active-test-session",
});

// --- CD13: server scores; client sends raw answer only, never score/correct ---
registerFixture("v1.levelup.recordItemAttempt", {
  // CD13: raw answer only — no score/correct, and no idempotencyKey in the body
  // (the UUIDv7 lives in the api-client envelope; the def carries a domain-key hint).
  request: { spaceId: SPACE, storyPointId: SP, itemId: ITEM, answer: "0" },
  as: "student",
  seedState: "enrolled-student",
  expect: (res) => {
    const json = JSON.stringify(res);
    // response is the authoritative ItemProgressView; must include progress
    if (!/progress/.test(json))
      throw new Error("recordItemAttempt response missing authoritative progress");
  },
});
registerFixture("v1.levelup.evaluateAnswer", {
  request: {
    spaceId: SPACE,
    storyPointId: SP,
    itemId: ITEM,
    answer: "A contiguous block of memory",
  },
  as: "student",
  seedState: "story-point-with-item",
});

// --- chat (optimistic append) ---
registerFixture("v1.levelup.sendChatMessage", {
  request: { spaceId: SPACE, storyPointId: SP, itemId: ITEM, text: "Why is index access O(1)?" },
  as: "student",
  seedState: "story-point-with-item",
});

// --- store / purchase (NEVER optimistic) ---
registerFixture("v1.levelup.listStoreSpaces", {
  request: { limit: 20 },
  as: "student",
  seedState: "published-space",
});
registerFixture("v1.levelup.purchaseSpace", {
  // must target the PUBLISHED store space (the draft DSA space is not purchasable).
  request: { spaceId: SPACE_PUB },
  as: "student",
  seedState: "published-space",
});
