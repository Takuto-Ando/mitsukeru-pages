import { useEffect, useId, useRef, useState } from "react";
import {
  createSurveyResponse,
  surveyQuestions,
  type SurveyAnswers,
  type SurveyResponse,
} from "./postUseSurvey";
export interface PostUseSurveyProps {
  consent: boolean;
  taskId: string;
  onSave: (
    response: SurveyResponse,
    signal: AbortSignal,
  ) => void | Promise<void>;
  onSkip: () => void;
}
/** Mount only after consent. Remount with key={taskId + consentSession} when these change. */
export function PostUseSurvey(props: PostUseSurveyProps) {
  return props.consent ? (
    <SurveyForm key={props.taskId} {...props} />
  ) : (
    <p>研究参加の説明と同意の後に、利用後の質問を表示できます。</p>
  );
}
function SurveyForm({ consent, taskId, onSave, onSkip }: PostUseSurveyProps) {
  const prefix = useId();
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => pending.current?.abort(), []);
  const locked = useRef(false);
  const recordId = useRef<string | undefined>(undefined);
  return (
    <form
      aria-label="利用後の質問"
      onSubmit={async (e) => {
        e.preventDefault();
        if (locked.current || saved || !consent) return;
        locked.current = true;
        setSaving(true);
        setError("");
        const controller = new AbortController();
        pending.current = controller;
        try {
          recordId.current ||= crypto.randomUUID();
          await onSave(
            createSurveyResponse({
              consent,
              id: recordId.current,
              taskId,
              answers,
            }),
            controller.signal,
          );
          if (!controller.signal.aborted) setSaved(true);
        } catch {
          if (!controller.signal.aborted)
            setError(
              "記録できませんでした。もう一度試すか、答えずに終われます。",
            );
        } finally {
          locked.current = false;
          if (!controller.signal.aborted) setSaving(false);
        }
      }}
    >
      <h2>使ってみて、どうだった？</h2>
      <p>答えたくない質問は、とばして大丈夫です。</p>
      <fieldset
        disabled={saving || saved}
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        <legend>使った感想</legend>
        {surveyQuestions.map((q) => (
          <fieldset key={q.id} style={{ margin: "16px 0", minWidth: 0 }}>
            <legend>{q.text}</legend>
            {q.choices.map((choice, index) => (
              <label
                key={choice}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 44,
                }}
              >
                <input
                  type="radio"
                  name={`${prefix}-${q.id}`}
                  value={index + 1}
                  checked={answers[q.id] === index + 1}
                  onChange={() =>
                    setAnswers((old) => ({
                      ...old,
                      [q.id]: (index + 1) as 1 | 2 | 3,
                    }))
                  }
                />
                {choice}
              </label>
            ))}
            <button
              type="button"
              onClick={() =>
                setAnswers((old) => {
                  const copy = { ...old };
                  delete copy[q.id];
                  return copy;
                })
              }
            >
              この質問は答えない
            </button>
          </fieldset>
        ))}
        <button type="submit" className="primary">
          {saving ? "記録中…" : saved ? "記録しました" : "回答を記録する"}
        </button>
      </fieldset>
      {!saved && (
        <button
          type="button"
          className="text-button"
          disabled={saving}
          onClick={onSkip}
        >
          答えずに終わる
        </button>
      )}
      {saved && <p role="status">回答を記録しました。</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
