import { artwork, assetPath } from "../content/artwork";
import { drawingRegions, type Scene } from "../content/scenes";
import type { Stroke } from "../types";

async function embedded(path: string, height: number) {
  const response = await fetch(assetPath(path));
  if (!response.ok) throw new Error("観察イラストを読み込めませんでした。");
  let text = await response.text();
  if (!/<svg[^>]*\bwidth=/.test(text)) {
    text = text.replace("<svg ", `<svg width="600" height="${height}" `);
  }
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を作れませんでした。"));
    image.src = source;
  });
}

function png(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNGを作れませんでした。")),
      "image/png",
    ),
  );
}

export async function composeObservationImages(
  scene: Scene,
  strokes: Stroke[],
) {
  const height = scene.frameHeight || 400,
    art = scene.artworkOverride || artwork[scene.id];
  const [baseUrl, answerUrl] = await Promise.all([
    embedded(art.incomplete!, height),
    embedded(art.reference || art.answer || art.explanation!, height),
  ]);
  const [baseImage, answerImage] = await Promise.all([
    loadImage(baseUrl),
    loadImage(answerUrl),
  ]);
  const regions = drawingRegions(scene);

  const ownCanvas = document.createElement("canvas");
  ownCanvas.width = 1200;
  ownCanvas.height = height * 2;
  const ownCtx = ownCanvas.getContext("2d");
  if (!ownCtx) throw new Error("画像を描けませんでした。");
  ownCtx.save();
  ownCtx.scale(2, 2);
  ownCtx.fillStyle = "#faf7ec";
  ownCtx.fillRect(0, 0, 600, height);
  ownCtx.drawImage(baseImage, 0, 0, 600, height);
  if (art.blankFill && art.blankFill !== "transparent") {
    ownCtx.fillStyle = art.blankFill;
    for (const r of regions) {
      ownCtx.fillRect(
        r.x * 600,
        r.y * height,
        r.width * 600,
        r.height * height,
      );
    }
  }
  ownCtx.save();
  ownCtx.beginPath();
  for (const r of regions) {
    ownCtx.rect(r.x * 600, r.y * height, r.width * 600, r.height * height);
  }
  ownCtx.clip();
  ownCtx.lineWidth = 7;
  ownCtx.lineCap = "round";
  ownCtx.lineJoin = "round";
  ownCtx.strokeStyle = "#277e78";
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    ownCtx.beginPath();
    ownCtx.moveTo(stroke[0].x, stroke[0].y);
    for (const point of stroke.slice(1)) {
      ownCtx.lineTo(point.x, point.y);
    }
    ownCtx.stroke();
  }
  ownCtx.restore();
  ownCtx.restore();
  const ownPng = await png(ownCanvas);

  const answerCanvas = document.createElement("canvas");
  answerCanvas.width = 1200;
  answerCanvas.height = height * 2;
  const ansCtx = answerCanvas.getContext("2d");
  if (!ansCtx) throw new Error("画像を描けませんでした。");
  ansCtx.save();
  ansCtx.scale(2, 2);
  ansCtx.fillStyle = "#faf7ec";
  ansCtx.fillRect(0, 0, 600, height);
  if (art.reference) {
    ansCtx.drawImage(answerImage, 0, 0, 600, height);
  } else {
    ansCtx.drawImage(baseImage, 0, 0, 600, height);
    ansCtx.save();
    ansCtx.beginPath();
    for (const r of regions) {
      ansCtx.rect(r.x * 600, r.y * height, r.width * 600, r.height * height);
    }
    ansCtx.clip();
    ansCtx.globalAlpha = 0.65;
    ansCtx.drawImage(answerImage, 0, 0, 600, height);
    ansCtx.restore();
  }
  ansCtx.restore();
  const answerPng = await png(answerCanvas);

  const pair = document.createElement("canvas");
  pair.width = 2400;
  pair.height = height * 2 + 100;
  const c = pair.getContext("2d");
  if (!c) throw new Error("比較画像を描けませんでした。");
  c.fillStyle = "#faf7ec";
  c.fillRect(0, 0, pair.width, pair.height);
  if (document.fonts) await document.fonts.ready;
  c.fillStyle = "#514638";
  c.font = '700 32px "Zen Maru Gothic", sans-serif';
  c.textAlign = "center";
  c.fillText("自分の絵", 600, 62);
  c.fillText("お手本", 1800, 62);
  c.drawImage(ownCanvas, 0, 100, 1200, height * 2);
  c.drawImage(answerCanvas, 1200, 100, 1200, height * 2);
  c.strokeStyle = "#d8d0bc";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(1200, 24);
  c.lineTo(1200, pair.height - 24);
  c.stroke();
  return { ownPng, answerPng, comparisonPng: await png(pair) };
}

