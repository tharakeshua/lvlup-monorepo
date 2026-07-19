/**
 * Analytics & report generation callable wrappers.
 */

import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "../firebase";
import type {
  GetSummaryRequest,
  GetSummaryResponse,
  GenerateReportRequest,
  GenerateReportResponse,
} from "@levelup/shared-types";

// ---------------------------------------------------------------------------
// Callable wrappers
// ---------------------------------------------------------------------------

function getCallable<Req, Res>(name: string) {
  const { functions } = getFirebaseServices();
  return httpsCallable<Req, Res>(functions, name);
}

export async function callGetSummary(data: GetSummaryRequest): Promise<GetSummaryResponse> {
  const fn = getCallable<GetSummaryRequest, GetSummaryResponse>("getSummary");
  const result = await fn(data);
  return result.data;
}

export async function callGenerateReport(
  data: GenerateReportRequest
): Promise<GenerateReportResponse> {
  const fn = getCallable<GenerateReportRequest, GenerateReportResponse>("generateReport");
  const result = await fn(data);
  return result.data;
}

/** Wrapper for platform/health scoped getSummary calls (super-admin). */
export async function callGetPlatformSummary(
  data: Pick<GetSummaryRequest, "scope">
): Promise<GetSummaryResponse> {
  const fn = getCallable<GetSummaryRequest, GetSummaryResponse>("getSummary");
  const result = await fn(data as GetSummaryRequest);
  return result.data;
}
