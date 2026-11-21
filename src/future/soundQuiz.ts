// 音のイメージクイズ：動物ごとの「音のモチーフ」を WebAudio で合成して鳴らす。
// 本物の鳴き声ではなく、特徴を音の高さ・リズムで表したイメージ音。
let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

type Note = { freq: number; at: number; dur: number; type?: OscillatorType };

const MOTIFS: Record<string, Note[]> = {
  // ゾウ：低く長いひと鳴き
  elephant: [{ freq: 130, at: 0, dur: 0.9, type: "sawtooth" }],
  // ヤギ：短く2回の震える鳴き声
  goat: [
    { freq: 620, at: 0, dur: 0.22 },
    { freq: 580, at: 0.32, dur: 0.28 },
  ],
  // シマウマ：高めから下がるいななき風
  zebra: [
    { freq: 880, at: 0, dur: 0.16 },
    { freq: 720, at: 0.18, dur: 0.16 },
    { freq: 540, at: 0.36, dur: 0.3 },
  ],
  // カバ：低い泡のような音
  hippo: [
    { freq: 90, at: 0, dur: 0.25, type: "sine" },
    { freq: 80, at: 0.3, dur: 0.35, type: "sine" },
  ],
  // キリン：静かな低いハミング
  giraffe: [{ freq: 196, at: 0, dur: 0.8, type: "sine" }],
  // サル：速い繰り返し
  capuchin: [
    { freq: 1200, at: 0, dur: 0.09 },
    { freq: 1200, at: 0.14, dur: 0.09 },
    { freq: 1350, at: 0.28, dur: 0.09 },
    { freq: 1200, at: 0.42, dur: 0.12 },
  ],
  macaque: [
    { freq: 980, at: 0, dur: 0.1 },
    { freq: 1050, at: 0.16, dur: 0.1 },
    { freq: 980, at: 0.32, dur: 0.14 },
  ],
  // フェネック：高い小さな鳴き声
  fennec: [
    { freq: 1500, at: 0, dur: 0.1 },
    { freq: 1650, at: 0.18, dur: 0.14 },
  ],
  // ゴリラ：胸を叩く低い連打
  gorilla: [
    { freq: 70, at: 0, dur: 0.12, type: "square" },
    { freq: 70, at: 0.18, dur: 0.12, type: "square" },
    { freq: 70, at: 0.36, dur: 0.12, type: "square" },
    { freq: 70, at: 0.54, dur: 0.2, type: "square" },
  ],
  // ミーアキャット：見張りの短い警戒音
  meerkat: [
    { freq: 1100, at: 0, dur: 0.08 },
    { freq: 1100, at: 0.3, dur: 0.08 },
    { freq: 1100, at: 0.6, dur: 0.08 },
  ],
};

export const SOUND_QUIZ_IDS = Object.keys(MOTIFS);

export function playMotif(groupId: string) {
  const notes = MOTIFS[groupId];
  if (!notes) return;
  const ac = audio();
  if (ac.state === "suspended") void ac.resume();
  const start = ac.currentTime + 0.05;
  for (const note of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = note.type ?? "triangle";
    osc.frequency.value = note.freq;
    const t = start + note.at;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + note.dur + 0.05);
  }
}
