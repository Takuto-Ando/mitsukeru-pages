import { useEffect, useReducer, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CameraView } from "./CameraView";
import { SketchCanvas } from "./SketchCanvas";
import { SketchComparison } from "./components/SketchComparison";
import { DrawingCollection } from "./components/DrawingCollection";
import { artwork, assetPath } from "./content/artwork";
import { groups } from "./content/groups";
import { tasksForGroup, taskById } from "./content/tasks";
import { clipStrokes } from "./content/scenes";
import { evaluateProfile } from "./content/profiles";
import { evaluateObservation } from "./evaluator";
import { researchRecorder as research } from "./research/recorder";
import { createFeedbackAudio } from "./audio";
import {
  emptyCollection,
  readCollection,
  writeCollection,
  type CollectionData,
} from "./collection/storage";
import { drawingHistory, emptyDrawing } from "./drawing/history";
import type { Evaluation } from "./types";
import "./styles/cards.css";

export default function App() {
  const reduce = useReducedMotion();
  const activeTask = useRef<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [taskId, setTaskId] = useState("goat");
  const [photo, setPhoto] = useState("");
  const [drawing, dispatchDrawing] = useReducer(
    drawingHistory,
    undefined,
    emptyDrawing,
  );
  const strokes = drawing.present;
  const [feedback, setFeedback] = useState<Evaluation>();
  const [hint, setHint] = useState(false);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const audio = useRef<ReturnType<typeof createFeedbackAudio> | null>(null);
  if (!audio.current)
    audio.current = createFeedbackAudio(() => soundRef.current);
  useEffect(() => () => audio.current?.dispose(), []);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collection, setCollection] = useState<CollectionData>(emptyCollection);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [savedId, setSavedId] = useState<string>();
  const task = taskById[taskId],
    scene = task.scene,
    profile = task.profile;
  const group = groups.find((g) => g.id === task.groupId)!;
  useEffect(() => {
    try {
      setCollection(readCollection(localStorage));
      setStorageReady(true);
    } catch {
      setStorageError(
        "保存した絵を読み込めませんでした。上書きせずに残しています。",
      );
    }
  }, []);
  function commit(data: CollectionData) {
    if (!storageReady) return false;
    try {
      writeCollection(localStorage, data);
      setCollection(data);
      setStorageError("");
      return true;
    } catch {
      setStorageError(
        "保存できませんでした。空き容量やブラウザの保存設定を確認してください。",
      );
      return false;
    }
  }
  function latest() {
    try {
      return readCollection(localStorage);
    } catch {
      setStorageError(
        "保存した絵を読み込めませんでした。上書きを止めています。",
      );
      return undefined;
    }
  }
  function save() {
    const data = latest();
    if (!data || savedId || !feedback?.passed) return;
    const visible = clipStrokes(strokes, scene).map((s) =>
      s.map((p) => ({
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
      })),
    );
    if (!visible.length) return;
    const id =
      Date.now().toString(36) +
      "-" +
      crypto.getRandomValues(new Uint32Array(3)).join("-");
    if (
      commit({
        version: 1,
        drawings: [
          {
            id,
            groupId: task.groupId,
            taskId,
            sceneVersion: 2,
            createdAt: new Date().toISOString(),
            strokes: visible,
            outcome:
              feedback.method === "automatic" ? "correct" : "self-confirmed",
          },
          ...data.drawings,
        ],
      })
    )
      setSavedId(id);
  }
  function next(value: number) {
    setStep(value);
    window.scrollTo(0, 0);
    if (value === 3) research.record(taskId, "explanation");
  }
  function selectTask(id: string) {
    if (activeTask.current) research.record(activeTask.current, "end");
    activeTask.current = undefined;
    setTaskId(id);
    dispatchDrawing({ type: "reset" });
    setHint(false);
    setFeedback(undefined);
    setSavedId(undefined);
    research.record(id, "start");
    activeTask.current = id;
  }
  function restart() {
    if (activeTask.current) research.record(activeTask.current, "end");
    activeTask.current = undefined;
    setCollectionOpen(false);
    setPhoto("");
    dispatchDrawing({ type: "reset" });
    setFeedback(undefined);
    setHint(false);
    setSavedId(undefined);
    next(0);
  }
  function celebrate() {
    audio.current?.unlock();
    audio.current?.success();
  }
  function confirm() {
    setFeedback({
      passed: true,
      status: "correct",
      method: "self-confirmed",
      message: "見くらべて、確かめたね。",
    });
    research.record(taskId, "self-confirmation");
    celebrate();
  }
  function answer() {
    const visible = clipStrokes(strokes, scene);
    if (!visible.length) return;
    if (!task.automatic) {
      setFeedback({
        passed: false,
        status: "uncertain",
        method: "comparison",
        message: "見えた形を見くらべよう。",
      });
      research.record(taskId, "judgment", "comparison");
      next(2);
      return;
    }
    const result = profile
      ? evaluateProfile(visible, profile, scene)
      : evaluateObservation(visible);
    result.method = "automatic";
    setFeedback(result);
    research.record(taskId, "judgment", "automatic:" + result.status);
    if (result.passed) {
      celebrate();
      next(2);
    }
  }
  return (
    <div className="figma-shell" data-step={step}>
      <header className="figma-header">
        <button onClick={restart} aria-label="ズーケッチ 撮影に戻る">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          ズーケッチ
        </button>
        <button
          className="collection-link"
          aria-expanded={collectionOpen}
          onClick={() => {
            setCollectionOpen(!collectionOpen);
            window.scrollTo(0, 0);
          }}
        >
          描いた動物 ({collection.drawings.length})
        </button>
      </header>
      <main>
        {storageError && <p role="alert">{storageError}</p>}
        {collectionOpen ? (
          <DrawingCollection
            drawings={collection.drawings}
            onBack={() => setCollectionOpen(false)}
            onDelete={(id) => {
              const data = latest();
              if (!data) return false;
              const ok = commit({
                version: 1,
                drawings: data.drawings.filter((d) => d.id !== id),
              });
              if (ok && savedId === id) setSavedId(undefined);
              return ok;
            }}
          />
        ) : (
          <>
            <nav className="card-flow" aria-label="観察の進み方">
              <ol>
                {["撮る", "描く", "比べる", "知る"].map((label, index) => (
                  <li
                    key={label}
                    aria-current={step === index ? "step" : undefined}
                  >
                    {label}
                  </li>
                ))}
              </ol>
            </nav>
            <motion.section
              className="activity-card"
              key={step}
              initial={reduce || step !== 1 ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="card-caption">
                {step === 0 ? "どうぶつの観察カード" : group.name}
              </div>
              {step === 0 ? (
                <CameraView
                  onSelect={(image, id) => {
                    setPhoto(image || "");
                    selectTask(id || "goat");
                    next(1);
                  }}
                />
              ) : step === 1 ? (
                <>
                  <div className="task-heading">
                    <span>{group.name}</span>
                  </div>
                  <h1>{task.part}を描こう</h1>
                  <p className="figma-support">{task.question}</p>
                  {tasksForGroup(group.id).length > 1 && (
                    <div
                      className="task-switch"
                      role="group"
                      aria-label="観察する部位"
                    >
                      {tasksForGroup(group.id).map((t) => (
                        <button
                          key={t.id}
                          aria-pressed={taskId === t.id}
                          onClick={() => selectTask(t.id)}
                        >
                          {t.part}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="figma-note">
                    空いているところに、見えた形を描こう。
                  </p>
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
                  <SketchCanvas
                    key={taskId}
                    scene={scene}
                    onDrawingActivity={(active) =>
                      research.record(
                        taskId,
                        active ? "drawing-start" : "drawing-end",
                      )
                    }
                    strokes={strokes}
                    showTarget={hint}
                    canUndo={drawing.past.length > 0}
                    onUndo={() => {
                      dispatchDrawing({ type: "undo" });
                      research.record(taskId, "revision", "undo");
                      setFeedback(undefined);
                      setSavedId(undefined);
                    }}
                    onChange={(value, action) => {
                      research.record(
                        taskId,
                        action === "draw" ? "drawing" : "revision",
                        action,
                      );
                      dispatchDrawing({ type: "commit", strokes: value });
                      setFeedback(undefined);
                      setSavedId(undefined);
                    }}
                  />
                  <button
                    className="text-button"
                    aria-expanded={hint}
                    aria-controls="observation-hint"
                    onClick={() => {
                      if (!hint) research.record(taskId, "hint");
                      setHint(!hint);
                    }}
                  >
                    ヒント
                  </button>
                  {hint && (
                    <p id="observation-hint" role="note">
                      {task.hint}
                    </p>
                  )}
                  {feedback && !feedback.passed && (
                    <div role="status" className="figma-feedback">
                      <p>{feedback.message}</p>
                      <p>{feedback.suggestion}</p>
                      <button className="primary" onClick={() => next(2)}>
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
                    <button
                      className="text-button"
                      onClick={() => {
                        setFeedback({
                          status: "uncertain",
                          passed: false,
                          method: "comparison",
                          message: "いま見えた姿を確かめよう。",
                        });
                        research.record(
                          taskId,
                          "judgment",
                          "comparison:observed-absent",
                        );
                        next(2);
                      }}
                    >
                      模様が見えないので、見くらべる
                    </button>
                  )}
                  <button
                    className="primary"
                    disabled={!strokes.length}
                    onClick={answer}
                  >
                    こたえあわせ →
                  </button>
                </>
              ) : step === 2 ? (
                <>
                  <h1 className="figma-discovery">
                    {feedback?.passed
                      ? "完成！ だいはっけん！"
                      : "見えた形を確かめよう"}
                  </h1>
                  <p className="center">
                    <strong>
                      {group.name}の{task.part}
                    </strong>
                  </p>
                  <p className="figma-note">
                    {feedback?.passed
                      ? "よく見てたね！"
                      : "あなたの観察と見くらべよう"}
                  </p>
                  <SketchComparison
                    strokes={strokes}
                    scene={scene}
                    profile={profile}
                    answer={group.answer}
                    note={task.comparisonNote}
                    completed={feedback?.passed}
                  />
                  {!feedback?.passed && (
                    <div className="self-check">
                      <p>実物とお手本を見くらべて、気づいたところはあった？</p>
                      <button className="primary" onClick={confirm}>
                        見くらべて、確かめた！
                      </button>
                      <button className="text-button" onClick={() => next(1)}>
                        もう少し観察して描く
                      </button>
                    </div>
                  )}
                  <button
                    className="primary collection-save"
                    disabled={
                      !!savedId ||
                      !storageReady ||
                      !feedback?.passed ||
                      !strokes.length
                    }
                    onClick={save}
                  >
                    {savedId ? "保存したよ！" : "この動物を保存する"}
                  </button>
                  <p className="quiet-note" role="status">
                    {savedId
                      ? "「描いた動物」から、いつでも見返せるよ。"
                      : "自分の絵をこの端末に残せます。撮影写真は保存しません。"}
                  </p>
                  <button
                    className="primary"
                    disabled={!feedback?.passed}
                    onClick={() => next(3)}
                  >
                    特徴について知ろう →
                  </button>
                </>
              ) : (
                <>
                  <h1>{task.explanation.name}</h1>
                  <div className="figma-science">
                    <svg
                      viewBox={`0 0 600 ${scene.frameHeight || 400}`}
                      role="img"
                      aria-label={task.explanation.name + "の解説イラスト"}
                    >
                      <image
                        href={assetPath(artwork[task.id].explanation!)}
                        width="600"
                        height={scene.frameHeight || 400}
                        preserveAspectRatio="none"
                      />
                    </svg>
                  </div>
                  <div className="figma-explanation">
                    <h2>よく見ると…</h2>
                    <p>{task.explanation.form}</p>
                    <h2>くらしとのつながり</h2>
                    <p>{task.explanation.ecology}</p>
                  </div>
                  <p className="figma-note">{task.next}</p>
                  <button className="primary" onClick={() => next(1)}>
                    もう一度、本物を見てみよう ↗
                  </button>
                  <button className="text-button" onClick={restart}>
                    次の動物を撮る
                  </button>
                </>
              )}
            </motion.section>
          </>
        )}
        <button
          className="text-button"
          aria-pressed={sound}
          onClick={() => {
            soundRef.current = !sound;
            setSound(!sound);
            if (!sound) audio.current?.unlock();
            else audio.current?.silence();
          }}
        >
          効果音 {sound ? "ON" : "OFF"}
        </button>
      </main>
    </div>
  );
}
