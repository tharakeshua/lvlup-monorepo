/**
 * `useAnswerParts` — the capture/upload controller for a media-capable AI answer
 * (audio + image_evaluation). W3 owns this; W1 renders the resulting
 * `AnswerPart[]` in the parts-stack shell and wires submit via `toWireAnswer`.
 *
 * Responsibilities:
 *  • image capture — camera + photo library (expo-image-picker, quality 0.7)
 *  • audio capture — the `useAudioRecorder` lifecycle (expo-av HIGH_QUALITY)
 *  • upload — every captured file streams through the `answer-media` Storage seam
 *    with uploading → ready → error status; the local URI is retained so a failed
 *    part can be retried and an audio clip can be played back without re-download.
 *  • the answer is NEVER lost on failure (design: "Answer parts are never lost").
 *
 * State model matches the canonical `AnswerPart` seam. `storagePath` is `""`
 * until the upload resolves (then status → 'ready'); `readyParts()` filters on it.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";

import {
  hasFailedPart,
  hasUploadingPart,
  type AnswerPart,
} from "../../components/ai-question/answer-bundle";
import { mimeForUri } from "./mime";
import { useAnswerMediaUpload, type UploadScope } from "./upload";
import { useAudioRecorder, type AudioRecorderState } from "./useAudioRecorder";

let partSeq = 0;
function nextPartId(): string {
  partSeq += 1;
  return `part_${Date.now().toString(36)}_${partSeq}`;
}

export interface AnswerPartsScope extends UploadScope {
  /** Space id — required by the answer-media path grammar. */
  spaceId?: string;
  /** Item id — required by the answer-media path grammar. */
  itemId?: string;
}

export interface UseAnswerPartsOptions {
  scope: AnswerPartsScope;
  /** Seed parts (e.g. try-again pre-fill of a prior attempt's media). */
  initialParts?: AnswerPart[];
  /** Fires on every parts mutation so the parent can rebuild the wire answer. */
  onChange?: (parts: AnswerPart[]) => void;
  disabled?: boolean;
}

export interface UseAnswerPartsResult {
  parts: AnswerPart[];
  /** True while any part is uploading — parent should defer submit. */
  uploading: boolean;
  /** True if any part failed to upload — parent surfaces retry. */
  hasError: boolean;
  /** Latest capture/permission error hint (mic/camera denied, picker failed). */
  error: string | null;
  clearError: () => void;
  /** Whether the mic permission was explicitly denied (drives the banner). */
  micDenied: boolean;
  /** Whether the camera/library permission was explicitly denied. */
  cameraDenied: boolean;

  addPhoto: () => Promise<void>;
  addFromCamera: () => Promise<void>;
  /** Add an already-recorded clip (used by the record stage on stop). */
  addAudio: (clip: { uri: string; durationSec?: number; name?: string }) => Promise<void>;
  remove: (id: string) => void;
  retry: (id: string) => Promise<void>;

  /** The audio record lifecycle (timer/level/start/stop) for the record stage. */
  recorder: AudioRecorderState;
  /** Convenience: record → stop → attach, wired to the recorder. */
  stopRecordingAndAttach: () => Promise<void>;
}

