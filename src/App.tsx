import { tutorialSurveyUrl } from "./research/tutorialSurvey";
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
import { DopaProgress } from "./components/DopaEffects";
import {
  IntroFlow,
  IntroLoadingScreen,
  SplashScreen,
  TutorialEndScreen,
} from "./components/IntroFlow";
import { ChallengeIntro } from "./components/ChallengeIntro";
import { DrawScreen, FreeDrawScreen } from "./screens/DrawScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { SettingsDialog } from "./components/SettingsDialog";
import {
  FuriganaProvider,
  loadFurigana,
  saveFurigana,
} from "./furigana/Furigana";
import { ReflectionNote } from "./components/ReflectionNote";
import { Settings } from "lucide-react";
import { ReadAloud, stopSpeech } from "./speech/Speech";
import { CameraView } from "./CameraView";
const DrawingCollection = lazy(() =>
  import("./components/DrawingCollection").then((module) => ({
    default: module.DrawingCollection,
  })),
);
import { artwork, assetPath } from "./content/artwork";
import { groups } from "./content/groups";
import { tasksForGroup, taskById } from "./content/tasks";
import { clipStrokes } from "./content/scenes";
import { currentProfileId } from "./future/profiles";
import { parseTaskHash } from "./future/deeplink";
import { QrScanner, qrScanSupported } from "./components/QrScanner";
import { drawingEvaluator } from "./domain";

import {
  recordStudy,
  flushStudyWrites,
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
  updateObservationReflection,
} from "./notebook/storage";
import {
  composeObservationImages,
  composeCardPng,
  savePng,
} from "./notebook/images";
import type { ObservationRecord } from "./notebook/types";
import { createFeedbackAudio } from "./audio";
import { drawingHistory, emptyDrawing } from "./drawing/history";
import type { Evaluation, Stroke, StrokeStyle } from "./types";
import {
  addXp,
  loadDopaSound,
  pickPraise,
  saveDopaSound,
} from "./dopagaki/dopa";
import { celebrateDopa, DopaOverlay, fireConfetti } from "./dopagaki/effects";
import {
  dopaDing,
  dopaShutter,
  silenceDopaAudio,
  unlockDopaAudio,
} from "./dopagaki/sounds";
import {
  applyStyles,
  getStrokeStyle,
  setStrokeStyle,
  stylesFor,
} from "./drawing/styles";
import "./styles/cards.css";
import "./styles/design3.css";
import "./styles/dopa.css";
import "./styles/dopagaki.css";

const TUTORIAL_KEY = "zooketch-tutorial-complete-v1";
type Screen = "splash" | "home" | "intro" | "activity" | "tutorial" | "free";

