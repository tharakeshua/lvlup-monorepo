/**
 * Teacher media upload hooks — question-paper images/PDFs and content-source PDFs.
 *
 * Routes through the SDK storage seam (useUploadImage → signed-PUT) — never
 * imports firebase/storage directly. Two upload kinds used by this app:
 *   kind:'question-paper'  — used by ExamWizardScreen (scope: examId)
 *   kind:'content-source'  — used by GenerateContentScreen (scope: spaceId)
 *
 * `uriToBytes` works for both local RN file URIs (from expo-image-picker /
 * expo-document-picker) and data-URIs. The picked document URI may be a
 * content:// URI on Android — React Native's `fetch` handles that natively.
 */
import { useCallback } from "react";
import { useUploadImage } from "@levelup/query";

export type QuestionPaperMediaKind = "image" | "pdf";

export interface QuestionPaperFile {
  uri: string;
  kind: QuestionPaperMediaKind;
  name?: string;
  contentType?: string;
}

const DEFAULT_CONTENT_TYPE: Record<QuestionPaperMediaKind, string> = {
  image: "image/jpeg",
  pdf: "application/pdf",
};

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}

/**
 * Upload a question-paper file (image or PDF) and resolve to the server-scoped
 * Storage path. The caller passes this path to `useSaveExam({ data: { questionPaperImages } })`.
 */
export function useQuestionPaperUpload() {
  const uploadImage = useUploadImage();

  const upload = useCallback(
    async (file: QuestionPaperFile, examId: string): Promise<string> => {
      const contentType = file.contentType ?? DEFAULT_CONTENT_TYPE[file.kind];
      const body = await uriToBlob(file.uri);
      const path = await uploadImage.mutateAsync({
        kind: "question-paper",
        contentType,
        examId: examId as never,
        body,
      } as never);
      return path as string;
    },
    [uploadImage]
  );

  return { upload, isPending: uploadImage.isPending };
}

/**
 * Upload a PDF as a content-source for AI generation. Returns the server-scoped
 * Storage path to pass to `useGenerateContent({ sourcePdfPath })`.
 */
export function useContentSourceUpload() {
  const uploadImage = useUploadImage();

  const upload = useCallback(
    async (uri: string, spaceId: string): Promise<string> => {
      const body = await uriToBlob(uri);
      const path = await uploadImage.mutateAsync({
        kind: "content-source",
        contentType: "application/pdf",
        spaceId: spaceId as never,
        body,
      } as never);
      return path as string;
    },
    [uploadImage]
  );

  return { upload, isPending: uploadImage.isPending };
}
