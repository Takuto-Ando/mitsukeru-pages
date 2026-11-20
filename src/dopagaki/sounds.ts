// ドパガキモードの効果音。WebAudio でその場で合成する（音声ファイル不要）。
import { loadDopaSound } from "./dopa";

let context: AudioContext | undefined;

function ctx(): AudioContext | undefined {
  if (!loadDopaSound()) return undefined;
  try {
    const Audio =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return undefined;
    context ??= new Audio();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    return context.state === "running" ? context : undefined;
  } catch {
    return undefined;
  }
}

function tone(
  audio: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "triangle",
  volume = 0.12,
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** 小さな成功音「ピコーン」 */
export function dopaDing() {
  const audio = ctx();
  if (!audio) return;
  const t = audio.currentTime;
  tone(audio, 1318.5, t, 0.12);
  tone(audio, 1760, t + 0.09, 0.18);
}

/** コンボ節目の音。コンボ数で少しずつ音程が上がる */
export function dopaComboSound(combo: number) {
  const audio = ctx();
  if (!audio) return;
  const t = audio.currentTime;
  const base = 660 * Math.pow(1.059, Math.min(combo, 24));
  tone(audio, base, t, 0.1, "square", 0.06);
  tone(audio, base * 1.5, t + 0.07, 0.14, "square", 0.06);
}

/** レベルアップのファンファーレ */
export function dopaFanfare() {
  const audio = ctx();
  if (!audio) return;
  const t = audio.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
    tone(audio, freq, t + i * 0.11, 0.22, "triangle", 0.13),
  );
  tone(audio, 1318.5, t + 0.46, 0.34, "triangle", 0.13);
}

/** 大当たりのパチンコ風アルペジオ */
export function dopaJackpotSound() {
  const audio = ctx();
  if (!audio) return;
  const t = audio.currentTime;
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
  notes.forEach((freq, i) => tone(audio, freq, t + i * 0.07, 0.16, "square", 0.055));
  [1046.5, 1318.5, 1568].forEach((freq, i) =>
    tone(audio, freq, t + 0.6 + i * 0.13, 0.3, "triangle", 0.12),
  );
}
