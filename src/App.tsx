import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CameraView } from "./CameraView";
import { SketchCanvas } from "./SketchCanvas";
import { SketchComparison } from "./components/SketchComparison";
import { Mascot } from "./components/Mascot";
import { DrawingCollection } from "./components/DrawingCollection";
import { useButtonMotion } from "./components/useButtonMotion";
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
import type { Stroke, Evaluation } from "./types";
import "./styles/figma.css";

export default function App() {
  useButtonMotion();
  const reduce = useReducedMotion();
  const activeTask = useRef<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [taskId, setTaskId] = useState("goat");
  const [photo, setPhoto] = useState("");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
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
    setStrokes([]);
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
    setStrokes([]);
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
    <div className="figma-shell">
      <header className="figma-header">
        <button onClick={restart} aria-label="ズーケッチ 撮影に戻る">
          <img
            src={import.meta.env.BASE_URL + "figma/2-2-imgLogoDot.svg"}
            alt=""
          />
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
            <div className="figma-flow">
              {
                [
                  "01 / 写真を撮る",
                  "02 / 特徴を描く",
                  "03 / 見くらべる",
                  "04 / 発見を知る",
                ][step]
              }
              <Mascot step={step} />
            </div>
            <motion.section
              key={step}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
                    <span>ひとつだけ、よく見よう</span>
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
                    1〜3分くらいで、見えた形を少しだけ。上手に描かなくて大丈夫。
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
                    onChange={(value) => {
                      research.record(
                        taskId,
                        value.length < strokes.length ? "revision" : "drawing",
                      );
                      setStrokes(value);
                      setFeedback(undefined);
                      setSavedId(undefined);
                    }}
                  />
                  <button
                    className="text-button"
                    onClick={() => {
                      if (!hint) research.record(taskId, "hint");
                      setHint(!hint);
                    }}
                  >
                    ✧ ヒント
                  </button>
                  {hint && <p role="note">{task.hint}</p>}
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
                  <motion.h1
                    key={feedback?.passed ? "complete" : "compare"}
                    className="figma-discovery"
                    initial={reduce ? false : { scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 14 }}
                  >
                    {feedback?.passed
                      ? "完成！ だいはっけん！"
                      : "見えた形を確かめよう"}
                  </motion.h1>
                  {feedback?.passed && (
                    <div className="figma-confetti" aria-hidden="true">
                      {!reduce &&
                        Array.from({ length: 10 }, (_, i) => (
                          <motion.span
                            className="discovery-star"
                            key={i}
                            initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                            animate={{
                              opacity: [0, 1, 0],
                              scale: [0.3, 1.2, 0.8],
                              rotate: i * 37,
                              x: (i - 4.5) * 29,
                              y: -25 - Math.sin(i) * 45,
                            }}
                            transition={{ duration: 1.2, delay: i * 0.035 }}
                          >
                            ✦
                          </motion.span>
                        ))}
                      {["Orange", "Teal", "Gold", "Coral"].map((c, i) => (
                        <motion.img
                          key={c}
                          src={
                            import.meta.env.BASE_URL +
                            `figma/2-48-imgConfetti${c}.svg`
                          }
                          initial={reduce ? false : { opacity: 0, y: -12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                        />
                      ))}
                    </div>
                  )}
                  <p className="center">
                    <strong>
                      {group.name}の{task.part}
                    </strong>
                  </p>
                  <p className="figma-note">
                    {feedback?.passed
                      ? "よく見てたね！ ✳"
                      : "あなたの観察と見くらべよう"}
                  </p>
                  <SketchComparison
                    strokes={strokes}
                    scene={scene}
                    profile={profile}
                    answer={group.answer}
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
                    disabled={!!savedId || !storageReady || !feedback?.passed}
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
                  <motion.div
                    className="figma-science"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <svg
                      viewBox="0 0 600 400"
                      role="img"
                      aria-label={task.explanation.name + "の解説イラスト"}
                    >
                      <image
                        href={assetPath(artwork[task.id].explanation!)}
                        width="600"
                        height="400"
                        preserveAspectRatio="none"
                      />
                    </svg>
                  </motion.div>
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
