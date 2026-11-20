import { useEffect, useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import { Pitsune } from "../components/Pitsune";
import { dopaFanfare, dopaJackpotSound } from "./sounds";

const colors = [
  "#ff579f",
  "#8dfdff",
  "#feed49",
  "#af84ff",
  "#5affa4",
  "#ff9635",
];
let stopConfetti: (() => void) | undefined;

export function fireConfetti(count: number) {
  const shell = document.querySelector(".dopa-on");
  if (!shell || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;

  stopConfetti?.();
  const canvas = document.createElement("canvas");
  canvas.className = "dopa-confetti-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.scale(ratio, ratio);
  shell.append(canvas);

  const pieces = Array.from({ length: Math.min(160, count) }, (_, i) => ({
    direction: i % 2 ? 1 : -1,
    size: 4 + Math.random() * 8,
    vx: width * (0.22 + Math.random() * 0.51),
    vy: height * (0.46 + Math.random() * 0.73),
    spin: (Math.random() - 0.5) * 13,
    shade: colors[i % colors.length],
    delay: Math.random() * 0.32,
  }));
  const start = performance.now();
  const gravity = height * 0.87;
  let frame = requestAnimationFrame(paint);
  function stop() {
    cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.remove();
    stopConfetti = undefined;
  }
  function onVisibility() {
    if (document.hidden) stop();
  }
  stopConfetti = stop;
  document.addEventListener("visibilitychange", onVisibility);
  function paint(now: number) {
    if (!context) return;
    const elapsed = (now - start) / 1000;
    if (elapsed >= 2.05 || !canvas.isConnected) {
      stop();
      return;
    }
    context.clearRect(0, 0, width, height);
    context.globalAlpha = Math.min(1, (2.05 - elapsed) * 2.5);
    for (const piece of pieces) {
      const time = elapsed - piece.delay;
      if (time < 0) continue;
      const x =
        (piece.direction > 0 ? width * 0.06 : width * 0.94) +
        piece.direction * piece.vx * time * (1 - time * 0.2);
      const y = height * 0.77 - piece.vy * time + gravity * time * time * 0.5;
      context.save();
      context.translate(x, y);
      context.rotate(piece.spin * time);
      context.fillStyle = piece.shade;
      context.fillRect(
        -piece.size / 2,
        -piece.size,
        piece.size,
        piece.size * 1.7,
      );
      context.restore();
    }
    frame = requestAnimationFrame(paint);
  }
}

export type DopaCelebration = {
  kind: "jackpot" | "levelup";
  title: string;
  sub: string;
  xp: number;
};

export function celebrateDopa(celebration: DopaCelebration) {
  if (celebration.kind === "jackpot") {
    dopaJackpotSound();
    fireConfetti(156);
  } else {
    dopaFanfare();
    fireConfetti(112);
  }
  window.dispatchEvent(
    new CustomEvent<DopaCelebration>("dopa:celebrate", { detail: celebration }),
  );
}

export function DopaOverlay() {
  const [event, setEvent] = useState<{ id: number; reward: DopaCelebration }>();
  useEffect(() => {
    let id = 0;
    let timer: number | undefined;
    const celebrate = (event: Event) => {
      setEvent({
        id: ++id,
        reward: (event as CustomEvent<DopaCelebration>).detail,
      });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setEvent(undefined), 2500);
    };
    window.addEventListener("dopa:celebrate", celebrate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("dopa:celebrate", celebrate);
      stopConfetti?.();
    };
  }, []);
  if (!event) return null;
  const { kind, title, sub, xp } = event.reward;
  return (
    <div key={event.id} className="dopa-overlay" data-kind={kind} role="status">
      <div className="dopa-overlay-rays" aria-hidden="true" />
      <div className="dopa-overlay-card">
        <div className="dopa-overlay-lamps" aria-hidden="true" />
        <div className="dopa-overlay-stage">
          <Sparkles
            className="dopa-overlay-star"
            size={43}
            aria-hidden="true"
          />
          <Pitsune pose="cheer" className="dopa-overlay-pitsune" />
          <Zap
            className="dopa-overlay-star dopa-overlay-star-right"
            size={46}
            aria-hidden="true"
          />
        </div>
        <p className="dopa-overlay-title">{title}</p>
        <p className="dopa-overlay-sub">{sub}</p>
        <strong className="dopa-overlay-xp">+{xp} XP</strong>
      </div>
    </div>
  );
}
