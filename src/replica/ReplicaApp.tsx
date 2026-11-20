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
import { taskById, tasksForGroup } from "../content/tasks";
import { composeObservationImages } from "../notebook/images";
import { drawingHistory, emptyDrawing } from "../drawing/history";
import { ReplicaCamera } from "./ReplicaCamera";
import { ReplicaGallery, type ReplicaRecord } from "./ReplicaGallery";
import {
  ReplicaDraw,
  ReplicaIntro,
  ReplicaPhotoReview,
  ReplicaResult,
  giraffeFact,
} from "./ReplicaScreens";
import { imageDataURL, loadReplicaRecords, saveReplicaRecord } from "./storage";
import "../styles/tokens.css";
import "../styles/cards.css";
import "../styles/design3.css";
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

const introSteps = ["wave", "book", "camera"] as const;
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

export function ReplicaApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [introPage, setIntroPage] = useState(0);
  const [tutorial, setTutorial] = useState(false);
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
  const writingPhoto = useRef<Promise<void>>(Promise.resolve());
  const activeCapture = useRef<string | undefined>(undefined);
  const reduce = useReducedMotion();
  const chosen = choices.find((choice) => choice.id === groupId);
  const group = chosen ?? choices[0];
  const task = tasksForGroup(group.id)[0] ?? taskById.giraffe;

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
  }, [screen]);

  function renderGalleryRecord(entry: ReplicaRecord) {
    if (mounted.current)
      setRecords((current) =>
        newestFirst([entry, ...current.filter((item) => item.id !== entry.id)]),
      );
  }

  function restartCamera() {
    activeCapture.current = undefined;
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
      samplePhoto: sample,
      animalName: sample ? "キリン" : undefined,
      photoDescription: sample ? giraffeFact : undefined,
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

  function startDrawing() {
    dispatchDrawing({ type: "reset" });
    setShowHint(false);
    setScreen("draw");
  }

  function nextAfterResult() {
    if (tutorial) {
      setScreen("tutorial");
      setError("");
    } else {
      restartCamera();
    }
  }

  async function finishDrawing() {
    if (savingRef.current || !drawing.present.length) return;
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
      const savedPhoto = records.find((item) => item.id === record?.id)?.photo;
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
        taskId: task.id,
        animalName: group.name,
        description: task.explanation.ecology || task.explanation.form,
        photoDescription: group.id === "giraffe" ? giraffeFact : group.fact,
      };
      await saveReplicaRecord(next);
      if (!mounted.current) return;
      renderGalleryRecord(next);
      nextAfterResult();
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
  return (
    <div
      className="figma-shell design3-shell replica-app"
      data-screen={screen}
      data-variant="replica"
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
              onStart={() => {
                setIntroPage(0);
                setTutorial(true);
                setScreen("intro");
              }}
              onContinue={() => {
                setTutorial(false);
                restartCamera();
              }}
              onCollection={() => setScreen("gallery")}
              onSettings={() => setScreen("free")}
            />
          )}
          {screen === "intro" && (
            <ReplicaIntro
              pose={introSteps[introPage]}
              onNext={() =>
                introPage < introSteps.length - 1
                  ? setIntroPage(introPage + 1)
                  : restartCamera()
              }
            />
          )}
          {camera && (
            <ReplicaCamera
              tutorial={tutorial}
              framedExample={framedExample}
              onCapture={takePhoto}
              onFreeDraw={() => setScreen("free")}
              onHome={() => setScreen("title")}
              onGallery={() => setScreen("gallery")}
            />
          )}
          {review && (
            <>
              <div inert={screen === "cheer" ? true : undefined}>
                <ReplicaPhotoReview
                  photo={record?.photo}
                  sample={!!record?.samplePhoto}
                  createdAt={record?.photo ? record.createdAt : undefined}
                  saved={records.some((item) => item.id === record?.id)}
                  group={chosen}
                  choices={choices}
                  onSelect={setGroupId}
                  onRetake={retakePhoto}
                  onConfirm={() => setScreen(tutorial ? "cheer" : "loading")}
                />
              </div>
              {screen === "cheer" && <PhotoCelebration />}
            </>
          )}
          {screen === "easel" && (
            <ReplicaIntro pose="easel" onNext={() => setScreen("challenge")} />
          )}
          {screen === "loading" && <IntroLoadingScreen />}
          {screen === "challenge" && (
            <ChallengeIntro
              taskId={task.id}
              animal={group.name}
              part={task.part}
              regionCount={task.scene.regions.length}
              onStart={startDrawing}
              tapAnywhere
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
              onDone={() => setScreen("result")}
            />
          )}
          {screen === "result" && (
            <>
              <ReplicaResult
                task={task}
                group={group}
                strokes={drawing.present}
                tutorial={tutorial}
                saving={saving}
                onRedraw={() => setScreen("draw")}
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
              onDone={() => {
                setTutorial(false);
                restartCamera();
              }}
            />
          )}
          {screen === "gallery" && (
            <ReplicaGallery
              records={records}
              onBack={restartCamera}
              onCamera={restartCamera}
            />
          )}
          {screen === "free" && (
            <FreeDrawScreen fixedPortrait onDone={restartCamera} />
          )}
        </motion.div>
      </main>
    </div>
  );
}
