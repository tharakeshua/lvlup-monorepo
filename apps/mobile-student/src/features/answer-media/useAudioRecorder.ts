/**
 * `useAudioRecorder` — expo-av spoken-answer capture for the audio question type.
 *
 * Owns the record lifecycle for the D1→D2→D3 states in
 * `capability-variants.card.html`: idle → recording (live timer + level meter) →
 * recorded clip. Metering feeds the live waveform; the timer drives the
 * `rec-timer`. Mic permission is requested lazily and surfaced (denied → the
 * caller shows the permission banner). The recorded file URI + duration are
 * handed back for upload; we never keep the recorder object past stop.
 *
 * v1 owner decision: audio is LLM-input-only — no on-device transcription.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

/** Cap per design copy ("up to 3 minutes"). */
export const MAX_RECORDING_MS = 3 * 60 * 1000;

export interface RecordedClip {
  uri: string;
  durationSec: number;
}

export interface AudioRecorderState {
  isRecording: boolean;
  /** Elapsed milliseconds while recording (0 when idle). */
  durationMs: number;
  /** 0..1 smoothed input level for the live meter (0 when idle). */
  level: number;
  /** True once the mic permission has been explicitly denied. */
  permissionDenied: boolean;
  start: () => Promise<boolean>;
  /** Stop + unload; resolves the recorded clip (or null on failure). */
  stop: () => Promise<RecordedClip | null>;
  /** Abort an in-flight recording without producing a clip. */
  cancel: () => Promise<void>;
}

/** Map expo-av metering dBFS (~-160..0) to a 0..1 bar height. */
function meterToLevel(db: number | undefined): number {
  if (db == null || Number.isNaN(db)) return 0;
  const floor = -50; // treat <= -50 dB as silence
  const clamped = Math.max(floor, Math.min(0, db));
  return (clamped - floor) / -floor;
}

export function useAudioRecorder(): AudioRecorderState {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const teardown = useCallback(async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    setDurationMs(0);
    setLevel(0);
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {
        // already unloaded / never started — nothing to clean up
      }
    }
  }, []);

  // Never leave the mic hot if the screen unmounts mid-recording.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const start = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied(true);
        return false;
      }
      setPermissionDenied(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      rec.setProgressUpdateInterval(100);
      rec.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        setDurationMs(status.durationMillis ?? 0);
        setLevel(meterToLevel(status.metering));
        if ((status.durationMillis ?? 0) >= MAX_RECORDING_MS) {
          // Auto-stop at the cap; the caller's stop() will still resolve the clip.
          void rec.pauseAsync().catch(() => {});
        }
      });
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
      return true;
    } catch {
      await teardown();
      return false;
    }
  }, [teardown]);

  const stop = useCallback(async (): Promise<RecordedClip | null> => {
    const rec = recordingRef.current;
    if (!rec) return null;
    recordingRef.current = null;
    setIsRecording(false);
    setLevel(0);
    try {
      const status = await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      const finalMs = status.durationMillis ?? durationMs;
      setDurationMs(0);
      if (!uri) return null;
      return { uri, durationSec: Math.max(1, Math.round(finalMs / 1000)) };
    } catch {
      setDurationMs(0);
      return null;
    }
  }, [durationMs]);

  const cancel = useCallback(() => teardown(), [teardown]);

  return { isRecording, durationMs, level, permissionDenied, start, stop, cancel };
}
