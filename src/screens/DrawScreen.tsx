import { useEffect, useRef } from "react";
import {
  ArrowRight,
  ChevronDown,
  Eye as EyeIcon,
  Lightbulb,
} from "lucide-react";
import { SketchCanvas } from "../SketchCanvas";
import type { Challenge, Evaluation, Stroke } from "../types";

export function DrawScreen({
  challenge,
  photo,
  strokes,
  changeStrokes,
  evaluation,
  hint,
  setHint,
  attempts,
  answer,
  onContinue,
}: {
  challenge: Challenge;
  photo: string;
  strokes: Stroke[];
  changeStrokes: (next: Stroke[]) => void;
  evaluation?: Evaluation;
  hint: boolean;
  setHint: (next: boolean) => void;
  attempts: number;
  answer: () => void;
  onContinue: () => void;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (evaluation && !evaluation.passed) {
      feedbackRef.current?.focus({ preventScroll: true });
      feedbackRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [evaluation]);
  return (
    <section className="draw-page">
      <div className="draw-copy">
        <span className="subject-tag">ヤギのかんさつ</span>
        <h1 tabIndex={-1}>{challenge.title}</h1>
        <p>{challenge.observationInstruction}</p>
        <div className="drawing-reminder">
          <EyeIcon size={18} />
          <span>画面とどうぶつを、見くらべてね。</span>
        </div>
        {photo && (
          <details className="reference-photo">
            <summary>
              カメラ写真を見直す
              <ChevronDown size={15} />
            </summary>
            <img
              src={photo}
              alt="自分で選んだ観察用写真（動物は自動判別していません）"
            />
          </details>
        )}
      </div>
      <div className="drawing-workspace">
        <SketchCanvas strokes={strokes} onChange={changeStrokes} />
        {evaluation && !evaluation.passed && (
          <div
            ref={feedbackRef}
            className="retry-message"
            role="status"
            tabIndex={-1}
          >
            <span className="retry-icon">
              <EyeIcon size={22} />
            </span>
            <div>
              <strong>{evaluation.message}</strong>
              <p>{evaluation.suggestion}</p>
              <button className="primary" onClick={onContinue}>
                {evaluation.status === "uncertain"
                  ? "うん、横長に見えた"
                  : "解説を見て確かめる"}
              </button>
              {evaluation.status === "uncertain" && (
                <button className="text-button" onClick={() => setHint(true)}>
                  もう少し観察する
                </button>
              )}
            </div>
          </div>
        )}
        <div className="answer-actions">
          <button
            className="hint-button"
            aria-expanded={hint}
            onClick={() => setHint(!hint)}
          >
            <Lightbulb size={19} />
            {hint ? "ヒントをとじる" : "ちょっとヒント"}
          </button>
          <button
            className="primary answer-button"
            disabled={!strokes.length}
            onClick={answer}
          >
            これで答える
            <ArrowRight size={19} />
          </button>
        </div>
        {hint && (
          <div className="hint-panel" role="note">
            <Lightbulb size={21} />
            <p>
              {
                challenge.hint[
                  Math.min(Math.max(0, attempts - 1), challenge.hint.length - 1)
                ]
              }
            </p>
          </div>
        )}
        <p className="sketch-reassurance">
          上手に描けなくても大丈夫。かたちが伝われば、いいんだよ。
        </p>
      </div>
    </section>
  );
}
