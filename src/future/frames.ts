// どうぶつ変身フォトフレーム：カメラ映像の上に耳やツノを重ね、撮影画像にも合成する。
export type PhotoFrame = {
  id: string;
  label: string;
  color: string;
  dark: string;
};

export const PHOTO_FRAMES: PhotoFrame[] = [
  { id: "giraffe", label: "キリン", color: "#f2b544", dark: "#8a6642" },
  { id: "fennec", label: "フェネック", color: "#e8c39a", dark: "#b0563a" },
  { id: "bear", label: "ツキノワグマ", color: "#4a3f3a", dark: "#2c2522" },
  { id: "zebra", label: "シマウマ", color: "#e8e4da", dark: "#3a3238" },
];

export function frameById(id: string): PhotoFrame | undefined {
  return PHOTO_FRAMES.find((f) => f.id === id);
}

/** 撮影済みキャンバスへフレームを合成する（プレビューSVGと同じ見た目）。 */
export function drawPhotoFrame(
  ctx: CanvasRenderingContext2D,
  frameId: string,
  width: number,
  height: number,
) {
  const frame = frameById(frameId);
  if (!frame) return;
  const u = Math.min(width, height) / 100;
  ctx.save();
  ctx.fillStyle = frame.color;
  ctx.strokeStyle = frame.dark;
  ctx.lineWidth = 2.5 * u;
  const ear = (cx: number, cy: number, w: number, h: number, rot: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  if (frameId === "giraffe") {
    // ツノ（オシコーン）2本＋耳
    for (const side of [-1, 1]) {
      const x = width / 2 + side * 16 * u;
      ctx.beginPath();
      ctx.moveTo(x, 10 * u);
      ctx.lineTo(x, 2 * u);
      ctx.lineWidth = 4 * u;
      ctx.strokeStyle = frame.dark;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, 2.5 * u, 2.6 * u, 0, Math.PI * 2);
      ctx.fillStyle = frame.dark;
      ctx.fill();
      ctx.fillStyle = frame.color;
      ear(width / 2 + side * 30 * u, 9 * u, 13 * u, 7 * u, side * 0.5);
    }
  } else if (frameId === "fennec") {
    ear(width * 0.22, 10 * u, 17 * u, 26 * u, -0.25);
    ear(width * 0.78, 10 * u, 17 * u, 26 * u, 0.25);
  } else if (frameId === "bear") {
    ear(width * 0.24, 7 * u, 13 * u, 13 * u, 0);
    ear(width * 0.76, 7 * u, 13 * u, 13 * u, 0);
    // 胸の三日月
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.96, 7 * u, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 3.4 * u;
    ctx.strokeStyle = "#f5efe0";
    ctx.stroke();
  } else if (frameId === "zebra") {
    ear(width * 0.3, 7 * u, 8 * u, 13 * u, -0.2);
    ear(width * 0.7, 7 * u, 8 * u, 13 * u, 0.2);
    // たてがみ
    ctx.fillStyle = frame.dark;
    ctx.fillRect(width / 2 - 2.2 * u, 0, 4.4 * u, 11 * u);
  }
  ctx.restore();
}

/** ライブプレビュー用のSVGパス（drawPhotoFrame と同じ形）。 */
export function frameSvg(frameId: string): string {
  switch (frameId) {
    case "giraffe":
      return `<g fill="#f2b544" stroke="#8a6642" stroke-width="2"><ellipse cx="20" cy="9" rx="7" ry="4"/><ellipse cx="80" cy="9" rx="7" ry="4"/><path d="M34 12 V3 M66 12 V3" stroke-width="4"/><circle cx="34" cy="3" r="3" fill="#8a6642"/><circle cx="66" cy="3" r="3" fill="#8a6642"/></g>`;
    case "fennec":
      return `<g fill="#e8c39a" stroke="#b0563a" stroke-width="2"><ellipse cx="22" cy="12" rx="9" ry="14"/><ellipse cx="78" cy="12" rx="9" ry="14"/></g>`;
    case "bear":
      return `<g fill="#4a3f3a" stroke="#2c2522" stroke-width="2"><circle cx="24" cy="8" r="7"/><circle cx="76" cy="8" r="7"/></g><path d="M42 96 A9 9 0 0 1 58 96" fill="none" stroke="#f5efe0" stroke-width="3"/>`;
    case "zebra":
      return `<g fill="#e8e4da" stroke="#3a3238" stroke-width="2"><ellipse cx="30" cy="8" rx="4.5" ry="7"/><ellipse cx="70" cy="8" rx="4.5" ry="7"/></g><rect x="47.5" y="0" width="5" height="12" fill="#3a3238"/>`;
    default:
      return "";
  }
}
