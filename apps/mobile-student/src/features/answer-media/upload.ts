/**
 * `useAnswerMediaUpload` — uploads one locally-captured file (expo-image-picker
 * asset or expo-av recording) to tenant-scoped Storage and resolves the
 * server-scoped path that rides the answer bundle's `mediaUrls`.
 *
 * It drives the SDK's Storage seam (`useRepos().storageRepo.uploadImage`
 * → signed-PUT grant → PUT bytes) — never `firebase/storage` directly. The
 * upload `kind` is `answer-media`: the ONLY `requestUploadUrl` kind a STUDENT is
 * authorized to use (`answerMedia.upload` = STUDENT_ONLY/self). The other kinds
 * are authoring/scanner-scoped and a learner would be PERMISSION_DENIED —
 * see the W3 upload-authz note. Path grammar:
 *   tenants/{t}/spaces/{s}/items/{i}/answers/{uid}/{stamp}.ext
 *
 * `spaceId` + `itemId` are required by the server path builder; the practice /
 * content-viewer flow always has both.
 */
import { useCallback } from "react";

import { useRepos } from "@levelup/query";

import { mimeForUri } from "./mime";
import type { AnswerPartKind } from "../../components/ai-question/answer-bundle";

export interface UploadScope {
  spaceId?: string;
  itemId?: string;
}

export interface CapturedFile {
  uri: string;
  kind: AnswerPartKind;
  /** Content-Type; resolved from the URI when the picker omits one. */
  mimeType?: string;
}

export interface UploadResult {
  storagePath: string;
  mimeType: string;
  sizeBytes?: number;
}

/** Read a local RN file URI into bytes the signed-PUT upload accepts. */
async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}

export function useAnswerMediaUpload() {
  const repos = useRepos();

  const upload = useCallback(
    async (file: CapturedFile, scope: UploadScope): Promise<UploadResult> => {
      const mimeType = file.mimeType ?? mimeForUri(file.uri, file.kind);
      const body = await uriToBlob(file.uri);
      const storagePath = await repos.storageRepo.uploadImage({
        kind: "answer-media",
        contentType: mimeType,
        spaceId: scope.spaceId,
        itemId: scope.itemId,
        body,
      });
      return {
        storagePath,
        mimeType,
        sizeBytes: typeof body.size === "number" ? body.size : undefined,
      };
    },
    [repos]
  );

  return { upload };
}
