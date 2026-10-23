import { groups } from "./content/groups";
import { OtherObservation } from "./screens/OtherObservation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye as EyeIcon,
  Pencil,
  Volume2,
  VolumeX,
} from "lucide-react";
import { challenges } from "./content/challenges";
import { geometryEvaluator } from "./evaluator";
import { CameraView } from "./CameraView";
import { createFeedbackAudio } from "./audio";
import type { Evaluation, Stroke } from "./types";
import { HomeScreen } from "./screens/HomeScreen";
import { ObserveScreen } from "./screens/ObserveScreen";
import { DrawScreen } from "./screens/DrawScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { LearnScreen } from "./screens/LearnScreen";

type Screen = "home" | "camera" | "observe" | "draw" | "result" | "explain";
const screens: Screen[] = [
  "home",
  "camera",
  "observe",
  "draw",
  "result",
  "explain",
];
function readScreen(): Screen {
  const value = window.location.hash.slice(1);
  return screens.includes(value as Screen) ? (value as Screen) : "home";
}
const challenge = challenges[0];
export default function App() {
  const [groupId, setGroupId] = useState("goat");
  const activeGroup = groups.find((g) => g.id === groupId) || groups[3];
  const [screen, setScreen] = useState<Screen>(readScreen);
  const [strokes, setStrokes] = useState<Stroke[]>([]),
    [evaluation, setEvaluation] = useState<Evaluation>();
  const [hint, setHint] = useState(false),
    [attempts, setAttempts] = useState(0),
    [photo, setPhoto] = useState("");
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem("mitsukeru-sound") === "on";
    } catch {
      return false;
    }
  });
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const audio = useRef<ReturnType<typeof createFeedbackAudio> | null>(null);
  if (!audio.current)
    audio.current = createFeedbackAudio(() => soundRef.current);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const listener = () => {
      setScreen(readScreen());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => () => audio.current?.dispose(), []);
  useEffect(() => {
    document.title =
      "みつけるスケッチ" +
      (screen === "home" ? "" : " — " + activeGroup.name + "のかんさつ");
    mainRef.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [screen, activeGroup.name]);
  function go(next: Screen) {
    window.location.hash = next;
  }
  function begin(next: Screen) {
    setGroupId("goat");
    setStrokes([]);
    setEvaluation(undefined);
    setAttempts(0);
    setHint(false);
    setPhoto("");
    go(next);
  }
  function changeStrokes(next: Stroke[]) {
    setStrokes(next);
    setEvaluation(undefined);
  }
  function toggleSound() {
    const next = !sound;
    setSound(next);
    soundRef.current = next;
    if (next) audio.current?.unlock();
    else audio.current?.silence();
    try {
      localStorage.setItem("mitsukeru-sound", next ? "on" : "off");
    } catch {
      return;
    }
  }
  function answer() {
    audio.current?.unlock();
    const result = geometryEvaluator.evaluate(strokes, challenge);
    setEvaluation(result);
    setAttempts((value) => value + 1);
    if (result.passed) {
      audio.current?.success();
      go("result");
    } else setHint(true);
  }
  const hasAnswer = evaluation?.passed === true;
  const activeStep = screen === "observe" ? 0 : screen === "draw" ? 1 : 2;
  if (
    activeGroup.evaluation === "self" &&
    screen !== "home" &&
    screen !== "camera"
  )
    return (
      <OtherObservation
        key={groupId}
        group={activeGroup}
        photo={photo}
        onHome={() => go("home")}
      />
    );
  function selectGroup(id: string) {
    begin("observe");
    setGroupId(id);
  }
  return (
    <div className="app-shell">
      <header className="header">
        <button
          className="wordmark"
          onClick={() => go("home")}
          aria-label="みつけるスケッチ ホーム"
        >
          <span className="brand-mark">
            <Pencil size={23} />
            <i />
          </span>
          <span>
            みつける<span>スケッチ</span>
            <small>見る。描く。あっ、わかった。</small>
          </span>
        </button>
        <button
          className="sound-toggle"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "効果音をオフにする" : "効果音をオンにする"}
        >
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          <span>音 {sound ? "ON" : "OFF"}</span>
        </button>
      </header>
      {screen !== "home" && (
        <div className="topline">
          <button
            className="back-button"
            onClick={() =>
              go(
                screen === "camera"
                  ? "home"
                  : screen === "observe"
                    ? "camera"
                    : screen === "draw"
                      ? "observe"
                      : screen === "explain"
                        ? "result"
                        : "draw",
              )
            }
          >
            <ArrowLeft size={18} />
            {screen === "camera"
              ? "ホーム"
              : screen === "draw"
                ? "もう一度見る"
                : "戻る"}
          </button>
          {screen !== "camera" && (
            <div
              className="stepper"
              aria-label={
                "今は" + ["観察", "描画", "発見"][activeStep] + "のステップ"
              }
            >
              {["みる", "かく", "わかる"].map((label, index) => (
                <span
                  className={
                    index === activeStep
                      ? "current"
                      : index < activeStep
                        ? "complete"
                        : ""
                  }
                  key={label}
                >
                  <i>{index < activeStep ? <Check size={11} /> : index + 1}</i>
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <main ref={mainRef} className={"main screen-" + screen}>
        {screen === "home" && (
          <HomeScreen begin={begin} onSelect={selectGroup} />
        )}
        {screen === "camera" && (
          <CameraView
            onSelect={(image, id) => {
              setGroupId(id || "goat");
              setPhoto(image || "");
              go("observe");
            }}
          />
        )}
        {screen === "observe" && (
          <ObserveScreen photo={photo} onDraw={() => go("draw")} />
        )}
        {screen === "draw" && (
          <DrawScreen
            challenge={challenge}
            photo={photo}
            strokes={strokes}
            changeStrokes={changeStrokes}
            evaluation={evaluation}
            hint={hint}
            setHint={setHint}
            attempts={attempts}
            answer={answer}
            onContinue={() => {
              setEvaluation({
                passed: true,
                status: "correct",
                message: "観察した特徴を確かめよう。",
              });
              go("explain");
            }}
          />
        )}
        {(screen === "result" || screen === "explain") && !hasAnswer && (
          <section className="guard-page">
            <EyeIcon size={42} />
            <h1 tabIndex={-1}>まずは、よく見てみよう。</h1>
            <p>答えの前に、自分の発見を描いてみよう。</p>
            <button className="primary" onClick={() => go("observe")}>
              観察をはじめる
              <ArrowRight size={19} />
            </button>
          </section>
        )}
        {screen === "result" && hasAnswer && (
          <ResultScreen
            strokes={strokes}
            answer={activeGroup.answer}
            onNext={() => go("explain")}
          />
        )}
        {screen === "explain" && hasAnswer && (
          <LearnScreen
            challenge={challenge}
            onRestart={() => begin("observe")}
            onHome={() => go("home")}
          />
        )}
      </main>
      <footer className="footer">
        <span className="footer-squiggle">〜</span>
        <p>急がなくていい。発見は、すぐ目の前に。</p>
        <span>みつけるスケッチ</span>
      </footer>
    </div>
  );
}
