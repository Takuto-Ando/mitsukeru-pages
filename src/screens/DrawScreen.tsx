import { useEffect, useReducer, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { ChevronLeft, CircleHelp, CornerDownLeft } from "lucide-react";
import { SketchCanvas } from "../SketchCanvas";
import { Pitsune, PitsuneIcon } from "../components/Pitsune";
import { assetPath } from "../content/artwork";
import type { ObservationTask } from "../content/tasks";
import { drawingHistory, emptyDrawing } from "../drawing/history";
import { savePng } from "../notebook/images";
import { ReadAloud } from "../speech/Speech";
import type { Evaluation, Stroke } from "../types";

type CanvasControls = Pick<
  ComponentProps<typeof SketchCanvas>,
  "canUndo" | "canRedo" | "onUndo" | "onRedo" | "onChange" | "onDrawingActivity"
>;

export function DrawScreen({
  task,
  photo,
  strokes,
  feedback,
  hintLevel,
  onHint,
  onAnswer,
  onContinue,
  onAbsent,
  onReselect,
  canvasProps,
}: {
  task: ObservationTask;
  photo: string;
  strokes: Stroke[];
  feedback?: Evaluation;
  hintLevel: number;
  onHint: () => void;
  onAnswer: () => void;
  onContinue: () => void;
  onAbsent: () => void;
  onReselect: () => void;
  canvasProps: CanvasControls;
}) {
  const hasHint = hintLevel > 0;
  const observationPrompt =
    task.id === "giraffe"
      ? "舌をよく観察してみて！"
      : task.part + "をよく観察してみて！";
  const hints = task.hints?.length ? task.hints : [task.hint];
  const canShowHint = hintLevel < hints.length;
  const feedbackMessage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!feedback || feedback.passed) return;
    feedbackMessage.current?.focus({ preventScroll: true });
    feedbackMessage.current?.scrollIntoView({ block: "nearest" });
  }, [feedback]);
  const reference = (
    <>
      {photo && (
        <details>
          <summary>撮影した写真を確認</summary>
          <img
            className="selected-photo"
            src={photo}
            alt="撮影した動物の写真"
          />
        </details>
      )}
      <button className="text-button" onClick={onReselect}>
        動物を選び直す
      </button>
    </>
  );

  return (
    <div className="design3-draw">
      <SketchCanvas
        {...canvasProps}
        photoUrl={photo || undefined}
        missionTitle={hasHint ? "もうすこし観察してみて！" : observationPrompt}
        landscapeReselect={reference}
        missionLettering={
          hasHint
            ? "illustrations/pdf-design/drawing-prompt-hint.svg"
            : task.id === "giraffe"
              ? "illustrations/pdf-design/drawing-prompt-giraffe.svg"
              : undefined
        }
        scene={task.scene}
        strokes={strokes}
        showTarget={hasHint}
        actions={
          <>
            <button
              className="drawing-pill drawing-pill-green sketch-hint-button"
              aria-expanded={hasHint}
              aria-controls="observation-hint"
              disabled={!canShowHint}
              onClick={onHint}
            >
              <CircleHelp size={18} aria-hidden="true" />
              {hasHint && canShowHint ? (
                "次のヒントを見る"
              ) : hasHint ? (
                "ヒントを表示中"
              ) : (
                <img
                  className="drawing-lettering"
                  src={assetPath(
                    "illustrations/pdf-design/drawing-action-hint.svg",
                  )}
                  alt="ヒントを見る"
                />
              )}
            </button>
            <button
              className="drawing-pill draw-complete"
              disabled={!strokes.length}
              onClick={onAnswer}
            >
              <img
                className="drawing-pitsune-icon"
                alt=""
                width={19}
                height={17}
                src={assetPath("figma/entry/sketch-confirm.svg")}
              />
              <img
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-finish.svg",
                )}
                alt="できた！"
              />
            </button>
          </>
        }
      />
      <div
        id="observation-hint"
        className="observation-hints"
        hidden={!hasHint}
      >
        {hasHint && (
          <>
            <ol role="note">
              {hints.slice(0, hintLevel).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <ReadAloud id="hints" text={hints.slice(0, hintLevel).join("。")} />
          </>
        )}
      </div>
      {feedback && !feedback.passed && (
        <div
          ref={feedbackMessage}
          role="status"
          className="figma-feedback"
          tabIndex={-1}
        >
          <p>{feedback.message}</p>
          <p>{feedback.suggestion}</p>
          <button className="primary" onClick={onContinue}>
            {feedback.status === "uncertain"
              ? "見えた形をお手本と比べる"
              : "お手本で確かめる"}
          </button>
          {import.meta.env.DEV &&
            new URLSearchParams(location.search).has("debug") && (
              <details>
                <summary>判定デバッグ</summary>
                <pre>{JSON.stringify(feedback, null, 2)}</pre>
              </details>
            )}
        </div>
      )}
      {task.allowAbsent && !strokes.length && (
        <button className="text-button" onClick={onAbsent}>
          模様が見えないので、見くらべる
        </button>
      )}
      <div className="draw-afterword">
        <p className="figma-support">{task.question}</p>
        <ReadAloud id="question" text={task.question} />
        <div className="drawing-reference">{reference}</div>
      </div>
    </div>
  );
}

