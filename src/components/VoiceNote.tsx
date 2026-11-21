import { useEffect, useRef, useState } from "react";
import { updateObservationVoice } from "../notebook/storage";
import type { ObservationRecord } from "../notebook/types";

type RecordingSession = { stream?: MediaStream; recorder?: MediaRecorder };

// おしゃべり観察カード：自分の声で絵の説明を録音してカードに付ける。
export function VoiceNote({
  drawing,
  onSaved,
}: {
  drawing: ObservationRecord;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<
    "idle" | "opening" | "recording" | "saving"
  >("idle");
  const [error, setError] = useState("");
  const recording = state === "recording";
  const [url, setUrl] = useState<string>("");
  const session = useRef<RecordingSession | undefined>(undefined);
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    if (!drawing.voiceNote) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(drawing.voiceNote);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [drawing.voiceNote]);

  useEffect(() => {
    setState("idle");
    setError("");
    return () => {
      const previous = session.current;
      session.current = undefined;
      previous?.stream?.getTracks().forEach((track) => track.stop());
    };
  }, [drawing.id]);

  if (!supported) return null;

  const toggle = async () => {
    const existing = session.current;
    if (recording && existing?.recorder?.state === "recording") {
      setState("saving");
      existing.recorder.stop();
      return;
    }
    if (existing) return;

    const attempt: RecordingSession = {};
    session.current = attempt;
    setError("");
    setState("opening");
    const stopTracks = () =>
      attempt.stream?.getTracks().forEach((track) => track.stop());
    const fail = (message: string) => {
      stopTracks();
      if (session.current !== attempt) return;
      session.current = undefined;
      setError(message);
      setState("idle");
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      attempt.stream = stream;
      if (session.current !== attempt) {
        stopTracks();
        return;
      }
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      attempt.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => fail("録音を続けられませんでした。");
      recorder.onstop = async () => {
        stopTracks();
        if (session.current !== attempt) return;
        try {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          if (!blob.size) throw new Error("Empty voice note");
          await updateObservationVoice(drawing.id, blob);
          if (session.current === attempt) {
            session.current = undefined;
            setState("idle");
            onSaved?.();
          }
        } catch {
          fail("録音を保存できませんでした。");
        }
      };
      recorder.start();
      setState("recording");
    } catch {
      fail("録音を開始できませんでした。マイクの設定を確認してね。");
    }
  };
  return (
    <div className="voice-note">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={recording}
        disabled={state === "opening" || state === "saving"}
      >
        {recording
          ? "■ 録音を止める"
          : drawing.voiceNote
            ? "🎙 声の発表を録り直す"
            : "🎙 声で発表する（録音）"}
      </button>
      {error && <p role="alert">{error}</p>}
      {url && (
        <audio controls src={url} aria-label="録音した声の発表">
          声の再生に対応していません
        </audio>
      )}
    </div>
  );
}
