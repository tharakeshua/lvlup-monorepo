import { useCallback, useEffect, useRef, useState } from "react";

// Minimal shape of the Web Speech API — not in lib.dom.d.ts, so we declare
// just what we use rather than pulling in a third-party types package.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface UseSpeechToTextOptions {
  /** Called with each finalized chunk of transcribed speech. */
  onResult: (transcript: string) => void;
}

/** Browser-native voice-to-text via the Web Speech API. Unsupported browsers
 * (e.g. Firefox) get `isSupported: false` and should hide the mic affordance. */
export function useSpeechToText({ onResult }: UseSpeechToTextOptions) {
  const Ctor = useRef(getSpeechRecognitionCtor()).current;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      if (text.trim()) onResultRef.current(text.trim());
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [Ctor]);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    recognitionRef.current.start();
    setIsListening(true);
  }, [isListening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return { isSupported: !!Ctor, isListening, start, stop, toggle };
}
