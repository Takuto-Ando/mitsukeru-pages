import { useEffect, useState, useSyncExternalStore } from "react";
let state = { enabled: true, rate: 0.9, speaking: "", message: "" };
const listeners = new Set<() => void>();
let serial = 0;
const snapshot = () => state;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function update(value: Partial<typeof state>) {
  state = { ...state, ...value };
  listeners.forEach((fn) => fn());
}
export function stopSpeech() {
  serial++;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  update({ speaking: "" });
}
export function japaneseVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find((v) => /^ja(?:-|_|$)/i.test(v.lang));
}
export function ReadAloud({ text, id }: { text: string; id: string }) {
  const s = useSyncExternalStore(subscribe, snapshot);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable("speechSynthesis" in window);
    return stopSpeech;
  }, []);
  if (!available || !s.enabled) return null;
  return (
    <>
      <button
        className="text-button read-aloud"
        aria-pressed={s.speaking === id}
        onClick={() => {
          if (s.speaking === id) {
            stopSpeech();
            return;
          }
          stopSpeech();
          const voice = japaneseVoice(speechSynthesis.getVoices());
          if (!voice) {
            update({
              message:
                "日本語の音声を利用できません。文章を見ながら観察できます。",
            });
            return;
          }
          const generation = ++serial,
            utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "ja-JP";
          utterance.voice = voice;
          utterance.rate = s.rate;
          utterance.onend = () => {
            if (serial === generation) update({ speaking: "" });
          };
          utterance.onerror = () => {
            if (serial === generation)
              update({
                speaking: "",
                message: "音声を再生できませんでした。文章でも確認できます。",
              });
          };
          update({ speaking: id, message: "" });
          speechSynthesis.speak(utterance);
        }}
      >
        {s.speaking === id ? "読み上げを止める" : "読み上げる"}
      </button>
      {s.message && (
        <p role="status" className="quiet-note">
          {s.message}
        </p>
      )}
    </>
  );
}
export function SpeechSettings() {
  const s = useSyncExternalStore(subscribe, snapshot);
  return (
    <details className="speech-settings">
      <summary>読み上げの設定</summary>
      <label>
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => {
            stopSpeech();
            update({ enabled: e.target.checked });
          }}
        />
        読み上げボタンを使う
      </label>
      <label>
        読む速さ{" "}
        <select
          aria-label="読む速さ"
          value={s.rate}
          onChange={(e) => {
            stopSpeech();
            update({ rate: Number(e.target.value) });
          }}
        >
          <option value="0.7">ゆっくり</option>
          <option value="0.9">ふつう</option>
          <option value="1.1">はやめ</option>
        </select>
      </label>
      <p className="quiet-note">
        ボタンを押したときだけ読み上げます。日本語音声やオフラインでの再生は、端末の音声設定によって異なります。
      </p>
      {s.message && <p role="status">{s.message}</p>}
    </details>
  );
}
