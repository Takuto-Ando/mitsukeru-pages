import { getStrokeStyle } from "../drawing/styles";
import type { Stroke } from "../types";

// タイムラプス書き出し：保存済みストロークを「描いた順に線が現れる」
// アニメーション付き SVG として書き出す（SMIL、外部ツール不要）。
function pointsAttr(stroke: Stroke): string {
  return stroke.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function buildTimelapseSvg(
  strokes: Stroke[],
  height: number,
  title: string,
): string {
  const perStroke = 0.45; // 1筆あたりの秒数
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${height}" width="600" height="${height}">`,
  );
  parts.push(`<rect width="600" height="${height}" fill="#faf7ec"/>`);
  parts.push(
    `<text x="16" y="28" font-size="16" fill="#7a4a21" font-family="sans-serif">${title.replace(/[<>&]/g, "")}</text>`,
  );
  strokes.forEach((stroke, i) => {
    if (!stroke.length) return;
    const style = getStrokeStyle(stroke);
    const begin = (i * perStroke).toFixed(2);
    if (style?.fill) return; // 塗りマスクはアニメーション対象外
    if (style?.stamp && stroke.length <= 2) {
      parts.push(
        `<circle cx="${stroke[0].x}" cy="${stroke[0].y}" r="${Math.max(12, style.width / 2)}" fill="${style.color}" opacity="0">` +
          `<animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.2s" fill="freeze"/>` +
          `</circle>`,
      );
      return;
    }
    parts.push(
      `<polyline points="${pointsAttr(stroke)}" fill="none" stroke="${style?.color ?? "#277e78"}" stroke-width="${style?.width ?? 7}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">` +
        `<animate attributeName="stroke-dashoffset" from="1" to="0" begin="${begin}s" dur="${perStroke}s" fill="freeze"/>` +
        `</polyline>`,
    );
  });
  parts.push("</svg>");
  return parts.join("\n");
}

export function downloadTimelapse(
  strokes: Stroke[],
  height: number,
  title: string,
  filename: string,
) {
  const svg = buildTimelapseSvg(strokes, height, title);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
