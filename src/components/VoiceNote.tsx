import { useEffect, useRef, useState } from "react";
import { updateObservationVoice } from "../notebook/storage";
import type { ObservationRecord } from "../notebook/types";

// おしゃべり観察カード：自分の声で絵の説明を録音してカードに付ける。
export function VoiceNote({
  drawing,
  onSaved,
}: {
  drawing: ObservationRecord;
  onSaved?: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string>("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
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

  if (!supported) return null;

  const toggle = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, {
          type: rec.mimeType || "audio/webm",
        });
        void updateObservationVoice(drawing.id, blob)
          .then(() => onSaved?.())
          .catch(() => undefined);
      };
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  return (
    <div className="voice-note">
      <button type="button" onClick={toggle} aria-pressed={recording}>
        {recording
          ? "■ 録音を止める"
          : drawing.voiceNote
            ? "🎙 声の発表を録り直す"
            : "🎙 声で発表する（録音）"}
      </button>
      {url && (
        <audio controls src={url} aria-label="録音した声の発表">
          声の再生に対応していません
        </audio>
      )}
    </div>
  );
}
