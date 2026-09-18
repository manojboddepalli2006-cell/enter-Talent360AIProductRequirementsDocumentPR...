/**
 * Browser speech helpers for the video interview.
 *
 * - `speak` uses the Web Speech synthesis API so the AI "asks" each question
 *   aloud. Pure client-side, no server dependency.
 * - The transcriber uses the Web Speech recognition API (Chromium-based
 *   browsers) so the candidate's spoken answer is captured as text for the
 *   AI to score. If the browser does not support it, the UI falls back to a
 *   manual text box.
 */

export const SPEECH_SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;
export const RECOGNITION_SUPPORTED =
  typeof window !== "undefined" &&
  Boolean(
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition,
  );

let lastVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!SPEECH_SUPPORTED) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    lastVoice =
      voices.find((voice) => voice.lang.startsWith("en") && voice.name.includes("Google")) ??
      voices.find((voice) => voice.lang.startsWith("en")) ??
      voices[0];
  }
  return lastVoice;
}

// Some engines populate voices asynchronously.
if (SPEECH_SUPPORTED) {
  window.speechSynthesis.onvoiceschanged = () => {
    pickVoice();
  };
}

/** Speaks a question aloud. Returns a function that stops playback. */
export function speak(text: string): () => void {
  if (!SPEECH_SUPPORTED) return () => undefined;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);

  return () => window.speechSynthesis.cancel();
}

export function stopSpeaking(): void {
  if (SPEECH_SUPPORTED) window.speechSynthesis.cancel();
}

export interface TranscriberHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

export interface Transcriber {
  start: () => void;
  stop: () => void;
  active: () => boolean;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: unknown) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

/** Live speech-to-text that appends into the caller's answer buffer. */
export function createTranscriber(handlers: TranscriberHandlers): Transcriber | null {
  const Win = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };

  const Ctor = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event: unknown) => {
    const resultEvent = event as {
      resultIndex: number;
      results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
    };
    let interim = "";
    let final = "";

    for (let index = resultEvent.resultIndex; index < resultEvent.results.length; index += 1) {
      const result = resultEvent.results[index];
      const item = result[0];
      if (result && typeof (result as { isFinal?: boolean }).isFinal === "boolean") {
        if ((result as { isFinal?: boolean }).isFinal) final += item.transcript;
        else interim += item.transcript;
      } else {
        interim += item.transcript;
      }
    }

    if (final) handlers.onFinal(final);
    if (interim) handlers.onInterim(interim);
  };

  recognition.onerror = (event: unknown) => {
    const errorEvent = event as { error?: string };
    const code = errorEvent?.error ?? "unknown";
    const message =
      code === "not-allowed" || code === "service-not-allowed"
        ? "Microphone permission was denied. Type your answer instead."
        : code === "no-speech"
          ? "No speech was detected."
          : code === "audio-capture"
            ? "No microphone is available."
            : `Speech recognition unavailable (${code}). Type your answer instead.`;
    handlers.onError(message);
  };

  recognition.onend = () => handlers.onEnd();

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        handlers.onError("Speech recognition could not start. Type your answer instead.");
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
    active: () => true,
  };
}
