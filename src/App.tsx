import { DrawingCollection } from "./components/DrawingCollection";
import {
  readCollection,
  writeCollection,
  emptyCollection,
  type CollectionData,
} from "./collection/storage";
import { artwork, assetPath } from "./content/artwork";
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
import { scenes, clipStrokes } from "./content/scenes";
import { useButtonMotion } from "./components/useButtonMotion";
export default function App() {
  useButtonMotion();
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collection, setCollection] = useState<CollectionData>(emptyCollection);
  const [storageError, setStorageError] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [savedId, setSavedId] = useState<string>();
  useEffect(() => {
    try {
      setCollection(readCollection(localStorage));
      setStorageReady(true);
    } catch {
      setStorageError(
        "保存データを読み込めませんでした。既存のデータを守るため、保存を停止しています。",
      );
    }
  }, []);
  function commitCollection(data: CollectionData) {
    if (!storageReady) return false;
    try {
      writeCollection(localStorage, data);
      setCollection(data);
      setStorageError("");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error && error.message.includes("保存")
          ? error.message
          : "保存できませんでした。空き容量やブラウザの保存設定を確認してください。",
      );
      return false;
    }
  }
  function latestCollection() {
    try {
      return readCollection(localStorage);
    } catch {
      setStorageError(
        "保存データを読み込めませんでした。上書きせずに停止しました。",
      );
      return undefined;
    }
  }
  function saveDrawing() {
    const latest = latestCollection();
    if (!latest) return;
    if (savedId || !strokes.length) return;
    const id =
      Date.now().toString(36) +
      "-" +
      crypto.getRandomValues(new Uint32Array(3)).join("-");
    // Store visible vector lines only, never the camera photo or model output.
    const visible = clipStrokes(strokes, scene).map((s) =>
      s.map((p) => ({
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
      })),
    );
    if (!visible.length) return;
    if (
      commitCollection({
        version: 1,
        drawings: [
          {
            id,
            groupId,
            createdAt: new Date().toISOString(),
            strokes: visible,
            outcome: feedback?.passed ? "correct" : "self-confirmed",
          },
          ...latest.drawings,
        ],
      })
    )
      setSavedId(id);
  }
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
  const scene = scenes[groupId];
  const art = artwork[groupId];
  function restart() {
    setCollectionOpen(false);
    setSavedId(undefined);
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
      ? evaluateProfile(clipStrokes(strokes, scene), profile, scene)
      : evaluateObservation(
          clipStrokes(strokes, scene),
          challenge.observationParameters,
        );
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
        <button
          className="collection-link"
          onClick={() => {
            setCollectionOpen(!collectionOpen);
            window.scrollTo(0, 0);
          }}
          aria-expanded={collectionOpen}
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
              const latest = latestCollection();
              if (!latest) return false;
              const ok = commitCollection({
                version: 1,
                drawings: latest.drawings.filter((d) => d.id !== id),
              });
              if (ok && savedId === id) setSavedId(undefined);
              return ok;
            }}
          />
        ) : (
          <>
            <div className="figma-flow">
              {
                ["01 / OBSERVE", "02 / DRAW", "03 / DISCOVER", "04 / LEARN"][
                  step
                ]
              }
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
                    setSavedId(undefined);
                    setPhoto(image || "");
                    setGroupId(id || "goat");
                    next(1);
                  }}
                />
              ) : step === 1 ? (
                <>
                  <h1>
                    {profile
                      ? profile.part + "を描こう"
                      : "目の中を描いてみよう。"}
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
                      提案課題です。特徴で判定し、迷ったときは自分で確かめます。
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
                  <p className="artwork-status" role="note">
                    {art.status === "reviewed"
                      ? "観察イラスト"
                      : "専用イラストは制作待ちです。現在は配置確認用の提案図を表示しています。"}
                  </p>
                  <SketchCanvas
                    scene={scene}
                    strokes={strokes}
                    onChange={(s) => {
                      setSavedId(undefined);
                      setStrokes(s);
                      setFeedback(undefined);
                    }}
                  />
                  <button
                    className="text-button"
                    onClick={() => setHint(!hint)}
                  >
                    ✧ ヒント
                  </button>
                  {hint && (
                    <p role="note">{profile?.hint || challenge.hint[0]}</p>
                  )}
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
                  <p className="figma-support center">
                    上手に描かなくても大丈夫。
                  </p>
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
                    {feedback?.passed
                      ? art.status === "reviewed"
                        ? "完成！ だいはっけん！"
                        : "特徴を見つけたね！"
                      : "見えた形を確かめよう"}
                  </motion.h1>
                  {feedback?.passed && (
                    <div className="figma-confetti" aria-hidden="true">
                      {!reduce &&
                        [0, 1, 2, 3, 4, 5].map((i) => (
                          <motion.span
                            className="discovery-star"
                            key={i}
                            initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                            animate={{
                              opacity: [0, 1, 0],
                              scale: [0.3, 1.2, 0.8],
                              rotate: (i % 2 ? 1 : -1) * 75,
                              x: (i - 2.5) * 38,
                              y: -20 - Math.sin(i) * 35,
                            }}
                            transition={{ duration: 1.1, delay: i * 0.05 }}
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
                    scene={scene}
                  />
                  <p className="figma-support center">
                    {profile
                      ? "少し違っていても、見つけた特徴が大切だよ。"
                      : "少し違っていても、横長に気づけたね。"}
                  </p>
                  <button
                    className="primary collection-save"
                    disabled={!!savedId || !storageReady || !strokes.length}
                    onClick={saveDrawing}
                  >
                    {savedId ? "保存したよ！" : "この動物を保存する"}
                  </button>
                  <p className="quiet-note" role="status">
                    {savedId
                      ? "「描いた動物」から、いつでも見返せるよ。"
                      : "自分の絵をこの端末に残せます。撮影写真は保存しません。"}
                  </p>
                  <button className="primary" onClick={() => next(3)}>
                    {profile ? "特徴について知ろう →" : "どうして横長なの？ →"}
                  </button>
                </>
              ) : (
                <>
                  <h1>
                    {profile
                      ? profile.part + "の手がかり"
                      : "どうして横長なの？"}
                  </h1>
                  <p className="figma-support">
                    見つけた形には、ちゃんと理由がある。
                  </p>
                  <motion.div
                    className="figma-science"
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {art.explanation ? (
                      <img
                        className="explanation-asset"
                        src={assetPath(art.explanation)}
                        alt={art.alt}
                      />
                    ) : profile ? (
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
                            import.meta.env.BASE_URL +
                            "figma/2-74-imgEyeOuter.svg"
                          }
                          x="51"
                          y="28"
                          width="250.32"
                          height="173.04"
                        />
                        <image
                          href={
                            import.meta.env.BASE_URL +
                            "figma/2-74-imgEyeIris.svg"
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
                          この課題は描いた特徴の広がり・向き・曲がりなどで判定します。曖昧な場合は自分で確かめられます。
                        </p>
                        {group.source && (
                          <a href={group.source}>京都市動物園の公式図鑑</a>
                        )}
                      </>
                    )}
                    {!profile && <p>{challenge.explanation.certainty}</p>}
                    {!profile &&
                      challenge.scientificSource.map((s) => (
                        <a
                          key={s.url}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.title}
                        </a>
                      ))}
                  </details>
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
