import { useModelPreload } from "../recognition/useModelPreload";
import {
  FuriganaProvider,
  loadFurigana,
  saveFurigana,
} from "../furigana/Furigana";
import { flushShareQueue, replicaShareDestination } from "../future/share";
import {
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { HomeScreen } from "../components/HomeScreen";
import {
  IntroLoadingScreen,
  SplashScreen,
  TutorialEndScreen,
} from "../components/IntroFlow";
import {
  ChallengeIntro,
  PhotoCelebration,
  SketchCelebration,
} from "../components/ChallengeIntro";
import { groups } from "../content/groups";
import { taskById, tasksForGroup } from "../content/tasks";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import { drawingHistory, emptyDrawing } from "../drawing/history";
import { stylesFor } from "../drawing/styles";
import { drawingEvaluator } from "../domain";
import { tutorialSurveyUrl } from "../research/tutorialSurvey";
import type { Evaluation, Stroke } from "../types";
import type { CameraCapture } from "./ReplicaCamera";
import type { ReplicaRecord } from "./ReplicaGallery";
import { ReplicaIntro, ReplicaPhotoReview } from "./ReplicaScreens";
import {
  galleryPhotoLocation,
  identifyReplicaPhoto,
  imageDataURL,
  loadReplicaRecord,
  loadReplicaRecords,
  saveReplicaRecord,
} from "./storage";
import "../styles/tokens.css";
import "../styles/cards.css";
import "../styles/design3.css";
import "../styles/card-motion.css";
import "../styles/furigana.css";
import "./replica.css";
import { ScreenErrorBoundary } from "../recovery/ScreenErrorBoundary";

const ReplicaCamera = lazy(() =>
  import("./ReplicaCamera").then(({ ReplicaCamera }) => ({
    default: ReplicaCamera,
  })),
);
const ReplicaGallery = lazy(() =>
  import("./ReplicaGallery").then(({ ReplicaGallery }) => ({
    default: ReplicaGallery,
  })),
);
const ReplicaDraw = lazy(() =>
  import("./ReplicaDrawingScreens").then(({ ReplicaDraw }) => ({
    default: ReplicaDraw,
  })),
);
const ReplicaResult = lazy(() =>
  import("./ReplicaDrawingScreens").then(({ ReplicaResult }) => ({
    default: ReplicaResult,
  })),
);
const FreeDrawScreen = lazy(() =>
  import("../screens/DrawScreen").then(({ FreeDrawScreen }) => ({
    default: FreeDrawScreen,
  })),
);
const SettingsDialog = lazy(() =>
  import("../components/SettingsDialog").then(({ SettingsDialog }) => ({
    default: SettingsDialog,
  })),
);

type Screen =
  | "splash"
  | "title"
  | "intro"
  | "camera"
  | "review"
  | "cheer"
  | "easel"
  | "loading"
  | "challenge"
  | "draw"
  | "result"
  | "tutorial"
  | "gallery"
  | "free";

const introSteps = [
  { pose: "wave", node: "29-683" },
  { pose: "book", node: "36-778" },
  { pose: "camera", node: "38-898" },
] as const;
const choiceIds = ["giraffe", "hippo", "meerkat", "fennec", "elephant"];
const choices = choiceIds.map((id) => groups.find((group) => group.id === id)!);

function newestFirst(records: ReplicaRecord[]) {
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function recordId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function ReplicaApp({ legacy = false }: { legacy?: boolean }) {
  return (
    <ScreenErrorBoundary>
      <ReplicaAppContent legacy={legacy} />
    </ScreenErrorBoundary>
  );
}

function ReplicaAppContent({ legacy }: { legacy: boolean }) {
  // The revised tutorial should also appear once for devices using the old flow.
  const tutorialKey = legacy
    ? "zooketch-replica-tutorial-v1"
    : "zooketch-replica-tutorial-v2";
  const [screen, updateScreen] = useState<Screen>(legacy ? "splash" : "title");
  // Keep the current view painted while a newly opened screen downloads.
  const setScreen = useCallback((next: SetStateAction<Screen>) => {
    startTransition(() => updateScreen(next));
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  const [furigana, setFurigana] = useState(loadFurigana);
  const [feedback, setFeedback] = useState<Evaluation>();
  const [sketchCelebrating, setSketchCelebrating] = useState(false);
  const [surveyUrl] = useState(() =>
    tutorialSurveyUrl(
      window.location.search,
      import.meta.env.VITE_STUDY_FORM_URL,
    ),
  );
  const attemptedSurvey = useRef(false);
  useEffect(() => {
    if (
      !legacy ||
      screen !== "tutorial" ||
      !surveyUrl ||
      attemptedSurvey.current ||
      !navigator.onLine
    )
      return;
    attemptedSurvey.current = true;
    window.location.assign(surveyUrl);
  }, [legacy, screen, surveyUrl]);
  const [introPage, setIntroPage] = useState(0);
  const [tutorial, setTutorial] = useState(false);
  useModelPreload({
    enabled: tutorial && !legacy,
    photo: false,
    allowMetered: true,
  });
  const [framedExample, setFramedExample] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [record, setRecord] = useState<ReplicaRecord>();
  const [records, setRecords] = useState<ReplicaRecord[]>([]);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [galleryLoadAttempt, setGalleryLoadAttempt] = useState(0);
  const [galleryLoadFailed, setGalleryLoadFailed] = useState(false);
  const keepGalleryRecords = legacy || screen === "gallery";
  const galleryOpen = useRef(keepGalleryRecords);
  galleryOpen.current = keepGalleryRecords;
  const [drawing, dispatchDrawing] = useReducer(
    drawingHistory,
    undefined,
    emptyDrawing,
  );
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState("");
  const [photoWriteFailed, setPhotoWriteFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const savedDrawing = useRef<Stroke[] | undefined>(undefined);
  const writingPhoto = useRef<Promise<void>>(Promise.resolve());
  const activeCapture = useRef<string | undefined>(undefined);
  const selectedGroup = groups.find((choice) => choice.id === groupId);
  const chosen =
    selectedGroup && record?.groupId === selectedGroup.id && record.animalName
      ? { ...selectedGroup, name: record.animalName }
      : selectedGroup;
  const group = chosen ?? choices[0];
  const task =
    (record?.taskId && taskById[record.taskId]) ||
    tasksForGroup(group.id)[0] ||
    taskById.giraffe;

  useEffect(() => {
    const send = () => {
      void flushShareQueue();
    };
    if (legacy) return;
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [legacy]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!keepGalleryRecords) {
      setRecords((current) => (current.length ? [] : current));
      setGalleryLoadFailed(false);
      return;
    }
    let active = true;
    loadReplicaRecords().then(
      (saved) => {
        if (!active) return;
        setGalleryLoadFailed(false);
        setRecords((current) =>
          newestFirst(
            Array.from(
              new Map(
                [...saved, ...current].map((item) => [item.id, item]),
              ).values(),
            ),
          ),
        );
      },
      () => {
        if (active) setGalleryLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [galleryLoadAttempt, keepGalleryRecords]);

  const advanceScreen = useCallback(
    (current: Screen, next: Screen) => {
      setScreen((active) => (active === current ? next : active));
    },
    [setScreen],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    const next =
      screen === "cheer"
        ? "easel"
        : screen === "loading" || (screen === "easel" && (legacy || !tutorial))
          ? "challenge"
          : undefined;
    if (!next) return;
    const delay = legacy ? (screen === "cheer" ? 1200 : 950) : 1800;
    const timer = window.setTimeout(() => advanceScreen(screen, next), delay);
    return () => window.clearTimeout(timer);
  }, [advanceScreen, legacy, screen, tutorial]);

  const showResult = useCallback(() => {
    setSketchCelebrating(false);
    setScreen("result");
  }, [setScreen]);

  useEffect(() => {
    if (screen !== "draw" || !sketchCelebrating) return;
    const timer = window.setTimeout(showResult, 1800);
    return () => window.clearTimeout(timer);
  }, [screen, sketchCelebrating, showResult]);

  function renderGalleryRecord(entry: ReplicaRecord) {
    if (!mounted.current) return;
    if (entry.photo && entry.id === activeCapture.current) setPhotoSaved(true);
    if (galleryOpen.current)
      setRecords((current) =>
        newestFirst([entry, ...current.filter((item) => item.id !== entry.id)]),
      );
  }

  function restartCamera() {
    activeCapture.current = undefined;
    savedDrawing.current = undefined;
    setFramedExample(false);
    setRecord(undefined);
    setPhotoSaved(false);
    setPhotoWriteFailed(false);
    setGroupId("");
    setError("");
    setScreen("camera");
  }

  function retakePhoto() {
    restartCamera();
    setFramedExample(!!record?.samplePhoto);
  }

  function persistCapturedPhoto(next: ReplicaRecord) {
    const photo = next.photo;
    if (!photo) return;
    setPhotoWriteFailed(false);
    setError("");
    writingPhoto.current = writingPhoto.current
      .then(async () => {
        let source = photo;
        if (next.samplePhoto && !photo.startsWith("data:")) {
          const response = await fetch(photo);
          if (!response.ok) throw new Error("見本写真を読み込めませんでした。");
          source = await imageDataURL(await response.blob());
        }
        const saved = { ...next, photo: source };
        await saveReplicaRecord(saved);
        renderGalleryRecord(saved);
      })
      .catch(() => {
        if (mounted.current && activeCapture.current === next.id) {
          setPhotoWriteFailed(true);
          setError("写真を保存できませんでした。続けて描くことはできます。");
        }
      });
  }

  function takePhoto({ photo, sample, animal }: CameraCapture) {
    const captured = sample ? { groupId: "giraffe", name: "キリン" } : animal;
    const next: ReplicaRecord = {
      id: recordId(),
      createdAt: new Date().toISOString(),
      photo,
      photoLocation: photo ? galleryPhotoLocation : undefined,
      groupId: captured?.groupId,
      taskId: captured
        ? (captured.taskId ?? tasksForGroup(captured.groupId)[0]?.id)
        : undefined,
      samplePhoto: sample,
      animalName: captured?.name,
      photoDescription: captured
        ? zooAnimalSummary(captured.groupId)
        : undefined,
    };
    activeCapture.current = next.id;
    setPhotoSaved(false);
    setPhotoWriteFailed(false);
    setRecord(next);
    setGroupId(captured?.groupId ?? "");
    setError("");
    setScreen("review");
    writingPhoto.current = Promise.resolve();
    persistCapturedPhoto(next);
  }

  function selectCapturedAnimal(id: string) {
    const selected = groups.find((item) => item.id === id);
    if (!selected) return;
    setGroupId(id);
    if (!record) return;
    const details = {
      groupId: id,
      taskId: tasksForGroup(id)[0]?.id,
      animalName: selected.name,
      photoDescription: zooAnimalSummary(id),
    };
    const captureId = record.id;
    setRecord((current) =>
      current?.id === captureId ? { ...current, ...details } : current,
    );
    if (!record.photo) return;
    // Queue rapid corrections behind the capture and any previous selection.
    writingPhoto.current = writingPhoto.current
      .then(async () => {
        const saved = await identifyReplicaPhoto(captureId, details);
        if (saved) renderGalleryRecord(saved);
      })
      .catch(() => {
        if (mounted.current && activeCapture.current === captureId)
          setError("写真の動物名を保存できませんでした。");
      });
  }

  function startDrawing() {
    dispatchDrawing({ type: "reset" });
    setFeedback(undefined);
    setSketchCelebrating(false);
    setShowHint(false);
    setScreen("draw");
  }

  function nextAfterResult() {
    if (tutorial) {
      try {
        localStorage.setItem(tutorialKey, "1");
      } catch {
        // The current tutorial can finish without persistent storage.
      }
      setScreen("tutorial");
      setError("");
    } else {
      restartCamera();
    }
  }

  async function finishDrawing(advance = true) {
    if (savingRef.current || !drawing.present.length) return;
    if (savedDrawing.current === drawing.present) {
      if (advance) nextAfterResult();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await writingPhoto.current;
      const { composeObservationImages } = await import("../notebook/images");
      const { ownPng } = await composeObservationImages(
        task.scene,
        drawing.present,
        { unrestrictedDrawing: !legacy },
      );
      const sketch = await imageDataURL(ownPng);
      const saved = record ? await loadReplicaRecord(record.id) : undefined;
      const savedPhoto = saved?.photo;
      let photo = savedPhoto || record?.photo;
      if (!savedPhoto && photo && record?.samplePhoto) {
        const response = await fetch(photo);
        if (!response.ok) throw new Error("見本写真を読み込めませんでした。");
        photo = await imageDataURL(await response.blob());
      }
      const next: ReplicaRecord = {
        ...record,
        id: record?.id ?? recordId(),
        createdAt: record?.createdAt ?? new Date().toISOString(),
        photo,
        sketch,
        strokes: legacy ? undefined : drawing.present,
        strokeStyles: legacy ? undefined : stylesFor(drawing.present),
        groupId: group.id,
        taskId: task.id,
        animalName: group.name,
        description: zooAnimalSummary(group.id),
        photoDescription: zooAnimalSummary(group.id),
      };
      await saveReplicaRecord(
        next,
        legacy ? undefined : replicaShareDestination(),
      );
      if (!legacy) void flushShareQueue();
      if (!mounted.current) return;
      savedDrawing.current = drawing.present;
      renderGalleryRecord(next);
      if (advance) nextAfterResult();
    } catch {
      if (mounted.current)
        setError(
          "スケッチを保存できませんでした。空き容量を確認して、もう一度試してね。",
        );
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const camera = screen === "camera";
  const review = screen === "review" || screen === "cheer";
  const figmaNodes: Partial<Record<Screen, string>> = {
    title: "28-100",
    intro: introSteps[introPage].node,
    cheer: "52-5335",
    easel: tutorial ? "38-1056" : "43-1903",
    challenge: tutorial ? "52-5984" : "66-8272",
    draw: tutorial
      ? showHint
        ? "66-7254"
        : "43-1966"
      : showHint
        ? "66-8070"
        : "66-7869",
    result: feedback?.passed ? (tutorial ? "66-8363" : "66-10524") : undefined,
    tutorial: "43-1269",
  };
  return (
    <FuriganaProvider enabled={furigana}>
      <div
        className="figma-shell design3-shell replica-app"
        data-screen={screen}
        data-figma-node={legacy ? undefined : figmaNodes[screen]}
        data-variant={legacy ? "replica" : "product"}
      >
        <main>
          {error && (
            <div className="design3-alert replica-storage-error">
              <p role="alert">{error}</p>
              {screen === "review" && photoWriteFailed && record?.photo && (
                <button
                  type="button"
                  onClick={() => persistCapturedPhoto(record)}
                >
                  もう一度試す
                </button>
              )}
            </div>
          )}
          {screen === "gallery" && galleryLoadFailed && (
            <div className="design3-alert replica-storage-error">
              <p role="alert">ギャラリーを開けませんでした。</p>
              <button
                type="button"
                onClick={() => setGalleryLoadAttempt((attempt) => attempt + 1)}
              >
                もう一度試す
              </button>
            </div>
          )}
          <Suspense fallback={null}>
            <div
              key={screen === "intro" ? `intro-${introPage}` : screen}
              className="replica-screen"
            >
              {screen === "splash" && (
                <SplashScreen onDone={() => setScreen("title")} />
              )}
              {screen === "title" && (
                <HomeScreen
                  savedCount={records.length}
                  studyTutorial={legacy && !!surveyUrl}
                  onStart={() => {
                    try {
                      if (
                        !surveyUrl &&
                        localStorage.getItem(tutorialKey) === "1"
                      ) {
                        setTutorial(false);
                        restartCamera();
                        return;
                      }
                    } catch {
                      // The tutorial is available even with storage disabled.
                    }
                    setIntroPage(0);
                    setTutorial(true);
                    setScreen("intro");
                  }}
                  onCollection={() => setScreen("gallery")}
                  onSettings={() => setScreen("free")}
                />
              )}
              {screen === "intro" && (
                <ReplicaIntro
                  pose={introSteps[introPage].pose}
                  progress={legacy ? undefined : introPage + 1}
                  onSkip={
                    legacy
                      ? () => {
                          setTutorial(false);
                          restartCamera();
                        }
                      : undefined
                  }
                  onNext={() =>
                    introPage < introSteps.length - 1
                      ? setIntroPage(introPage + 1)
                      : restartCamera()
                  }
                />
              )}
              {camera && (
                <ReplicaCamera
                  legacy={legacy}
                  tutorial={tutorial}
                  framedExample={framedExample}
                  onCapture={takePhoto}
                  onFreeDraw={() => setScreen("free")}
                  onHome={() => setScreen("title")}
                  onGallery={() => setScreen("gallery")}
                  suspended={settingsOpen}
                  onSettings={
                    legacy
                      ? undefined
                      : (trigger) => {
                          settingsTrigger.current = trigger;
                          setSettingsOpen(true);
                        }
                  }
                />
              )}
              {review && (
                <>
                  <div inert={screen === "cheer" ? true : undefined}>
                    <ReplicaPhotoReview
                      photo={record?.photo}
                      sample={!!record?.samplePhoto}
                      createdAt={record?.photo ? record.createdAt : undefined}
                      photoLocation={record?.photoLocation}
                      saved={photoSaved}
                      group={chosen}
                      choices={legacy ? choices : groups}
                      figmaFlow={
                        !legacy && screen === "review"
                          ? tutorial
                            ? "tutorial"
                            : "regular"
                          : undefined
                      }
                      onSelect={selectCapturedAnimal}
                      onRetake={retakePhoto}
                      onConfirm={() =>
                        setScreen(
                          legacy ? (tutorial ? "cheer" : "loading") : "easel",
                        )
                      }
                    />
                  </div>
                  {screen === "cheer" && <PhotoCelebration />}
                </>
              )}
              {screen === "easel" &&
                (tutorial || legacy ? (
                  <ReplicaIntro
                    pose="easel"
                    progress={legacy ? undefined : 4}
                    onNext={() => setScreen("challenge")}
                  />
                ) : (
                  <IntroLoadingScreen
                    onContinue={() => advanceScreen("easel", "challenge")}
                  />
                ))}
              {screen === "loading" && <IntroLoadingScreen />}
              {screen === "challenge" && (
                <ChallengeIntro
                  taskId={task.id}
                  animal={group.name}
                  part={task.part}
                  regionCount={task.scene.regions.length}
                  onStart={startDrawing}
                  tapAnywhere
                  tapLabel={legacy ? undefined : "課題を確認してつぎへ"}
                  autoAdvance={!legacy || (tutorial && task.id === "giraffe")}
                />
              )}
              {screen === "draw" && (
                <>
                  <div inert={sketchCelebrating ? true : undefined}>
                    <ReplicaDraw
                      task={task}
                      observationTools={!legacy}
                      unrestrictedDrawing={!legacy}
                      strokes={drawing.present}
                      canUndo={drawing.past.length > 0}
                      canRedo={drawing.future.length > 0}
                      onUndo={() => dispatchDrawing({ type: "undo" })}
                      onRedo={() => dispatchDrawing({ type: "redo" })}
                      onChange={(strokes) =>
                        dispatchDrawing({ type: "commit", strokes })
                      }
                      showHint={showHint}
                      onHint={() => setShowHint(true)}
                      onDone={() => {
                        const evaluation = drawingEvaluator.evaluate(
                          task,
                          drawing.present,
                        );
                        if (
                          !legacy &&
                          (!drawing.present.length ||
                            evaluation.status === "retry")
                        ) {
                          setShowHint(true);
                          return;
                        }
                        setFeedback(
                          !legacy && !evaluation.passed
                            ? {
                                ...evaluation,
                                passed: true,
                                method: "completed",
                                message: "スケッチができたね！",
                              }
                            : evaluation,
                        );
                        if (legacy) {
                          showResult();
                        } else {
                          setSketchCelebrating(true);
                          void finishDrawing(false);
                        }
                      }}
                    />
                  </div>
                  {sketchCelebrating && (
                    <SketchCelebration onContinue={showResult} />
                  )}
                </>
              )}
              {screen === "result" && feedback && (
                <>
                  <ReplicaResult
                    task={task}
                    group={group}
                    strokes={drawing.present}
                    feedback={feedback}
                    tutorial={tutorial}
                    saving={saving}
                    onRedraw={() => setScreen("draw")}
                    canRedraw={legacy || !tutorial}
                    unrestrictedDrawing={!legacy}
                    showComparisonModes={legacy}
                    onConfirm={() =>
                      setFeedback({
                        passed: true,
                        status: "correct",
                        method: "self-confirmed",
                        message: "見くらべて、確かめたね。",
                      })
                    }
                    onDone={() => void finishDrawing()}
                  />
                  {error && (
                    <button
                      className="text-button replica-skip-save"
                      onClick={nextAfterResult}
                    >
                      保存せずに進む
                    </button>
                  )}
                </>
              )}
              {screen === "tutorial" && (
                <TutorialEndScreen
                  surveyUrl={surveyUrl}
                  showProgress={!legacy}
                  onDone={() => {
                    setTutorial(false);
                    restartCamera();
                  }}
                />
              )}
              {screen === "gallery" && (
                <ReplicaGallery
                  records={records}
                  legacy={legacy}
                  onBack={restartCamera}
                  onCamera={restartCamera}
                  onSettings={
                    legacy
                      ? undefined
                      : (trigger) => {
                          settingsTrigger.current = trigger;
                          setSettingsOpen(true);
                        }
                  }
                />
              )}
              {screen === "free" && (
                <FreeDrawScreen fixedPortrait onDone={restartCamera} />
              )}
            </div>
          </Suspense>
        </main>
        {!legacy && settingsTrigger.current && (
          <Suspense fallback={null}>
            <SettingsDialog
              product
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              furigana={furigana}
              onFuriganaChange={() => {
                setFurigana(!furigana);
                saveFurigana(!furigana);
              }}
              returnFocus={settingsTrigger}
            />
          </Suspense>
        )}
      </div>
    </FuriganaProvider>
  );
}
