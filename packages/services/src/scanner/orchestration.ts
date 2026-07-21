/**
 * Scanner session orchestration — stub for Manual Agent (QR + answer-sheet capture).
 * @see docs/scanner/SCANNER-MODULE.md
 */
import type { AuthContext } from "../shared/context.js";
import { ServiceError } from "../shared/context.js";

export interface StartScannerSessionInput {
  examId: string;
  scannerId: string;
  deviceLabel?: string;
}

export interface StartScannerSessionResult {
  sessionId: string;
  examId: string;
  status: "open";
}

export interface AttachScannerQrInput {
  sessionId: string;
  qrPayload: string;
}

export interface AttachScannerQrResult {
  studentId: string;
  examId: string;
  attachedAt: string;
}

export interface UploadScannerPageInput {
  sessionId: string;
  studentId: string;
  pageIndex: number;
  storagePath: string;
}

export interface CloseScannerSessionInput {
  sessionId: string;
  signatureDataUrl?: string;
}

export interface CloseScannerSessionResult {
  sessionId: string;
  status: "closed";
  submissionIds: string[];
}

function notImplemented(feature: string): never {
  throw new ServiceError("NOT_IMPLEMENTED", `${feature} is not implemented yet — see docs/scanner/SCANNER-MODULE.md`);
}

export async function startScannerSession(
  _input: StartScannerSessionInput,
  _ctx: AuthContext
): Promise<StartScannerSessionResult> {
  notImplemented("startScannerSession");
}

export async function attachScannerQr(
  _input: AttachScannerQrInput,
  _ctx: AuthContext
): Promise<AttachScannerQrResult> {
  notImplemented("attachScannerQr");
}

export async function uploadScannerPage(
  _input: UploadScannerPageInput,
  _ctx: AuthContext
): Promise<{ ok: true }> {
  notImplemented("uploadScannerPage");
}

export async function closeScannerSession(
  _input: CloseScannerSessionInput,
  _ctx: AuthContext
): Promise<CloseScannerSessionResult> {
  notImplemented("closeScannerSession");
}
