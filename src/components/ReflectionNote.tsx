import { useId, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<{ 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function recognitionCtor():
  | (new () => SpeechRecognitionLike)
  | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function createRecognition(): SpeechRecognitionLike | null {
  const Ctor = recognitionCtor();
  return Ctor ? new Ctor() : null;
}

export function ReflectionNote({
  value,
  question,
  disabled,
  onChange,
}: {
  value: { discovery: string; revisited: boolean };
  question: string;
  disabled: boolean;
  onChange: (value: { discovery: string; revisited: boolean }) => void;
}) {
  const id = useId();
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported =
    typeof window !== "undefined" && !!recognitionCtor();

  const toggleVoice = () => {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const rec = createRecognition();
    if (!rec) return;
    recognition.current = rec;
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text)
        onChange({
          ...value,
          discovery: (value.discovery + text).slice(0, 200),
        });
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <fieldset className="reflection-note" disabled={disabled}>
      <legend>もう一度、本物を見てみよう</legend>
      <p>{question}</p>
      <label className="reflection-check">
        <input
          type="checkbox"
          checked={value.revisited}
          onChange={(e) => onChange({ ...value, revisited: e.target.checked })}
        />
        実物を見て確かめた
      </label>
      <label htmlFor={id}>どんなことに気づいた？（書かなくても大丈夫）</label>
      <textarea
        id={id}
        rows={2}
        maxLength={200}
        value={value.discovery}
        onChange={(e) => onChange({ ...value, discovery: e.target.value })}
      />
      {voiceSupported && (
        <button
          type="button"
          className="voice-input-button"
          aria-pressed={listening}
          onClick={toggleVoice}
        >
          {listening ? "聞き取り中…（タップで停止）" : "🎙 声で入力する"}
        </button>
      )}
    </fieldset>
  );
}
