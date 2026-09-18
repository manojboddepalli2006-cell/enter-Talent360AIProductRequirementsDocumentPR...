import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "denied"
  | "unsupported"
  | "ready"
  | "recording"
  | "recorded";

export interface UseMediaRecorderResult {
  status: RecorderStatus;
  error: string | null;
  elapsed: number;
  /** URL of the most recent recording for playback. */
  blobUrl: string | null;
  /** The live camera stream, for assigning to <video>.srcObject. */
  stream: MediaStream | null;
  /** Requests camera + microphone; shows a live preview once granted. */
  requestCamera: () => Promise<void>;
  /** Starts capturing from the already-requested camera. */
  beginRecording: () => void;
  /** Stops capturing and finalises the recording blob. */
  stopRecording: () => void;
  reset: () => void;
  takeBlob: () => Blob | null;
}

const MIME_PREFERENCE = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_PREFERENCE.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null;
}

/**
 * Webcam + microphone recording for the video interview. The recording is kept
 * in the tab for immediate playback (it is not uploaded anywhere); the spoken
 * answer is transcribed live so the AI can score it.
 */
export function useMediaRecorder(): UseMediaRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      cleanupTracks();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl, cleanupTracks]);

  const requestCamera = useCallback(async () => {
    if (status === "recording" || status === "ready") return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("Video recording is not supported in this browser. Use the text interview instead.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      setError("Media recording is not supported in this browser. Use the text interview instead.");
      return;
    }

    setStatus("requesting");
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStatus("ready");
    } catch (caught) {
      setStatus("denied");
      setError(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Camera or microphone permission was denied. Allow access and try again, or use the text interview."
          : "No camera or microphone was found. Use the text interview instead.",
      );
    }
  }, [status]);

  const beginRecording = useCallback(() => {
    const mediaStream = streamRef.current;
    if (!mediaStream) return;

    const mimeType = pickMimeType();
    const recorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: 2_000_000 })
      : new MediaRecorder(mediaStream, { videoBitsPerSecond: 2_000_000 });

    chunksRef.current = [];
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType ?? "video/webm" });
      blobRef.current = blob;
      setBlobUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      setElapsed(0);
      setStatus("recorded");
      clearTimer();
    };

    recorder.start(1000);
    setElapsed(0);
    setStatus("recording");
    const startedAt = Date.now();
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
  }, [clearTimer]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const reset = useCallback(() => {
    stopRecording();
    cleanupTracks();
    setStatus("idle");
    setError(null);
    setElapsed(0);
    setBlobUrl(null);
    setStream(null);
    blobRef.current = null;
    chunksRef.current = [];
  }, [cleanupTracks, stopRecording]);

  return {
    status,
    error,
    elapsed,
    blobUrl,
    stream,
    requestCamera,
    beginRecording,
    stopRecording,
    reset,
    takeBlob: () => blobRef.current,
  };
}