export function useAnswerParts(options: UseAnswerPartsOptions): UseAnswerPartsResult {
  const { scope, initialParts, onChange, disabled } = options;
  const { upload } = useAnswerMediaUpload();
  const recorder = useAudioRecorder();

  const [parts, setParts] = useState<AnswerPart[]>(initialParts ?? []);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);

  // Keep local URIs for retry across re-renders even after a failed upload.
  const localUriRef = useRef<Record<string, string>>({});

  const commit = useCallback(
    (updater: (prev: AnswerPart[]) => AnswerPart[]) => {
      setParts((prev) => {
        const next = updater(prev);
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const patchPart = useCallback(
    (id: string, patch: Partial<AnswerPart>) => {
      commit((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [commit]
  );

  /** Upload a captured file for a part id already inserted as 'uploading'. */
  const runUpload = useCallback(
    async (id: string, uri: string, kind: AnswerPart["kind"]) => {
      try {
        const res = await upload({ uri, kind }, scope);
        patchPart(id, {
          status: "ready",
          storagePath: res.storagePath,
          mimeType: res.mimeType,
          sizeBytes: res.sizeBytes,
        });
      } catch {
        patchPart(id, { status: "error" });
        setError("Couldn't upload that file — check your connection and try again.");
      }
    },
    [upload, scope, patchPart]
  );

  const insertUploading = useCallback(
    (uri: string, kind: AnswerPart["kind"], extra?: Partial<AnswerPart>): string => {
      const id = nextPartId();
      localUriRef.current[id] = uri;
      const part: AnswerPart = {
        id,
        kind,
        storagePath: "",
        mimeType: extra?.mimeType ?? mimeForUri(uri, kind),
        status: "uploading",
        localUri: uri,
        ...extra,
      };
      commit((prev) => [...prev, part]);
      return id;
    },
    [commit]
  );

  const pickImage = useCallback(
    async (fromCamera: boolean) => {
      if (disabled) return;
      setError(null);
      try {
        const perm = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setCameraDenied(true);
          setError(
            fromCamera
              ? "Camera access is needed to photograph your work."
              : "Photo library access is needed to attach an image."
          );
          return;
        }
        setCameraDenied(false);
        const result = fromCamera
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
            });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        const count = parts.filter((p) => p.kind === "image").length + 1;
        const id = insertUploading(asset.uri, "image", {
          mimeType: asset.mimeType ?? mimeForUri(asset.uri, "image"),
          name: asset.fileName ?? `Page ${count}`,
          sizeBytes: asset.fileSize,
        });
        await runUpload(id, asset.uri, "image");
      } catch {
        setError("Couldn't open the image picker.");
      }
    },
    [disabled, parts, insertUploading, runUpload]
  );

  const addPhoto = useCallback(() => pickImage(false), [pickImage]);
  const addFromCamera = useCallback(() => pickImage(true), [pickImage]);

  const addAudio = useCallback(
    async (clip: { uri: string; durationSec?: number; name?: string }) => {
      if (disabled) return;
      setError(null);
      const count = parts.filter((p) => p.kind === "audio").length + 1;
      const id = insertUploading(clip.uri, "audio", {
        durationSec: clip.durationSec,
        name: clip.name ?? (count > 1 ? `Take ${count}` : "Your answer"),
      });
      await runUpload(id, clip.uri, "audio");
    },
    [disabled, parts, insertUploading, runUpload]
  );

  const stopRecordingAndAttach = useCallback(async () => {
    const clip = await recorder.stop();
    if (clip) await addAudio(clip);
    else setError("Couldn't save the recording.");
  }, [recorder, addAudio]);

  const remove = useCallback(
    (id: string) => {
      delete localUriRef.current[id];
      commit((prev) => prev.filter((p) => p.id !== id));
    },
    [commit]
  );

  const retry = useCallback(
    async (id: string) => {
      const uri = localUriRef.current[id];
      const part = parts.find((p) => p.id === id);
      if (!uri || !part) return;
      setError(null);
      patchPart(id, { status: "uploading" });
      await runUpload(id, uri, part.kind);
    },
    [parts, patchPart, runUpload]
  );

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      parts,
      uploading: hasUploadingPart(parts),
      hasError: hasFailedPart(parts),
      error,
      clearError,
      micDenied: recorder.permissionDenied,
      cameraDenied,
      addPhoto,
      addFromCamera,
      addAudio,
      remove,
      retry,
      recorder,
      stopRecordingAndAttach,
    }),
    [
      parts,
      error,
      clearError,
      recorder,
      cameraDenied,
      addPhoto,
      addFromCamera,
      addAudio,
      remove,
      retry,
      stopRecordingAndAttach,
    ]
  );
}
