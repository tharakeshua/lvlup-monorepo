import { useState, useRef, useCallback } from "react";
import type { AudioData } from "@levelup/shared-types";
import { Mic, Square, RotateCcw } from "lucide-react";

interface AudioAnswererProps {
  data: AudioData;
  value?: Blob | null;
  onChange: (value: Blob | null) => void;
  disabled?: boolean;
}

export default function AudioAnswerer({
  data,
  value: _value,
  onChange,
  disabled,
}: AudioAnswererProps) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onChange(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const next = d + 1;
          if (data.maxDurationSeconds && next >= data.maxDurationSeconds) {
            mediaRecorderRef.current?.stop();
            setRecording(false);
            clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    } catch {
      // Permission denied or not available
    }
  }, [data.maxDurationSeconds, onChange]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    onChange(null);
  }, [audioUrl, onChange]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-lg border p-4">
      {data.language && (
        <p className="text-muted-foreground mb-2 text-xs">Language: {data.language}</p>
      )}

      {!audioUrl ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={`text-primary-foreground flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium ${
              recording
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            } disabled:opacity-60`}
          >
            {recording ? (
              <>
                <Square className="h-4 w-4" /> Stop Recording
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Start Recording
              </>
            )}
          </button>
          {recording && (
            <p className="text-destructive font-mono text-sm">
              {formatTime(duration)}
              {data.maxDurationSeconds && ` / ${formatTime(data.maxDurationSeconds)}`}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <audio src={audioUrl} controls className="w-full max-w-md" />
          <button
            type="button"
            onClick={reset}
            disabled={disabled}
            className="text-primary flex items-center gap-1 text-sm hover:underline disabled:opacity-60"
          >
            <RotateCcw className="h-3 w-3" /> Re-record
          </button>
        </div>
      )}
    </div>
  );
}
