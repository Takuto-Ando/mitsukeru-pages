import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { FuriganaProvider } from "../furigana/Furigana";
import {
  maximumAge,
  preferencesForAge,
  type Difficulty,
  type ObservationPreferences,
} from "../replica/preferences";
import "./observation-preferences.css";

const difficultyLabels: Record<Difficulty, string> = {
  1: "かんたん",
  2: "ふつう",
  3: "むずかしい",
};
const nextDifficulty: Record<Difficulty, Difficulty> = { 1: 2, 2: 3, 3: 1 };
const ages = Array.from({ length: maximumAge + 1 }, (_, age) => age);

export function ObservationPreferenceControls({
  preferences,
  onChange,
  startDesign = false,
}: {
  preferences: ObservationPreferences;
  onChange: (next: ObservationPreferences) => void;
  startDesign?: boolean;
}) {
  const agesId = useId();
  const ageTrigger = useRef<HTMLButtonElement>(null);
  const selectedAge = useRef<HTMLButtonElement>(null);
  const [showAges, setShowAges] = useState(false);
  const difficulty = preferences.difficulty ?? 1;
  const difficultyLabel = difficultyLabels[difficulty];
  const ageLabel =
    preferences.age === undefined ? "年齢を選ぶ" : `${preferences.age}歳`;
  useEffect(() => {
    if (!showAges || !selectedAge.current) return;
    selectedAge.current.scrollIntoView({ block: "nearest" });
    selectedAge.current.focus({ preventScroll: true });
  }, [showAges]);

  return (
    <div
      className={`observation-preferences${startDesign ? " observation-start-controls" : ""}`}
    >
      <div className="observation-preference-row observation-age-row">
        {!startDesign && <span>年齢</span>}
        <button
          ref={ageTrigger}
          type="button"
          aria-label={ageLabel}
          aria-expanded={showAges}
          aria-controls={showAges ? agesId : undefined}
          onClick={() => setShowAges((open) => !open)}
        >
          {startDesign
            ? (preferences.age ?? <span className="observation-age-empty" />)
            : ageLabel}
          {!startDesign && <ChevronDown aria-hidden="true" size={16} />}
        </button>
        {startDesign && <span aria-hidden="true">歳</span>}
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
        <span>ふりがな</span>
        <button
          type="button"
          aria-label={`ふりがな ${preferences.furigana ? "ON" : "OFF"}`}
          aria-pressed={preferences.furigana}
          onClick={() =>
            onChange({ ...preferences, furigana: !preferences.furigana })
          }
        >
          {!startDesign && "ふりがな "}
          {preferences.furigana ? "ON" : "OFF"}
        </button>
      </div>
      <div className="observation-preference-row">
        <span>難易度</span>
        <button
          className="observation-difficulty-button"
          type="button"
          aria-label={`難易度 ${difficultyLabel}`}
          onClick={() =>
            onChange({ ...preferences, difficulty: nextDifficulty[difficulty] })
          }
        >
          {difficultyLabel}
        </button>
      </div>
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
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useId();
  useEffect(() => {
    const modal = dialog.current;
    if (modal && !modal.open) {
      modal.showModal();
      heading.current?.focus({ preventScroll: true });
    }
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
        className="observation-start-dialog"
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
      >
        <button
          type="button"
          className="observation-start-close"
          aria-label="閉じる"
          onClick={cancel}
        >
          <X aria-hidden="true" size={42} strokeWidth={2} />
        </button>
        <div className="observation-start-panel">
          <h2 id={title} ref={heading} tabIndex={-1}>
            あなたの年齢を教えてください。
          </h2>
          <p>※難易度がカスタマイズされます。</p>
          <ObservationPreferenceControls
            preferences={draft}
            onChange={setDraft}
            startDesign
          />
          <button
            type="button"
            className="observation-primary"
            onClick={() => onStart(draft)}
          >
            決定！
            <ChevronRight aria-hidden="true" size={20} strokeWidth={2.6} />
          </button>
        </div>
      </dialog>
    </FuriganaProvider>
  );
}
