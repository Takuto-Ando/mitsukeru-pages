import {
  penColorsFor,
  sketchPresentationFor,
} from "../content/sketchPresentation";
import { challengeTitle } from "../content/challengeTitle";
import { BubbleLine } from "../components/BubbleLine";
import { ZooCardSummary } from "../components/ZooCardSummary";
import { SketchResultCardFooter } from "../components/SketchResultCardFooter";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import { CardLettering } from "../components/CardLettering";
import { Camera, CircleHelp, CornerDownLeft } from "lucide-react";
import { useRef, type ComponentProps } from "react";
import { SketchComparison } from "../components/SketchComparison";
import { assetPath } from "../content/artwork";
import { designCardViewport } from "../drawing/viewport";
import { SketchCanvas } from "../SketchCanvas";
import type { ObservationGroup } from "../content/groups";
import type { ObservationTask } from "../content/tasks";
import type { Evaluation, Stroke } from "../types";

type DrawingProps = Pick<
  ComponentProps<typeof SketchCanvas>,
  "strokes" | "canUndo" | "canRedo" | "onUndo" | "onRedo" | "onChange"
>;

export function ReplicaDraw({
  task,
  showHint,
  onHint,
  onDone,
  canComplete,
  observationTools,
  unrestrictedDrawing,
  ...drawing
}: DrawingProps & {
  task: ObservationTask;
  showHint: boolean;
  onHint: () => void;
  onDone: () => void;
  canComplete: boolean;
  observationTools?: boolean;
  unrestrictedDrawing?: boolean;
}) {
  const prompt = sketchPresentationFor(task.scene)?.prompt;
  const activeStroke = useRef(false);
  return (
    <section className="design3-draw">
      <SketchCanvas
        key={task.id}
        {...drawing}
        scene={task.scene}
        initialPenColors={penColorsFor(task.groupId)}
        observationTools={observationTools}
        unrestrictedDrawing={unrestrictedDrawing}
        fixedPortrait
        inkBehindArtwork
        onDrawingActivity={(active) => {
          activeStroke.current = active;
        }}
        showTarget={showHint}
        missionTitle={
          showHint
            ? "もうすこし観察してみて！"
            : (prompt?.text ?? task.part + "をよく観察してみて！")
        }
        missionHighlights={
          !showHint && task.id === "giraffe" ? ["舌"] : undefined
        }
        missionLettering={
          showHint
            ? "illustrations/pdf-design/drawing-prompt-hint.svg"
            : prompt?.lettering
        }
        actions={
          <>
            <button
              className="drawing-pill drawing-pill-green sketch-hint-button"
              onClick={onHint}
              aria-pressed={showHint}
              disabled={showHint}
            >
              <CircleHelp size={18} aria-hidden />
              <CardLettering
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-hint.svg",
                )}
                text="ヒントを見る"
              />
            </button>
            <button
              className="drawing-pill draw-complete"
              onClick={() => {
                if (!activeStroke.current) onDone();
              }}
              disabled={!canComplete}
            >
              <img
                className="drawing-pitsune-icon"
                alt=""
                width={19}
                height={17}
                src={assetPath("figma/entry/sketch-confirm.svg")}
              />
              <CardLettering
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-finish.svg",
                )}
                text="できた！"
              />
            </button>
          </>
        }
      />
    </section>
  );
}

export function ReplicaResult({
  task,
  group,
  strokes,
  feedback,
  tutorial,
  saving,
  onRedraw,
  showComparisonModes = true,
  unrestrictedDrawing,
  onConfirm,
  onDone,
}: {
  task: ObservationTask;
  group: ObservationGroup;
  strokes: Stroke[];
  feedback: Evaluation;
  tutorial: boolean;
  saving: boolean;
  onRedraw: () => void;
  showComparisonModes?: boolean;
  unrestrictedDrawing?: boolean;
  onConfirm: () => void;
  onDone: () => void;
}) {
  const fact = zooAnimalSummary(group.id, task.id);
  const title = challengeTitle(task.id, group.name, task.part);

  return (
    <section className="design3-result">
      <div className="result-pitsune">
        <img
          alt=""
          className="result-pitsune-face"
          src={assetPath("figma/entry/sketch-face.svg")}
        />
        <h1 className="pitsune-bubble">
          {feedback.passed && !showComparisonModes ? (
            <BubbleLine text="なんでこんな形なのかな？" />
          ) : feedback.passed && feedback.method === "automatic" ? (
            <CardLettering
              className="drawing-lettering"
              src={assetPath(
                "illustrations/pdf-design/drawing-prompt-success.svg",
              )}
              text="上手に描けたね！"
            />
          ) : (
            <BubbleLine text={feedback.message} />
          )}
        </h1>
      </div>
      <SketchComparison
        strokes={strokes}
        scene={task.scene}
        answer={group.answer}
        completed={feedback.passed}
        initialMode="drawing"
        animateDrawingFor={task.id}
        showReplay={false}
        showModes={showComparisonModes}
        unrestrictedDrawing={unrestrictedDrawing}
        viewport={designCardViewport(task.scene)}
        compactCard={unrestrictedDrawing}
        cardFooter={
          unrestrictedDrawing ? (
            <SketchResultCardFooter
              title={title}
              taskId={task.id}
              regionCount={task.scene.regions.length}
              summary={fact}
            />
          ) : (
            fact && <ZooCardSummary className="result-fact" text={fact} />
          )
        }
        afterCard={
          <div className="drawing-actions result-actions">
            <button
              className="drawing-pill drawing-pill-green"
              onClick={onRedraw}
              disabled={saving}
            >
              <CornerDownLeft aria-hidden="true" width={21} height={20} />
              <span>描きなおす</span>
            </button>
            {feedback.passed && (
              <button
                className="drawing-pill"
                onClick={onDone}
                disabled={saving}
              >
                {tutorial ? (
                  <img
                    alt=""
                    className="pitsune-cta-icon"
                    src={assetPath("figma/entry/sketch-confirm.svg")}
                    width={18.5146}
                    height={17}
                  />
                ) : (
                  <Camera aria-hidden="true" size={22} />
                )}
                <span>{tutorial ? "つぎへ" : "写真を撮る"}</span>
              </button>
            )}
          </div>
        }
      />
      {!feedback.passed && (
        <div className="self-check">
          {feedback.suggestion && <p>{feedback.suggestion}</p>}
          <button className="primary" onClick={onConfirm}>
            見くらべて、確かめた！
          </button>
        </div>
      )}
    </section>
  );
}
