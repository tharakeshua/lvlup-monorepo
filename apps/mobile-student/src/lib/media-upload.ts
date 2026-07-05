/**
 * `useMediaUpload` — the app-side glue that turns a locally-captured media file
 * (an expo-image-picker asset or an expo-av recording) into a persisted,
 * server-scoped Storage path suitable for an answer's `mediaUrls`.
 *
 * It never touches `firebase/storage`: it drives the SDK's already-wired Storage
 * seam (`useRepos().storageRepo` → signed-PUT-URL grant → PUT bytes), returning
 * the server-scoped `StoragePath` string the backend resolves at evaluation time
 * (the same value `Submission.imageUrls` persists). No new backend is introduced.
 *
 * NOTE (contract seam): the only deployed `requestUploadUrl` kind that fits a
 * learner artifact is `answer-sheet`, whose server schema pins the path under an
 * id it calls `examId`. In the timed-test / story-point flow there is no exam, so
 * we pass the closest stable scope we have (the itemId) as that id — the file
 * still lands tenant-scoped server-side. If/when a first-class "answer-media"
 * upload kind exists, swap the `kind`/scope here only.
 */
import { useCallback } from "react";

import { useRepos } from "@levelup/query";

export type MediaAnswerKind = "image" | "audio";

export interface CapturedMedia {
  /** Local file URI from expo-image-picker / expo-av. */
  uri: string;
  kind: MediaAnswerKind;
  /** MIME type; defaulted per-kind when the picker doesn't supply one. */
  contentType?: string;
}

const DEFAULT_CONTENT_TYPE: Record<MediaAnswerKind, string> = {
  image: "image/jpeg",
  audio: "audio/m4a",
};

/** Read a local RN file URI into bytes the signed-PUT upload accepts. */
async function uriToBytes(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}

export function useMediaUpload() {
  const repos = useRepos();

  /**
   * Upload one captured file; resolves to the persisted server Storage path.
   * `scopeId` is the itemId (see file header) used as the server path scope.
   */
  const upload = useCallback(
    async (media: CapturedMedia, scopeId?: string): Promise<string> => {
      const contentType = media.contentType ?? DEFAULT_CONTENT_TYPE[media.kind];
      const body = await uriToBytes(media.uri);
      const path = await repos.storageRepo.uploadImage({
        kind: "answer-sheet",
        contentType,
        examId: scopeId ?? "test-session",
        body,
      });
      return path;
    },
    [repos]
  );

  return { upload };
}
