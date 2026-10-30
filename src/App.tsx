import { captureStudyDrawing, type StudyDrawing } from "./research/pairs";
import { StudyPairView } from "./components/StudyPairView";
import {
  Suspense,
  lazy,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { HomeScreen } from "./components/HomeScreen";
import { SettingsDialog } from "./components/SettingsDialog";
import { Settings } from "lucide-react";
import { ReadAloud, stopSpeech } from "./speech/Speech";
import { CameraView } from "./CameraView";
import { SketchCanvas } from "./SketchCanvas";
import { SketchComparison } from "./components/SketchComparison";
const DrawingCollection = lazy(() =>
  import("./components/DrawingCollection").then((module) => ({
    default: module.DrawingCollection,
  })),
);
import { artwork, assetPath } from "./content/artwork";
import { groups } from "./content/groups";
import { tasksForGroup, taskById } from "./content/tasks";
import { clipStrokes } from "./content/scenes";
import { drawingEvaluator } from "./domain";

import {
  recordStudy,
  setStudyContext,
  studyStatus,
  subscribeStudy,
  currentStudyContext,
} from "./research/study";
import {
  prepareNotebook,
  countObservations,
  loadObservations,
  addObservation,
  deleteObservation,
  observationMetadata,
} from "./notebook/storage";
import {
  composeObservationImages,
  composeCardPng,
  savePng,
} from "./notebook/images";
import type { ObservationRecord } from "./notebook/types";
import { createFeedbackAudio } from "./audio";
import { drawingHistory, emptyDrawing } from "./drawing/history";
import type { Evaluation } from "./types";
import "./styles/cards.css";

export default function App() {
  const reduce = useReducedMotion();
  const study = useSyncExternalStore(subscribeStudy, studyStatus);
  const [studyPhase, setStudyPhase] = useState<"before" | "after">("before");
  const [beforeDrawing, setBeforeDrawing] = useState<StudyDrawing>();
  const pairId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!study.collecting) {
      setBeforeDrawing(undefined);
      setStudyPhase("before");
    }
  }, [study.collecting]);
  const taskGeneration = useRef(0);
  const activeTask = useRef<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [screen, setScreen] = useState<"home" | "activity">("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  const [taskId, setTaskId] = useState("goat");
  const [photo, setPhoto] = useState("");
  const [drawing, dispatchDrawing] = useReducer(
    drawingHistory,
    undefined,
    emptyDrawing,
  );
  const strokes = drawing.present;
  const [feedback, setFeedback] = useState<Evaluation>();
  const [hintLevel, setHintLevel] = useState(0);
  const hint = hintLevel > 0;
  const [sound, setSound] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const audio = useRef<ReturnType<typeof createFeedbackAudio> | null>(null);
  if (!audio.current)
    audio.current = createFeedbackAudio(() => soundRef.current);
  useEffect(() => () => audio.current?.dispose(), []);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const collectionOpenRef = useRef(collectionOpen);
  collectionOpenRef.current = collectionOpen;
  const [collectionCount, setCollectionCount] = useState(0);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const collectionGeneration = useRef(0);
  const [collection, setCollection] = useState<ObservationRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const completedAttempt = useRef(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [savedId, setSavedId] = useState<string>();
  const task = taskById[taskId],
    scene = task.scene,
    profile = task.profile;
  const group = groups.find((g) => g.id === task.groupId)!;
  const context = currentStudyContext();
  const studyTaskEnabled =
    study.collecting &&
    study.comparisonStudy &&
    context.taskId === taskId &&
    context.phase === studyPhase &&
    context.pairId === pairId.current;
  useEffect(() => {
    prepareNotebook()
      .then(countObservations)
      .then((count) => {
        setCollectionCount(count);
        setStorageReady(true);
      })
      .catch(() => {
        setStorageError(
          "観察ノートを開けませんでした。元の保存データは消していません。保存容量やブラウザの設定を確認してください。",
        );
      });
  }, []);
  async function refreshCollection() {
    if (!collectionOpenRef.current) {
      setCollectionCount(await countObservations());
      return;
    }
    const generation = ++collectionGeneration.current;
    const data = await loadObservations();
    if (generation === collectionGeneration.current) {
      setCollection(data);
      setCollectionCount(data.length);
    }
  }
  useEffect(() => {
    if (!collectionOpen || !storageReady) return;
    let cancelled = false;
    setCollectionLoading(true);
    setStorageError("");
    void refreshCollection()
      .catch(() => {
        if (!cancelled)
          setStorageError(
            "観察ノートを読み込めませんでした。閉じてもう一度開いてください。",
          );
      })
      .finally(() => {
        if (!cancelled) setCollectionLoading(false);
      });
    return () => {
      cancelled = true;
      collectionGeneration.current++;
      setCollection([]);
    };
  }, [collectionOpen, storageReady]);
  async function save() {
    if (savingLock.current || savedId || !feedback?.passed || !storageReady)
      return;
    const visible = clipStrokes(strokes, scene).map((s) =>
      s.map((p) => ({
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
      })),
    );
    if (!visible.length) return;
    const generation = taskGeneration.current,
      logContext = currentStudyContext();
    savingLock.current = true;
    setSaving(true);
    setStorageError("");
    try {
      const record = observationMetadata({
        id: crypto.randomUUID(),
        groupId: task.groupId,
        taskId,
        sceneVersion: 2,
        createdAt: new Date().toISOString(),
        strokes: visible,
        outcome: feedback.method === "automatic" ? "correct" : "self-confirmed",
      });
      const images = await composeObservationImages(scene, visible);
      await addObservation({ ...record, ...images });
      await refreshCollection();
      if (generation === taskGeneration.current) setSavedId(record.id);
      recordStudy("observation_saved", {}, logContext);
    } catch {
      setStorageError(
        "観察を保存できませんでした。空き容量やブラウザの設定を確認し、もう一度試してください。",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  async function exportCurrentPng(kind: "own" | "comparison") {
    const visible = clipStrokes(strokes, scene);
    if (!visible.length || saving) return;
    setSaving(true);
    setStorageError("");
    try {
      const images = await composeObservationImages(scene, visible);
      const date = new Date().toISOString().slice(0, 10);
      await savePng(
        await composeCardPng(
          kind === "own" ? images.ownPng : images.comparisonPng,
          {
            animalName: group.name,
            taskName: task.part,
            createdAt: new Date().toISOString(),
            explanation: task.explanation,
          },
          kind === "comparison",
        ),
        `zooketch-${taskId}-${date}-${kind === "own" ? "sketch" : "comparison"}.png`,
      );
    } catch {
      setStorageError(
        "PNG画像を保存できませんでした。もう一度試してください。",
      );
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (step !== 3 || collectionOpen || settingsOpen || screen !== "activity")
      return;
    const logContext = currentStudyContext();
    let opened = false;
    const show = () => {
      if (!document.hidden && studyStatus().collecting) {
        recordStudy("explanation_opened", {}, logContext);
        opened = true;
      }
    };
    const hide = () => {
      if (opened) {
        recordStudy("explanation_closed", {}, logContext);
        opened = false;
      }
    };
    const visibility = () => (document.hidden ? hide() : show());
    show();
    document.addEventListener("visibilitychange", visibility);
    if (!completedAttempt.current) {
      recordStudy("challenge_completed");
      completedAttempt.current = true;
    }
    return () => {
      hide();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [step, taskId, collectionOpen, settingsOpen, screen]);
  function next(value: number) {
    stopSpeech();
    setStep(value);
    window.scrollTo(0, 0);
    if (value === 2) recordStudy("comparison_opened");
  }
  function selectTask(id: string) {
    taskGeneration.current++;
    if (activeTask.current) recordStudy("challenge_left");
    activeTask.current = undefined;
    setTaskId(id);
    setBeforeDrawing(undefined);
    setStudyPhase("before");
    pairId.current = crypto.randomUUID();
    dispatchDrawing({ type: "reset" });
    setHintLevel(0);
    setFeedback(undefined);
    setSavedId(undefined);
    setStudyContext(
      taskById[id].groupId,
      id,
      study.collecting && study.comparisonStudy ? "before" : undefined,
      study.collecting && study.comparisonStudy ? pairId.current : undefined,
    );
    completedAttempt.current = false;
    recordStudy("challenge_opened");
    activeTask.current = id;
  }
  function restart(destination: "home" | "activity" = "activity") {
    setScreen(destination);
    taskGeneration.current++;
    if (activeTask.current) recordStudy("challenge_left");
    activeTask.current = undefined;
    setCollectionOpen(false);
    setBeforeDrawing(undefined);
    setStudyPhase("before");
    setPhoto("");
    dispatchDrawing({ type: "reset" });
    setFeedback(undefined);
    setHintLevel(0);
    setSavedId(undefined);
    setStudyContext();
    next(0);
  }
  async function startSecondDrawing() {
    if (!feedback || saving) return;
    setSaving(true);
    setStorageError("");
    recordStudy("explanation_closed");
    const generation = taskGeneration.current;
    try {
      const before = await captureStudyDrawing(scene, strokes, feedback);
      if (
        generation !== taskGeneration.current ||
        !studyStatus().collecting ||
        !studyStatus().comparisonStudy
      )
        return;
      setBeforeDrawing(before);
      setStudyPhase("after");
      recordStudy("challenge_left");
      setStudyContext(task.groupId, taskId, "after", pairId.current);
      completedAttempt.current = false;
      recordStudy("challenge_opened");
      dispatchDrawing({ type: "reset" });
      setHintLevel(0);
      setFeedback(undefined);
      setSavedId(undefined);
      next(1);
    } catch {
      setStorageError(
        "1回目の記録を保存できませんでした。もう一度試してください。",
      );
    } finally {
      setSaving(false);
    }
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
    recordStudy("evaluation_completed", {
      method: "self-confirmed",
      status: "correct",
    });
    celebrate();
  }
  function answer() {
    const visible = clipStrokes(strokes, scene);
    if (!visible.length) return;
    recordStudy("drawing_submitted", { empty: false });
    if (!task.automatic) {
      setFeedback({
        passed: false,
        status: "uncertain",
        method: "comparison",
        message: "見えた形を見くらべよう。",
      });
      recordStudy("evaluation_completed", {
        method: "comparison",
        status: "uncertain",
      });
      next(2);
      return;
    }
    const result = drawingEvaluator.evaluate(task, visible);
    result.method = "automatic";
    setFeedback(result);
    recordStudy("evaluation_completed", {
      method: "automatic",
      status: result.status,
    });
    if (result.passed) {
      celebrate();
      next(2);
    }
  }
  return (
    <div
      className="figma-shell"
      data-step={step}
      data-screen={collectionOpen ? "collection" : screen}
    >
      {(screen !== "home" || collectionOpen) && (
        <header className="figma-header">
          <button
            onClick={() => restart("home")}
            aria-label="ズーケッチ ホームに戻る"
          >
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
            図鑑 ({collectionCount})
          </button>
          <button
            className="header-settings"
            aria-label="設定を開く"
            onClick={(event) => {
              settingsTrigger.current = event.currentTarget;
              setSettingsOpen(true);
            }}
          >
            <Settings aria-hidden="true" size={20} />
          </button>
        </header>
      )}
      <main>
        {storageError && <p role="alert">{storageError}</p>}
        {collectionOpen ? (
          <Suspense fallback={<p role="status">観察ノートを開いています…</p>}>
            {collectionLoading || !storageReady ? (
              <p role="status">観察ノートを読み込んでいます…</p>
            ) : (
              <DrawingCollection
                title="スケッチ図鑑"
                drawings={collection}
                onBack={() => setCollectionOpen(false)}
                onUpdate={async () => {
                  await refreshCollection();
                }}
                onDelete={async (id) => {
                  try {
                    await deleteObservation(id);
                    await refreshCollection();
                    if (savedId === id) setSavedId(undefined);
                    return true;
                  } catch {
                    setStorageError(
                      "観察を削除できませんでした。もう一度試してください。",
                    );
                    return false;
                  }
                }}
              />
            )}
          </Suspense>
        ) : screen === "home" ? (
          <HomeScreen
            onStart={() => restart("activity")}
            onCollection={() => {
              setCollectionOpen(true);
              window.scrollTo(0, 0);
            }}
            onSettings={(trigger) => {
              settingsTrigger.current = trigger;
              setSettingsOpen(true);
            }}
            savedCount={collectionCount}
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
                {step === 0 ? "かんさつカメラ" : group.name}
              </div>
              {step === 0 ? (
                <CameraView
                  suspended={settingsOpen}
                  onSelect={(image, id, method) => {
                    recordStudy(
                      "animal_identified",
                      { method: method || "manual" },
                      {
                        animalId:
                          taskById[id || "goat"]?.groupId || id || "goat",
                        taskId: undefined,
                        attemptId: undefined,
                      },
                    );
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
                  {studyTaskEnabled && (
                    <p className="quiet-note">
                      {studyPhase === "before" ? "1回目" : "2回目"}のスケッチ
                    </p>
                  )}
                  <button className="text-button" onClick={() => restart()}>
                    動物を選び直す
                  </button>
                  <p className="figma-support">{task.question}</p>
                  <ReadAloud id="question" text={task.question} />
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
                    絵のつづきを描こう。実物を見ながらで大丈夫。
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
                    onDrawingActivity={(active, tool) =>
                      recordStudy(
                        active ? "drawing_started" : "drawing_stopped",
                        { tool },
                      )
                    }
                    strokes={strokes}
                    showTarget={hint}
                    canUndo={drawing.past.length > 0}
                    onUndo={() => {
                      dispatchDrawing({ type: "undo" });
                      recordStudy("drawing_undo");
                      setFeedback(undefined);
                      setSavedId(undefined);
                    }}
                    onChange={(value, action) => {
                      if (action === "clear") recordStudy("drawing_cleared");
                      if (action === "erase") recordStudy("drawing_erased");
                      dispatchDrawing({ type: "commit", strokes: value });
                      setFeedback(undefined);
                      setSavedId(undefined);
                    }}
                  />
                  <div className="observation-hints">
                    <button
                      className="text-button"
                      aria-expanded={hint}
                      aria-controls="observation-hint"
                      disabled={hintLevel >= (task.hints?.length || 0)}
                      onClick={() => {
                        const level = hintLevel + 1;
                        setHintLevel(level);
                        recordStudy("hint_opened", { hintLevel: level });
                      }}
                    >
                      {hintLevel === 0
                        ? "ヒントを見る"
                        : hintLevel < (task.hints?.length || 0)
                          ? "次のヒントを見る"
                          : "ヒントを表示中"}
                    </button>
                    {hint && (
                      <ol id="observation-hint" role="note">
                        {task.hints?.slice(0, hintLevel).map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ol>
                    )}
                    {hint && (
                      <ReadAloud
                        id="hints"
                        text={
                          task.hints?.slice(0, hintLevel).join("。") ||
                          task.hint
                        }
                      />
                    )}
                  </div>
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
                        recordStudy("drawing_submitted", {
                          empty: true,
                          reason: "observed-absent",
                        });
                        recordStudy("evaluation_completed", {
                          method: "comparison",
                          status: "uncertain",
                        });
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
                  <ReadAloud
                    id="result"
                    text={
                      feedback?.passed
                        ? "完成！ だいはっけん！ よく見てたね！"
                        : "見えた形を確かめよう。あなたの観察と見くらべよう。"
                    }
                  />
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
                    onSliderCommit={(from, to, via) =>
                      recordStudy("comparison_slider_moved", { from, to, via })
                    }
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
                      saving ||
                      !strokes.length
                    }
                    onClick={() => void save()}
                  >
                    {savedId
                      ? "保存したよ！"
                      : saving
                        ? "観察を保存中…"
                        : "観察を保存する"}
                  </button>
                  <p className="quiet-note" role="status">
                    {savedId
                      ? "「観察ノート」から、いつでも見返せるよ。"
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
                  <ReadAloud
                    id="explanation"
                    text={[
                      task.explanation.name,
                      task.explanation.form,
                      task.explanation.ecology,
                      task.next,
                    ].join("。")}
                  />
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
                  <button
                    className="primary collection-save"
                    disabled={
                      !!savedId ||
                      saving ||
                      !storageReady ||
                      !feedback?.passed ||
                      !strokes.length
                    }
                    onClick={() => void save()}
                  >
                    {savedId
                      ? "保存したよ！"
                      : saving
                        ? "観察を保存中…"
                        : "観察を保存する"}
                  </button>
                  {strokes.length > 0 && (
                    <div className="png-actions">
                      <button
                        className="primary collection-save"
                        disabled={saving}
                        onClick={() => void exportCurrentPng("own")}
                      >
                        自分の絵をPNGで保存
                      </button>
                      <button
                        className="primary collection-save"
                        disabled={saving}
                        onClick={() => void exportCurrentPng("comparison")}
                      >
                        比較画像をPNGで保存
                      </button>
                    </div>
                  )}
                  {studyTaskEnabled ? (
                    studyPhase === "before" ? (
                      <button
                        className="primary"
                        disabled={saving}
                        onClick={() => void startSecondDrawing()}
                      >
                        同じ特徴をもう一度描く
                      </button>
                    ) : (
                      beforeDrawing &&
                      feedback && (
                        <StudyPairView
                          id={pairId.current}
                          scene={scene}
                          before={beforeDrawing}
                          strokes={strokes}
                          evaluation={feedback}
                        />
                      )
                    )
                  ) : (
                    <button className="primary" onClick={() => next(1)}>
                      もう一度、本物を見てみよう ↗
                    </button>
                  )}
                  <button className="text-button" onClick={() => restart()}>
                    次の動物を撮る
                  </button>
                </>
              )}
            </motion.section>
          </>
        )}
        <SettingsDialog
          open={settingsOpen}
          returnFocus={settingsTrigger}
          onClose={() => setSettingsOpen(false)}
          sound={sound}
          onSoundChange={() => {
            soundRef.current = !sound;
            setSound(!sound);
            if (!sound) audio.current?.unlock();
            else audio.current?.silence();
          }}
        />
      </main>
    </div>
  );
}
