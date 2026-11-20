import { useEffect, useState } from "react";
import { Pitsune } from "../components/Pitsune";
import { dopaFanfare, dopaJackpotSound } from "./sounds";

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 虹色の紙吹雪を画面いっぱいにまく（canvas を一時的に生成する） */
export function fireConfetti(count = 110) {
  if (reducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.className = "dopa-confetti-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const g = canvas.getContext("2d");
  if (!g) {
    canvas.remove();
    return;
  }
  const pieces = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.35,
    w: 6 + Math.random() * 7,
    h: 8 + Math.random() * 9,
    vy: 2.2 + Math.random() * 3.4,
    vx: -1.4 + Math.random() * 2.8,
    rot: Math.random() * Math.PI,
    vr: -0.16 + Math.random() * 0.32,
    hue: Math.floor(Math.random() * 360),
  }));
  const started = performance.now();
  const DURATION = 2100;
  function frame(now: number) {
    const elapsed = now - started;
    g!.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g!.save();
      g!.translate(p.x, p.y);
      g!.rotate(p.rot);
      g!.fillStyle = `hsl(${p.hue} 95% 60%)`;
      g!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g!.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

export interface DopaCelebration {
  kind: "jackpot" | "levelup";
  title: string;
  sub?: string;
}

/** 大当たり／レベルアップの全画面演出を出す（音＋紙吹雪つき） */
export function celebrateDopa(celebration: DopaCelebration) {
  if (celebration.kind === "jackpot") {
    dopaJackpotSound();
    fireConfetti(150);
  } else {
    dopaFanfare();
    fireConfetti(90);
  }
  window.dispatchEvent(
    new CustomEvent<DopaCelebration>("dopa:celebrate", { detail: celebration }),
  );
}

/** 演出オーバーレイ。App のルートに1つ置く */
export function DopaOverlay() {
  const [current, setCurrent] = useState<DopaCelebration | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      setCurrent((event as CustomEvent<DopaCelebration>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCurrent(null), 2500);
    };
    window.addEventListener("dopa:celebrate", handler);
    return () => {
      window.removeEventListener("dopa:celebrate", handler);
      window.clearTimeout(timer);
    };
  }, []);
  if (!current) return null;
  return (
    <div className="dopa-overlay" role="status" aria-live="polite">
      <div className="dopa-overlay-lamps" aria-hidden="true" />
      <div className="dopa-overlay-card">
        <Pitsune pose="cheer" className="dopa-overlay-pitsune" />
        <p className="dopa-overlay-title">{current.title}</p>
        {current.sub && <p className="dopa-overlay-sub">{current.sub}</p>}
      </div>
    </div>
  );
}
