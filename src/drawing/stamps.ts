// スタンプ（ドパガキ版）：タップで置ける形。Path2D を -50..50 の箱で定義し、
// 指定サイズに拡縮して塗る。アンカーのマイクロストロークに style.stamp で紐づく。
export const STAMPS: { id: string; label: string }[] = [
  { id: "star", label: "ほし" },
  { id: "heart", label: "ハート" },
  { id: "leaf", label: "はっぱ" },
  { id: "paw", label: "あしあと" },
  { id: "flower", label: "おはな" },
  { id: "sakura", label: "さくら（春）", },
  { id: "sun", label: "たいよう（夏）" },
  { id: "momiji", label: "もみじ（秋）" },
  { id: "snow", label: "ゆき（冬）" },
];

const PATHS: Record<string, string> = {
  star: "M0,-48 L14,-15 L49,-15 L21,6 L31,42 L0,20 L-31,42 L-21,6 L-49,-15 L-14,-15 Z",
  heart:
    "M0,38 C-46,10 -50,-12 -38,-28 C-28,-42 -8,-40 0,-24 C8,-40 28,-42 38,-28 C50,-12 46,10 0,38 Z",
  leaf: "M-40,40 C-42,-8 -12,-38 42,-42 C40,10 12,38 -40,40 Z M-34,34 C-16,12 4,-6 28,-26",
  flower:
    "M0,-14 C-16,-44 16,-44 0,-14 C30,-30 44,2 14,4 C36,22 14,46 0,16 C-14,46 -36,22 -14,4 C-44,2 -30,-30 0,-14 Z",
  sakura:
    "M0,-46 C8,-30 30,-30 34,-14 C46,-20 48,-2 36,4 C46,14 34,28 24,20 C22,34 6,44 0,32 C-6,44 -22,34 -24,20 C-34,28 -46,14 -36,4 C-48,-2 -46,-20 -34,-14 C-30,-30 -8,-30 0,-46 Z",
  sun: "M0,-20 A20,20 0 1,1 0,20 A20,20 0 1,1 0,-20 M0,-48 L6,-28 L-6,-28 Z M34,-34 L20,-20 L14,-28 Z M48,0 L28,6 L28,-6 Z M34,34 L20,20 L28,14 Z M0,48 L-6,28 L6,28 Z M-34,34 L-20,20 L-28,14 Z M-48,0 L-28,-6 L-28,6 Z M-34,-34 L-20,-20 L-14,-28 Z",
  momiji:
    "M0,-48 L8,-24 L30,-38 L24,-14 L46,-16 L28,0 L44,12 L20,12 L26,34 L8,18 L0,40 L-8,18 L-26,34 L-20,12 L-44,12 L-28,0 L-46,-16 L-24,-14 L-30,-38 L-8,-24 Z",
  snow: "M0,-48 L0,48 M-42,-24 L42,24 M42,-24 L-42,24 M0,-48 L-10,-36 M0,-48 L10,-36 M0,48 L-10,36 M0,48 L10,36 M-42,-24 L-24,-26 M-42,-24 L-40,-8 M42,24 L24,26 M42,24 L40,8 M42,-24 L24,-26 M42,-24 L40,-8 M-42,24 L-24,26 M-42,24 L-40,8",
};

export function drawStamp(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  if (id === "paw") {
    // 肉球：大きな楕円＋4つの小円
    ctx.beginPath();
    ctx.ellipse(0, 12, size * 0.3, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    const toes: [number, number][] = [
      [-0.34, -0.12],
      [-0.12, -0.26],
      [0.12, -0.26],
      [0.34, -0.12],
    ];
    for (const [tx, ty] of toes) {
      ctx.beginPath();
      ctx.ellipse(tx * size, ty * size, size * 0.11, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const path = PATHS[id];
    if (path) {
      const scale = size / 100;
      ctx.scale(scale, scale);
      ctx.fill(new Path2D(path));
    }
  }
  ctx.restore();
}
