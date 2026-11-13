/** Explicitly called only. Does not access a camera, save, upload or retain photos. */
export interface PhotoCardInput {
  photo: Blob;
  sketch: Blob;
  animalName: string;
  featureName: string;
  discovery?: string;
}
export const photoCardLimits = {
  inputBytes: 12 * 1024 * 1024,
  decodedPixels: 24_000_000,
  width: 1000,
};
export function validatePhotoCard(input: PhotoCardInput) {
  for (const blob of [input.photo, input.sketch]) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(blob.type) ||
      !blob.size ||
      blob.size > photoCardLimits.inputBytes
    )
      throw new Error("12MB以下のJPEG・PNG・WebP画像を使ってください。");
  }
  for (const label of [input.animalName, input.featureName])
    if (!label.trim() || label.length > 100)
      throw new Error("動物名と特徴の名前を確認してください。");
  if ((input.discovery?.length || 0) > 200)
    throw new Error("気づきは200文字以内で入力してください。");
}
async function decode(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("画像を読み込めませんでした。"));
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > photoCardLimits.decodedPixels
    )
      throw new Error("画像が大きすぎます。小さい画像で試してください。");
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
/** Photo above full sketch: keeps the drawing intact and never crops either image. */
export async function composePhotoCard(input: PhotoCardInput): Promise<Blob> {
  validatePhotoCard(input);
  // Sequential decoding reduces peak work on phones. Re-encoding strips source metadata.
  const photo = await decode(input.photo);
  const sketch = await decode(input.sketch);
  const canvas = document.createElement("canvas");
  canvas.width = photoCardLimits.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("カードを作れませんでした。");
  await document.fonts?.ready;
  const font = '28px "Zen Maru Gothic", sans-serif';
  ctx.font = font;
  const lines: string[] = [];
  let line = "";
  for (const char of input.discovery?.trim().replace(/\s+/g, " ") || "") {
    if (char === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    if (ctx.measureText(line + char).width > 872 && line) {
      lines.push(line);
      line = "";
    }
    line += char;
  }
  if (line) lines.push(line);
  canvas.height = 1370 + (lines.length ? 56 + lines.length * 40 : 0);
  ctx.fillStyle = "#faf7ec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#277e78";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 960, canvas.height - 40);
  ctx.fillStyle = "#277e78";
  ctx.font = 'bold 40px "Zen Maru Gothic", sans-serif';
  ctx.fillText(input.animalName, 64, 90, 872);
  ctx.fillStyle = "#514638";
  ctx.font = font;
  ctx.fillText(input.featureName, 64, 136, 872);
  function contain(image: HTMLImageElement, y: number, height: number) {
    const scale = Math.min(
      872 / image.naturalWidth,
      height / image.naturalHeight,
    );
    const w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    ctx!.drawImage(image, 64 + (872 - w) / 2, y + (height - h) / 2, w, h);
  }
  ctx.fillText("撮った動物", 64, 188);
  contain(photo, 210, 440);
  ctx.fillText("自分が描いた特徴", 64, 700);
  contain(sketch, 720, 560);
  if (lines.length) {
    ctx.fillText("わたしの気づき", 64, 1330);
    lines.forEach((value, i) => ctx.fillText(value, 64, 1370 + i * 40));
  }
  ctx.fillStyle = "#277e78";
  ctx.font = '24px "Zen Maru Gothic", sans-serif';
  ctx.fillText("ズーケッチ", 64, canvas.height - 32);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("カード画像を作れませんでした。")),
      "image/png",
    ),
  );
}
