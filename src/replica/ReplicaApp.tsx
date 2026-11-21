import { useModelPreload } from "../recognition/useModelPreload";
import { usePhotoIdentification } from "../recognition/usePhotoIdentification";
import {
  FuriganaProvider,
  loadFurigana,
  saveFurigana,
} from "../furigana/Furigana";
import { SettingsDialog } from "../components/SettingsDialog";
import { enqueueShare, flushShareQueue } from "../future/share";
import { useEffect, useReducer, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HomeScreen } from "../components/HomeScreen";
import {
  IntroLoadingScreen,
  SplashScreen,
  TutorialEndScreen,
} from "../components/IntroFlow";
import { ChallengeIntro, PhotoCelebration } from "../components/ChallengeIntro";
import { FreeDrawScreen } from "../screens/DrawScreen";
import { groups } from "../content/groups";
import { clipStrokes } from "../content/scenes";
import { taskById, tasksForGroup } from "../content/tasks";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import { composeObservationImages } from "../notebook/images";
import { drawingHistory, emptyDrawing } from "../drawing/history";
import { drawingEvaluator } from "../domain";
import { tutorialSurveyUrl } from "../research/tutorialSurvey";
import type { Evaluation, Stroke } from "../types";
import { ReplicaCamera } from "./ReplicaCamera";
import { ReplicaGallery, type ReplicaRecord } from "./ReplicaGallery";
import {
  ReplicaDraw,
  ReplicaIntro,
  ReplicaPhotoReview,
  ReplicaResult,
} from "./ReplicaScreens";
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

const tutorialKey = "zooketch-replica-tutorial-v1";
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
  const [screen, setScreen] = useState<Screen>(legacy ? "splash" : "title");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  const [furigana, setFurigana] = useState(loadFurigana);
  const [feedback, setFeedback] = useState<Evaluation>();
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
  useModelPreload({ enabled: tutorial && !legacy, allowMetered: true });
  const [framedExample, setFramedExample] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [record, setRecord] = useState<ReplicaRecord>();
  const [records, setRecords] = useState<ReplicaRecord[]>([]);
  const [drawing, dispatchDrawing] = useReducer(
    drawingHistory,
    undefined,
    emptyDrawing,
  );
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const savedDrawing = useRef<Stroke[] | undefined>(undefined);
  const writingPhoto = useRef<Promise<void>>(Promise.resolve());
  const activeCapture = useRef<string | undefined>(undefined);
  const reduce = useReducedMotion();
  const chosen = groups.find((choice) => choice.id === groupId);
  const group = chosen ?? choices[0];
  const task = tasksForGroup(group.id)[0] ?? taskById.giraffe;
  const identification = usePhotoIdentification(
    !legacy && screen === "review" && !record?.samplePhoto && !groupId
      ? record?.photo
      : undefined,
  );

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
    loadReplicaRecords().then(
      (saved) => {
        if (!mounted.current) return;
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
      () => undefined,
    );
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!legacy) return;
    const next =
      screen === "cheer"
        ? "easel"
        : screen === "loading"
          ? "challenge"
          : undefined;
    if (!next) return;
    const timer = window.setTimeout(
      () => setScreen(next),
      screen === "cheer" ? 1200 : 950,
    );
    return () => window.clearTimeout(timer);
  }, [legacy, screen]);

  function renderGalleryRecord(entry: ReplicaRecord) {
    if (mounted.current)
      setRecords((current) =>
        newestFirst([entry, ...current.filter((item) => item.id !== entry.id)]),
      );
  }

  function restartCamera() {
    activeCapture.current = undefined;
    savedDrawing.current = undefined;
    setFramedExample(false);
    setRecord(undefined);
    setGroupId("");
    setError("");
    setScreen("camera");
  }

  function retakePhoto() {
    restartCamera();
    setFramedExample(!!record?.samplePhoto);
  }

  function takePhoto({ photo, sample }: { photo?: string; sample: boolean }) {
    const next: ReplicaRecord = {
      id: recordId(),
      createdAt: new Date().toISOString(),
      photo,
      photoLocation: photo ? galleryPhotoLocation : undefined,
      groupId: sample ? "giraffe" : undefined,
      taskId: sample ? taskById.giraffe.id : undefined,
      samplePhoto: sample,
      animalName: sample ? "キリン" : undefined,
      photoDescription: sample ? zooAnimalSummary("giraffe") : undefined,
    };
    activeCapture.current = next.id;
    setRecord(next);
    setGroupId(sample ? "giraffe" : "");
    setError("");
    setScreen("review");
    if (!photo) {
      writingPhoto.current = Promise.resolve();
      return;
    }
    writingPhoto.current = (async () => {
      let source = photo;
      if (sample) {
        const response = await fetch(photo);
        if (!response.ok) throw new Error("見本写真を読み込めませんでした。");
        source = await imageDataURL(await response.blob());
      }
      const saved = { ...next, photo: source };
      await saveReplicaRecord(saved);
      renderGalleryRecord(saved);
    })().catch(() => {
      if (mounted.current && activeCapture.current === next.id)
        setError("写真を保存できませんでした。続けて描くことはできます。");
    });
  }

  const selectAnimal = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    if (!groupId && screen === "review" && identification.candidate)
      selectAnimal.current(identification.candidate.groupId);
  }, [groupId, identification.candidate, screen]);

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

  selectAnimal.current = selectCapturedAnimal;

  function startDrawing() {
    dispatchDrawing({ type: "reset" });
    setFeedback(undefined);
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
      const { ownPng } = await composeObservationImages(
        task.scene,
        drawing.present,
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
        groupId: group.id,
        taskId: task.id,
        animalName: group.name,
        description: zooAnimalSummary(group.id),
        photoDescription: zooAnimalSummary(group.id),
      };
      await saveReplicaRecord(next);
      if (!legacy) enqueueShare(next.id);
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
    draw: showHint ? "66-8070" : tutorial ? "43-1966" : "66-7869",
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
            <p className="design3-alert replica-storage-error" role="alert">
              {error}
            </p>
          )}
          <motion.div
            key={screen === "intro" ? `intro-${introPage}` : screen}
            className="replica-screen"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: [0, 0, 0.58, 1] }}
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
                    saved={records.some((item) => item.id === record?.id)}
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
                        tutorial ? "cheer" : legacy ? "loading" : "easel",
                      )
                    }
                    canRetake={legacy || !tutorial}
                  />
                </div>
                {!groupId && screen === "review" && identification.message && (
                  <p
                    role="status"
                    className="quiet-note replica-recognition-status"
                  >
                    {identification.message}
                  </p>
                )}
                {screen === "cheer" && (
                  <PhotoCelebration
                    onContinue={legacy ? undefined : () => setScreen("easel")}
                  />
                )}
              </>
            )}
            {screen === "easel" &&
              (tutorial || legacy ? (
                <ReplicaIntro
                  pose="easel"
                  onNext={() => setScreen("challenge")}
                />
              ) : (
                <IntroLoadingScreen onContinue={() => setScreen("challenge")} />
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
                autoAdvance={legacy && tutorial && task.id === "giraffe"}
              />
            )}
            {screen === "draw" && (
              <ReplicaDraw
                task={task}
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
                    (!clipStrokes(drawing.present, task.scene).length ||
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
                  setScreen("result");
                  if (!legacy) void finishDrawing(false);
                }}
              />
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
              />
            )}
            {screen === "free" && (
              <FreeDrawScreen fixedPortrait onDone={restartCamera} />
            )}
          </motion.div>
        </main>
        {!legacy && (
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
        )}
      </div>
    </FuriganaProvider>
  );
}
