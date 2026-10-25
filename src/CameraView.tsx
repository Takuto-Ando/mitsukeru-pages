import { challengeProvider } from "./domain";
import { recordStudy } from "./research/study";
import { groups } from "./content/groups";
import type { Candidate } from "./recognition/labels";
import { AnimalSelector } from "./components/AnimalSelector";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { speciesRecognizer } from "./recognition/species";
import { motion, useReducedMotion } from "motion/react";
export function CameraView({
  onSelect,
}: {
  onSelect: (
    photo?: string,
    id?: string,
    method?: "manual" | "automatic",
  ) => void;
}) {
  const [captured, setCaptured] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelReady, setModelReady] = useState(speciesRecognizer.isReady());
  const [recognizing, setRecognizing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0);
  const [status, setStatus] = useState<"waiting" | "live" | "failed">(
      "waiting",
    ),
    [message, setMessage] = useState("");
  useEffect(
    () => () => {
      generation.current++;
      speciesRecognizer.release();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function start() {
    const request = ++generation.current;
    setStatus("waiting");
    setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (request !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      if (request === generation.current) setStatus("live");
    } catch {
      if (request !== generation.current) return;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setStatus("failed");
      setMessage(
        "カメラを使えなくても大丈夫。下から動物を選んで、同じ体験を始められます。",
      );
    }
  }
  useEffect(() => {
    void start();
  }, []);
  async function capture() {
    if (busy || !video.current?.videoWidth || status !== "live") return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        1200 / Math.max(video.current.videoWidth, video.current.videoHeight),
      );
      canvas.width = Math.round(video.current.videoWidth * scale);
      canvas.height = Math.round(video.current.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.8);
      setCaptured(image);
      recordStudy(
        "animal_photographed",
        {},
        { animalId: undefined, taskId: undefined, attemptId: undefined },
      );
      setCandidates([]);
      await recognize(image);
    } catch {
      setMessage("撮影できませんでした。カメラをもう一度試してください。");
    } finally {
      setBusy(false);
    }
  }
  async function recognize(image = captured) {
    const request = generation.current;
    setRecognizing(true);
    setCandidates([]);
    setMessage("初回モデルを読込中です。手動選択もできます。");
    try {
      const result = await speciesRecognizer.recognize(image, (text) => {
        if (request === generation.current) setMessage(text);
      });
      if (request !== generation.current) return;
      if (result.status === "candidates") {
        setModelReady(true);
        const [first, second] = result.candidates;
        if (
          first &&
          first.score >= 0.55 &&
          first.score - (second?.score ?? 0) >= 0.12 &&
          challengeProvider.forSpecies(first.speciesId || first.groupId)
            .length > 0
        ) {
          onSelect(image, first.speciesId || first.groupId, "automatic");
          return;
        }
        setCandidates(result.candidates);
        setMessage("AIの候補です。実物と写真を見て確定してください。");
      } else if (result.status !== "ready") setMessage(result.reason);
    } finally {
      if (request === generation.current) {
        setRecognizing(false);
        setModelReady(speciesRecognizer.isReady());
      }
    }
  }
  async function prepare() {
    const request = generation.current;
    setRecognizing(true);
    setMessage("モデルを準備しています…");
    const result = await speciesRecognizer.prepare((text) => {
      if (request === generation.current) setMessage(text);
    });
    if (request !== generation.current) return;
    setModelReady(result.status === "ready");
    setMessage(
      result.status === "ready"
        ? "準備できました。撮影するとAIが推定します。違うときは選び直せます。"
        : result.status === "unavailable" || result.status === "unknown"
          ? result.reason
          : "準備を確認してください。",
    );
    setRecognizing(false);
  }
  return (
    <div className="camera-page">
      <div className="screen-title">
        <h1>どの動物を見ている？</h1>
        <p>動物を撮るか、下から選んでね。</p>
      </div>
      <div className="camera-frame">
        <video
          ref={video}
          playsInline
          autoPlay
          muted
          aria-label="動物を映すカメラ"
          className={status === "live" ? "" : "hidden-video"}
        />
        {status !== "live" && (
          <div className="camera-fallback">
            {status === "failed" ? (
              <CameraOff size={38} />
            ) : (
              <Camera size={38} />
            )}
            <strong>
              {status === "failed"
                ? "手動で始められるよ"
                : "カメラを準備しています"}
            </strong>
            <span>動物から少し離れて、そっと観察しよう。</span>
          </div>
        )}
        {status === "live" && (
          <ScanLine className="viewfinder" aria-hidden="true" />
        )}
        <span className="camera-tag">
          {status === "live" ? "カメラで観察中" : "かんさつカメラ"}
        </span>
      </div>
      {message && (
        <p className="camera-message" role="status">
          {message}
          {status === "failed" && (
            <button
              className="text-button"
              disabled={recognizing}
              onClick={() => void start()}
            >
              カメラをもう一度試す
            </button>
          )}
        </p>
      )}
      {captured && (
        <motion.img
          key={captured}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="selected-photo"
          src={captured}
          alt="撮影した動物の写真"
        />
      )}
      <button
        className="shutter-button"
        disabled={status !== "live" || busy || recognizing}
        onClick={() => void capture()}
      >
        {busy ? "写真を確認中…" : captured ? "もう一度撮る" : "シャッター"}
      </button>
      <details className="recognition-settings">
        <summary>撮影の設定</summary>
        <button
          className="text-button"
          disabled={recognizing || modelReady}
          onClick={() => void prepare()}
        >
          {modelReady ? "識別モデル準備済み" : "識別モデルを先にダウンロード"}
        </button>
        <p className="quiet-note">
          初回は約150MB以上。Wi-Fiで先に準備できます。撮影後、候補が絞れたら描画へ進みます。
        </p>
        {recognizing && !captured && (
          <button
            className="text-button"
            onClick={() => {
              speciesRecognizer.cancel();
              setModelReady(false);
            }}
          >
            準備をやめる
          </button>
        )}
        {captured && (
          <>
            <button
              className="text-button"
              disabled={recognizing}
              onClick={() => void recognize()}
            >
              {recognizing ? "候補を探しています…" : "AIで候補を探す"}
            </button>
            {recognizing && (
              <button
                className="text-button"
                onClick={() => speciesRecognizer.cancel()}
              >
                検索をやめる
              </button>
            )}
          </>
        )}
      </details>
      {candidates.length > 0 && (
        <section aria-label="AIの候補">
          <h2>この動物かな？</h2>
          {candidates.map((c) => (
            <button
              className="animal-choice"
              key={c.groupId}
              disabled={
                !challengeProvider.forSpecies(c.speciesId || c.groupId).length
              }
              onClick={() => onSelect(captured, c.speciesId || c.groupId)}
            >
              {c.speciesId === "sheep"
                ? "ヒツジ"
                : groups.find((g) => g.id === c.groupId)?.name ||
                  "ヤブイヌ（描画課題は未対応）"}{" "}
              {challengeProvider.forSpecies(c.speciesId || c.groupId).length > 0
                ? "を観察する"
                : ""}
            </button>
          ))}
          <p>違うときは、下から選んでね。</p>
        </section>
      )}
      {captured && <p role="status">撮影した写真を見て、動物を選んでね。</p>}
      <AnimalSelector onSelect={(id) => onSelect(captured, id)} />
      <p className="quiet-note">
        写真は端末内で処理します。描くときは実物を見てね。
      </p>
    </div>
  );
}