export default function App({ dopa = false }: { dopa?: boolean }) {
  const [dopaSound, setDopaSound] = useState(loadDopaSound);
  const [dopaPraise, setDopaPraise] = useState<string>();
  const awardedDopaPass = useRef(false);

  useEffect(() => {
    if (!dopa) return;
    const theme = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!theme) return;
    const previous = theme.content;
    theme.content = "#fbe1ee";
    return () => {
      theme.content = previous;
    };
  }, [dopa]);
  useEffect(() => () => silenceDopaAudio(), []);

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
  const [screen, setScreen] = useState<Screen>("splash");
  const [qrOpen, setQrOpen] = useState(false);
  const openLinkedTaskRef = useRef(openLinkedTask);
  openLinkedTaskRef.current = openLinkedTask;
  useEffect(() => {
    const followHash = () => {
      const id = parseTaskHash(window.location.hash);
      if (!id || !Object.hasOwn(taskById, id)) return;
      const url = window.location;
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search,
      );
      openLinkedTaskRef.current(id);
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);
  const [photoPhase, setPhotoPhase] = useState<
    "cheer" | "loading" | "challenge"
  >();
  const tutorialShown = useRef(false);
  const attemptedSurvey = useRef(false);
  const [surveyUrl] = useState(() =>
    tutorialSurveyUrl(
      window.location.search,
      import.meta.env.VITE_STUDY_FORM_URL,
    ),
  );
  useEffect(() => {
    if (screen !== "tutorial" || !surveyUrl || attemptedSurvey.current) return;
    let active = true;
    void flushStudyWrites().then(() => {
      if (!active || attemptedSurvey.current || !navigator.onLine) return;
      attemptedSurvey.current = true;
      window.location.assign(surveyUrl);
    });
    return () => {
      active = false;
    };
  }, [screen, surveyUrl]);
  useEffect(() => {
    if (photoPhase !== "cheer" && photoPhase !== "loading") return;
    const duration =
      photoPhase === "cheer" ? (dopa ? 760 : 1200) : dopa ? 450 : 950;
    const timer = window.setTimeout(
      () => setPhotoPhase(photoPhase === "cheer" ? "loading" : "challenge"),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [dopa, photoPhase]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  const [taskId, setTaskId] = useState("goat");
  const [reflection, setReflection] = useState({
    discovery: "",
    revisited: false,
  });
  const [reflectionDirty, setReflectionDirty] = useState(false);
  const [photo, setPhoto] = useState("");
  const [drawing, dispatchDrawing] = useReducer(
    drawingHistory,
    undefined,
    emptyDrawing,
  );
  const strokes = drawing.present;
  const DRAFT_KEY = "zooketch-drafts-v1";
  type DraftMap = Record<
    string,
    { strokes: Stroke[]; styles: (StrokeStyle | null)[] }
  >;
  const readDrafts = (): DraftMap => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as DraftMap;
    } catch {
      return {};
    }
  };
  const writeDrafts = (drafts: DraftMap) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    } catch {
      /* storage may be unavailable; drafts are a convenience only */
    }
  };
  const removeDraft = (id: string) => {
    const drafts = readDrafts();
    if (id in drafts) {
      delete drafts[id];
      writeDrafts(drafts);
    }
  };
  useEffect(() => {
    if (screen !== "activity" || step !== 1 || !strokes.length) return;
    const drafts = readDrafts();
    drafts[taskId] = { strokes, styles: stylesFor(strokes) };
    writeDrafts(drafts);
  }, [strokes, taskId, step, screen]);
  useEffect(() => {
    if (screen === "activity" && step === 1 && !strokes.length) {
      const draft = readDrafts()[taskId];
      setDraftOffer(draft?.strokes.length ? taskId : undefined);
    } else if (step !== 1) setDraftOffer(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, taskId, screen]);
  function restoreDraft() {
    const draft = readDrafts()[taskId];
    if (!draft) return;
    applyStyles(draft.strokes, draft.styles);
    dispatchDrawing({ type: "commit", strokes: draft.strokes });
    setDraftOffer(undefined);
  }
  function discardDraft() {
    removeDraft(taskId);
    setDraftOffer(undefined);
  }
  const [feedback, setFeedback] = useState<Evaluation>();
  const [hintLevel, setHintLevel] = useState(0);
  const [furigana, setFurigana] = useState(loadFurigana);
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
  const [completedGroup, setCompletedGroup] = useState("");
  const [draftOffer, setDraftOffer] = useState<string>();
  const task = taskById[taskId],
    scene = task.scene;
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
  async function save(): Promise<"created" | "updated" | undefined> {
    if (
      savingLock.current ||
      (savedId && !reflectionDirty) ||
      !feedback?.passed ||
      !storageReady
    )
      return;
    const clipped = clipStrokes(strokes, scene);
    const visible = clipped.map((s) =>
      s.map((p) => ({
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
      })),
    );
    clipped.forEach((source, i) => {
      const style = getStrokeStyle(source);
      if (style) setStrokeStyle(visible[i], style);
    });
    if (!visible.length) return;
    const generation = taskGeneration.current,
      logContext = currentStudyContext();
    savingLock.current = true;
    setSaving(true);
    setStorageError("");
    try {
      if (savedId) {
        await updateObservationReflection(savedId, reflection);
        if (generation === taskGeneration.current) setReflectionDirty(false);
        recordStudy(
          "reflection_saved",
          {
            hasDiscovery: !!reflection.discovery.trim(),
            revisitedSelfReport: reflection.revisited,
          },
          logContext,
        );
        return "updated";
      }
      const record = observationMetadata({
        id: crypto.randomUUID(),
        groupId: task.groupId,
        taskId,
        sceneVersion: 2,
        createdAt: new Date().toISOString(),
        strokes: visible,
        styles: stylesFor(visible),
        outcome: feedback.method === "automatic" ? "correct" : "self-confirmed",
        profileId: currentProfileId(),
      });
      const images = await composeObservationImages(scene, visible);
      await addObservation({ ...record, ...images, ...reflection });
      removeDraft(taskId);
      if (generation === taskGeneration.current) {
        setSavedId(record.id);
        setReflectionDirty(false);
        void loadObservations()
          .then((records) => {
            if (
              generation === taskGeneration.current &&
              tasksForGroup(task.groupId).every((t) =>
                records.some((record) => record.taskId === t.id),
              )
            )
              setCompletedGroup(group.name);
          })
          .catch(() => undefined);
      }
      void refreshCollection().catch(() => undefined);
      recordStudy("observation_saved", {}, logContext);
      recordStudy(
        "reflection_saved",
        {
          hasDiscovery: !!reflection.discovery.trim(),
          revisitedSelfReport: reflection.revisited,
        },
        logContext,
      );
      return "created";
    } catch {
      setStorageError(
        "観察を保存できませんでした。空き容量やブラウザの設定を確認し、もう一度試してください。",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  function openCollection() {
    setCollectionOpen(true);
    window.scrollTo(0, 0);
  }
  function openSettings(trigger: HTMLElement) {
    settingsTrigger.current = trigger;
    setSettingsOpen(true);
  }
  async function finishObservation(advance: boolean) {
    const generation = taskGeneration.current;
    if (dopa) unlockDopaAudio();
    const result = !savedId || reflectionDirty ? await save() : undefined;
    if (generation !== taskGeneration.current) return;
    if (dopa && result === "created") {
      const { level, leveledUp } = addXp(30);
      if (leveledUp) {
        celebrateDopa({
          kind: "levelup",
          title: "レベルアップ！",
          sub: `Lv.${level} 到達！`,
          xp: 30,
        });
      } else {
        dopaDing();
        fireConfetti(48);
      }
    }
    if (result === "created" && !tutorialShown.current) {
      tutorialShown.current = true;
      if (surveyUrl) {
        restart("tutorial");
        return;
      }
      try {
        if (!localStorage.getItem(TUTORIAL_KEY)) {
          localStorage.setItem(TUTORIAL_KEY, "true");
          restart("tutorial");
          return;
        }
      } catch {
        restart("tutorial");
        return;
      }
    }
    if (advance) {
      if (savedId && (!reflectionDirty || result === "updated"))
        openCollection();
      else if (result === "created") restart();
    }
  }
  async function exportCurrentPng(
    kind: "own" | "comparison" | "photo",
    share = false,
  ) {
    const visible = clipStrokes(strokes, scene);
    if (!visible.length || saving || (kind === "photo" && !photo)) return;
    setSaving(true);
    setStorageError("");
    try {
      const images = await composeObservationImages(scene, visible);
      const createdAt = new Date().toISOString();
      const date = createdAt.slice(0, 10);
      if (kind === "photo") {
        const [{ composePhotoCard }, capture] = await Promise.all([
          import("./future/photoCard"),
          fetch(photo),
        ]);
        const card = await composePhotoCard({
          photo: await capture.blob(),
          sketch: images.ownPng,
          animalName: group.name,
          featureName: task.part,
          discovery: reflection.discovery,
        });
        await savePng(card, `zooketch-${taskId}-${date}-photo-card.png`);
        return;
      }
      const image = await composeCardPng(
        kind === "own" ? images.ownPng : images.comparisonPng,
        {
          animalName: group.name,
          taskName: task.part,
          createdAt,
          explanation: task.explanation,
          ...reflection,
        },
        kind === "comparison",
      );
      const filename = `zooketch-${taskId}-${date}-${kind === "own" ? "sketch" : "comparison"}.png`;
      if (share && navigator.share && navigator.canShare) {
        const file = new File([image], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "ズーケッチ" });
          return;
        }
      }
      await savePng(image, filename);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStorageError(
        "PNG画像を準備できませんでした。もう一度試してください。",
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
    awardedDopaPass.current = false;
    setDopaPraise(undefined);
    if (activeTask.current) recordStudy("challenge_left");
    activeTask.current = undefined;
    setTaskId(id);
    setBeforeDrawing(undefined);
    setStudyPhase("before");
    pairId.current = crypto.randomUUID();
    dispatchDrawing({ type: "reset" });
    setHintLevel(0);
    setReflection({ discovery: "", revisited: false });
    setReflectionDirty(false);
    setFeedback(undefined);
    setSavedId(undefined);
    setCompletedGroup("");
    setDraftOffer(undefined);
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
  function restart(destination: Screen = "activity") {
    setScreen(destination);
    setPhotoPhase(undefined);
    setStorageError("");
    taskGeneration.current++;
    awardedDopaPass.current = false;
    setDopaPraise(undefined);
    if (activeTask.current) recordStudy("challenge_left");
    activeTask.current = undefined;
    setCollectionOpen(false);
    setBeforeDrawing(undefined);
    setStudyPhase("before");
    setPhoto("");
    dispatchDrawing({ type: "reset" });
    setFeedback(undefined);
    setHintLevel(0);
    setReflection({ discovery: "", revisited: false });
    setReflectionDirty(false);
    setSavedId(undefined);
    setCompletedGroup("");
    setDraftOffer(undefined);
    setStudyContext();
    next(0);
  }
  function openLinkedTask(id: string) {
    if (!Object.hasOwn(taskById, id)) return;
    restart();
    setSettingsOpen(false);
    selectTask(id);
    setPhotoPhase("challenge");
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
      awardedDopaPass.current = false;
      setDopaPraise(undefined);
      recordStudy("challenge_opened");
      dispatchDrawing({ type: "reset" });
      setHintLevel(0);
      setReflection({ discovery: "", revisited: false });
      setReflectionDirty(false);
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
    if (dopa) {
      if (awardedDopaPass.current) return;
      awardedDopaPass.current = true;
      const praise = pickPraise();
      setDopaPraise(praise);
      const { level, leveledUp } = addXp(50);
      celebrateDopa({
        kind: "jackpot",
        title: "大当たり！",
        sub: leveledUp ? `レベルアップ！ Lv.${level} 到達！` : praise,
        xp: 50,
      });
      return;
    }
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
    removeDraft(taskId);
    recordStudy("drawing_submitted", { empty: false });
    const result = drawingEvaluator.evaluate(task, strokes);
    setFeedback(result);
    recordStudy("evaluation_completed", {
      method: result.method,
      status: result.status,
    });
    if (result.method === "comparison") next(2);
    if (result.passed) {
      celebrate();
      next(2);
    }
  }
  const collectionLoadingView = (
    <p className="design3-alert" role="status">
      観察ノートを読み込んでいます…
    </p>
  );
  return (
    <FuriganaProvider enabled={furigana}>
    <div
      className={
        dopa
          ? "figma-shell design3-shell dopa-app dopa-on"
          : "figma-shell design3-shell"
      }
      data-step={step}
      data-screen={
        collectionOpen
          ? "collection"
          : photoPhase === "cheer"
            ? screen
            : (photoPhase ?? screen)
      }
    >
      <main>
        {dopa &&
          screen === "activity" &&
          !collectionOpen &&
          photoPhase !== "cheer" && (
            <DopaProgress step={photoPhase ? 1 : step} />
          )}
        {storageError && (
          <p className="design3-alert" role="alert">
            {storageError}
          </p>
        )}
        {collectionOpen ? (
          <Suspense fallback={collectionLoadingView}>
            {collectionLoading || !storageReady ? (
              collectionLoadingView
            ) : (
              <DrawingCollection
                drawings={collection}
                onBack={() => setCollectionOpen(false)}
                onCamera={() => restart()}
                onUpdate={refreshCollection}
                onDelete={async (id) => {
                  try {
                    await deleteObservation(id);
                    await refreshCollection();
                    if (savedId === id) {
                      setSavedId(undefined);
                      setCompletedGroup("");
                    }
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
        ) : screen === "splash" ? (
          <SplashScreen onDone={() => setScreen("home")} />
        ) : screen === "home" ? (
          <HomeScreen
            edition={dopa ? "dopa" : "plus"}
            onStart={() => {
              if (dopa) unlockDopaAudio();
              restart("intro");
            }}
            onContinue={() => {
              if (dopa) unlockDopaAudio();
              restart();
            }}
            onCollection={openCollection}
            onSettings={openSettings}
            savedCount={collectionCount}
            studyTutorial={!!surveyUrl}
            onScanQr={qrScanSupported() ? () => setQrOpen(true) : undefined}
          />
        ) : screen === "intro" ? (
          <IntroFlow onDone={() => setScreen("activity")} />
        ) : screen === "tutorial" ? (
          <TutorialEndScreen
            onDone={() => restart("home")}
            surveyUrl={surveyUrl}
          />
        ) : screen === "free" ? (
          <FreeDrawScreen onDone={() => restart()} />
        ) : photoPhase === "loading" ? (
          <IntroLoadingScreen />
        ) : photoPhase === "challenge" ? (
          <ChallengeIntro
            taskId={task.id}
            animal={group.name}
            part={task.part}
            regionCount={scene.regions.length}
            onStart={() => {
              setPhotoPhase(undefined);
              next(1);
            }}
          />
        ) : (
          <>
            <motion.section
              className="activity-card"
              key={step}
              initial={reduce || step !== 1 ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 ? (
                <CameraView
                  dopa={dopa}
                  onCapture={dopa ? dopaShutter : undefined}
                  suspended={settingsOpen}
                  celebrating={photoPhase === "cheer"}
                  onCollection={openCollection}
                  onSettings={openSettings}
                  onFreeDraw={() => restart("free")}
                  onSelect={(image, id, method) => {
                    recordStudy(
                      "animal_identified",
                      { method },
                      {
                        animalId: taskById[id].groupId,
                        taskId: undefined,
                        attemptId: undefined,
                      },
                    );
                    setPhoto(image);
                    selectTask(id);
                    window.scrollTo(0, 0);
                    setPhotoPhase(
                      image && !(dopa && reduce) ? "cheer" : "challenge",
                    );
                  }}
                />
              ) : step === 1 ? (
                <>
                  {studyTaskEnabled && (
                    <p className="quiet-note">
                      {studyPhase === "before" ? "1回目" : "2回目"}のスケッチ
                    </p>
                  )}
                  {draftOffer === taskId && (
                    <div className="draft-banner" role="status">
                      <p>前に描いた下書きがあるよ</p>
                      <button className="primary" onClick={restoreDraft}>
                        つづきを描く
                      </button>
                      <button className="text-button" onClick={discardDraft}>
                        下書きを消す
                      </button>
                    </div>
                  )}
                  <DrawScreen
                    dopaMode={dopa}
                    key={taskId}
                    task={task}
                    photo={photo}
                    strokes={strokes}
                    feedback={feedback}
                    hintLevel={hintLevel}
                    onHint={() => {
                      const level = hintLevel + 1;
                      setHintLevel(level);
                      recordStudy("hint_opened", { hintLevel: level });
                    }}
                    onAnswer={answer}
                    onContinue={() => next(2)}
                    onAbsent={() => {
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
                    onReselect={() => restart()}
                    canvasProps={{
                      canUndo: drawing.past.length > 0,
                      canRedo: drawing.future.length > 0,
                      onUndo: () => {
                        dispatchDrawing({ type: "undo" });
                        recordStudy("drawing_undo");
                        setFeedback(undefined);
                        setSavedId(undefined);
                      },
                      onRedo: () => {
                        dispatchDrawing({ type: "redo" });
                        setFeedback(undefined);
                        setSavedId(undefined);
                      },
                      onChange: (value, action) => {
                        if (action === "clear") {
                          recordStudy("drawing_cleared");
                          removeDraft(taskId);
                        }
                        if (action === "erase") recordStudy("drawing_erased");
                        dispatchDrawing({ type: "commit", strokes: value });
                        setFeedback(undefined);
                        setSavedId(undefined);
                      },
                      onDrawingActivity: (active, tool) =>
                        recordStudy(
                          active ? "drawing_started" : "drawing_stopped",
                          { tool },
                        ),
                    }}
                  />
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
                          onClick={() => {
                            selectTask(t.id);
                            window.scrollTo(0, 0);
                          }}
                        >
                          {t.part}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : step === 2 ? (
                <ResultScreen
                  dopaMode={dopa}
                  dopaPraise={dopaPraise}
                  task={task}
                  group={group}
                  strokes={strokes}
                  feedback={feedback}
                  reflection={reflection}
                  onReflectionChange={(value) => {
                    setReflection(value);
                    setReflectionDirty(true);
                  }}
                  saving={saving}
                  saved={!!savedId}
                  reflectionDirty={reflectionDirty}
                  storageReady={storageReady}
                  completedGroup={completedGroup}
                  onConfirm={confirm}
                  onRedraw={() => next(1)}
                  onNext={() => void finishObservation(true)}
                  onUpdateReflection={() => void finishObservation(false)}
                  onLearn={() => next(3)}
                  onExport={exportCurrentPng}
                  onPhotoExport={
                    photo ? () => void exportCurrentPng("photo") : undefined
                  }
                  onShare={() => void exportCurrentPng("own", true)}
                  onSliderCommit={(from, to, via) =>
                    recordStudy("comparison_slider_moved", { from, to, via })
                  }
                />
              ) : (
                <section className="design3-lesson">
                  <button className="text-button" onClick={() => next(2)}>
                    結果に戻る
                  </button>
                  <h1>{task.explanation.name}</h1>
                  <ReadAloud
                    id="explanation"
                    text={[
                      task.explanation.name,
                      task.explanation.form,
                      task.explanation.ecology,
                      task.next,
                    ].filter(Boolean).join("。")}
                  />
                  <div className="figma-science">
                    <svg
                      viewBox={`0 0 600 ${scene.frameHeight || 400}`}
                      role="img"
                      aria-label={task.explanation.name + "の解説イラスト"}
                    >
                      <image
                        href={assetPath(
                          (scene.artworkOverride ?? artwork[task.id])
                            .explanation!,
                        )}
                        width="600"
                        height={scene.frameHeight || 400}
                        preserveAspectRatio="none"
                      />
                    </svg>
                  </div>
                  <div className="figma-explanation">
                    <h2>よく見ると…</h2>
                    <p>{task.explanation.form}</p>
                    {task.explanation.ecology && (
                      <>
                        <h2>くらしとのつながり</h2>
                        <p>{task.explanation.ecology}</p>
                      </>
                    )}
                    {task.provisional && task.source && (
                      <a href={task.source} target="_blank" rel="noreferrer">
                        京都市動物園の図鑑を見る
                      </a>
                    )}
                  </div>
                  <ReflectionNote
                    value={reflection}
                    question={task.next}
                    disabled={saving}
                    onChange={(value) => {
                      setReflection(value);
                      setReflectionDirty(true);
                    }}
                  />
                  <button
                    className="primary collection-save"
                    disabled={
                      (!!savedId && !reflectionDirty) ||
                      saving ||
                      !storageReady ||
                      !feedback?.passed ||
                      !strokes.length
                    }
                    onClick={() => void finishObservation(false)}
                  >
                    {savedId && !reflectionDirty
                      ? "保存したよ！"
                      : saving
                        ? "観察を保存中…"
                        : savedId
                          ? "気づきを更新する"
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
                      {photo && (
                        <button
                          className="primary collection-save"
                          disabled={saving}
                          onClick={() => void exportCurrentPng("photo")}
                        >
                          写真とスケッチをPNGで保存
                        </button>
                      )}
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
                </section>
              )}
            </motion.section>
            {photoPhase !== "cheer" && (
              <nav
                className="figma-header design3-utilities"
                aria-label="アプリのメニュー"
              >
                <button
                  disabled={saving}
                  onClick={() => restart("home")}
                  aria-label="ズーケッチ ホームに戻る"
                >
                  ホーム
                </button>
                {step !== 0 && (
                  <>
                    <button disabled={saving} onClick={openCollection}>
                      図鑑 ({collectionCount})
                    </button>
                    <button
                      className="header-settings"
                      disabled={saving}
                      aria-label="設定を開く"
                      onClick={(event) => openSettings(event.currentTarget)}
                    >
                      <Settings aria-hidden="true" size={19} />
                    </button>
                  </>
                )}
              </nav>
            )}
          </>
        )}
        {qrOpen && (
          <QrScanner
            onClose={() => setQrOpen(false)}
            onFound={(id) => {
              setQrOpen(false);
              openLinkedTask(id);
            }}
          />
        )}
        <SettingsDialog
          open={settingsOpen}
          defaultObservationTaskId={
            screen === "activity" && step > 0 ? taskId : undefined
          }
          returnFocus={settingsTrigger}
          onClose={() => setSettingsOpen(false)}
          sound={dopa ? dopaSound : sound}
          onSoundChange={() => {
            if (dopa) {
              saveDopaSound(!dopaSound);
              setDopaSound(!dopaSound);
              if (dopaSound) silenceDopaAudio();
              else dopaDing();
              return;
            }
            soundRef.current = !sound;
            setSound(!sound);
            if (!sound) audio.current?.unlock();
            else audio.current?.silence();
          }}
          furigana={furigana}
          onFuriganaChange={() => {
            saveFurigana(!furigana);
            setFurigana(!furigana);
          }}
        />
      </main>
      {dopa && <DopaOverlay />}
    </div>
    </FuriganaProvider>
  );
}
