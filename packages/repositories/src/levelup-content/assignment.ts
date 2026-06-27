/**
 * assignmentRepo (C12 — SDK-LAYERS-PLAN §3.2 folded list, §4.1, §4.3).
 *
 *   save(input)  — assignContent: assign a space/exam to classes/students
 *                  (metadata write; D2: never injects tenantId). Invalidates
 *                  {assignment,spaces,exams} (§4.3).
 */
import { type ApiClientLike } from "./_kit";

export interface AssignContentInput {
  contentType: "space" | "exam";
  contentId: string;
  classIds?: string[];
  studentIds?: string[];
  dueAt?: string;
}

export interface AssignmentRepo {
  save(input: AssignContentInput): Promise<unknown>;
}

export function createAssignmentRepo(api: ApiClientLike): AssignmentRepo {
  const lv = api.levelup;
  return {
    save: (input) => lv["assignContent"]!(input),
  };
}
