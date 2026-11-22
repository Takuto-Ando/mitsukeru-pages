import { useEffect, useId, useRef, useState } from "react";
import { BookOpenText, ChevronDown, X } from "lucide-react";
import { FuriganaProvider } from "../furigana/Furigana";
import {
  maximumAge,
  preferencesForAge,
  type Difficulty,
  type ObservationPreferences,
} from "../replica/preferences";
import "./observation-preferences.css";

const levels: { value: Difficulty; label: string }[] = [
  { value: 1, label: "やさしい" },
  { value: 2, label: "ふつう" },
  { value: 3, label: "むずかしい" },
];
const ages = Array.from({ length: maximumAge + 1 }, (_, age) => age);

export function ObservationPreferenceControls({
  preferences,
  onChange,
}: {
  preferences: ObservationPreferences;
  onChange: (next: ObservationPreferences) => void;
}) {
  const agesId = useId();
  const ageTrigger = useRef<HTMLButtonElement>(null);
  const selectedAge = useRef<HTMLButtonElement>(null);
  const [showAges, setShowAges] = useState(false);
  useEffect(() => {
    if (!showAges || !selectedAge.current) return;
    selectedAge.current.scrollIntoView({ block: "nearest" });
    selectedAge.current.focus({ preventScroll: true });
  }, [showAges]);

  return (
    <div className="observation-preferences">
      <div className="observation-preference-row">
        <span>年齢</span>
        <button
          ref={ageTrigger}
          type="button"
          aria-expanded={showAges}
          aria-controls={showAges ? agesId : undefined}
          onClick={() => setShowAges(!showAges)}
        >
          {preferences.age === undefined
            ? "年齢を選ぶ"
            : `${preferences.age}歳`}
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      </div>
      {showAges && (
        <div
          className="observation-age-list"
          role="group"
          aria-label="年齢"
          id={agesId}
        >
          {ages.map((age) => (
            <button
              key={age}
              ref={age === (preferences.age ?? 0) ? selectedAge : undefined}
              type="button"
              aria-pressed={preferences.age === age}
              onClick={() => {
                onChange(preferencesForAge(preferences, age));
                setShowAges(false);
                ageTrigger.current?.focus({ preventScroll: true });
              }}
            >
              {age}歳
            </button>
          ))}
        </div>
      )}
      <div className="observation-preference-row">
        <span>
          <BookOpenText aria-hidden="true" size={19} />
          ふりがな
        </span>
        <button
          type="button"
          aria-pressed={preferences.furigana}
          onClick={() =>
            onChange({ ...preferences, furigana: !preferences.furigana })
          }
        >
          ふりがな {preferences.furigana ? "ON" : "OFF"}
        </button>
      </div>
      <fieldset>
        <legend>難易度</legend>
        <div className="observation-difficulty-options">
          {levels.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={(preferences.difficulty ?? 1) === value}
              onClick={() => onChange({ ...preferences, difficulty: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function StartPreferencesDialog({
  preferences,
  onCancel,
  onStart,
}: {
  preferences: ObservationPreferences;
  onCancel: () => void;
  onStart: (settings: ObservationPreferences) => void;
}) {
  const [draft, setDraft] = useState(preferences);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  function cancel() {
    dialog.current?.close();
    onCancel();
  }

  return (
    <FuriganaProvider enabled={draft.furigana}>
      <dialog
        ref={dialog}
        aria-labelledby={title}
        className="settings-dialog observation-start-dialog"
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
      >
        <div className="settings-heading">
          <h2 id={title}>年齢を教えてください</h2>
          <button type="button" aria-label="閉じる" onClick={cancel}>
            <X aria-hidden="true" size={22} />
          </button>
        </div>
        <div className="settings-content">
          <ObservationPreferenceControls
            preferences={draft}
            onChange={setDraft}
          />
        </div>
        <button
          type="button"
          className="settings-done observation-primary"
          onClick={() => onStart(draft)}
        >
          チュートリアルを始める
        </button>
      </dialog>
    </FuriganaProvider>
  );
}