export interface CardMetadata {
  animalName: string;
  taskName: string;
  createdAt: string;
  explanation: { form: string; ecology?: string };
}
// Frozen notebook PNGs stay unchanged. Cards wrap those images at export time.
export async function composeCardPng(
  image: Blob,
  meta: CardMetadata,
  comparison = false,
) {
  const url = URL.createObjectURL(image);
  try {
    const art = await loadImage(url);
    await document.fonts?.ready;
    const canvas = document.createElement("canvas");
    canvas.width = comparison ? 1800 : 1200;
    const scale = canvas.width / art.width;
    const artHeight = art.height * scale;
    const width = canvas.width,
      margin = 64,
      top = 236;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("カードを描けませんでした。");
    const text = meta.explanation.form;
    // Japanese wraps by grapheme, not by spaces. Measure with the actual local font.
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = '500 30px "Zen Maru Gothic", sans-serif';
    const lines: string[] = [];
    let line = "";
    for (const char of Array.from(text)) {
      if (measure.measureText(line + char).width > width - margin * 2 && line) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    if (line) lines.push(line);
    canvas.height = Math.ceil(top + artHeight + lines.length * 46 + 146);
    ctx.fillStyle = "#faf7ec";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.strokeStyle = "#277e78";
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, width - 36, canvas.height - 36);
    ctx.fillStyle = "#277e78";
    ctx.fillRect(18, 18, width - 36, 30);
    ctx.font = '700 48px "Zen Maru Gothic", sans-serif';
    ctx.fillText(meta.animalName, margin, 118);
    ctx.fillStyle = "#514638";
    ctx.font = '500 30px "Zen Maru Gothic", sans-serif';
    ctx.fillText(meta.taskName, margin, 170, width - margin * 2);
    const date = new Date(meta.createdAt).toLocaleDateString("ja-JP");
    ctx.font = '500 24px "Zen Maru Gothic", sans-serif';
    ctx.fillText("観察日 " + date, margin, 210);
    ctx.drawImage(art, 0, top, width, artHeight);
    ctx.fillStyle = "#e58c76";
    ctx.fillRect(margin, top + artHeight + 16, 56, 8);
    ctx.fillStyle = "#514638";
    ctx.font = '500 30px "Zen Maru Gothic", sans-serif';
    lines.forEach((value, i) =>
      ctx.fillText(value, margin, top + artHeight + 78 + i * 46),
    );
    ctx.font = '700 22px "Zen Maru Gothic", sans-serif';
    ctx.fillStyle = "#277e78";
    ctx.fillText("ズーケッチ", margin, canvas.height - 42);
    ctx.strokeStyle = "#277e78";
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, width - 36, canvas.height - 36);
    return await png(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const savePng = (blob: Blob, name: string) => saveFile(blob, name);

export async function saveFile(blob: Blob, name: string) {
  if (
    !(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    ) &&
    "download" in HTMLAnchorElement.prototype
  ) {
    downloadBlob(blob, name);
    return true;
  }
  const file = new File([blob], name, {
    type: blob.type || "application/octet-stream",
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "ズーケッチの観察" });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return false;
    }
  }
  downloadBlob(blob, name);
  return true;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
