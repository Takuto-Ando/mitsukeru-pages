import { useState, useRef, useEffect } from "react";
import { createFeedbackAudio } from "./audio";
import { motion, useReducedMotion } from "motion/react";
import { CameraView } from "./CameraView";
import { SketchCanvas } from "./SketchCanvas";
import { SketchComparison } from "./components/SketchComparison";
import { Mascot } from "./components/Mascot";

import { groups } from "./content/groups";
import { challenges } from "./content/challenges";
import { evaluateObservation } from "./evaluator";
import { profiles, evaluateProfile } from "./content/profiles";
import type { Stroke, Evaluation } from "./types";
import "./styles/figma.css";
export default function App() {
  const [step, setStep] = useState(0),
    [groupId, setGroupId] = useState("goat"),
    [photo, setPhoto] = useState("");
  const [strokes, setStrokes] = useState<Stroke[]>([]),
    [feedback, setFeedback] = useState<Evaluation>(),
    [hint, setHint] = useState(false);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const audio = useRef<ReturnType<typeof createFeedbackAudio> | null>(null);
  if (!audio.current)
    audio.current = createFeedbackAudio(() => soundRef.current);
  useEffect(() => () => audio.current?.dispose(), []);
  const reduce = useReducedMotion();
  const challenge = challenges[0];
  const group = groups.find((g) => g.id === groupId)!;
  const profile = profiles[groupId];
  function restart() {
    setStrokes([]);
    setFeedback(undefined);
    setHint(false);
    setPhoto("");
    setStep(0);
    window.scrollTo(0, 0);
  }
  function next(value: number) {
    setStep(value);
    window.scrollTo(0, 0);
  }
  function answer() {
    const result = profile
      ? evaluateProfile(strokes, profile)
      : evaluateObservation(strokes, challenge.observationParameters);
    setFeedback(result);
    if (result.passed) {
      audio.current?.unlock();
      audio.current?.success();
      next(2);
    }
  }
  return (
    <div className="figma-shell">
      <header className="figma-header">
        <button onClick={restart}>
          <img
            src={import.meta.env.BASE_URL + "figma/2-2-imgLogoDot.svg"}
            alt=""
          />
          みつけるスケッチ
        </button>
      </header>
      <main>
        <div className="figma-flow">
          {["01 / OBSERVE", "02 / DRAW", "03 / DISCOVER", "04 / LEARN"][step]}
          <Mascot step={step} />
        </div>
        <motion.section
          key={step}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 ? (
            <CameraView
              onSelect={(image, id) => {
                setPhoto(image || "");
                setGroupId(id || "goat");
                next(1);
              }}
            />
          ) : step === 1 ? (
            <>
              <h1>
                {profile ? profile.part + "を描こう" : "目の中を描いてみよう。"}
              </h1>
              <p className="figma-support">
                {profile
                  ? profile.question
                  : "ヤギの瞳の黒い部分は、どんな形？"}
              </p>
              <p className="figma-note">まちがえても大丈夫♪</p>
              {!profile && (
                <p className="quiet-note">
                  ヤギ・ヒツジのうち、ヤギの課題です。ヒツジ個別のお手本は確認中です。
                </p>
              )}
              {profile && (
                <p className="quiet-note">
                  提案課題・自動判定は未検証。実物を見て自己確認します。
                </p>
              )}
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
                template={profile ? "blank" : "eye"}
                backdrop={
                  profile ? (
                    <svg
                      className="eye-template"
                      viewBox="0 0 600 400"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d={profile.background}
                        fill="none"
                        stroke="#b8a58c"
                        strokeWidth="4"
                      />
                    </svg>
                  ) : undefined
                }
                strokes={strokes}
                onChange={(s) => {
                  setStrokes(s);
                  setFeedback(undefined);
                }}
              />
              <button className="text-button" onClick={() => setHint(!hint)}>
                ✧ ヒント
              </button>
              {hint && <p role="note">{profile?.hint || challenge.hint[0]}</p>}
              {feedback && !feedback.passed && (
                <div role="status" className="figma-feedback">
                  <p>{feedback.message}</p>
                  <p>{feedback.suggestion}</p>
                  {new URLSearchParams(location.search).has("debug") && (
                    <details>
                      <summary>判定デバッグ</summary>
                      <pre>{JSON.stringify(feedback.debug, null, 2)}</pre>
                    </details>
                  )}
                  <button className="primary" onClick={() => next(2)}>
                    {feedback.status === "uncertain"
                      ? profile
                        ? "うん、実物でも見えた"
                        : "うん、横長に見えた"
                      : "お手本で確かめる"}
                  </button>
                </div>
              )}
              <p className="figma-support center">上手に描かなくても大丈夫。</p>
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
                className="figma-discovery"
                initial={reduce ? false : { scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 14 }}
              >
                {feedback?.passed ? "だいはっけん！" : "見えた形を確かめよう"}
              </motion.h1>
              {feedback?.passed && (
                <div className="figma-confetti" aria-hidden="true">
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
                  {profile
                    ? group.name + "の" + profile.part
                    : "ヤギの瞳は横長だった！"}
                </strong>
              </p>
              <p className="figma-note">
                {feedback?.passed
                  ? "よく見てたね！ ✳"
                  : "あなたの観察と見比べよう"}
              </p>
              <SketchComparison
                strokes={strokes}
                answer={group.answer}
                profile={profile}
              />
              <p className="figma-support center">
                少し違っていても、横長に気づけたね。
              </p>
              <button className="primary" onClick={() => next(3)}>
                {profile ? "特徴について知ろう →" : "どうして横長なの？ →"}
              </button>
            </>
          ) : (
            <>
              <h1>
                {profile ? profile.part + "の手がかり" : "どうして横長なの？"}
              </h1>
              <p className="figma-support">
                見つけた形には、ちゃんと理由がある。
              </p>
              <motion.div
                className="figma-science"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {profile ? (
                  <svg viewBox="0 0 600 400" className="eye-template">
                    <path
                      d={profile.background}
                      fill="none"
                      stroke="#b8a58c"
                      strokeWidth="4"
                    />
                    <path
                      d={profile.answer}
                      fill="none"
                      stroke="#4c9b92"
                      strokeWidth="9"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 355 225"
                    className="figma-learn-eye"
                    aria-label="ヤギの瞳孔の模式図"
                    role="img"
                  >
                    <image
                      href={
                        import.meta.env.BASE_URL + "figma/2-74-imgEyeOuter.svg"
                      }
                      x="51"
                      y="28"
                      width="250.32"
                      height="173.04"
                    />
                    <image
                      href={
                        import.meta.env.BASE_URL + "figma/2-74-imgEyeIris.svg"
                      }
                      x="118.59"
                      y="51.36"
                      width="115.147"
                      height="126.319"
                    />
                    <rect
                      x="141.12"
                      y="104.14"
                      width="72.59"
                      height="22.495"
                      rx="10"
                      fill="#242e2b"
                    />
                  </svg>
                )}
                <strong>{profile?.part || "ヤギの瞳孔"}</strong>
              </motion.div>
              <div className="figma-explanation">
                <h2>
                  {profile ? "分かっていること" : "まわりを広く見るため！"}
                </h2>
                <p>{profile ? group.fact : challenge.explanation.role}</p>
                <p>
                  {profile
                    ? "部位の働きは確認中の内容を含みます。模式図は提案課題で、元カードの再現ではありません。"
                    : challenge.explanation.ecology}
                </p>
              </div>
              <p className="figma-note">
                {profile?.next || challenge.explanation.question}
              </p>
              <button className="primary" onClick={() => next(1)}>
                もう一度、本物を見てみよう ↗
              </button>
              <button className="text-button" onClick={restart}>
                次の動物を撮る
              </button>
              <details>
                <summary>解説の出典・判定の状態</summary>
                {profile && (
                  <>
                    <p>
                      この課題の自動正誤判定は未検証です。自己確認で進みます。
                    </p>
                    {group.source && (
                      <a href={group.source}>京都市動物園の公式図鑑</a>
                    )}
                  </>
                )}
                <p>{challenge.explanation.certainty}</p>
                {challenge.scientificSource.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ))}
              </details>
            </>
          )}
        </motion.section>
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