export function FreeDrawScreen({
  onDone,
  fixedPortrait,
}: {
  onDone: () => void;
  fixedPortrait?: boolean;
}) {
  const [drawing, dispatch] = useReducer(
    drawingHistory,
    undefined,
    emptyDrawing,
  );
  const canvas = useRef<HTMLCanvasElement>(null);
  const previewFrame = useRef<number | undefined>(undefined);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob }>();
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (previewFrame.current !== undefined)
        cancelAnimationFrame(previewFrame.current);
      previewFrame.current = undefined;
    },
    [],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  function previewDrawing() {
    const source = canvas.current;
    if (!source || previewFrame.current !== undefined) return;
    setError("");
    setPreviewing(true);
    function finishPreview(blob: Blob | null) {
      if (previewFrame.current === undefined) return;
      previewFrame.current = undefined;
      setPreviewing(false);
      if (blob) {
        setPreview({ url: URL.createObjectURL(blob), blob });
        window.scrollTo(0, 0);
      } else {
        setError("スケッチを表示できませんでした。");
      }
    }
    previewFrame.current = requestAnimationFrame(() => {
      const copy = document.createElement("canvas");
      copy.width = source.width;
      copy.height = source.height;
      const context = copy.getContext("2d");
      if (!context) {
        finishPreview(null);
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, copy.width, copy.height);
      context.drawImage(source, 0, 0);
      copy.toBlob(finishPreview, "image/png");
    });
  }

  return (
    <section className="design3-draw design3-free-draw">
      {error && <p role="alert">{error}</p>}
      <div className="free-drawing-editor" hidden={!!preview}>
        <button
          type="button"
          className="free-drawing-back"
          aria-label="カメラに戻る"
          onClick={onDone}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <SketchCanvas
          template="blank"
          fixedPortrait={fixedPortrait}
          missionTitle="よ〜く観察してみて！"
          canvasRef={canvas}
          strokes={drawing.present}
          canUndo={drawing.past.length > 0}
          canRedo={drawing.future.length > 0}
          onUndo={() => dispatch({ type: "undo" })}
          onRedo={() => dispatch({ type: "redo" })}
          onChange={(strokes) => dispatch({ type: "commit", strokes })}
          actions={
            <button
              className="drawing-pill draw-complete"
              disabled={!drawing.present.length || previewing}
              onClick={previewDrawing}
            >
              <PitsuneIcon className="drawing-pitsune-icon" />
              できた！
            </button>
          }
        />
      </div>
      {preview && (
        <>
          <div className="result-pitsune">
            <Pitsune pose="face" className="result-pitsune-face" />
            <h1 className="pitsune-bubble">上手に描けたね！</h1>
          </div>
          <img
            className="free-drawing-preview"
            src={preview.url}
            alt="自由に描いたスケッチ"
          />
          <div className="drawing-actions">
            <button
              className="drawing-pill drawing-pill-green"
              onClick={() => setPreview(undefined)}
            >
              <CornerDownLeft size={18} aria-hidden="true" />
              描きなおす
            </button>
            <button className="drawing-pill" onClick={onDone}>
              写真を撮る
            </button>
          </div>
          <button
            className="text-button"
            onClick={() =>
              void savePng(preview.blob, "zooketch-sketch.png").catch(() =>
                setError(
                  "PNG画像を保存できませんでした。もう一度試してください。",
                ),
              )
            }
          >
            自分の絵をPNGで保存
          </button>
        </>
      )}
    </section>
  );
}
