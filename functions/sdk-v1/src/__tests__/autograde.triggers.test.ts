/**
 * P1-G pin: the pipeline writes questionSubmissions FLAT into the `submissions`
 * collection with a `_kind:'questionSubmission'` discriminator — so
 * `onQuestionSubmissionUpdated` must register on the FLAT path (the old nested
 * `…/questionSubmissions/{q}` path never receives an event) and the three
 * submission-collection triggers must dispatch on `_kind`.
 *
 * Runs with no LVLUP_COLLECTION_PREFIX (unit env) — prefixing itself is pinned
 * in @levelup/functions-adapters' on-document.prefix.test.ts.
 */
import { describe, it, expect } from "vitest";
import type { TriggerEvent } from "@levelup/functions-adapters";
import {
  eventDocKind,
  onQuestionSubmissionUpdated,
  onSubmissionCreated,
  onSubmissionUpdated,
} from "../autograde.js";

type Endpointed = {
  __endpoint: { eventTrigger: { eventFilterPathPatterns: { document: string } } };
};

const docPath = (fn: unknown): string =>
  (fn as Endpointed).__endpoint.eventTrigger.eventFilterPathPatterns.document;

const ev = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): TriggerEvent<Record<string, unknown>> => ({
  type: "updated",
  params: { tenantId: "t1" },
  before,
  after,
  id: "doc1",
});

describe("onQuestionSubmissionUpdated registration (P1-G)", () => {
  it("listens on the FLAT submissions collection, not a nested subcollection", () => {
    expect(docPath(onQuestionSubmissionUpdated)).toBe(
      "tenants/{tenantId}/submissions/{questionSubmissionId}"
    );
    expect(docPath(onQuestionSubmissionUpdated)).not.toContain("questionSubmissions/");
  });

  it("shares the exact collection path the submission triggers watch", () => {
    const collection = (p: string) => p.split("/").slice(0, 3).join("/");
    expect(collection(docPath(onQuestionSubmissionUpdated))).toBe(
      collection(docPath(onSubmissionCreated))
    );
    expect(collection(docPath(onQuestionSubmissionUpdated))).toBe(
      collection(docPath(onSubmissionUpdated))
    );
  });
});

describe("eventDocKind (_kind dispatch)", () => {
  it("reads the discriminator from after, falling back to before (deletes)", () => {
    expect(eventDocKind(ev(null, { _kind: "questionSubmission" }))).toBe("questionSubmission");
    expect(eventDocKind(ev({ _kind: "questionSubmission" }, null))).toBe("questionSubmission");
    expect(eventDocKind(ev({ _kind: "old" }, { _kind: "new" }))).toBe("new");
  });

  it("is undefined for real submission docs (no _kind field)", () => {
    expect(eventDocKind(ev(null, { pipelineStatus: "uploaded" }))).toBeUndefined();
  });
});
